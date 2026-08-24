// ============================================
// Admin Module — Admin Dashboard
// สโมสรนักศึกษาราชวิทยาลัยจุฬาภรณ์
// ============================================

import {
  db, auth,
  collection, doc, getDocs, getDoc, addDoc, updateDoc, deleteDoc,
  query, where, orderBy,
  serverTimestamp, onSnapshot, onAuthStateChanged
} from './firebase-config.js';
import { initLoginForm } from './auth.js';
import { showEquipmentQRModal, printBatchEquipmentLabels } from './qr-helper.js';

// ---- State ----
let pendingBookings = [];
let allEquipment = [];
let currentPage = 1;
const PAGE_SIZE = 10;
let editingEquipmentId = null;

// เก็บ unsubscribe functions เพื่อป้องกัน memory leak
const unsubscribers = [];

// ---- DOM Elements ----
const statNewRequests  = document.getElementById('stat-new-requests');
const statActiveLoans  = document.getElementById('stat-active-loans');
const statOverdue      = document.getElementById('stat-overdue');
const pendingTableBody = document.getElementById('pending-table-body');
const paginationInfo   = document.getElementById('pagination-info');
const paginationContainer = document.getElementById('pagination-container');
const addEquipmentBtn  = document.getElementById('add-equipment-btn');
const equipmentModal   = document.getElementById('equipment-modal');

// ---- Initialize ----
document.addEventListener('DOMContentLoaded', () => {
  initLoginForm();
  initAdminListeners();
  initEquipmentModal();
  initEquipmentListDelegation();
});

// Cleanup เมื่อออกจากหน้า
window.addEventListener('beforeunload', () => {
  unsubscribers.forEach(unsub => unsub());
});

/**
 * Initialize real-time listeners (only after auth)
 */
function initAdminListeners() {
  onAuthStateChanged(auth, (user) => {
    if (user) {
      loadDashboardStats();
      loadPendingRequests();
      loadEquipmentList();
    }
  });
}

// ============================================
// Dashboard Statistics
// ============================================

/**
 * Load dashboard KPI stats with real-time updates
 */
function loadDashboardStats() {
  // Pending requests count
  const pendingQuery = query(
    collection(db, 'bookings'),
    where('status', '==', 'pending')
  );
  const unsubPending = onSnapshot(pendingQuery, (snapshot) => {
    if (statNewRequests) statNewRequests.textContent = snapshot.size;
  });
  unsubscribers.push(unsubPending);

  // Active loans count + overdue
  const activeQuery = query(
    collection(db, 'bookings'),
    where('status', '==', 'approved')
  );
  const unsubActive = onSnapshot(activeQuery, (snapshot) => {
    if (statActiveLoans) statActiveLoans.textContent = snapshot.size;

    const now = new Date();
    let overdueCount = 0;
    snapshot.docs.forEach(d => {
      const data = d.data();
      const endDate = data.endDate?.toDate ? data.endDate.toDate() : new Date(data.endDate);
      if (endDate < now) overdueCount++;
    });
    if (statOverdue) statOverdue.textContent = overdueCount;
  });
  unsubscribers.push(unsubActive);
}

// ============================================
// Pending Requests Table
// ============================================

/**
 * Load pending booking requests with real-time listener
 */
function loadPendingRequests() {
  const q = query(
    collection(db, 'bookings'),
    where('status', '==', 'pending')
  );

  const unsub = onSnapshot(q, (snapshot) => {
    pendingBookings = snapshot.docs
      .map(d => ({ id: d.id, ...d.data() }))
      .sort((a, b) => {
        const timeA = a.createdAt?.toDate ? a.createdAt.toDate().getTime() : new Date(a.createdAt || 0).getTime();
        const timeB = b.createdAt?.toDate ? b.createdAt.toDate().getTime() : new Date(b.createdAt || 0).getTime();
        return timeB - timeA;
      });
    currentPage = 1; // reset to first page on new data
    renderPendingTable();
  }, (err) => {
    console.warn('Notice: Failed loading pending requests:', err);
  });
  unsubscribers.push(unsub);
}

/**
 * Render the pending requests table
 */
