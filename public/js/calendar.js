// ============================================
// Calendar Module — Booking Calendar Page
// สโมสรนักศึกษาราชวิทยาลัยจุฬาภรณ์
// ============================================

import {
  db, auth,
  collection, addDoc, query, where, orderBy,
  Timestamp, serverTimestamp, onSnapshot, onAuthStateChanged
} from './firebase-config.js';

// ---- State ----
let currentYear  = new Date().getFullYear();
let currentMonth = new Date().getMonth(); // 0-indexed
let bookings        = [];
let calendarEntries = [];
let selectedDate    = null;
let isAdmin         = false;

// เก็บ unsubscribe functions
const unsubscribers = [];

// ---- Thai month names ----
const THAI_MONTHS = [
  'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน',
  'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม',
  'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'
];

// Color palette for events
const EVENT_COLORS = [
  { bg: 'bg-blue-100',   text: 'text-blue-700',   border: 'border-blue-200' },
  { bg: 'bg-orange-100', text: 'text-orange-700',  border: 'border-orange-200' },
  { bg: 'bg-green-100',  text: 'text-green-700',   border: 'border-green-200' },
  { bg: 'bg-purple-100', text: 'text-purple-700',  border: 'border-purple-200' },
  { bg: 'bg-pink-100',   text: 'text-pink-700',    border: 'border-pink-200' },
  { bg: 'bg-teal-100',   text: 'text-teal-700',    border: 'border-teal-200' },
];

// ---- DOM Elements ----
const calendarDays    = document.getElementById('calendar-days');
const monthDisplay    = document.getElementById('month-display');
const prevMonthBtn    = document.getElementById('prev-month-btn');
const nextMonthBtn    = document.getElementById('next-month-btn');
const todayBtn        = document.getElementById('today-btn');
const dayDetailPanel  = document.getElementById('day-detail-panel');
const dayDetailDate   = document.getElementById('day-detail-date');
const dayDetailCount  = document.getElementById('day-detail-count');
const dayDetailList   = document.getElementById('day-detail-list');
const addCalendarModal = document.getElementById('add-calendar-modal');
const openModalBtn    = document.getElementById('open-modal-btn');
const modalCancelBtn  = document.getElementById('modal-cancel-btn');
const modalSaveBtn    = document.getElementById('modal-save-btn');

// ---- Initialize ----
document.addEventListener('DOMContentLoaded', () => {
  initNavigation();
  initModal();
  loadData();
  checkAdminStatus();
});

// Cleanup เมื่อออกจากหน้า
window.addEventListener('beforeunload', () => {
  unsubscribers.forEach(unsub => unsub());
});

/**
 * Check if current user is admin (for showing add button)
 */
function checkAdminStatus() {
  onAuthStateChanged(auth, (user) => {
    isAdmin = !!user;
    if (openModalBtn) {
      openModalBtn.classList.toggle('hidden', !isAdmin);
    }
  });
}

/**
 * Initialize month navigation buttons
 */
function initNavigation() {
  if (prevMonthBtn) {
    prevMonthBtn.addEventListener('click', () => {
      currentMonth--;
      if (currentMonth < 0) {
        currentMonth = 11;
        currentYear--;
      }
      renderCalendar();
    });
  }

  if (nextMonthBtn) {
    nextMonthBtn.addEventListener('click', () => {
      currentMonth++;
      if (currentMonth > 11) {
        currentMonth = 0;
        currentYear++;
      }
      renderCalendar();
    });
  }

  if (todayBtn) {
    todayBtn.addEventListener('click', () => {
      const today = new Date();
      currentYear  = today.getFullYear();
      currentMonth = today.getMonth();
      renderCalendar();
      selectDate(today);
    });
  }
}

/**
 * Load bookings + calendar entries from Firestore
 */
