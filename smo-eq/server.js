import 'dotenv/config';
import express from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import multer from 'multer';
import nodemailer from 'nodemailer';
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getAuth as getAdminAuth } from 'firebase-admin/auth';

// ─── Firebase Admin Init ───────────────────────────────────────────────────
// ใช้ GOOGLE_APPLICATION_CREDENTIALS (service account JSON path) หรือ
// Application Default Credentials (Cloud Run / GCE) อัตโนมัติ
if (!getApps().length) {
  try {
    if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
      // รองรับ inject JSON string ตรงๆ ผ่าน env (สำหรับ Cloud Run secrets)
      const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
      initializeApp({ credential: cert(serviceAccount) });
    } else {
      // Application Default Credentials (GOOGLE_APPLICATION_CREDENTIALS file path)
      initializeApp();
    }
    console.log('[Firebase Admin] Initialized successfully.');
  } catch (err) {
    console.warn('[Firebase Admin] Init failed — admin token verification will be DISABLED:', err.message);
  }
}

/**
 * Middleware: ตรวจ Firebase ID Token จาก Authorization: Bearer <token>
 * ถ้า Firebase Admin ยังไม่ได้ตั้งค่า (dev) → ผ่านได้ แต่ log warning
 */
async function verifyAdminToken(req, res, next) {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

  // ถ้า Admin SDK ยังไม่ init (dev without credentials) → แจ้ง warning แล้วผ่าน
  if (!getApps().length) {
    console.warn('[Auth] Firebase Admin not configured — skipping token check (dev mode)');
    return next();
  }

  if (!token) {
    return res.status(401).json({ success: false, message: 'Unauthorized: Missing token' });
  }

  try {
    req.adminUser = await getAdminAuth().verifyIdToken(token);
    next();
  } catch (err) {
    return res.status(403).json({ success: false, message: 'Forbidden: Invalid or expired token' });
  }
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;
const publicDir = path.join(__dirname, 'public');
const uploadDir = path.join(publicDir, 'uploads');

// Ensure uploads folder exists
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// In-memory / local notification log for audit & preview
const notificationLog = [];

// Middleware
app.use(express.json({ limit: '25mb' }));
app.use(express.urlencoded({ extended: true, limit: '25mb' }));
app.use(express.static(publicDir));
app.use('/uploads', express.static(uploadDir));

// Multer Storage Configuration
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname) || '.jpg';
    const cleanName = path.basename(file.originalname, ext).replace(/[^a-zA-Z0-9_-]/g, '_').substring(0, 30);
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e6);
    cb(null, `eq-${cleanName}-${uniqueSuffix}${ext}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('กรุณาอัปโหลดเฉพาะไฟล์รูปภาพ (JPEG, PNG, WebP, GIF)'));
    }
  }
});

// Helper: Setup Nodemailer Transporter
function getMailTransporter() {
  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const port = parseInt(process.env.SMTP_PORT || '587', 10);
  const secure = process.env.SMTP_SECURE === 'true' || port === 465;

  if (host && user && pass) {
    return nodemailer.createTransport({
      host,
      port,
      secure,
      auth: { user, pass }
    });
  }

  // If no SMTP configured, return null (fallback to in-memory notification log)
  return null;
}

// ---------------------------------------------
// API: Upload Equipment Image (File or Base64)
// ---------------------------------------------
app.post('/api/upload-image', upload.single('image'), (req, res) => {
  try {
    // 1. If uploaded via multipart/form-data
    if (req.file) {
      const relativePath = `/uploads/${req.file.filename}`;
      return res.json({
        success: true,
        imageUrl: relativePath,
        filename: req.file.filename,
        size: req.file.size
      });
    }

    // 2. If uploaded via Base64 JSON payload
    if (req.body && req.body.base64Image) {
      const base64Data = req.body.base64Image;
      const matches = base64Data.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
      
      let ext = '.jpg';
      let buffer;

      if (matches && matches.length === 3) {
        const mime = matches[1];
        if (mime.includes('png')) ext = '.png';
        else if (mime.includes('webp')) ext = '.webp';
        else if (mime.includes('gif')) ext = '.gif';
        buffer = Buffer.from(matches[2], 'base64');
      } else {
        buffer = Buffer.from(base64Data, 'base64');
      }

      const filename = `eq-base64-${Date.now()}-${Math.round(Math.random() * 1e6)}${ext}`;
      const filePath = path.join(uploadDir, filename);
      fs.writeFileSync(filePath, buffer);

      const relativePath = `/uploads/${filename}`;
      return res.json({
        success: true,
        imageUrl: relativePath,
        filename,
        size: buffer.length
      });
    }

    return res.status(400).json({ success: false, message: 'ไม่พบไฟล์รูปภาพที่อัปโหลด' });
  } catch (error) {
    console.error('Error in upload-image:', error);
    return res.status(500).json({ success: false, message: error.message || 'เกิดข้อผิดพลาดในการอัปโหลดรูปภาพ' });
  }
});

// ---------------------------------------------
// API: Send Email Notification to Admin for New Booking
// ---------------------------------------------
app.post('/api/notify-admin-booking', async (req, res) => {
  try {
    const {
      bookingId,
      equipmentName,
      equipmentCode,
      fullName,
      studentId,
      faculty,
      department,
      affiliation,
      startDate,
      endDate,
      activityName,
      reason,
      applicantEmail,
      applicantPhone
    } = req.body;

    const adminEmail = process.env.ADMIN_NOTIFICATION_EMAIL || 'skullgamer2405@gmail.com';
    const now = new Date();
    const formattedTimestamp = now.toLocaleString('th-TH', { timeZone: 'Asia/Bangkok' });

    // HTML Email Template
    const emailSubject = `🔔 [คำขอยืมอุปกรณ์ใหม่] ${equipmentName || 'อุปกรณ์'} - ${fullName || 'นักศึกษา'}`;
    const emailHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: 'Prompt', 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f1f5f9; margin: 0; padding: 20px; color: #1e293b; }
          .container { max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.08); border: 1px solid #e2e8f0; }
          .header { background: linear-gradient(135deg, #1a365d 0%, #2b6cb0 100%); color: #ffffff; padding: 24px 30px; text-align: center; }
          .header h1 { margin: 0; font-size: 20px; font-weight: 700; letter-spacing: 0.5px; }
          .header p { margin: 6px 0 0 0; font-size: 13px; opacity: 0.9; }
          .badge { display: inline-block; background: #f59e0b; color: #ffffff; font-size: 12px; font-weight: bold; padding: 4px 12px; border-radius: 9999px; margin-top: 10px; }
          .content { padding: 28px 30px; }
          .highlight-card { background: #eff6ff; border-left: 4px solid #1a365d; padding: 16px; border-radius: 8px; margin-bottom: 24px; }
          .highlight-card h2 { margin: 0 0 4px 0; font-size: 17px; color: #1a365d; }
          .highlight-card p { margin: 0; font-size: 13px; color: #64748b; }
          .table-info { width: 100%; border-collapse: collapse; margin-bottom: 24px; }
          .table-info td { padding: 10px 12px; font-size: 14px; border-bottom: 1px solid #f1f5f9; }
          .table-info td.label { width: 38%; color: #64748b; font-weight: 600; background: #f8fafc; }
          .table-info td.value { color: #0f172a; font-weight: 500; }
          .reason-box { background: #f8fafc; border: 1px dashed #cbd5e1; padding: 14px; border-radius: 8px; font-size: 13px; color: #334155; line-height: 1.6; margin-bottom: 24px; }
          .btn-container { text-align: center; margin: 28px 0 10px 0; }
          .btn-approve { display: inline-block; background: #f59e0b; color: #ffffff; text-decoration: none; padding: 12px 28px; border-radius: 10px; font-weight: 700; font-size: 14px; box-shadow: 0 2px 8px rgba(245,158,11,0.35); }
          .footer { background: #f8fafc; padding: 18px 30px; text-align: center; font-size: 12px; color: #94a3b8; border-top: 1px solid #e2e8f0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>สโมสรนักศึกษาราชวิทยาลัยจุฬาภรณ์</h1>
            <p>ระบบยืม-คืนอุปกรณ์สโมสรนักศึกษา (SMO.CRA Equipment)</p>
            <div class="badge">คำขอยืมอุปกรณ์ใหม่</div>
          </div>
          <div class="content">
            <div class="highlight-card">
              <h2>${equipmentName || 'อุปกรณ์'}</h2>
              <p>รหัสครุภัณฑ์/อุปกรณ์: <strong>${equipmentCode || '-'}</strong></p>
            </div>
            
            <table class="table-info">
              <tr>
                <td class="label">ผู้ขอยืม</td>
                <td class="value">${fullName || '-'}</td>
              </tr>
              <tr>
                <td class="label">รหัสนักศึกษา</td>
                <td class="value">${studentId || '-'}</td>
              </tr>
              <tr>
                <td class="label">คณะ / สาขาวิชา</td>
                <td class="value">${faculty || '-'} / ${department || '-'}</td>
              </tr>
              <tr>
                <td class="label">สังกัด</td>
                <td class="value">${affiliation || '-'}</td>
              </tr>
              <tr>
                <td class="label">ช่วงเวลาที่ขอยืม</td>
                <td class="value"><strong>${startDate || '-'}</strong> ถึง <strong>${endDate || '-'}</strong></td>
              </tr>
              <tr>
                <td class="label">โครงการ / กิจกรรม</td>
                <td class="value">${activityName || '-'}</td>
              </tr>
              ${applicantEmail ? `<tr><td class="label">อีเมลผู้ยืม</td><td class="value">${applicantEmail}</td></tr>` : ''}
              ${applicantPhone ? `<tr><td class="label">เบอร์ติดต่อ</td><td class="value">${applicantPhone}</td></tr>` : ''}
            </table>

            <div style="font-size: 13px; font-weight: 600; color: #475569; margin-bottom: 6px;">วัตถุประสงค์ในการยืม:</div>
            <div class="reason-box">
              ${reason || 'ไม่ได้ระบุ'}
            </div>

            <div class="btn-container">
              <a href="https://ais-dev-lywh6mc65jfa6xl6m37ab6-126087633678.asia-southeast1.run.app/admin.html" class="btn-approve" target="_blank">
                เข้าสู่ระบบแอดมินเพื่อตรวจสอบและอนุมัติ
              </a>
            </div>
          </div>
          <div class="footer">
            <p>ส่งเมื่อ: ${formattedTimestamp} (ICT)</p>
            <p>อีเมลแจ้งเตือนอัตโนมัติจากระบบ SMO Equipment Lending System</p>
          </div>
        </div>
      </body>
      </html>
    `;

    // Record in in-memory notification log
    const notificationEntry = {
      id: `notif-${Date.now()}`,
      bookingId: bookingId || `b-${Date.now()}`,
      recipient: adminEmail,
      subject: emailSubject,
      equipmentName,
      fullName,
      studentId,
      startDate,
      endDate,
      timestamp: formattedTimestamp,
      sentViaSMTP: false
    };

    const transporter = getMailTransporter();
    let sentSuccess = false;
    let transportError = null;

    if (transporter) {
      try {
        const sender = process.env.SMTP_FROM || `SMO.CRA Lending <${process.env.SMTP_USER || 'no-reply@smo.cra.ac.th'}>`;
        await transporter.sendMail({
          from: sender,
          to: adminEmail,
          subject: emailSubject,
          html: emailHtml
        });
        notificationEntry.sentViaSMTP = true;
        sentSuccess = true;
        console.log(`[Email Sent] New booking notification sent to ${adminEmail}`);
      } catch (err) {
        console.error('[SMTP Send Error]:', err);
        transportError = err.message;
      }
    } else {
      console.log(`[Notification Logged] SMTP not configured. Logged notification for admin (${adminEmail}) for booking ${equipmentName} by ${fullName}`);
    }

    notificationLog.unshift(notificationEntry);
    if (notificationLog.length > 50) notificationLog.pop();

    return res.json({
      success: true,
      deliveredToSMTP: sentSuccess,
      adminEmail,
      message: sentSuccess
        ? `ส่งอีเมลแจ้งเตือนไปยัง ${adminEmail} เรียบร้อยแล้ว`
        : `บันทึกการแจ้งเตือนสำหรับแอดมิน (${adminEmail}) เรียบร้อยแล้ว`,
      notification: notificationEntry,
      smtpConfigured: !!transporter,
      smtpError: transportError
    });
  } catch (error) {
    console.error('Error in notify-admin-booking:', error);
    return res.status(500).json({ success: false, message: error.message || 'เกิดข้อผิดพลาดในการส่งแจ้งเตือน' });
  }
});

