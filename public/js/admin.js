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
  initExcelImport();
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

        // ส่ง email แจ้งผู้ยืมว่าได้รับการอนุมัติ
        if (bookingData.applicantEmail) {
          try {
            const startDate = bookingData.startDate?.toDate ? bookingData.startDate.toDate() : new Date(bookingData.startDate);
            const endDate   = bookingData.endDate?.toDate   ? bookingData.endDate.toDate()   : new Date(bookingData.endDate);
            await fetch('/api/notify-borrower-approved', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                bookingId:     bookingId,
                equipmentName: bookingData.equipmentName || '',
                equipmentCode: bookingData.assetCode     || '',
                fullName:      bookingData.fullName      || '',
                applicantEmail: bookingData.applicantEmail,
                activityName:  bookingData.activityName  || '',
                startDate:     startDate.toLocaleDateString('th-TH'),
                endDate:       endDate.toLocaleDateString('th-TH')
              })
            });
          } catch (notifErr) {
            console.warn('[Notify Borrower Approved] Failed:', notifErr);
          }
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

        // ส่ง email แจ้งผู้ยืมว่าไม่ได้รับการอนุมัติ
        if (bookingSnap.data().applicantEmail) {
          try {
            await fetch('/api/notify-borrower-rejected', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                equipmentName: bookingSnap.data().equipmentName || '',
                fullName:      bookingSnap.data().fullName      || '',
                applicantEmail: bookingSnap.data().applicantEmail,
                adminNote:     reason || ''
              })
            });
          } catch (notifErr) {
            console.warn('[Notify Borrower Rejected] Failed:', notifErr);
          }
        }

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
      ? '<span class="px-2 py-0.5 rounded-full text-xs bg-green-100 text-green-700">ว่าง</span>'
      : eq.status === 'maintenance'
      ? '<span class="px-2 py-0.5 rounded-full text-xs bg-yellow-100 text-yellow-700">ซ่อมบำรุง</span>'
      : '<span class="px-2 py-0.5 rounded-full text-xs bg-red-100 text-red-700">ไม่ว่าง</span>';

    return `
      <div class="flex items-center justify-between p-3 rounded-lg border border-gray-100 hover:bg-gray-50 transition-colors">
        <div class="flex items-center gap-3">
          <img src="${escapeHtml(eq.imageUrl || 'https://placehold.co/48x48/1a365d/white?text=EQ')}" alt="${escapeHtml(eq.title)}" class="w-12 h-12 rounded-lg object-cover" />
          <div>
            <p class="font-semibold text-sm font-['Prompt']">${escapeHtml(eq.title)}</p>
            <div class="flex items-center gap-2 mt-0.5">
              <span class="text-xs text-gray-400 font-['Sarabun']">${escapeHtml(eq.assetCode || '')}</span>
              ${statusBadge}
            </div>
          </div>
        </div>
        <div class="flex items-center gap-1">
          <button data-eq-action="edit" data-eq-id="${eq.id}" class="p-2 rounded-lg text-gray-400 hover:text-[#1a365d] hover:bg-blue-50 transition-colors" title="แก้ไข">
            <span class="material-symbols-outlined text-lg">edit</span>
          </button>
          <button data-eq-action="delete" data-eq-id="${eq.id}" class="p-2 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors" title="ลบ">
            <span class="material-symbols-outlined text-lg">delete</span>
          </button>
          ${eq.status === 'unavailable' ? `
            <button data-eq-action="returned" data-eq-id="${eq.id}" class="p-2 rounded-lg text-gray-400 hover:text-green-500 hover:bg-green-50 transition-colors" title="บันทึกคืน">
              <span class="material-symbols-outlined text-lg">assignment_return</span>
            </button>
          ` : ''}
        </div>
      </div>
    `;
  }).join('');
}

// ============================================
// Equipment Modal
// ============================================

/**
 * Initialize equipment modal handlers
 */