function renderPendingTable() {
  if (!pendingTableBody) return;

  const start = (currentPage - 1) * PAGE_SIZE;
  const end   = start + PAGE_SIZE;
  const pageBookings = pendingBookings.slice(start, end);

  if (pageBookings.length === 0) {
    pendingTableBody.innerHTML = `
      <tr>
        <td colspan="5" class="text-center py-12 text-gray-400">
          <span class="material-symbols-outlined text-5xl">task_alt</span>
          <p class="mt-2 font-['Prompt']">ไม่มีคำขอรอดำเนินการ</p>
        </td>
      </tr>
    `;
    updatePagination();
    return;
  }

  pendingTableBody.innerHTML = pageBookings.map(booking => {
    const startDate = booking.startDate?.toDate ? booking.startDate.toDate() : new Date(booking.startDate);
    const endDate   = booking.endDate?.toDate   ? booking.endDate.toDate()   : new Date(booking.endDate);

    return `
      <tr class="border-b border-gray-100 hover:bg-gray-50/50 transition-colors">
        <td class="py-4 px-4">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-full bg-[#1a365d] flex items-center justify-center text-white font-bold text-sm">
              ${escapeHtml((booking.fullName || '?')[0])}
            </div>
            <div>
              <p class="font-semibold text-sm text-gray-800 font-['Prompt']">${escapeHtml(booking.fullName || '-')}</p>
              <p class="text-xs text-gray-400 font-['Sarabun']">ID: ${escapeHtml(booking.studentId || '-')}</p>
              ${booking.faculty ? `<p class="text-xs text-gray-400 font-['Sarabun']">${escapeHtml(booking.faculty)} ${escapeHtml(booking.department || '')}</p>` : ''}
            </div>
          </div>
        </td>
        <td class="py-4 px-4">
          <div class="flex items-center gap-2">
            <span class="material-symbols-outlined text-[#1a365d] text-lg">devices</span>
            <div>
              <p class="font-medium text-sm text-gray-800 font-['Prompt']">${escapeHtml(booking.equipmentName || '-')}</p>
              <span class="inline-block mt-1 text-[10px] px-2 py-0.5 rounded-full bg-[#1a365d]/10 text-[#1a365d] font-semibold font-['Sarabun']">
                ${escapeHtml(booking.assetCode || '')}
              </span>
            </div>
          </div>
        </td>
        <td class="py-4 px-4">
          <p class="text-sm text-gray-700 font-['Sarabun']">
            ${formatDateThai(startDate)} ถึง ${formatDateThai(endDate)}
          </p>
        </td>
        <td class="py-4 px-4">
          <p class="text-sm text-gray-600 font-['Sarabun'] max-w-[200px] truncate" title="${escapeHtml(booking.reason || '')}">${escapeHtml(booking.reason || '-')}</p>
          ${booking.activityName ? `<p class="text-xs text-gray-400 font-['Sarabun'] mt-1">โครงการ: ${escapeHtml(booking.activityName)}</p>` : ''}
        </td>
        <td class="py-4 px-4">
          <div class="flex items-center gap-2">
            <button
              class="action-btn flex items-center justify-center w-10 h-10 rounded-full bg-red-50 text-red-500 hover:bg-red-500 hover:text-white transition-colors shadow-sm"
              data-action="reject"
              data-booking-id="${booking.id}"
              title="ปฏิเสธ"
            >
              <span class="material-symbols-outlined">close</span>
            </button>
            <button
              class="action-btn flex items-center justify-center w-10 h-10 rounded-full bg-[#1a365d] text-white hover:brightness-110 transition-all shadow-sm active:scale-90"
              data-action="approve"
              data-booking-id="${booking.id}"
              title="อนุมัติ"
            >
              <span class="material-symbols-outlined">check</span>
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join('');

  updatePagination();
}

/**
 * Event delegation สำหรับ approve/reject — ไม่ต้อง bind ซ้ำทุก render
 */
function initEquipmentListDelegation() {
  // Pending table delegation
  if (pendingTableBody) {
    pendingTableBody.addEventListener('click', async (e) => {
      const btn = e.target.closest('.action-btn');
      if (!btn || btn.disabled) return;

      const { action, bookingId } = btn.dataset;
      if (!bookingId) return;

      if (action === 'approve') await handleApprove(bookingId, btn);
      if (action === 'reject')  await handleReject(bookingId, btn);
    });
  }

  // Equipment list delegation
  const equipmentList = document.getElementById('equipment-list');
  if (equipmentList) {
    equipmentList.addEventListener('click', async (e) => {
      const btn = e.target.closest('[data-eq-action]');
      if (!btn || btn.disabled) return;

      const { eqAction, eqId } = btn.dataset;
      if (!eqId) return;

      if (eqAction === 'edit')     openEquipmentModal(eqId);
      if (eqAction === 'delete')   await handleDeleteEquipment(eqId, btn);
      if (eqAction === 'returned') await handleMarkReturned(eqId, btn);
    });
  }
}

/**
 * Update pagination info
 */
function updatePagination() {
  const total = pendingBookings.length;
  const start = Math.min((currentPage - 1) * PAGE_SIZE + 1, total);
  const end   = Math.min(currentPage * PAGE_SIZE, total);
  const totalPages = Math.ceil(total / PAGE_SIZE);

  if (paginationInfo) {
    paginationInfo.textContent = total > 0
      ? `แสดง ${start}-${end} จาก ${total} รายการ`
      : 'ไม่มีรายการ';
  }

  if (paginationContainer) {
    if (totalPages <= 1) {
      paginationContainer.innerHTML = '';
      return;
    }

    let html = '';
    html += `<button data-page="${currentPage - 1}" class="page-btn px-3 py-1.5 rounded-lg text-sm ${currentPage === 1 ? 'text-gray-300 cursor-not-allowed pointer-events-none' : 'text-gray-600 hover:bg-gray-100'}">
      <span class="material-symbols-outlined text-sm">chevron_left</span>
    </button>`;

    for (let i = 1; i <= totalPages; i++) {
      html += `<button data-page="${i}" class="page-btn px-3 py-1.5 rounded-lg text-sm font-medium ${i === currentPage ? 'bg-[#1a365d] text-white' : 'text-gray-600 hover:bg-gray-100'}">${i}</button>`;
    }

    html += `<button data-page="${currentPage + 1}" class="page-btn px-3 py-1.5 rounded-lg text-sm ${currentPage === totalPages ? 'text-gray-300 cursor-not-allowed pointer-events-none' : 'text-gray-600 hover:bg-gray-100'}">
      <span class="material-symbols-outlined text-sm">chevron_right</span>
    </button>`;

    paginationContainer.innerHTML = html;

    // Bind page buttons
    paginationContainer.querySelectorAll('.page-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const page = parseInt(btn.dataset.page);
        const max = Math.ceil(pendingBookings.length / PAGE_SIZE);
        if (page < 1 || page > max) return;
        currentPage = page;
        renderPendingTable();
      });
    });
  }
}

// ============================================
// Modal Helper Functions (Action & Status Modals)
// ============================================

const actionModal = document.getElementById('booking-action-modal');
const actionModalTitle = document.getElementById('action-modal-title');
const actionModalDesc = document.getElementById('action-modal-desc');
const actionModalIcon = document.getElementById('action-modal-icon');
const actionModalIconBg = document.getElementById('action-modal-icon-bg');
const actionRejectContainer = document.getElementById('action-reject-reason-container');
const actionRejectInput = document.getElementById('action-reject-reason-input');
const actionConfirmBtn = document.getElementById('action-modal-confirm-btn');
const actionCancelBtn = document.getElementById('action-modal-cancel-btn');

const statusResultModal = document.getElementById('status-result-modal');
const statusResultTitle = document.getElementById('status-result-title');
const statusResultDesc = document.getElementById('status-result-desc');
const statusResultIcon = document.getElementById('status-result-icon');
const statusResultIconBg = document.getElementById('status-result-icon-bg');
const statusResultCloseBtn = document.getElementById('status-result-close-btn');

let currentActionConfirmCallback = null;

if (actionCancelBtn && actionModal) {
  actionCancelBtn.addEventListener('click', () => {
    actionModal.classList.add('hidden');
    currentActionConfirmCallback = null;
  });
}

if (actionConfirmBtn && actionModal) {
  actionConfirmBtn.addEventListener('click', async () => {
    if (typeof currentActionConfirmCallback === 'function') {
      const reason = actionRejectInput ? actionRejectInput.value.trim() : '';
      const cb = currentActionConfirmCallback;
      currentActionConfirmCallback = null;
      actionModal.classList.add('hidden');
      await cb(reason);
    }
  });
}

if (statusResultCloseBtn && statusResultModal) {
  statusResultCloseBtn.addEventListener('click', () => {
    statusResultModal.classList.add('hidden');
  });
}

/**
 * Show Action Confirmation Modal (No native confirm/prompt blocks)
 */
function showConfirmDialog({
  title = 'ยืนยันการดำเนินการ',
  desc = 'คุณต้องการดำเนินการนี้ใช่หรือไม่?',
  icon = 'task_alt',
  isDanger = false,
  showReasonInput = false,
  confirmText = 'ยืนยัน',
  onConfirm
}) {
  if (!actionModal) {
    if (typeof onConfirm === 'function') onConfirm('');
    return;
  }

  if (actionModalTitle) actionModalTitle.textContent = title;
  if (actionModalDesc)  actionModalDesc.textContent = desc;
  if (actionModalIcon)  actionModalIcon.textContent = icon;

  if (actionModalIconBg) {
    actionModalIconBg.className = isDanger
      ? 'w-16 h-16 rounded-2xl bg-red-50 text-red-600 flex items-center justify-center mx-auto mb-4 border border-red-100 shadow-inner'
      : 'w-16 h-16 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto mb-4 border border-emerald-100 shadow-inner';
  }

  if (actionConfirmBtn) {
    actionConfirmBtn.className = isDanger
      ? 'flex-1 py-2.5 px-4 rounded-xl bg-red-600 text-white font-[\'Prompt\'] text-sm font-semibold hover:bg-red-700 transition-all shadow-md flex items-center justify-center gap-2'
      : 'flex-1 py-2.5 px-4 rounded-xl bg-emerald-600 text-white font-[\'Prompt\'] text-sm font-semibold hover:bg-emerald-700 transition-all shadow-md flex items-center justify-center gap-2';
    actionConfirmBtn.innerHTML = `<span>${confirmText}</span>`;
  }

  if (actionRejectContainer) {
    if (showReasonInput) {
      actionRejectContainer.classList.remove('hidden');
      if (actionRejectInput) actionRejectInput.value = '';
    } else {
      actionRejectContainer.classList.add('hidden');
    }
  }

  currentActionConfirmCallback = onConfirm;
  actionModal.classList.remove('hidden');
}

/**
 * Show Success or Failure Result Modal Popup
 */
function showStatusPopup({
  success = true,
  title = '',
  message = ''
}) {
  if (!statusResultModal) {
    showToast(message || (success ? 'สำเร็จ' : 'ไม่สำเร็จ'), success ? 'success' : 'error');
    return;
  }

  if (statusResultTitle) {
    statusResultTitle.textContent = title || (success ? 'ดำเนินการสำเร็จ' : 'ดำเนินการไม่สำเร็จ');
  }
  if (statusResultDesc) {
    statusResultDesc.textContent = message || (success ? 'การดำเนินการเสร็จสมบูรณ์เรียบร้อยแล้ว' : 'เกิดข้อผิดพลาดในการดำเนินการ');
  }

  if (statusResultIcon) {
    statusResultIcon.textContent = success ? 'check_circle' : 'cancel';
  }

  if (statusResultIconBg) {
    statusResultIconBg.className = success
      ? 'w-16 h-16 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto mb-4 border border-emerald-100'
      : 'w-16 h-16 rounded-2xl bg-red-50 text-red-600 flex items-center justify-center mx-auto mb-4 border border-red-100';
  }

  if (statusResultCloseBtn) {
    statusResultCloseBtn.className = success
      ? 'w-full py-2.5 rounded-xl bg-emerald-600 text-white font-[\'Prompt\'] font-semibold text-sm hover:bg-emerald-700 transition-colors shadow-md'
      : 'w-full py-2.5 rounded-xl bg-red-600 text-white font-[\'Prompt\'] font-semibold text-sm hover:bg-red-700 transition-colors shadow-md';
  }

  statusResultModal.classList.remove('hidden');
}

// ============================================
// Approve / Reject Bookings
// ============================================

/**
 * Approve a booking request
 */
async function handleApprove(bookingId, btn) {
  const booking = pendingBookings.find(b => b.id === bookingId);
  const applicantName = booking?.fullName ? `ของคุณ ${booking.fullName}` : '';
  const equipName = booking?.equipmentName ? ` (${booking.equipmentName})` : '';

  showConfirmDialog({
    title: 'ยืนยันการอนุมัติคำขอยืม',
    desc: `คุณต้องการอนุมัติคำขอยืมอุปกรณ์${equipName} ${applicantName} ใช่หรือไม่?`,
    icon: 'task_alt',
    isDanger: false,
    showReasonInput: false,
    confirmText: 'ยืนยันอนุมัติ',
    onConfirm: async () => {
      setButtonLoading(btn, true);

      try {
        const bookingRef = doc(db, 'bookings', bookingId);
        const bookingSnap = await getDoc(bookingRef);

        if (!bookingSnap.exists()) {
          showStatusPopup({
            success: false,
            title: 'ไม่สำเร็จ',
            message: 'ไม่พบรายการคำขอยืมนี้ในระบบ'
          });
          return;
        }

        const bookingData = bookingSnap.data();

        if (bookingData.status !== 'pending') {
          showStatusPopup({
            success: false,
            title: 'ไม่สำเร็จ',
            message: 'คำขอนี้ถูกดำเนินการไปก่อนหน้านี้แล้ว'
          });
          return;
        }

        // Update booking status
        await updateDoc(bookingRef, {
          status: 'approved',
          approvedAt: serverTimestamp()
        });

        // Update equipment status
        if (bookingData.equipmentId) {
          const equipmentRef = doc(db, 'equipment', bookingData.equipmentId);
          await updateDoc(equipmentRef, {
            status: 'unavailable',
            returnDate: bookingData.endDate
          });
        }

        showStatusPopup({
          success: true,
          title: 'อนุมัติสำเร็จ',
          message: `อนุมัติคำขอยืมอุปกรณ์${equipName} เรียบร้อยแล้ว ระบบได้ปรับปรุงสถานะและบันทึกลงในปฏิทินแล้ว`
        });
        showToast('อนุมัติคำขอเรียบร้อยแล้ว', 'success');
      } catch (error) {
        console.error('Error approving booking:', error);
        showStatusPopup({
          success: false,
          title: 'เกิดข้อผิดพลาด',
          message: 'ไม่สามารถอนุมัติคำขอได้: ' + (error.message || 'โปรดลองใหม่อีกครั้ง')
        });
        showToast('เกิดข้อผิดพลาดในการอนุมัติ', 'error');
      } finally {
        setButtonLoading(btn, false);
      }
    }
  });
}

/**
 * Reject a booking request
 */
async function handleReject(bookingId, btn) {
  const booking = pendingBookings.find(b => b.id === bookingId);
  const applicantName = booking?.fullName ? `ของคุณ ${booking.fullName}` : '';
  const equipName = booking?.equipmentName ? ` (${booking.equipmentName})` : '';

  showConfirmDialog({
    title: 'ยืนยันการปฏิเสธคำขอ',
    desc: `คุณต้องการปฏิเสธคำขอยืมอุปกรณ์${equipName} ${applicantName} ใช่หรือไม่? สามารถระบุเหตุผลด้านล่างได้`,
    icon: 'cancel',
    isDanger: true,
    showReasonInput: true,
    confirmText: 'ยืนยันปฏิเสธคำขอ',
    onConfirm: async (reason) => {
      setButtonLoading(btn, true);

      try {
        const bookingRef = doc(db, 'bookings', bookingId);
        const bookingSnap = await getDoc(bookingRef);

        if (!bookingSnap.exists() || bookingSnap.data().status !== 'pending') {
          showStatusPopup({
            success: false,
            title: 'ไม่สำเร็จ',
            message: 'คำขอนี้ถูกดำเนินการไปก่อนหน้านี้แล้ว'
          });
          return;
        }

        await updateDoc(bookingRef, {
          status: 'rejected',
          adminNote: reason || '',
          rejectedAt: serverTimestamp()
        });

        showStatusPopup({
          success: true,
          title: 'ปฏิเสธคำขอสำเร็จ',
          message: `ปฏิเสธคำขอยืมอุปกรณ์${equipName} เรียบร้อยแล้ว${reason ? ` (เหตุผล: ${reason})` : ''}`
        });
        showToast('ปฏิเสธคำขอเรียบร้อยแล้ว', 'info');
      } catch (error) {
        console.error('Error rejecting booking:', error);
        showStatusPopup({
          success: false,
          title: 'เกิดข้อผิดพลาด',
          message: 'ไม่สามารถปฏิเสธคำขอได้: ' + (error.message || 'โปรดลองใหม่อีกครั้ง')
        });
        showToast('เกิดข้อผิดพลาดในการปฏิเสธ', 'error');
      } finally {
        setButtonLoading(btn, false);
      }
    }
  });
}

// ============================================
// Equipment Management (CRUD)
// ============================================

/**
 * Load equipment list for management with real-time listener
 */
function loadEquipmentList() {
  const q = query(collection(db, 'equipment'), orderBy('createdAt', 'desc'));
  const unsub = onSnapshot(q, (snapshot) => {
    allEquipment = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
    renderEquipmentManagement();
  });
  unsubscribers.push(unsub);
}

/**
 * Render equipment management section
 */
function renderEquipmentManagement() {
  const equipmentList = document.getElementById('equipment-list');
  if (!equipmentList) return;

  if (allEquipment.length === 0) {
    equipmentList.innerHTML = `
      <div class="text-center py-8 text-gray-400">
        <span class="material-symbols-outlined text-4xl">inventory_2</span>
        <p class="mt-2 font-['Prompt']">ยังไม่มีอุปกรณ์ในระบบ</p>
        <p class="text-sm font-['Sarabun']">กดปุ่ม "เพิ่มอุปกรณ์" เพื่อเริ่มต้น</p>
      </div>
    `;
    return;
  }

  equipmentList.innerHTML = allEquipment.map(eq => {
    const statusBadge = eq.status === 'available'
      ? '<span class="px-2 py-0.5 rounded-full text-xs bg-green-100 text-green-700 font-[\'Prompt\'] font-medium">ว่าง</span>'
      : eq.status === 'maintenance'
      ? '<span class="px-2 py-0.5 rounded-full text-xs bg-yellow-100 text-yellow-700 font-[\'Prompt\'] font-medium">ซ่อมบำรุง</span>'
      : '<span class="px-2 py-0.5 rounded-full text-xs bg-red-100 text-red-700 font-[\'Prompt\'] font-medium">ไม่ว่าง</span>';

    return `
      <div class="flex items-center justify-between p-3 rounded-xl border border-gray-200 bg-white hover:bg-slate-50 transition-all shadow-2xs">
        <div class="flex items-center gap-3 min-w-0">
          <img src="${escapeHtml(eq.imageUrl || 'https://placehold.co/48x48/1a365d/white?text=EQ')}" alt="${escapeHtml(eq.title)}" class="w-12 h-12 rounded-lg object-cover border border-gray-100 shrink-0" onerror="this.src='https://placehold.co/48x48/1a365d/white?text=EQ'" />
          <div class="min-w-0">
            <p class="font-semibold text-sm font-['Prompt'] text-slate-800 truncate">${escapeHtml(eq.title)}</p>
            <div class="flex items-center gap-2 mt-0.5 flex-wrap">
              <span class="text-xs font-mono font-bold text-primary bg-blue-50 px-1.5 py-0.2 rounded">${escapeHtml(eq.assetCode || '')}</span>
              ${statusBadge}
              <span class="text-xs text-gray-400 font-['Sarabun'] hidden sm:inline">• ${escapeHtml(eq.category || '')}</span>
            </div>
          </div>
        </div>
        <div class="flex items-center gap-1 shrink-0">
          <button data-eq-action="qr" data-eq-id="${eq.id}" class="p-2 rounded-lg text-slate-500 hover:text-secondary hover:bg-amber-50 transition-colors" title="ดู / ดาวน์โหลด / พิมพ์ QR Code">
            <span class="material-symbols-outlined text-lg">qr_code_2</span>
          </button>
          <button data-eq-action="edit" data-eq-id="${eq.id}" class="p-2 rounded-lg text-slate-500 hover:text-[#1a365d] hover:bg-blue-50 transition-colors" title="แก้ไข">
            <span class="material-symbols-outlined text-lg">edit</span>
          </button>
          <button data-eq-action="delete" data-eq-id="${eq.id}" class="p-2 rounded-lg text-slate-500 hover:text-red-500 hover:bg-red-50 transition-colors" title="ลบ">
            <span class="material-symbols-outlined text-lg">delete</span>
          </button>
          ${eq.status === 'unavailable' ? `
            <button data-eq-action="returned" data-eq-id="${eq.id}" class="p-2 rounded-lg text-slate-500 hover:text-green-600 hover:bg-green-50 transition-colors" title="บันทึกคืน">
              <span class="material-symbols-outlined text-lg">assignment_return</span>
            </button>
          ` : ''}
        </div>
      </div>
    `;
  }).join('');
}

/**
 * Initialize event delegation for equipment list actions (QR, Edit, Delete, Return)
 */
function initEquipmentListDelegation() {
  const equipmentList = document.getElementById('equipment-list');
  if (equipmentList) {
    equipmentList.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-eq-action]');
      if (!btn) return;

      const action = btn.dataset.eqAction;
      const eqId = btn.dataset.eqId;

      if (action === 'qr') {
        const eq = allEquipment.find(item => item.id === eqId);
        if (eq) {
          showEquipmentQRModal(eq);
        }
      } else if (action === 'edit') {
        openEquipmentModal(eqId);
      } else if (action === 'delete') {
        handleDeleteEquipment(eqId, btn);
      } else if (action === 'returned') {
        handleMarkReturned(eqId, btn);
      }
    });
  }

  // Batch Print All QR Codes button
  const batchPrintBtn = document.getElementById('batch-print-qr-btn');
  if (batchPrintBtn) {
    batchPrintBtn.addEventListener('click', () => {
      if (allEquipment.length === 0) {
        showToast('ไม่พบรายการอุปกรณ์สำหรับพิมพ์ป้าย QR', 'info');
        return;
      }
      printBatchEquipmentLabels(allEquipment);
    });
  }
}

// ============================================
// Equipment Modal & Image Upload
// ============================================

let currentUploadedImageUrl = '';

/**
 * Initialize equipment modal handlers
 */
function initEquipmentModal() {
  if (addEquipmentBtn) {
    addEquipmentBtn.addEventListener('click', () => openEquipmentModal());
  }

  const addEquipmentBtnSec = document.getElementById('add-equipment-btn-sec');
  if (addEquipmentBtnSec) {
    addEquipmentBtnSec.addEventListener('click', () => openEquipmentModal());
  }

  const eqCancelBtn = document.getElementById('eq-cancel-btn');
  if (eqCancelBtn) eqCancelBtn.addEventListener('click', closeEquipmentModal);

  const eqSaveBtn = document.getElementById('eq-save-btn');
  if (eqSaveBtn) eqSaveBtn.addEventListener('click', saveEquipment);

  const closeIcon = document.getElementById('modal-close-icon');
  if (closeIcon) closeIcon.addEventListener('click', closeEquipmentModal);

  if (equipmentModal) {
    equipmentModal.addEventListener('click', (e) => {
      if (e.target === equipmentModal) closeEquipmentModal();
    });
  }

  initImageUploadHandlers();
  fetchNotificationStatus();
}

/**
 * Initialize Image Upload Dropzone, File Input and Previews
 */
function initImageUploadHandlers() {
  const dropzone        = document.getElementById('eq-dropzone');
  const fileInput       = document.getElementById('eq-file-input');
  const changeImgBtn    = document.getElementById('eq-change-img-btn');
  const removeImgBtn    = document.getElementById('eq-remove-img-btn');
  const toggleUrlBtn    = document.getElementById('eq-toggle-url-btn');
  const urlContainer    = document.getElementById('eq-url-input-container');
  const imageUrlInput   = document.getElementById('eq-image-url');

  if (dropzone && fileInput) {
    dropzone.addEventListener('click', () => fileInput.click());

    // Drag & Drop
    ['dragenter', 'dragover'].forEach(eventName => {
      dropzone.addEventListener(eventName, (e) => {
        e.preventDefault();
        e.stopPropagation();
        dropzone.classList.add('border-primary', 'bg-blue-50/60');
      });
    });

    ['dragleave', 'drop'].forEach(eventName => {
      dropzone.addEventListener(eventName, (e) => {
        e.preventDefault();
        e.stopPropagation();
        dropzone.classList.remove('border-primary', 'bg-blue-50/60');
      });
    });

    dropzone.addEventListener('drop', (e) => {
      if (e.dataTransfer && e.dataTransfer.files.length > 0) {
        const file = e.dataTransfer.files[0];
        processSelectedImageFile(file);
      }
    });

    fileInput.addEventListener('change', (e) => {
      if (e.target.files && e.target.files.length > 0) {
        const file = e.target.files[0];
        processSelectedImageFile(file);
      }
    });
  }

  if (changeImgBtn && fileInput) {
    changeImgBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      fileInput.click();
    });
  }

  if (removeImgBtn) {
    removeImgBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      clearImagePreview();
    });
  }

  if (toggleUrlBtn && urlContainer) {
    toggleUrlBtn.addEventListener('click', () => {
      urlContainer.classList.toggle('hidden');
    });
  }

  if (imageUrlInput) {
    imageUrlInput.addEventListener('input', (e) => {
      const url = e.target.value.trim();
      if (url) {
        setImagePreview(url, 'URL รูปภาพภายนอก');
      }
    });
  }
}

/**
 * Process, compress and upload selected image file
 */
async function processSelectedImageFile(file) {
  if (!file || !file.type.startsWith('image/')) {
    showToast('กรุณาเลือกเฉพาะไฟล์รูปภาพ (JPEG, PNG, WebP, GIF)', 'error');
    return;
  }

  const dropzone = document.getElementById('eq-dropzone');
  const previewContainer = document.getElementById('eq-preview-container');
  const previewImg = document.getElementById('eq-preview-img');
  const previewFilename = document.getElementById('eq-preview-filename');
  const previewStatus = document.getElementById('eq-preview-status');

  // Temporary local thumbnail preview immediately
  const localUrl = URL.createObjectURL(file);
  if (previewImg) previewImg.src = localUrl;
  if (previewFilename) previewFilename.textContent = file.name;
  if (previewStatus) {
    previewStatus.innerHTML = '<span class="material-symbols-outlined text-xs animate-spin">progress_activity</span> กำลังประมวลผลรูป...';
    previewStatus.className = 'inline-flex items-center gap-1 text-[11px] font-semibold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full font-[\'Prompt\']';
  }
  if (dropzone) dropzone.classList.add('hidden');
  if (previewContainer) previewContainer.classList.remove('hidden');

  try {
    // Compress image to high-quality max 1200px
    const compressedBase64 = await compressImageFile(file, 1200, 0.85);

    // Upload to server API
    const response = await fetch('/api/upload-image', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ base64Image: compressedBase64 })
    });

    const result = await response.json();

    if (result.success && result.imageUrl) {
      currentUploadedImageUrl = result.imageUrl;
      const imageUrlInput = document.getElementById('eq-image-url');
      if (imageUrlInput) imageUrlInput.value = result.imageUrl;

      if (previewStatus) {
        previewStatus.innerHTML = '<span class="material-symbols-outlined text-xs">check_circle</span> บันทึกลงในระบบแล้ว';
        previewStatus.className = 'inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full font-[\'Prompt\']';
      }
      showToast('อัปโหลดรูปภาพเรียบร้อยแล้ว', 'success');
    } else {
      // Fallback to compressed base64 directly into Firestore
      currentUploadedImageUrl = compressedBase64;
      const imageUrlInput = document.getElementById('eq-image-url');
      if (imageUrlInput) imageUrlInput.value = compressedBase64;

      if (previewStatus) {
        previewStatus.innerHTML = '<span class="material-symbols-outlined text-xs">check_circle</span> พร้อมบันทึกในระบบ';
        previewStatus.className = 'inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full font-[\'Prompt\']';
      }
    }
  } catch (err) {
    console.error('Error processing image:', err);
    // Fallback using direct reader
    const reader = new FileReader();
    reader.onload = (e) => {
      currentUploadedImageUrl = e.target.result;
      const imageUrlInput = document.getElementById('eq-image-url');
      if (imageUrlInput) imageUrlInput.value = currentUploadedImageUrl;
      if (previewStatus) {
        previewStatus.innerHTML = '<span class="material-symbols-outlined text-xs">check_circle</span> พร้อมบันทึกในระบบ';
        previewStatus.className = 'inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full font-[\'Prompt\']';
      }
    };
    reader.readAsDataURL(file);
  }
}

/**
 * Client-side Canvas Image Compression
 */
function compressImageFile(file, maxDimension = 1200, quality = 0.85) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = reject;
    reader.onload = (event) => {
      const img = new Image();
      img.onerror = reject;
      img.onload = () => {
        let width = img.width;
        let height = img.height;

        if (width > maxDimension || height > maxDimension) {
          if (width > height) {
            height = Math.round((height * maxDimension) / width);
            width = maxDimension;
          } else {
            width = Math.round((width * maxDimension) / height);
            height = maxDimension;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);

        const dataUrl = canvas.toDataURL('image/jpeg', quality);
        resolve(dataUrl);
      };
      img.src = event.target.result;
    };
    reader.readAsDataURL(file);
  });
}

/**
 * Set Image Preview from existing URL
 */
function setImagePreview(url, filename = 'รูปภาพอุปกรณ์') {
  if (!url) {
    clearImagePreview();
    return;
  }

  currentUploadedImageUrl = url;
  const dropzone = document.getElementById('eq-dropzone');
  const previewContainer = document.getElementById('eq-preview-container');
  const previewImg = document.getElementById('eq-preview-img');
  const previewFilename = document.getElementById('eq-preview-filename');
  const previewStatus = document.getElementById('eq-preview-status');
  const imageUrlInput = document.getElementById('eq-image-url');

  if (previewImg) previewImg.src = url;
  if (previewFilename) previewFilename.textContent = filename;
  if (imageUrlInput) imageUrlInput.value = url;

  if (previewStatus) {
    previewStatus.innerHTML = '<span class="material-symbols-outlined text-xs">check_circle</span> รูปภาพปัจจุบัน';
    previewStatus.className = 'inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full font-[\'Prompt\']';
  }

  if (dropzone) dropzone.classList.add('hidden');
  if (previewContainer) previewContainer.classList.remove('hidden');
}

/**
 * Clear Image Preview and reset to dropzone
 */
function clearImagePreview() {
  currentUploadedImageUrl = '';
  const dropzone = document.getElementById('eq-dropzone');
  const previewContainer = document.getElementById('eq-preview-container');
  const previewImg = document.getElementById('eq-preview-img');
  const fileInput = document.getElementById('eq-file-input');
  const imageUrlInput = document.getElementById('eq-image-url');

  if (previewImg) previewImg.src = '';
  if (fileInput) fileInput.value = '';
  if (imageUrlInput) imageUrlInput.value = '';

  if (previewContainer) previewContainer.classList.add('hidden');
  if (dropzone) dropzone.classList.remove('hidden');
}

/**
 * Fetch and display admin email notification configuration
 */
async function fetchNotificationStatus() {
  try {
    const res = await fetch('/api/admin/notifications');
    const data = await res.json();
    if (data.success && data.adminEmail) {
      const emailEl = document.getElementById('admin-target-email');
      if (emailEl) emailEl.textContent = data.adminEmail;
    }
  } catch (e) {
    // Ignore error silently
  }
}

/**
 * Open equipment modal (add or edit)
 */
function openEquipmentModal(equipmentId = null) {
  editingEquipmentId = equipmentId;

  // Reset form
  const fields = ['eq-title', 'eq-code', 'eq-image-url', 'eq-description'];
  fields.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });

  const catEl = document.getElementById('eq-category');
  if (catEl) catEl.selectedIndex = 0;

  clearImagePreview();

  const modalTitle = document.getElementById('eq-modal-title');

  if (equipmentId) {
    const eq = allEquipment.find(e => e.id === equipmentId);
    if (eq) {
      if (document.getElementById('eq-title'))    document.getElementById('eq-title').value    = eq.title      || '';
      if (document.getElementById('eq-code'))     document.getElementById('eq-code').value     = eq.assetCode  || '';
      if (document.getElementById('eq-category')) document.getElementById('eq-category').value = eq.category   || '';
      if (document.getElementById('eq-description')) document.getElementById('eq-description').value = eq.description || '';
      
      if (eq.imageUrl) {
        setImagePreview(eq.imageUrl, eq.title || 'รูปภาพอุปกรณ์');
      }
    }
    if (modalTitle) modalTitle.textContent = 'แก้ไขอุปกรณ์';
  } else {
    if (modalTitle) modalTitle.textContent = 'เพิ่มอุปกรณ์ใหม่';
  }

  if (equipmentModal) equipmentModal.classList.remove('hidden');
}

function closeEquipmentModal() {
  if (equipmentModal) equipmentModal.classList.add('hidden');
  editingEquipmentId = null;
  clearImagePreview();
}

/**
 * Save equipment (add or update) — รวม imageUrl จากการอัปโหลดหรือระบุ URL
 */
async function saveEquipment() {
  const title       = document.getElementById('eq-title')?.value.trim()       || '';
  const assetCode   = document.getElementById('eq-code')?.value.trim()        || '';
  const category    = document.getElementById('eq-category')?.value.trim()    || '';
  const urlFromInput= document.getElementById('eq-image-url')?.value.trim()   || '';
  const imageUrl    = currentUploadedImageUrl || urlFromInput;
  const description = document.getElementById('eq-description')?.value.trim() || '';

  if (!title || !assetCode) {
    showToast('กรุณากรอกชื่ออุปกรณ์และรหัสอุปกรณ์', 'error');
    return;
  }

  const eqSaveBtn = document.getElementById('eq-save-btn');
  setButtonLoading(eqSaveBtn, true, 'กำลังบันทึก...');

  try {
    const data = {
      title,
      assetCode,
      category,
      imageUrl: imageUrl || '',
      description,
      updatedAt: serverTimestamp()
    };

    if (editingEquipmentId) {
      await updateDoc(doc(db, 'equipment', editingEquipmentId), data);
      showToast('แก้ไขอุปกรณ์และบันทึกรูปภาพเรียบร้อยแล้ว', 'success');
    } else {
      data.status    = 'available';
      data.createdAt = serverTimestamp();
      await addDoc(collection(db, 'equipment'), data);
      showToast('เพิ่มอุปกรณ์และบันทึกรูปภาพเข้าสู่ระบบเรียบร้อยแล้ว', 'success');
    }

    closeEquipmentModal();
  } catch (error) {
    console.error('Error saving equipment:', error);
    showToast('เกิดข้อผิดพลาดในการบันทึก: ' + (error.message || ''), 'error');
  } finally {
    setButtonLoading(eqSaveBtn, false, 'บันทึกอุปกรณ์');
  }
}

/**
 * Delete equipment
 */
async function handleDeleteEquipment(equipmentId, btn) {
  const eq = allEquipment.find(e => e.id === equipmentId);
  const eqName = eq?.title ? ` "${eq.title}"` : '';

  showConfirmDialog({
    title: 'ยืนยันการลบอุปกรณ์',
    desc: `ต้องการลบอุปกรณ์${eqName} ใช่หรือไม่? การดำเนินการนี้ไม่สามารถย้อนกลับได้`,
    icon: 'delete_forever',
    isDanger: true,
    showReasonInput: false,
    confirmText: 'ยืนยันลบ',
    onConfirm: async () => {
      setButtonLoading(btn, true);
      try {
        await deleteDoc(doc(db, 'equipment', equipmentId));
        showStatusPopup({
          success: true,
          title: 'ลบสำเร็จ',
          message: `ลบอุปกรณ์${eqName} ออกจากระบบเรียบร้อยแล้ว`
        });
        showToast('ลบอุปกรณ์เรียบร้อยแล้ว', 'success');
      } catch (error) {
        console.error('Error deleting equipment:', error);
        showStatusPopup({
          success: false,
          title: 'ไม่สำเร็จ',
          message: 'เกิดข้อผิดพลาดในการลบอุปกรณ์: ' + (error.message || '')
        });
        showToast('เกิดข้อผิดพลาดในการลบ', 'error');
      } finally {
        setButtonLoading(btn, false);
      }
    }
  });
}

/**
 * Mark equipment as returned
 */
async function handleMarkReturned(equipmentId, btn) {
  const eq = allEquipment.find(e => e.id === equipmentId);
  const eqName = eq?.title ? ` "${eq.title}"` : '';

  showConfirmDialog({
    title: 'ยืนยันการรับคืนอุปกรณ์',
    desc: `ยืนยันว่าอุปกรณ์${eqName} ได้รับการส่งคืนกลับเข้าคลังเรียบร้อยแล้วใช่หรือไม่?`,
    icon: 'assignment_turned_in',
    isDanger: false,
    showReasonInput: false,
    confirmText: 'ยืนยันรับคืน',
    onConfirm: async () => {
      setButtonLoading(btn, true);
      try {
        await updateDoc(doc(db, 'equipment', equipmentId), {
          status: 'available',
          returnDate: null
        });

        // Update related active booking to returned
        const bookingsQuery = query(
          collection(db, 'bookings'),
          where('equipmentId', '==', equipmentId),
          where('status', '==', 'approved')
        );
        const snapshot = await getDocs(bookingsQuery);
        for (const bookingDoc of snapshot.docs) {
          await updateDoc(doc(db, 'bookings', bookingDoc.id), {
            status: 'returned',
            returnedAt: serverTimestamp()
          });
        }

        showStatusPopup({
          success: true,
          title: 'บันทึกการคืนสำเร็จ',
          message: `บันทึกการส่งคืนอุปกรณ์${eqName} เรียบร้อยแล้ว สถานะอุปกรณ์พร้อมให้ยืมต่อได้ทันที`
        });
        showToast('บันทึกการคืนอุปกรณ์เรียบร้อยแล้ว', 'success');
      } catch (error) {
        console.error('Error marking returned:', error);
        showStatusPopup({
          success: false,
          title: 'ไม่สำเร็จ',
          message: 'เกิดข้อผิดพลาดในการบันทึกการคืนอุปกรณ์: ' + (error.message || '')
        });
        showToast('เกิดข้อผิดพลาด', 'error');
      } finally {
        setButtonLoading(btn, false);
      }
    }
  });
}

// ============================================
// Utilities
// ============================================

/**
 * Escape HTML เพื่อป้องกัน XSS
 */
function escapeHtml(str) {
  if (typeof str !== 'string') return String(str ?? '');
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Set loading state on a button
 */
function setButtonLoading(btn, loading, loadingText = 'กำลังดำเนินการ...') {
  if (!btn) return;
  btn.disabled = loading;
  if (loading) {
    btn.dataset.originalHtml = btn.innerHTML;
    btn.innerHTML = `<span class="material-symbols-outlined animate-spin text-sm">progress_activity</span>`;
  } else {
    btn.innerHTML = btn.dataset.originalHtml || btn.innerHTML;
  }
}

/**
 * Show toast notification
 */
function showToast(message, type = 'info') {
  const colors = {
    success: 'bg-green-500',
    error:   'bg-red-500',
    info:    'bg-[#1a365d]'
  };
  const icons = {
    success: 'check_circle',
    error:   'error',
    info:    'info'
  };

  const toast = document.createElement('div');
  toast.className = `fixed bottom-6 right-6 z-[300] flex items-center gap-3 px-5 py-3 rounded-xl ${colors[type] || colors.info} text-white shadow-2xl transform translate-y-4 opacity-0 transition-all duration-300`;
  toast.innerHTML = `
    <span class="material-symbols-outlined">${icons[type] || icons.info}</span>
    <span class="font-['Sarabun'] text-sm">${escapeHtml(message)}</span>
  `;

  document.body.appendChild(toast);

  requestAnimationFrame(() => {
    toast.classList.remove('translate-y-4', 'opacity-0');
  });

  setTimeout(() => {
    toast.classList.add('translate-y-4', 'opacity-0');
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

/**
 * Format date to Thai locale
 */
function formatDateThai(date) {
  if (!(date instanceof Date) || isNaN(date)) return '-';
  return date.toLocaleDateString('th-TH', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
}