function loadData() {
  // Listen to approved bookings
  const bookingsRef = collection(db, 'bookings');
  const q = query(bookingsRef, where('status', '==', 'approved'), orderBy('startDate', 'asc'));

  const unsubBookings = onSnapshot(q, (snapshot) => {
    bookings = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
    renderCalendar();
    if (selectedDate) updateDayDetail(selectedDate);
  }, (err) => {
    console.error('Error loading bookings:', err);
  });
  unsubscribers.push(unsubBookings);

  // Listen to calendar entries
  const entriesRef = collection(db, 'calendarEntries');
  const unsubEntries = onSnapshot(entriesRef, (snapshot) => {
    calendarEntries = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
    renderCalendar();
    if (selectedDate) updateDayDetail(selectedDate);
  }, (err) => {
    console.error('Error loading calendar entries:', err);
  });
  unsubscribers.push(unsubEntries);
}

/**
 * Render the calendar grid for current month/year
 */
function renderCalendar() {
  if (!calendarDays) return;

  if (monthDisplay) {
    monthDisplay.textContent = `${THAI_MONTHS[currentMonth]} ${currentYear + 543}`;
  }

  const firstDay = new Date(currentYear, currentMonth, 1).getDay();
  const daysInMonth     = new Date(currentYear, currentMonth + 1, 0).getDate();
  const daysInPrevMonth = new Date(currentYear, currentMonth, 0).getDate();
  const today = new Date();

  let html = '';

  // Previous month's trailing days
  for (let i = firstDay - 1; i >= 0; i--) {
    const day = daysInPrevMonth - i;
    html += `
      <div class="min-h-[100px] p-2 bg-gray-50/50 border border-gray-100 rounded-lg opacity-40">
        <span class="text-xs text-gray-400 font-['Sarabun']">${day}</span>
      </div>
    `;
  }

  // Current month's days
  for (let day = 1; day <= daysInMonth; day++) {
    const date      = new Date(currentYear, currentMonth, day);
    const isToday   = date.toDateString() === today.toDateString();
    const isSelected = selectedDate && date.toDateString() === selectedDate.toDateString();
    const dayEvents = getEventsForDate(date);

    const todayClass    = isToday ? 'ring-2 ring-[#f59e0b] ring-offset-1' : '';
    const selectedClass = isSelected ? 'bg-blue-50 border-[#1a365d]' : 'bg-white border-gray-100 hover:border-[#1a365d]/30';
    const todayBadge    = isToday
      ? `<span class="inline-flex items-center justify-center w-6 h-6 rounded-full bg-[#f59e0b] text-white text-xs font-bold">${day}</span>`
      : `<span class="text-sm text-gray-700 font-['Sarabun']">${day}</span>`;

    const eventsHTML = dayEvents.slice(0, 3).map((event, idx) => {
      const color = EVENT_COLORS[idx % EVENT_COLORS.length];
      return `<div class="text-[10px] px-1.5 py-0.5 rounded ${color.bg} ${color.text} truncate font-['Sarabun']">${escapeHtml(event.title)}</div>`;
    }).join('');

    const moreCount = dayEvents.length > 3
      ? `<div class="text-[10px] text-gray-400 px-1 font-['Sarabun']">+${dayEvents.length - 3} อื่นๆ</div>`
      : '';

    html += `
      <div class="min-h-[100px] p-2 ${selectedClass} border rounded-lg cursor-pointer transition-all duration-200 ${todayClass} calendar-day"
           data-date="${date.toISOString()}">
        <div class="flex justify-between items-start mb-1">
          ${todayBadge}
          ${dayEvents.length > 0 ? `<span class="text-[10px] px-1.5 py-0.5 rounded-full bg-[#1a365d] text-white">${dayEvents.length}</span>` : ''}
        </div>
        <div class="space-y-0.5">
          ${eventsHTML}
          ${moreCount}
        </div>
      </div>
    `;
  }

  // Next month's leading days
  const totalCells    = firstDay + daysInMonth;
  const remainingCells = totalCells % 7 === 0 ? 0 : 7 - (totalCells % 7);
  for (let i = 1; i <= remainingCells; i++) {
    html += `
      <div class="min-h-[100px] p-2 bg-gray-50/50 border border-gray-100 rounded-lg opacity-40">
        <span class="text-xs text-gray-400 font-['Sarabun']">${i}</span>
      </div>
    `;
  }

  calendarDays.innerHTML = html;

  // Bind click — event delegation แทน inline onclick
  calendarDays.querySelectorAll('.calendar-day').forEach(cell => {
    cell.addEventListener('click', () => {
      selectDate(new Date(cell.dataset.date));
    });
  });
}