function initEquipmentModal() {
  if (addEquipmentBtn) {
    addEquipmentBtn.addEventListener('click', () => openEquipmentModal());
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

  const modalTitle = document.getElementById('eq-modal-title');

  if (equipmentId) {
    const eq = allEquipment.find(e => e.id === equipmentId);
    if (eq) {
      if (document.getElementById('eq-title'))    document.getElementById('eq-title').value    = eq.title      || '';
      if (document.getElementById('eq-code'))     document.getElementById('eq-code').value     = eq.assetCode  || '';
      if (document.getElementById('eq-category')) document.getElementById('eq-category').value = eq.category   || '';
      if (document.getElementById('eq-image-url'))document.getElementById('eq-image-url').value= eq.imageUrl   || '';
      if (document.getElementById('eq-description')) document.getElementById('eq-description').value = eq.description || '';
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
}

/**
 * Save equipment (add or update) — รวม imageUrl ด้วย
 */
async function saveEquipment() {
  const title       = document.getElementById('eq-title')?.value.trim()       || '';
  const assetCode   = document.getElementById('eq-code')?.value.trim()        || '';
  const category    = document.getElementById('eq-category')?.value.trim()    || '';
  const imageUrl    = document.getElementById('eq-image-url')?.value.trim()   || '';
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
      imageUrl,
      description,
      updatedAt: serverTimestamp()
    };

    if (editingEquipmentId) {
      await updateDoc(doc(db, 'equipment', editingEquipmentId), data);
      showToast('แก้ไขอุปกรณ์เรียบร้อยแล้ว', 'success');
    } else {
      data.status    = 'available';
      data.createdAt = serverTimestamp();
      await addDoc(collection(db, 'equipment'), data);
      showToast('เพิ่มอุปกรณ์เรียบร้อยแล้ว', 'success');
    }

    closeEquipmentModal();
  } catch (error) {
    console.error('Error saving equipment:', error);
    showToast('เกิดข้อผิดพลาดในการบันทึก', 'error');
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

// ============================================
// Excel Bulk Import
// ============================================

/** รายการ equipment ที่ parse จาก Excel */
let excelParsedRows = [];

/**
 * Initialize Excel bulk import UI & handlers
 */
function initExcelImport() {
  const dropzone   = document.getElementById('excel-dropzone');
  const fileInput  = document.getElementById('excel-file-input');
  const clearBtn   = document.getElementById('excel-clear-btn');
  const importBtn  = document.getElementById('excel-import-btn');
  const templateBtn = document.getElementById('download-template-btn');

  if (!dropzone || !fileInput) return;

  // คลิก dropzone → เปิด file picker
  dropzone.addEventListener('click', () => fileInput.click());

  // เลือกไฟล์จาก file picker — ตรวจ extension แล้ว route
  fileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.name.match(/\.docx$/i)) {
      parseDocxFile(file);
    } else {
      parseExcelFile(file);
    }
  });

  // Drag over
  dropzone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropzone.classList.add('border-green-500', 'bg-green-50/30');
  });
  dropzone.addEventListener('dragleave', () => {
    dropzone.classList.remove('border-green-500', 'bg-green-50/30');
  });
  dropzone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropzone.classList.remove('border-green-500', 'bg-green-50/30');
    const file = e.dataTransfer.files[0];
    if (!file) return;
    if (file.name.match(/\.docx$/i)) {
      parseDocxFile(file);
    } else {
      parseExcelFile(file);
    }
  });

  // ล้างข้อมูล
  if (clearBtn) {
    clearBtn.addEventListener('click', () => {
      excelParsedRows = [];
      fileInput.value = '';
      document.getElementById('excel-preview-section')?.classList.add('hidden');
      document.getElementById('excel-progress-container')?.classList.add('hidden');
    });
  }

  // นำเข้า Firestore
  if (importBtn) {
    importBtn.addEventListener('click', () => batchImportEquipment());
  }

  // ดาวน์โหลด template
  if (templateBtn) {
    templateBtn.addEventListener('click', downloadExcelTemplate);
  }
}

/**
 * Parse Excel/XLSX file ด้วย SheetJS
 */
