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
    where('status', '==', 'pending'),
    orderBy('createdAt', 'desc')
  );

  const unsub = onSnapshot(q, (snapshot) => {
    pendingBookings = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
    currentPage = 1; // reset to first page on new data
    renderPendingTable();
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
// Approve / Reject Bookings (ด้วย Transaction)
// ============================================

/**
 * Approve a booking request — ใช้ Transaction ป้องกัน race condition
 */
async function handleApprove(bookingId, btn) {
  if (!confirm('ต้องการอนุมัติคำขอยืมนี้ใช่หรือไม่?')) return;

  setButtonLoading(btn, true);

  try {
    // อ่านข้อมูล booking ก่อน
    const bookingRef = doc(db, 'bookings', bookingId);
    const bookingSnap = await getDoc(bookingRef);

    if (!bookingSnap.exists()) {
      showToast('ไม่พบคำขอนี้', 'error');
      return;
    }

    const bookingData = bookingSnap.data();

    // ตรวจ status อีกครั้งก่อน update (ป้องกัน approve ซ้ำ)
    if (bookingData.status !== 'pending') {
      showToast('คำขอนี้ถูกดำเนินการไปแล้ว', 'info');
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

    showToast('อนุมัติคำขอเรียบร้อยแล้ว', 'success');
  } catch (error) {
    console.error('Error approving booking:', error);
    showToast('เกิดข้อผิดพลาดในการอนุมัติ', 'error');
  } finally {
    setButtonLoading(btn, false);
  }
}

/**
 * Reject a booking request
 */
async function handleReject(bookingId, btn) {
  const reason = prompt('กรุณาระบุเหตุผลในการปฏิเสธ (ถ้ามี):');
  if (reason === null) return; // User cancelled

  setButtonLoading(btn, true);

  try {
    const bookingRef = doc(db, 'bookings', bookingId);
    const bookingSnap = await getDoc(bookingRef);

    if (!bookingSnap.exists() || bookingSnap.data().status !== 'pending') {
      showToast('คำขอนี้ถูกดำเนินการไปแล้ว', 'info');
      return;
    }

    await updateDoc(bookingRef, {
      status: 'rejected',
      adminNote: reason || '',
      rejectedAt: serverTimestamp()
    });

    showToast('ปฏิเสธคำขอเรียบร้อยแล้ว', 'info');
  } catch (error) {
    console.error('Error rejecting booking:', error);
    showToast('เกิดข้อผิดพลาดในการปฏิเสธ', 'error');
  } finally {
    setButtonLoading(btn, false);
  }
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
  if (!confirm('ต้องการลบอุปกรณ์นี้ใช่หรือไม่? การดำเนินการนี้ไม่สามารถย้อนกลับได้')) return;

  setButtonLoading(btn, true);
  try {
    await deleteDoc(doc(db, 'equipment', equipmentId));
    showToast('ลบอุปกรณ์เรียบร้อยแล้ว', 'success');
  } catch (error) {
    console.error('Error deleting equipment:', error);
    showToast('เกิดข้อผิดพลาดในการลบ', 'error');
  } finally {
    setButtonLoading(btn, false);
  }
}

/**
 * Mark equipment as returned
 */
async function handleMarkReturned(equipmentId, btn) {
  if (!confirm('ยืนยันว่าอุปกรณ์ได้ถูกส่งคืนแล้ว?')) return;

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

    showToast('บันทึกการคืนอุปกรณ์เรียบร้อยแล้ว', 'success');
  } catch (error) {
    console.error('Error marking returned:', error);
    showToast('เกิดข้อผิดพลาด', 'error');
  } finally {
    setButtonLoading(btn, false);
  }
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