// ---------------------------------------------
// API: Notify Borrower — Approved
// ---------------------------------------------
app.post('/api/notify-borrower-approved', async (req, res) => {
  try {
    const { bookingId, equipmentName, equipmentCode, fullName, applicantEmail, startDate, endDate, activityName } = req.body;

    if (!applicantEmail) {
      return res.json({ success: false, message: 'ไม่มีอีเมลผู้ยืม — ไม่ส่งอีเมล' });
    }

    const now = new Date();
    const formattedTimestamp = now.toLocaleString('th-TH', { timeZone: 'Asia/Bangkok' });
    const emailSubject = `✅ [อนุมัติแล้ว] คำขอยืม ${equipmentName || 'อุปกรณ์'} ได้รับการอนุมัติแล้ว — SMO.CRA`;

    const emailHtml = `
      <!DOCTYPE html><html><head><meta charset="utf-8">
        <style>
          body { font-family: 'Prompt','Segoe UI',sans-serif; background:#f1f5f9; margin:0; padding:20px; color:#1e293b; }
          .container { max-width:600px; margin:0 auto; background:#fff; border-radius:16px; overflow:hidden; box-shadow:0 4px 20px rgba(0,0,0,.08); border:1px solid #e2e8f0; }
          .header { background:linear-gradient(135deg,#065f46,#10b981); color:#fff; padding:24px 30px; text-align:center; }
          .header h1 { margin:0; font-size:20px; font-weight:700; }
          .header p { margin:6px 0 0; font-size:13px; opacity:.9; }
          .badge { display:inline-block; background:#fef3c7; color:#92400e; font-size:12px; font-weight:700; padding:4px 14px; border-radius:9999px; margin-top:10px; }
          .approved-banner { background:#ecfdf5; border:1px solid #6ee7b7; padding:18px 24px; margin:24px 30px 0; border-radius:12px; text-align:center; }
          .approved-banner h2 { margin:8px 0 4px; color:#065f46; font-size:18px; font-weight:700; }
          .approved-banner p { margin:0; color:#047857; font-size:13px; }
          .content { padding:20px 30px 28px; }
          .table-info { width:100%; border-collapse:collapse; margin-bottom:20px; }
          .table-info td { padding:10px 12px; font-size:14px; border-bottom:1px solid #f1f5f9; }
          .table-info td.label { width:40%; color:#64748b; font-weight:600; background:#f8fafc; }
          .table-info td.value { color:#0f172a; font-weight:500; }
          .note-box { background:#fffbeb; border-left:4px solid #f59e0b; padding:14px 16px; border-radius:0 8px 8px 0; font-size:13px; color:#78350f; margin-bottom:20px; }
          .footer { background:#f8fafc; padding:16px 30px; text-align:center; font-size:12px; color:#94a3b8; border-top:1px solid #e2e8f0; }
        </style>
      </head>
      <body><div class="container">
        <div class="header">
          <h1>สโมสรนักศึกษาราชวิทยาลัยจุฬาภรณ์</h1>
          <p>ระบบยืม-คืนอุปกรณ์สโมสรนักศึกษา (SMO.CRA Equipment)</p>
          <div class="badge">✅ คำขอได้รับการอนุมัติ</div>
        </div>
        <div class="approved-banner">
          <div style="font-size:40px">🎉</div>
          <h2>คำขอยืมอุปกรณ์ของคุณได้รับการอนุมัติแล้ว!</h2>
          <p>สามารถมารับอุปกรณ์ได้ตามวันเวลาที่กำหนดด้านล่าง</p>
        </div>
        <div class="content">
          <table class="table-info">
            <tr><td class="label">ผู้ยืม</td><td class="value">${fullName || '-'}</td></tr>
            <tr><td class="label">อุปกรณ์</td><td class="value">${equipmentName || '-'}${equipmentCode ? ` (${equipmentCode})` : ''}</td></tr>
            <tr><td class="label">โครงการ / กิจกรรม</td><td class="value">${activityName || '-'}</td></tr>
            <tr><td class="label">ช่วงเวลายืม</td><td class="value"><strong>${startDate || '-'}</strong> ถึง <strong>${endDate || '-'}</strong></td></tr>
          </table>
          <div class="note-box">📌 <strong>ข้อควรปฏิบัติ:</strong> กรุณานำบัตรนักศึกษามาแสดงเมื่อรับอุปกรณ์ และส่งคืนตามวันที่กำหนดในสภาพสมบูรณ์</div>
          <p style="font-size:13px;color:#64748b;text-align:center">หากมีข้อสงสัย ติดต่อสโมสรนักศึกษาได้โดยตรง</p>
        </div>
        <div class="footer"><p>ส่งเมื่อ: ${formattedTimestamp} (ICT)</p><p>อีเมลแจ้งเตือนอัตโนมัติจากระบบ SMO Equipment Lending System</p></div>
      </div></body></html>
    `;

    const transporter = getMailTransporter();
    let sentSuccess = false;
    let transportError = null;
    if (transporter) {
      try {
        const sender = process.env.SMTP_FROM || `SMO.CRA Lending <${process.env.SMTP_USER || 'no-reply@smo.cra.ac.th'}>`;
        await transporter.sendMail({ from: sender, to: applicantEmail, subject: emailSubject, html: emailHtml });
        sentSuccess = true;
        console.log(`[Email Sent] Approval notification → ${applicantEmail}`);
      } catch (err) {
        console.error('[SMTP Error - Approval]:', err);
        transportError = err.message;
      }
    } else {
      console.log(`[Notification Logged] Approval notification logged for ${applicantEmail} (SMTP not configured)`);
    }

    return res.json({
      success: true, deliveredToSMTP: sentSuccess, applicantEmail,
      message: sentSuccess ? `ส่งอีเมลแจ้งอนุมัติไปยัง ${applicantEmail} เรียบร้อยแล้ว` : `บันทึกการแจ้งเตือน (SMTP ยังไม่ได้ตั้งค่า)`,
      smtpConfigured: !!transporter, smtpError: transportError
    });
  } catch (error) {
    console.error('Error in notify-borrower-approved:', error);
    return res.status(500).json({ success: false, message: error.message || 'เกิดข้อผิดพลาด' });
  }
});