function parseExcelFile(file) {
  if (!window.XLSX) {
    showToast('ไม่พบ SheetJS library — กรุณา refresh หน้าเว็บ', 'error');
    return;
  }

  const validTypes = [
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-excel'
  ];
  if (!validTypes.includes(file.type) && !file.name.match(/\.(xlsx|xls)$/i)) {
    showToast('กรุณาเลือกเฉพาะไฟล์ .xlsx หรือ .xls', 'error');
    return;
  }

  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const data     = new Uint8Array(e.target.result);
      const workbook = XLSX.read(data, { type: 'array' });
      const sheet    = workbook.Sheets[workbook.SheetNames[0]];
      const rows     = XLSX.utils.sheet_to_json(sheet, { defval: '' });

      if (rows.length === 0) {
        showToast('ไม่พบข้อมูลในไฟล์ Excel', 'error');
        return;
      }

      // Map column names (รองรับ header ภาษาไทยและภาษาอังกฤษ)
      excelParsedRows = rows.map((row, idx) => ({
        _rowNum:     idx + 2,
        title:       (row['ชื่ออุปกรณ์'] || row['title'] || row['name'] || '').toString().trim(),
        assetCode:   (row['รหัสอุปกรณ์'] || row['assetCode'] || row['code'] || '').toString().trim(),
        category:    (row['หมวดหมู่'] || row['category'] || 'ครุภัณฑ์').toString().trim(),
        imageUrl:    (row['URL รูปภาพ'] || row['imageUrl'] || row['image'] || '').toString().trim(),
        description: (row['รายละเอียด'] || row['description'] || '').toString().trim(),
        _valid:      !!(row['ชื่ออุปกรณ์'] || row['title'] || row['name']) &&
                     !!(row['รหัสอุปกรณ์'] || row['assetCode'] || row['code'])
      }));

      renderExcelPreview();
      showToast(`พบข้อมูล ${excelParsedRows.length} รายการ`, 'success');
    } catch (err) {
      console.error('Excel parse error:', err);
      showToast('ไม่สามารถอ่านไฟล์ Excel ได้: ' + err.message, 'error');
    }
  };
  reader.readAsArrayBuffer(file);
}

/**
 * Parse Word (.docx) file ด้วย mammoth.js
 * รองรับ:
 *   - ตาราง (table) ที่มี header row
 *   - รายการ bullet list แบบ "ชื่อ | รหัส | หมวดหมู่"
 */
function parseDocxFile(file) {
  if (!window.mammoth) {
    showToast('ไม่พบ mammoth.js library — กรุณา refresh หน้าเว็บ', 'error');
    return;
  }

  if (!file.name.match(/\.docx$/i)) {
    showToast('กรุณาเลือกเฉพาะไฟล์ .docx', 'error');
    return;
  }

  showToast('กำลังอ่านไฟล์ Word...', 'info');

  const reader = new FileReader();
  reader.onload = async (e) => {
    try {
      const arrayBuffer = e.target.result;

      // แปลง docx → HTML ด้วย mammoth
      const result = await mammoth.convertToHtml({ arrayBuffer });
      const html   = result.value;

      // parse HTML เพื่อดึง table
      const parser  = new DOMParser();
      const htmlDoc = parser.parseFromString(html, 'text/html');
      const tables  = htmlDoc.querySelectorAll('table');

      if (tables.length > 0) {
        // ─── กรณี 1: ไฟล์มีตาราง ───
        excelParsedRows = parseDocxTable(tables[0]);
      } else {
        // ─── กรณี 2: ไม่มีตาราง — ลอง parse จาก paragraph list ───
        excelParsedRows = parseDocxParagraphs(htmlDoc);
      }

      if (excelParsedRows.length === 0) {
        showToast('ไม่พบข้อมูลอุปกรณ์ในไฟล์ Word — กรุณาตรวจสอบรูปแบบไฟล์', 'error');
        return;
      }

      renderExcelPreview();
      showToast(`อ่านไฟล์ Word สำเร็จ — พบ ${excelParsedRows.length} รายการ`, 'success');
    } catch (err) {
      console.error('Docx parse error:', err);
      showToast('ไม่สามารถอ่านไฟล์ Word ได้: ' + err.message, 'error');
    }
  };
  reader.readAsArrayBuffer(file);
}

/**
 * Parse ตาราง HTML จาก Word document
 * Row แรก = headers, rows ต่อๆ มา = data
 */