/**
 * Get events for a specific date (from bookings + calendar entries)
 * FIX: clone Date objects ก่อน setHours เพื่อไม่ mutate ข้อมูลต้นฉบับ
 */
function getEventsForDate(date) {
  const events = [];

  // midnight ของวันที่ต้องการ
  const dayStart = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0);
  const dayEnd   = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999);

  // From approved bookings
  bookings.forEach(booking => {
    // clone ก่อนใช้ — ไม่แก้ไข object ใน array โดยตรง
    const rawStart = booking.startDate?.toDate ? booking.startDate.toDate() : new Date(booking.startDate);
    const rawEnd   = booking.endDate?.toDate   ? booking.endDate.toDate()   : new Date(booking.endDate);

    const bookingStart = new Date(rawStart.getFullYear(), rawStart.getMonth(), rawStart.getDate(), 0, 0, 0, 0);
    const bookingEnd   = new Date(rawEnd.getFullYear(),   rawEnd.getMonth(),   rawEnd.getDate(),   23, 59, 59, 999);

    if (dayStart <= bookingEnd && dayEnd >= bookingStart) {
      events.push({
        type:      'booking',
        title:     booking.equipmentName || booking.assetCode,
        borrower:  booking.fullName,
        status:    booking.status,
        startDate: booking.startDate,
        endDate:   booking.endDate,
        id:        booking.id
      });
    }
  });

  // From calendar entries
  calendarEntries.forEach(entry => {
    const rawEntryDate = entry.date?.toDate ? entry.date.toDate() : new Date(entry.date);
    const entryDate    = new Date(rawEntryDate.getFullYear(), rawEntryDate.getMonth(), rawEntryDate.getDate());
    if (entryDate.toDateString() === dayStart.toDateString()) {
      events.push({
        type:      'entry',
        title:     entry.activityName,
        equipment: entry.equipmentName,
        startTime: entry.startTime,
        endTime:   entry.endTime,
        id:        entry.id
      });
    }
  });

  return events;
}

/**
 * Select a date and show details
 */
function selectDate(date) {
  if (typeof date === 'string') date = new Date(date);
  selectedDate = date;
  renderCalendar();
  updateDayDetail(date);
}

/**
 * Update the day detail panel
 */
function updateDayDetail(date) {
  const dayEvents = getEventsForDate(date);

  if (dayDetailDate) {
    dayDetailDate.textContent = date.toLocaleDateString('th-TH', {
      weekday: 'long',
      year:    'numeric',
      month:   'long',
      day:     'numeric'
    });
  }

  if (dayDetailCount) {
    dayDetailCount.textContent = `${dayEvents.length} รายการ`;
  }

  if (dayDetailList) {
    if (dayEvents.length === 0) {
      dayDetailList.innerHTML = `
        <div class="text-center py-8 text-gray-400">
          <span class="material-symbols-outlined text-4xl">event_available</span>
          <p class="mt-2 font-['Sarabun']">ไม่มีรายการในวันนี้</p>
        </div>
      `;
    } else {
      dayDetailList.innerHTML = dayEvents.map((event, idx) => {
        const color = EVENT_COLORS[idx % EVENT_COLORS.length];
        if (event.type === 'booking') {
          return `
            <div class="p-3 rounded-lg border ${color.border} ${color.bg} mb-2">
              <div class="flex items-center gap-2 mb-1">
                <span class="material-symbols-outlined text-sm ${color.text}">devices</span>
                <span class="font-semibold text-sm ${color.text} font-['Prompt']">${escapeHtml(event.title)}</span>
              </div>
              <p class="text-xs text-gray-600 font-['Sarabun']">ผู้ยืม: ${escapeHtml(event.borrower)}</p>
              <span class="inline-block mt-1 text-[10px] px-2 py-0.5 rounded-full bg-green-100 text-green-700">อนุมัติแล้ว</span>
            </div>
          `;
        } else {
          return `
            <div class="p-3 rounded-lg border ${color.border} ${color.bg} mb-2">
              <div class="flex items-center gap-2 mb-1">
                <span class="material-symbols-outlined text-sm ${color.text}">event</span>
                <span class="font-semibold text-sm ${color.text} font-['Prompt']">${escapeHtml(event.title)}</span>
              </div>
              ${event.startTime ? `<p class="text-xs text-gray-600 font-['Sarabun']">${escapeHtml(event.startTime)} - ${escapeHtml(event.endTime)}</p>` : ''}
              ${event.equipment ? `<p class="text-xs text-gray-600 font-['Sarabun']">อุปกรณ์: ${escapeHtml(event.equipment)}</p>` : ''}
            </div>
          `;
        }
      }).join('');
    }
  }
}

