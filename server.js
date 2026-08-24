import express from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import multer from 'multer';
import nodemailer from 'nodemailer';

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
// API: Get Recent Notifications & SMTP Status
// ---------------------------------------------
app.get('/api/admin/notifications', (req, res) => {
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