function parseDocxTable(table) {
  const rows = Array.from(table.querySelectorAll('tr'));
  if (rows.length < 2) return [];

  // อ่าน headers จาก row แรก
  const headerCells = Array.from(rows[0].querySelectorAll('th, td'))
    .map(cell => cell.textContent.trim().toLowerCase());

  // helper: หา index ของ header
  const colIdx = (candidates) => {
    for (const c of candidates) {
      const i = headerCells.findIndex(h => h.includes(c));
      if (i !== -1) return i;
    }
    return -1;
  };

  const titleIdx  = colIdx(['ชื่ออุปกรณ์', 'title', 'name', 'ชื่อ']);
  const codeIdx   = colIdx(['รหัสอุปกรณ์', 'assetcode', 'code', 'รหัส']);
  const catIdx    = colIdx(['หมวดหมู่', 'category', 'ประเภท']);
  const imgIdx    = colIdx(['url', 'image', 'รูป']);
  const descIdx   = colIdx(['รายละเอียด', 'description', 'หมายเหตุ', 'note']);

  const parsed = [];
  for (let i = 1; i < rows.length; i++) {
    const cells = Array.from(rows[i].querySelectorAll('td, th'))
      .map(cell => cell.textContent.trim());

    if (cells.every(c => !c)) continue; // ข้าม empty row

    const title     = titleIdx  >= 0 ? (cells[titleIdx]  || '') : (cells[0] || '');
    const assetCode = codeIdx   >= 0 ? (cells[codeIdx]   || '') : (cells[1] || '');
    const category  = catIdx    >= 0 ? (cells[catIdx]    || 'ครุภัณฑ์') : (cells[2] || 'ครุภัณฑ์');
    const imageUrl  = imgIdx    >= 0 ? (cells[imgIdx]    || '') : '';
    const description = descIdx >= 0 ? (cells[descIdx]   || '') : (cells[4] || '');

    parsed.push({
      _rowNum:  i + 1,
      title:    title.trim(),
      assetCode: assetCode.trim(),
      category:  category.trim(),
      imageUrl:  imageUrl.trim(),
      description: description.trim(),
      _valid:   !!title.trim() && !!assetCode.trim()
    });
  }
  return parsed;
}

/**
 * Parse paragraph list จาก Word (กรณีไม่มีตาราง)
 * รูปแบบที่รองรับ:
 *   - "ชื่อ | รหัส | หมวดหมู่ | รายละเอียด"
 *   - "ชื่อ, รหัส, หมวดหมู่"
 *   - "ชื่อ - รหัส"
 */
function parseDocxParagraphs(htmlDoc) {
  const paragraphs = Array.from(htmlDoc.querySelectorAll('p, li'))
    .map(el => el.textContent.trim())
    .filter(text => text.length > 0);

  const parsed = [];
  paragraphs.forEach((text, idx) => {
    // ลอง split ด้วย | หรือ , หรือ \t
    let parts = [];
    if (text.includes('|'))  parts = text.split('|').map(s => s.trim());
    else if (text.includes('\t')) parts = text.split('\t').map(s => s.trim());
    else if (text.includes(',') && text.split(',').length >= 2) parts = text.split(',').map(s => s.trim());
    else if (text.includes(' - ')) parts = text.split(' - ').map(s => s.trim());

    if (parts.length >= 2) {
      parsed.push({
        _rowNum:  idx + 1,
        title:    parts[0] || '',
        assetCode: parts[1] || '',
        category:  parts[2] || 'ครุภัณฑ์',
        imageUrl:  parts[3] || '',
        description: parts[4] || '',
        _valid:   !!parts[0] && !!parts[1]
      });
    }
  });
  return parsed;
}

/**
 * แสดงตาราง Preview ก่อน import
 */
function renderExcelPreview() {
  const previewSection = document.getElementById('excel-preview-section');
  const previewBody    = document.getElementById('excel-preview-body');
  const previewCount   = document.getElementById('excel-preview-count');

  if (!previewSection || !previewBody) return;

  const validCount   = excelParsedRows.filter(r => r._valid).length;
  const invalidCount = excelParsedRows.length - validCount;

  if (previewCount) {
    previewCount.innerHTML = `
      พบ <strong>${excelParsedRows.length}</strong> รายการ
      — <span class="text-green-600">${validCount} พร้อม import</span>
      ${invalidCount > 0 ? `<span class="text-red-500 ml-2">${invalidCount} ข้อมูลไม่ครบ</span>` : ''}
    `;
  }

  previewBody.innerHTML = excelParsedRows.map((row, idx) => `
    <tr class="${row._valid ? '' : 'bg-red-50'}">
      <td class="px-3 py-2 text-gray-400">${idx + 1}</td>
      <td class="px-3 py-2 font-medium ${row.title ? 'text-slate-800' : 'text-red-500'}">
        ${escapeHtml(row.title || '⚠ ไม่มีชื่อ')}
      </td>
      <td class="px-3 py-2 ${row.assetCode ? 'text-slate-600' : 'text-red-500'}">
        ${escapeHtml(row.assetCode || '⚠ ไม่มีรหัส')}
      </td>
      <td class="px-3 py-2 text-slate-500">${escapeHtml(row.category || '-')}</td>
      <td class="px-3 py-2">
        ${row._valid
          ? '<span class="inline-flex items-center gap-1 text-green-700 bg-green-50 px-2 py-0.5 rounded-full text-[10px] font-semibold">✅ พร้อม</span>'
          : '<span class="inline-flex items-center gap-1 text-red-700 bg-red-50 px-2 py-0.5 rounded-full text-[10px] font-semibold">❌ ข้อมูลไม่ครบ</span>'
        }
      </td>
    </tr>
  `).join('');

  previewSection.classList.remove('hidden');
  document.getElementById('excel-progress-container')?.classList.add('hidden');
}