// ---------------------------------------------
// API: Notify Borrower — Rejected
// ---------------------------------------------
app.post('/api/notify-borrower-rejected', async (req, res) => {
  try {
    const { equipmentName, fullName, applicantEmail, adminNote } = req.body;

    if (!applicantEmail) {
      return res.json({ success: false, message: 'ไม่มีอีเมลผู้ยืม — ไม่ส่งอีเมล' });
    }

    const now = new Date();
    const formattedTimestamp = now.toLocaleString('th-TH', { timeZone: 'Asia/Bangkok' });
    const emailSubject = `❌ [ไม่อนุมัติ] คำขอยืม ${equipmentName || 'อุปกรณ์'} — SMO.CRA Equipment`;

    const emailHtml = `
      <!DOCTYPE html><html><head><meta charset="utf-8">
        <style>
          body { font-family:'Prompt','Segoe UI',sans-serif; background:#f1f5f9; margin:0; padding:20px; color:#1e293b; }
          .container { max-width:600px; margin:0 auto; background:#fff; border-radius:16px; overflow:hidden; box-shadow:0 4px 20px rgba(0,0,0,.08); border:1px solid #e2e8f0; }
          .header { background:linear-gradient(135deg,#7f1d1d,#dc2626); color:#fff; padding:24px 30px; text-align:center; }
          .header h1 { margin:0; font-size:20px; font-weight:700; }
          .header p { margin:6px 0 0; font-size:13px; opacity:.9; }
          .badge { display:inline-block; background:#fee2e2; color:#991b1b; font-size:12px; font-weight:700; padding:4px 14px; border-radius:9999px; margin-top:10px; }
          .rejected-banner { background:#fef2f2; border:1px solid #fca5a5; padding:18px 24px; margin:24px 30px 0; border-radius:12px; text-align:center; }
          .rejected-banner h2 { margin:8px 0 4px; color:#991b1b; font-size:18px; font-weight:700; }
          .rejected-banner p { margin:0; color:#dc2626; font-size:13px; }
          .content { padding:20px 30px 28px; }
          .reason-box { background:#fffbeb; border-left:4px solid #eab308; padding:14px 16px; border-radius:0 8px 8px 0; font-size:13px; color:#713f12; margin:16px 0; }
          .retry-box { background:#eff6ff; border:1px solid #bfdbfe; padding:14px 16px; border-radius:8px; font-size:13px; color:#1e40af; margin-bottom:16px; }
          .footer { background:#f8fafc; padding:16px 30px; text-align:center; font-size:12px; color:#94a3b8; border-top:1px solid #e2e8f0; }
        </style>
      </head>
      <body><div class="container">
        <div class="header">
          <h1>สโมสรนักศึกษาราชวิทยาลัยจุฬาภรณ์</h1>
          <p>ระบบยืม-คืนอุปกรณ์สโมสรนักศึกษา (SMO.CRA Equipment)</p>
          <div class="badge">❌ ไม่อนุมัติคำขอ</div>
        </div>
        <div class="rejected-banner">
          <div style="font-size:40px">😔</div>
          <h2>ขออภัย คำขอยืมอุปกรณ์ไม่ได้รับการอนุมัติ</h2>
          <p>คำขอยืม "${equipmentName || 'อุปกรณ์'}" ของคุณ ${fullName || ''}</p>
        </div>
        <div class="content">
          ${adminNote ? `<div class="reason-box">📋 <strong>เหตุผลจากแอดมิน:</strong><br>${adminNote}</div>` : ''}
          <div class="retry-box">💡 <strong>สามารถทำรายการใหม่ได้:</strong> หากมีอุปกรณ์อื่นที่ต้องการ หรือต้องการเปลี่ยนช่วงเวลา สามารถยื่นคำขอใหม่ได้ที่ระบบ SMO Equipment</div>
          <p style="font-size:13px;color:#64748b;text-align:center">หากมีข้อสงสัย ติดต่อสโมสรนักศึกษาได้โดยตรง</p>
        </div>
        <div class="footer"><p>ส่งเมื่อ: ${formattedTimestamp} (ICT)</p><p>อีเมลแจ้งเตือนอัตโนมัติจากระบบ SMO Equipment Lending System</p></div>
      </div></body></html>
    `;

    const transporter = getMailTransporter();
    let sentSuccess = false;
    let transportError = null;
    if (transporter) {
      try {
        const sender = process.env.SMTP_FROM || `SMO.CRA Lending <${process.env.SMTP_USER || 'no-reply@smo.cra.ac.th'}>`;
        await transporter.sendMail({ from: sender, to: applicantEmail, subject: emailSubject, html: emailHtml });
        sentSuccess = true;
        console.log(`[Email Sent] Rejection notification → ${applicantEmail}`);
      } catch (err) {
        console.error('[SMTP Error - Rejection]:', err);
        transportError = err.message;
      }
    } else {
      console.log(`[Notification Logged] Rejection notification logged for ${applicantEmail} (SMTP not configured)`);
    }

    return res.json({
      success: true, deliveredToSMTP: sentSuccess, applicantEmail,
      message: sentSuccess ? `ส่งอีเมลแจ้งปฏิเสธไปยัง ${applicantEmail} เรียบร้อยแล้ว` : `บันทึกการแจ้งเตือน (SMTP ยังไม่ได้ตั้งค่า)`,
      smtpConfigured: !!transporter, smtpError: transportError
    });
  } catch (error) {
    console.error('Error in notify-borrower-rejected:', error);
    return res.status(500).json({ success: false, message: error.message || 'เกิดข้อผิดพลาด' });
  }
});

// ---------------------------------------------
// API: Get Recent Notifications & SMTP Status
// ---------------------------------------------
app.get('/api/admin/notifications', verifyAdminToken, (req, res) => {
  const transporter = getMailTransporter();
  res.json({
    success: true,
    adminEmail: process.env.ADMIN_NOTIFICATION_EMAIL || 'skullgamer2405@gmail.com',
    smtpConfigured: !!transporter,
    recentNotifications: notificationLog
  });
});

// HTML page routes
app.get('/', (req, res) => {
  res.sendFile(path.join(publicDir, 'index.html'));
});

app.get('/equipment', (req, res) => {
  res.sendFile(path.join(publicDir, 'equipment.html'));
});

app.get('/calendar', (req, res) => {
  res.sendFile(path.join(publicDir, 'calendar.html'));
});

app.get('/booking', (req, res) => {
  res.sendFile(path.join(publicDir, 'booking.html'));
});

app.get('/admin', (req, res) => {
  res.sendFile(path.join(publicDir, 'admin.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running at http://0.0.0.0:${PORT}`);
});
