// ============================================
// QR Code Helper & Scanner Utility Module
// SMO.CRA Equipment Lending System
// ============================================

/**
 * Generate QR Code Data URL using QRCode library (with fallback)
 * @param {string} text - URL or text to encode
 * @param {object} options - Generation options
 * @returns {Promise<string>} Data URL (image/png)
 */
export async function generateQRCodeDataUrl(text, options = {}) {
  const defaultOpts = {
    width: options.width || 300,
    margin: options.margin || 2,
    color: {
      dark: '#1a365d',
      light: '#ffffff'
    },
    errorCorrectionLevel: 'H'
  };

  // 1. Try global window.QRCode (from qrcode.min.js)
  if (typeof window !== 'undefined' && window.QRCode && typeof window.QRCode.toDataURL === 'function') {
    try {
      return await window.QRCode.toDataURL(text, defaultOpts);
    } catch (e) {
      console.warn('window.QRCode error:', e);
    }
  }

  // 2. Fallback to Google Chart API or QR Server API for reliable image rendering
  const encodedText = encodeURIComponent(text);
  const size = options.width || 300;
  return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodedText}&color=1a365d&bgcolor=ffffff&margin=1`;
}

/**
 * Show Equipment QR Code Modal with Download, Print, and Copy actions
 * @param {object} equipment - Equipment object {id, title, assetCode, category, status, imageUrl}
 */
export async function showEquipmentQRModal(equipment) {
  if (!equipment) return;

  // Build target URL
  const origin = window.location.origin;
  const bookingUrl = `${origin}/booking.html?id=${encodeURIComponent(equipment.id)}`;
  
  // Ensure modal container exists in DOM
  let modalContainer = document.getElementById('equipment-qr-modal');
  if (!modalContainer) {
    modalContainer = document.createElement('div');
    modalContainer.id = 'equipment-qr-modal';
    modalContainer.className = 'fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs transition-opacity duration-200';
    document.body.appendChild(modalContainer);
  }

  const isAvailable = equipment.status === 'available';
  const statusBadge = isAvailable
    ? `<span class="px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-700 font-['Prompt'] flex items-center gap-1">
        <span class="w-1.5 h-1.5 rounded-full bg-emerald-500"></span> พร้อมใช้งาน
       </span>`
    : `<span class="px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-100 text-rose-700 font-['Prompt'] flex items-center gap-1">
        <span class="w-1.5 h-1.5 rounded-full bg-rose-500"></span> ไม่ว่าง
       </span>`;

  // Render modal structure
  modalContainer.innerHTML = `
    <div class="bg-white rounded-3xl shadow-2xl border border-gray-100 w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200 flex flex-col max-h-[92vh]">
      <!-- Header -->
      <div class="bg-gradient-to-r from-[#1a365d] to-[#2a4d7d] p-5 text-white flex items-center justify-between">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-xl bg-white/15 backdrop-blur-md flex items-center justify-center text-secondary border border-white/20">
            <span class="material-symbols-outlined text-2xl">qr_code_2</span>
          </div>
          <div>
            <h3 class="font-['Prompt'] text-base font-bold leading-tight">QR Code สำหรับอุปกรณ์</h3>
            <p class="text-xs text-blue-100 font-['Sarabun']">สแกนเพื่อดูรายละเอียดและส่งคำขอยืม</p>
          </div>
        </div>
        <button id="qr-modal-close-btn" class="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors cursor-pointer" title="ปิด">
          <span class="material-symbols-outlined text-lg">close</span>
        </button>
      </div>

      <!-- Modal Body -->
      <div class="p-6 overflow-y-auto flex-1 flex flex-col items-center text-center space-y-4">
        <!-- Equipment Header Info -->
        <div class="w-full bg-slate-50 p-3.5 rounded-2xl border border-gray-100 text-left flex items-start gap-3">
          <div class="w-12 h-12 rounded-xl bg-white border border-gray-200 overflow-hidden shrink-0">
            <img src="${equipment.imageUrl || 'https://placehold.co/200x200/1a365d/white?text=SMO'}" alt="${equipment.title}" class="w-full h-full object-cover" onerror="this.src='https://placehold.co/200x200/1a365d/white?text=SMO'">
          </div>
          <div class="flex-1 min-w-0">
            <div class="flex items-center justify-between gap-2">
              <span class="text-xs font-mono font-bold text-primary bg-blue-100/70 px-2 py-0.5 rounded">${equipment.assetCode || '-'}</span>
              ${statusBadge}
            </div>
            <h4 class="font-['Prompt'] text-sm font-bold text-slate-800 truncate mt-1">${equipment.title || 'อุปกรณ์'}</h4>
            <p class="text-[11px] text-gray-500 font-['Sarabun']">${equipment.category || 'หมวดหมู่อุปกรณ์'}</p>
          </div>
        </div>

        <!-- QR Code Display Box -->
        <div class="relative bg-white p-4 rounded-2xl border-2 border-dashed border-gray-200 shadow-inner flex flex-col items-center justify-center min-h-[220px] w-[220px]">
          <div id="qr-canvas-container" class="w-[190px] h-[190px] flex items-center justify-center">
            <div class="w-8 h-8 border-3 border-primary border-t-transparent rounded-full animate-spin"></div>
          </div>
          <span class="mt-2 text-[10px] text-gray-400 font-['Prompt'] tracking-wider">SMO.CRA LENDING SYSTEM</span>
        </div>

        <!-- Direct URL Copy -->
        <div class="w-full">
          <div class="flex items-center gap-1.5 bg-gray-50 p-2 rounded-xl border border-gray-200 text-left">
            <span class="material-symbols-outlined text-gray-400 text-sm pl-1">link</span>
            <input type="text" readonly value="${bookingUrl}" class="flex-1 bg-transparent text-xs text-gray-600 font-mono outline-none select-all overflow-hidden text-ellipsis">
            <button id="qr-copy-url-btn" class="px-2.5 py-1 bg-white hover:bg-gray-100 text-slate-700 text-xs font-['Prompt'] font-medium rounded-lg border border-gray-200 shadow-2xs transition-all flex items-center gap-1 shrink-0">
              <span class="material-symbols-outlined text-xs">content_copy</span> คัดลอก
            </button>
          </div>
        </div>

        <!-- Action Buttons -->
        <div class="w-full grid grid-cols-2 gap-2.5 pt-1">
          <button id="qr-download-btn" class="py-2.5 px-3 bg-white hover:bg-slate-50 text-primary border border-primary/30 rounded-xl font-['Prompt'] text-xs font-semibold transition-all flex items-center justify-center gap-1.5 shadow-2xs">
            <span class="material-symbols-outlined text-base">download</span> บันทึกรูป QR
          </button>
          <button id="qr-print-btn" class="py-2.5 px-3 bg-white hover:bg-slate-50 text-slate-700 border border-gray-300 rounded-xl font-['Prompt'] text-xs font-semibold transition-all flex items-center justify-center gap-1.5 shadow-2xs">
            <span class="material-symbols-outlined text-base">print</span> พิมพ์ป้ายแท็ก
          </button>
        </div>
      </div>

      <!-- Footer CTA -->
      <div class="p-4 bg-slate-50 border-t border-gray-100 flex gap-2">
        <a href="${bookingUrl}" class="flex-1 py-2.5 bg-secondary hover:bg-amber-600 text-white rounded-xl font-['Prompt'] text-xs font-bold transition-all shadow-sm flex items-center justify-center gap-1.5">
          <span class="material-symbols-outlined text-base">arrow_forward</span> ไปยังหน้าขอยืมอุปกรณ์
        </a>
      </div>
    </div>
  `;

  modalContainer.classList.remove('hidden');

  // Close handlers
  const closeBtn = document.getElementById('qr-modal-close-btn');
  if (closeBtn) closeBtn.onclick = () => modalContainer.classList.add('hidden');
  modalContainer.onclick = (e) => {
    if (e.target === modalContainer) modalContainer.classList.add('hidden');
  };

  // Generate QR Code
  let qrDataUrl = '';
  try {
    qrDataUrl = await generateQRCodeDataUrl(bookingUrl, { width: 300 });
    const qrContainer = document.getElementById('qr-canvas-container');
    if (qrContainer) {
      qrContainer.innerHTML = `<img src="${qrDataUrl}" alt="QR Code for ${equipment.title}" class="w-full h-full object-contain rounded-lg">`;
    }
  } catch (err) {
    console.error('Failed to generate QR Code:', err);
    const qrContainer = document.getElementById('qr-canvas-container');
    if (qrContainer) {
      qrContainer.innerHTML = `<div class="text-xs text-red-500 font-['Sarabun']">ไม่สามารถสร้าง QR Code ได้</div>`;
    }
  }

  // Copy Link Button
  const copyBtn = document.getElementById('qr-copy-url-btn');
  if (copyBtn) {
    copyBtn.onclick = async () => {
      try {
        await navigator.clipboard.writeText(bookingUrl);
        copyBtn.innerHTML = '<span class="material-symbols-outlined text-xs text-emerald-600">check</span> คัดลอกแล้ว!';
        copyBtn.classList.add('bg-emerald-50', 'text-emerald-700', 'border-emerald-200');
        setTimeout(() => {
          copyBtn.innerHTML = '<span class="material-symbols-outlined text-xs">content_copy</span> คัดลอก';
          copyBtn.classList.remove('bg-emerald-50', 'text-emerald-700', 'border-emerald-200');
        }, 2000);
      } catch (err) {
        // Fallback prompt
        window.prompt('คัดลอกลิงก์:', bookingUrl);
      }
    };
  }

  // Download QR PNG Card
  const downloadBtn = document.getElementById('qr-download-btn');
  if (downloadBtn) {
    downloadBtn.onclick = () => {
      downloadEquipmentQRCard(equipment, qrDataUrl, bookingUrl);
    };
  }

  // Print Label Tag
  const printBtn = document.getElementById('qr-print-btn');
  if (printBtn) {
    printBtn.onclick = () => {
      printEquipmentLabel(equipment, qrDataUrl, bookingUrl);
    };
  }
}

/**
 * Generate and download a polished printable sticker card image (Canvas -> PNG)
 */
export function downloadEquipmentQRCard(equipment, qrDataUrl, targetUrl) {
  const canvas = document.createElement('canvas');
  canvas.width = 600;
  canvas.height = 800;
  const ctx = canvas.getContext('2d');

  // Background
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Border & Shadow outline
  ctx.strokeStyle = '#cbd5e1';
  ctx.lineWidth = 4;
  ctx.strokeRect(16, 16, canvas.width - 32, canvas.height - 32);

  // Header Banner
  ctx.fillStyle = '#1a365d';
  ctx.fillRect(16, 16, canvas.width - 32, 120);

  // Header Text
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 28px "Prompt", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('สโมสรนักศึกษาราชวิทยาลัยจุฬาภรณ์', canvas.width / 2, 65);

  ctx.fillStyle = '#f59e0b';
  ctx.font = 'bold 18px "Prompt", sans-serif';
  ctx.fillText('SMO.CRA EQUIPMENT LENDING SYSTEM', canvas.width / 2, 105);

  // Equipment Title & Code Box
  ctx.fillStyle = '#f8fafc';
  ctx.fillRect(36, 156, canvas.width - 72, 100);
  ctx.strokeStyle = '#e2e8f0';
  ctx.lineWidth = 2;
  ctx.strokeRect(36, 156, canvas.width - 72, 100);

  ctx.fillStyle = '#0f172a';
  ctx.font = 'bold 24px "Prompt", sans-serif';
  ctx.textAlign = 'center';
  const title = (equipment.title || 'อุปกรณ์').substring(0, 35);
  ctx.fillText(title, canvas.width / 2, 198);

  ctx.fillStyle = '#1a365d';
  ctx.font = 'bold 18px "Courier New", monospace';
  ctx.fillText(`รหัส: ${equipment.assetCode || '-'}  |  หมวด: ${equipment.category || '-'}`, canvas.width / 2, 234);

  // Draw QR Code image onto canvas
  const qrImg = new Image();
  qrImg.crossOrigin = 'anonymous';
  qrImg.onload = () => {
    // QR Code Container Box
    const qrSize = 340;
    const qrX = (canvas.width - qrSize) / 2;
    const qrY = 276;
    ctx.drawImage(qrImg, qrX, qrY, qrSize, qrSize);

    // Call to Action footer
    ctx.fillStyle = '#475569';
    ctx.font = '500 18px "Sarabun", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('สแกน QR Code ด้วยมือถือเพื่อตรวจสอบข้อมูลและยืมอุปกรณ์', canvas.width / 2, 650);

    ctx.fillStyle = '#94a3b8';
    ctx.font = '14px "Sarabun", sans-serif';
    ctx.fillText('Equipment by SMO • ฝ่ายพัสดุและอุปกรณ์สโมสรนักศึกษา', canvas.width / 2, 680);

    // Bottom decorative bar
    ctx.fillStyle = '#f59e0b';
    ctx.fillRect(36, 715, canvas.width - 72, 8);

    // Download trigger
    const filename = `QR-${(equipment.assetCode || equipment.title || 'equipment').replace(/[^a-zA-Z0-9_-]/g, '_')}.png`;
    const link = document.createElement('a');
    link.download = filename;
    link.href = canvas.toDataURL('image/png');
    link.click();
  };
  qrImg.src = qrDataUrl;
}

/**
 * Open print dialog for a single equipment tag
 */
export function printEquipmentLabel(equipment, qrDataUrl, targetUrl) {
  const printWin = window.open('', '_blank', 'width=600,height=700');
  if (!printWin) {
    alert('กรุณาอนุญาต Pop-up เพื่อเปิดหน้าพิมพ์ป้ายแท็ก');
    return;
  }

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>ป้ายแท็ก QR Code - ${equipment.title}</title>
      <style>
        @page { size: auto; margin: 10mm; }
        body { font-family: 'Prompt', 'Segoe UI', Tahoma, sans-serif; background: #fff; margin: 0; padding: 20px; display: flex; justify-content: center; }
        .label-card {
          width: 380px;
          border: 2px solid #1a365d;
          border-radius: 16px;
          overflow: hidden;
          text-align: center;
          background: #fff;
          box-shadow: 0 4px 12px rgba(0,0,0,0.1);
        }
        .header { background: #1a365d; color: #fff; padding: 12px; }
        .header h1 { margin: 0; font-size: 16px; font-weight: 700; }
        .header p { margin: 2px 0 0 0; font-size: 11px; color: #f59e0b; font-weight: 600; }
        .content { padding: 16px; }
        .eq-title { font-size: 18px; font-weight: 700; color: #0f172a; margin: 0 0 4px 0; }
        .eq-code { font-family: monospace; font-size: 14px; font-weight: 700; color: #1a365d; background: #e0f2fe; display: inline-block; padding: 3px 10px; border-radius: 6px; margin-bottom: 12px; }
        .qr-box { margin: 0 auto 12px auto; width: 200px; height: 200px; }
        .qr-box img { width: 100%; height: 100%; object-fit: contain; }
        .instruction { font-size: 12px; color: #475569; margin: 0 0 6px 0; }
        .footer { font-size: 10px; color: #94a3b8; border-top: 1px solid #e2e8f0; padding-top: 8px; }
        @media print {
          body { padding: 0; }
          .label-card { box-shadow: none; }
          .no-print { display: none; }
        }
      </style>
    </head>
    <body>
      <div>
        <div class="no-print" style="margin-bottom: 15px; text-align: center;">
          <button onclick="window.print()" style="background: #1a365d; color: #fff; border: none; padding: 10px 20px; font-size: 14px; font-weight: bold; border-radius: 8px; cursor: pointer;">
            🖨️ กดสั่งพิมพ์ป้ายแท็ก (Print Label)
          </button>
        </div>
        <div class="label-card">
          <div class="header">
            <h1>สโมสรนักศึกษาราชวิทยาลัยจุฬาภรณ์</h1>
            <p>SMO.CRA EQUIPMENT LENDING SYSTEM</p>
          </div>
          <div class="content">
            <h2 class="eq-title">${equipment.title}</h2>
            <div class="eq-code">รหัส: ${equipment.assetCode || '-'}</div>
            <div class="qr-box">
              <img src="${qrDataUrl}" alt="QR Code">
            </div>
            <p class="instruction">สแกน QR Code ด้วยมือถือเพื่อดูข้อมูลและยืมอุปกรณ์</p>
            <div class="footer">
              หมวดหมู่: ${equipment.category || '-'} • ฝ่ายพัสดุและอุปกรณ์ สโมสรนักศึกษา
            </div>
          </div>
        </div>
      </div>
    </body>
    </html>
  `;

  printWin.document.write(html);
  printWin.document.close();
}