/**
 * Batch import equipment รายการที่ valid ไปยัง Firestore
 */
async function batchImportEquipment() {
  const validRows = excelParsedRows.filter(r => r._valid);
  if (validRows.length === 0) {
    showToast('ไม่มีรายการที่พร้อม import', 'error');
    return;
  }

  const importBtn = document.getElementById('excel-import-btn');
  const progressContainer = document.getElementById('excel-progress-container');
  const progressBar  = document.getElementById('excel-progress-bar');
  const progressText = document.getElementById('excel-progress-text');

  if (importBtn) {
    importBtn.disabled = true;
    importBtn.innerHTML = `<span class="material-symbols-outlined text-base animate-spin">progress_activity</span> กำลังนำเข้า...`;
  }
  if (progressContainer) progressContainer.classList.remove('hidden');

  let successCount = 0;
  let failCount    = 0;

  for (let i = 0; i < validRows.length; i++) {
    const row = validRows[i];
    try {
      await addDoc(collection(db, 'equipment'), {
        title:       row.title,
        assetCode:   row.assetCode,
        category:    row.category || 'ครุภัณฑ์',
        imageUrl:    row.imageUrl || '',
        description: row.description || '',
        status:      'available',
        createdAt:   serverTimestamp(),
        updatedAt:   serverTimestamp()
      });
      successCount++;
    } catch (err) {
      console.error(`Failed to import row ${row._rowNum}:`, err);
      failCount++;
    }

    // อัปเดต progress bar
    const pct = Math.round(((i + 1) / validRows.length) * 100);
    if (progressBar)  progressBar.style.width = `${pct}%`;
    if (progressText) progressText.textContent = `${i + 1} / ${validRows.length}`;
  }

  // Reset UI
  if (importBtn) {
    importBtn.disabled = false;
    importBtn.innerHTML = `<span class="material-symbols-outlined text-base">cloud_upload</span> นำเข้าอุปกรณ์ทั้งหมด`;
  }

  if (successCount > 0) {
    showStatusPopup({
      success: true,
      title: 'นำเข้าสำเร็จ!',
      message: `นำเข้าอุปกรณ์เรียบร้อยแล้ว ${successCount} รายการ${failCount > 0 ? ` (ล้มเหลว ${failCount} รายการ)` : ''}`
    });
    showToast(`นำเข้าสำเร็จ ${successCount} รายการ`, 'success');

    // Reset state
    excelParsedRows = [];
    const fileInput = document.getElementById('excel-file-input');
    if (fileInput) fileInput.value = '';
    document.getElementById('excel-preview-section')?.classList.add('hidden');
    document.getElementById('excel-progress-container')?.classList.add('hidden');
  } else {
    showToast('นำเข้าไม่สำเร็จ กรุณาลองใหม่', 'error');
  }
}

/**
 * ดาวน์โหลด CSV Template สำหรับ Excel import
 */
function downloadExcelTemplate() {
  const headers = ['ชื่ออุปกรณ์', 'รหัสอุปกรณ์', 'หมวดหมู่', 'URL รูปภาพ', 'รายละเอียด'];
  const examples = [
    ['โปรเจกเตอร์ EPSON EB-X51', 'EQ-001', 'ครุภัณฑ์', '', 'ความละเอียด XGA รองรับ HDMI'],
    ['ลูกฟุตบอล Molten F5U2800', 'SP-001', 'กีฬา', '', 'เบอร์ 5 หนังแท้'],
    ['ไมโครโฟนลอยไร้สาย', 'AV-001', 'อุปกรณ์จิปาถะ', '', 'พร้อมรีซีฟเวอร์ UHF']
  ];

  const csvContent = [headers, ...examples]
    .map(row => row.map(cell => `"${cell}"`).join(','))
    .join('\r\n');

  // เพิ่ม BOM สำหรับ UTF-8 ให้ Excel อ่านภาษาไทยได้
  const bom = '\uFEFF';
  const blob = new Blob([bom + csvContent], { type: 'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href     = url;
  link.download = 'smo_equipment_template.csv';
  link.click();
  URL.revokeObjectURL(url);
  showToast('ดาวน์โหลด Template เรียบร้อยแล้ว', 'success');
}