// ============================================
// Modal — Add Calendar Entry
// ============================================

/**
 * Initialize modal for adding calendar entries
 */
function initModal() {
  if (openModalBtn) {
    openModalBtn.addEventListener('click', () => {
      if (addCalendarModal) {
        addCalendarModal.classList.remove('hidden');
        const modalDate = document.getElementById('modal-date');
        if (modalDate && selectedDate) {
          // FIX timezone: ใช้ local date ไม่ใช่ ISO string ที่ถูก convert เป็น UTC
          const y = selectedDate.getFullYear();
          const m = String(selectedDate.getMonth() + 1).padStart(2, '0');
          const d = String(selectedDate.getDate()).padStart(2, '0');
          modalDate.value = `${y}-${m}-${d}`;
        }
      }
    });
  }

  if (modalCancelBtn) {
    modalCancelBtn.addEventListener('click', closeModal);
  }

  if (addCalendarModal) {
    addCalendarModal.addEventListener('click', (e) => {
      if (e.target === addCalendarModal) closeModal();
    });
  }

  if (modalSaveBtn) {
    modalSaveBtn.addEventListener('click', saveCalendarEntry);
  }
}

function closeModal() {
  if (addCalendarModal) addCalendarModal.classList.add('hidden');
}

/**
 * Save a new calendar entry to Firestore
 * FIX timezone: แปลง date string เป็น local Date ด้วย new Date(y, m, d)
 */
async function saveCalendarEntry() {
  const modalDate      = document.getElementById('modal-date');
  const modalStartTime = document.getElementById('modal-start-time');
  const modalEndTime   = document.getElementById('modal-end-time');
  const modalActivity  = document.getElementById('modal-activity');
  const modalEquipment = document.getElementById('modal-equipment');

  if (!modalDate?.value || !modalActivity?.value?.trim()) {
    alert('กรุณากรอกวันที่และชื่อกิจกรรม');
    return;
  }

  if (modalSaveBtn) {
    modalSaveBtn.disabled = true;
    modalSaveBtn.textContent = 'กำลังบันทึก...';
  }

  try {
    // FIX: แปลง "YYYY-MM-DD" เป็น local Date ไม่ใช่ UTC
    const [year, month, day] = modalDate.value.split('-').map(Number);
    const localDate = new Date(year, month - 1, day);

    await addDoc(collection(db, 'calendarEntries'), {
      date:         Timestamp.fromDate(localDate),
      startTime:    modalStartTime?.value || '',
      endTime:      modalEndTime?.value   || '',
      activityName: modalActivity.value.trim(),
      equipmentName: modalEquipment?.value || '',
      createdAt:    serverTimestamp()
    });

    closeModal();

    // Reset form
    if (modalDate)      modalDate.value      = '';
    if (modalStartTime) modalStartTime.value = '';
    if (modalEndTime)   modalEndTime.value   = '';
    if (modalActivity)  modalActivity.value  = '';
    if (modalEquipment) modalEquipment.selectedIndex = 0;

  } catch (error) {
    console.error('Error saving calendar entry:', error);
    alert('เกิดข้อผิดพลาดในการบันทึก กรุณาลองใหม่');
  } finally {
    if (modalSaveBtn) {
      modalSaveBtn.disabled    = false;
      modalSaveBtn.textContent = 'บันทึกข้อมูล';
    }
  }
}

// ============================================
// Utilities
// ============================================

function escapeHtml(str) {
  if (typeof str !== 'string') return String(str ?? '');
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