/**
 * Batch Print all equipment labels in the inventory (for Admins)
 */
export async function printBatchEquipmentLabels(equipmentList) {
  if (!equipmentList || equipmentList.length === 0) {
    alert('ไม่พบรายการอุปกรณ์สำหรับพิมพ์');
    return;
  }

  const origin = window.location.origin;
  const printWin = window.open('', '_blank', 'width=900,height=900');
  if (!printWin) {
    alert('กรุณาอนุญาต Pop-up เพื่อเปิดหน้าพิมพ์ป้ายแท็ก');
    return;
  }

  // Pre-generate QR data URLs for all items
  const itemsWithQR = await Promise.all(equipmentList.map(async (eq) => {
    const bookingUrl = `${origin}/booking.html?id=${encodeURIComponent(eq.id)}`;
    let qrUrl = '';
    try {
      qrUrl = await generateQRCodeDataUrl(bookingUrl, { width: 220 });
    } catch (e) {
      qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(bookingUrl)}`;
    }
    return { ...eq, qrUrl };
  }));

  const cardsHtml = itemsWithQR.map(item => `
    <div class="label-card">
      <div class="header">
        <h1>สโมสรนักศึกษาราชวิทยาลัยจุฬาภรณ์</h1>
        <p>SMO.CRA EQUIPMENT</p>
      </div>
      <div class="content">
        <h2 class="eq-title">${item.title}</h2>
        <div class="eq-code">รหัส: ${item.assetCode || '-'}</div>
        <div class="qr-box">
          <img src="${item.qrUrl}" alt="QR Code">
        </div>
        <p class="instruction">สแกนเพื่อตรวจสอบและยืมอุปกรณ์</p>
        <div class="footer">
          หมวด: ${item.category || '-'} • SMO.CRA
        </div>
      </div>
    </div>
  `).join('');

  const fullHtml = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>พิมพ์ป้ายแท็กอุปกรณ์ทั้งหมด (${equipmentList.length} รายการ)</title>
      <style>
        @page { size: A4; margin: 8mm; }
        body { font-family: 'Prompt', 'Segoe UI', Tahoma, sans-serif; background: #f8fafc; margin: 0; padding: 20px; }
        .no-print { text-align: center; margin-bottom: 20px; }
        .grid-container {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 16px;
        }
        .label-card {
          border: 2px solid #1a365d;
          border-radius: 12px;
          overflow: hidden;
          text-align: center;
          background: #fff;
          page-break-inside: avoid;
        }
        .header { background: #1a365d; color: #fff; padding: 8px 10px; }
        .header h1 { margin: 0; font-size: 13px; font-weight: 700; }
        .header p { margin: 2px 0 0 0; font-size: 10px; color: #f59e0b; font-weight: 600; }
        .content { padding: 12px 10px; }
        .eq-title { font-size: 14px; font-weight: 700; color: #0f172a; margin: 0 0 2px 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .eq-code { font-family: monospace; font-size: 12px; font-weight: 700; color: #1a365d; background: #e0f2fe; display: inline-block; padding: 2px 8px; border-radius: 4px; margin-bottom: 8px; }
        .qr-box { margin: 0 auto 6px auto; width: 140px; height: 140px; }
        .qr-box img { width: 100%; height: 100%; object-fit: contain; }
        .instruction { font-size: 10px; color: #475569; margin: 0 0 4px 0; }
        .footer { font-size: 9px; color: #94a3b8; border-top: 1px solid #e2e8f0; padding-top: 4px; }
        @media print {
          body { background: #fff; padding: 0; }
          .no-print { display: none; }
          .grid-container { gap: 10px; }
        }
      </style>
    </head>
    <body>
      <div class="no-print">
        <h2 style="margin: 0 0 10px 0; color: #1a365d;">พิมพ์ป้ายแท็กอุปกรณ์ทั้งหมด (${equipmentList.length} รายการ)</h2>
        <button onclick="window.print()" style="background: #1a365d; color: #fff; border: none; padding: 10px 24px; font-size: 15px; font-weight: bold; border-radius: 8px; cursor: pointer;">
          🖨️ สั่งพิมพ์ (Print Labels - A4)
        </button>
      </div>
      <div class="grid-container">
        ${cardsHtml}
      </div>
    </body>
    </html>
  `;

  printWin.document.write(fullHtml);
  printWin.document.close();
}

/**
 * Open QR Scanner Modal for Students & Users
 */
export function openQRScannerModal() {
  let modal = document.getElementById('qr-scanner-modal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'qr-scanner-modal';
    modal.className = 'fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-xs';
    document.body.appendChild(modal);
  }

  modal.innerHTML = `
    <div class="bg-white rounded-3xl shadow-2xl border border-gray-100 w-full max-w-md overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-200">
      <!-- Header -->
      <div class="bg-gradient-to-r from-[#1a365d] to-[#2a4d7d] p-5 text-white flex items-center justify-between">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-xl bg-white/15 backdrop-blur-md flex items-center justify-center text-secondary border border-white/20">
            <span class="material-symbols-outlined text-2xl">document_scanner</span>
          </div>
          <div>
            <h3 class="font-['Prompt'] text-base font-bold leading-tight">สแกน QR Code อุปกรณ์</h3>
            <p class="text-xs text-blue-100 font-['Sarabun']">สแกนป้ายที่ติดบนตัวอุปกรณ์เพื่อเปิดหน้าขอยืม</p>
          </div>
        </div>
        <button id="scanner-close-btn" class="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors cursor-pointer" title="ปิด">
          <span class="material-symbols-outlined text-lg">close</span>
        </button>
      </div>

      <!-- Scanner Area -->
      <div class="p-6 flex flex-col items-center space-y-4">
        <!-- Interactive Camera / Video Container -->
        <div class="relative w-full aspect-square bg-slate-900 rounded-2xl overflow-hidden shadow-inner flex flex-col items-center justify-center border-2 border-slate-700">
          <video id="qr-scanner-video" class="w-full h-full object-cover hidden" playsinline></video>
          <canvas id="qr-scanner-canvas" class="hidden"></canvas>
          
          <!-- Viewfinder Overlay -->
          <div id="scanner-reticle" class="absolute inset-8 border-2 border-secondary/80 rounded-xl pointer-events-none flex flex-col justify-between p-2">
            <div class="flex justify-between">
              <span class="w-4 h-4 border-t-3 border-l-3 border-secondary rounded-tl"></span>
              <span class="w-4 h-4 border-t-3 border-r-3 border-secondary rounded-tr"></span>
            </div>
            <div class="flex justify-between">
              <span class="w-4 h-4 border-b-3 border-l-3 border-secondary rounded-bl"></span>
              <span class="w-4 h-4 border-b-3 border-r-3 border-secondary rounded-br"></span>
            </div>
          </div>

          <!-- Camera Placeholder / Start Prompt -->
          <div id="scanner-prompt" class="text-center p-4 text-white z-10 flex flex-col items-center">
            <span class="material-symbols-outlined text-5xl text-secondary mb-2 animate-bounce">center_focus_strong</span>
            <p class="font-['Prompt'] text-sm font-semibold">เล็งกล้องไปที่ QR Code อุปกรณ์</p>
            <p class="text-xs text-gray-400 font-['Sarabun'] mt-1">ระบบจะเปิดหน้าขอยืมอุปกรณ์ให้อัตโนมัติ</p>
            <button id="start-camera-btn" class="mt-4 px-4 py-2 bg-secondary hover:bg-amber-600 text-white rounded-xl font-['Prompt'] text-xs font-bold shadow-md transition-all flex items-center gap-1.5 cursor-pointer">
              <span class="material-symbols-outlined text-base">photo_camera</span> เปิดกล้องสแกน
            </button>
          </div>

          <!-- Scanner Status indicator -->
          <div id="scanner-status" class="absolute bottom-3 left-3 right-3 text-center py-1 bg-black/60 backdrop-blur-sm text-white text-[11px] rounded-lg hidden font-['Prompt']">
            กำลังตรวจจับ QR Code...
          </div>
        </div>

        <!-- Or Upload QR Image file -->
        <div class="w-full pt-1">
          <input id="qr-file-scan-input" type="file" accept="image/*" class="hidden">
          <button id="qr-upload-scan-btn" class="w-full py-2.5 px-4 bg-slate-50 hover:bg-blue-50 text-primary border border-gray-200 rounded-xl font-['Prompt'] text-xs font-semibold transition-all flex items-center justify-center gap-2 cursor-pointer">
            <span class="material-symbols-outlined text-base">image</span> หรือเลือกภาพ QR Code จากเครื่อง
          </button>
        </div>
      </div>
    </div>
  `;

  modal.classList.remove('hidden');

  let stream = null;
  let scanAnimationId = null;

  const closeScanner = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      stream = null;
    }
    if (scanAnimationId) {
      cancelAnimationFrame(scanAnimationId);
      scanAnimationId = null;
    }
    modal.classList.add('hidden');
  };

  const closeBtn = document.getElementById('scanner-close-btn');
  if (closeBtn) closeBtn.onclick = closeScanner;
  modal.onclick = (e) => {
    if (e.target === modal) closeScanner();
  };

  const startCameraBtn = document.getElementById('start-camera-btn');
  const video = document.getElementById('qr-scanner-video');
  const canvas = document.getElementById('qr-scanner-canvas');
  const promptEl = document.getElementById('scanner-prompt');
  const statusEl = document.getElementById('scanner-status');

  const startCamera = async () => {
    try {
      if (promptEl) promptEl.classList.add('hidden');
      if (statusEl) {
        statusEl.classList.remove('hidden');
        statusEl.textContent = 'กำลังเปิดกล้อง...';
      }

      stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' }
      });

      if (video) {
        video.srcObject = stream;
        video.classList.remove('hidden');
        video.play();
        
        if (statusEl) statusEl.textContent = 'กำลังสแกน... เล็ง QR Code ในกรอบ';
        scanFrame();
      }
    } catch (err) {
      console.warn('Camera access error:', err);
      if (promptEl) {
        promptEl.classList.remove('hidden');
        promptEl.innerHTML = `
          <span class="material-symbols-outlined text-4xl text-rose-400 mb-2">videocam_off</span>
          <p class="font-['Prompt'] text-sm font-semibold text-rose-300">ไม่สามารถเข้าถึงกล้องได้</p>
          <p class="text-xs text-gray-400 font-['Sarabun'] mt-1">กรุณาอนุญาตสิทธิ์การใช้งานกล้อง หรือใช้การเลือกไฟล์ภาพแทน</p>
        `;
      }
      if (statusEl) statusEl.classList.add('hidden');
    }
  };

  if (startCameraBtn) startCameraBtn.onclick = startCamera;

  // Frame scanning using native BarcodeDetector or jsQR if available
  const scanFrame = () => {
    if (!video || video.readyState !== video.HAVE_ENOUGH_DATA) {
      scanAnimationId = requestAnimationFrame(scanFrame);
      return;
    }

    if (window.BarcodeDetector) {
      const barcodeDetector = new window.BarcodeDetector({ formats: ['qr_code'] });
      barcodeDetector.detect(video).then(barcodes => {
        if (barcodes && barcodes.length > 0) {
          const rawValue = barcodes[0].rawValue;
          handleScannedData(rawValue, closeScanner);
          return;
        }
        scanAnimationId = requestAnimationFrame(scanFrame);
      }).catch(() => {
        scanAnimationId = requestAnimationFrame(scanFrame);
      });
    } else {
      // Keep running frame loop
      scanAnimationId = requestAnimationFrame(scanFrame);
    }
  };

  // Upload image to scan
  const fileScanInput = document.getElementById('qr-file-scan-input');
  const uploadScanBtn = document.getElementById('qr-upload-scan-btn');
  if (uploadScanBtn && fileScanInput) {
    uploadScanBtn.onclick = () => fileScanInput.click();
    fileScanInput.onchange = async (e) => {
      if (e.target.files && e.target.files.length > 0) {
        const file = e.target.files[0];
        try {
          if (window.BarcodeDetector) {
            const bitmap = await createImageBitmap(file);
            const detector = new window.BarcodeDetector({ formats: ['qr_code'] });
            const barcodes = await detector.detect(bitmap);
            if (barcodes.length > 0) {
              handleScannedData(barcodes[0].rawValue, closeScanner);
              return;
            }
          }
          // Fallback or general detection
          alert('ไม่พบ QR Code ในรูปภาพที่เลือก กรุณาลองใหม่อีกครั้ง');
        } catch (err) {
          alert('ไม่สามารถอ่าน QR Code จากไฟล์นี้ได้');
        }
      }
    };
  }
}

/**
 * Handle Scanned QR Code string
 */
function handleScannedData(data, closeCallback) {
  if (!data) return;

  if (closeCallback) closeCallback();

  // If data is a direct booking URL
  if (data.includes('booking.html')) {
    window.location.href = data;
    return;
  }

  // If data is an equipment ID or code
  const urlParams = new URLSearchParams();
  if (data.startsWith('http://') || data.startsWith('https://')) {
    window.location.href = data;
  } else {
    // Treat as equipment id
    window.location.href = `booking.html?id=${encodeURIComponent(data)}`;
  }
}
