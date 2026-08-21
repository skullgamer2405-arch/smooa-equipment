// ============================================
// Booking Module — Equipment Booking Form
// สโมสรนักศึกษาราชวิทยาลัยจุฬาภรณ์
// ============================================

import {
  db,
  collection, doc, getDoc, addDoc,
  Timestamp, serverTimestamp
} from './firebase-config.js';

// ---- DOM Elements ----
const bookingForm     = document.getElementById('booking-form');
const submitBtn       = document.getElementById('submit-btn');
const equipmentInfo   = document.getElementById('equipment-info');
const equipmentTitle  = document.getElementById('equipment-title');
const equipmentCode   = document.getElementById('equipment-code');
const equipmentImage  = document.getElementById('equipment-image');

// Form fields
const fullNameInput    = document.getElementById('student-fullname');
const studentIdInput   = document.getElementById('student-id');
const facultyInput     = document.getElementById('student-faculty');
const departmentInput  = document.getElementById('student-department');
const affiliationInput = document.getElementById('student-affiliation');
const startDateInput   = document.getElementById('start-date');
const endDateInput     = document.getElementById('end-date');
const activityNameInput = document.getElementById('activity-name');
const reasonInput      = document.getElementById('borrow-reason');
const termsCheckbox    = document.getElementById('terms-checkbox');

// Summary elements
const summaryEquipment = document.getElementById('summary-equipment');
const summaryDates     = document.getElementById('summary-dates');
const summaryBorrower  = document.getElementById('summary-borrower');

// ---- State ----
let currentEquipment = null;

// ---- Initialize ----
document.addEventListener('DOMContentLoaded', () => {
  loadEquipmentFromURL();
  initFormHandlers();
  initSummaryUpdates();
});

/**
 * Load equipment details from URL query parameter
 */
async function loadEquipmentFromURL() {
  const urlParams   = new URLSearchParams(window.location.search);
  const equipmentId = urlParams.get('id');

  if (!equipmentId) {
    showError('ไม่พบรหัสอุปกรณ์ กรุณาเลือกอุปกรณ์จากหน้ารายการ');
    disableForm('ไม่พบรหัสอุปกรณ์');
    return;
  }

  try {
    const docRef  = doc(db, 'equipment', equipmentId);
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) {
      showError('ไม่พบอุปกรณ์นี้ในระบบ');
      disableForm('ไม่พบอุปกรณ์');
      return;
    }

    currentEquipment = { id: docSnap.id, ...docSnap.data() };
    displayEquipmentInfo(currentEquipment);

    if (currentEquipment.status !== 'available') {
      disableForm('อุปกรณ์นี้ไม่พร้อมให้ยืมในขณะนี้');
    }
  } catch (error) {
    console.error('Error loading equipment:', error);
    showError('เกิดข้อผิดพลาดในการโหลดข้อมูลอุปกรณ์');
    disableForm('โหลดข้อมูลไม่สำเร็จ');
  }
}

/**
 * Display equipment info in the info card
 */
function displayEquipmentInfo(equipment) {
  if (equipmentTitle) equipmentTitle.textContent = equipment.title || '';
  if (equipmentCode)  equipmentCode.textContent  = equipment.assetCode || '';
  if (equipmentImage) {
    equipmentImage.src = equipment.imageUrl || 'https://placehold.co/400x300/1a365d/white?text=No+Image';
    equipmentImage.alt = equipment.title || 'Equipment';
    // fallback ถ้ารูปโหลดไม่ได้
    equipmentImage.onerror = () => {
      equipmentImage.src = 'https://placehold.co/400x300/1a365d/white?text=No+Image';
    };
  }

  const catEl = document.getElementById('equipment-category');
  if (catEl) catEl.textContent = equipment.category || '';

  if (summaryEquipment) summaryEquipment.textContent = equipment.title || '';
}

/**
 * Initialize form submission handler
 */
function initFormHandlers() {
  if (!bookingForm) return;

  // ป้องกัน double submit — ใช้ submit event เดียว
  bookingForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    await handleSubmit();
  });

  // Set minimum date to today
  const today = new Date();
  const todayStr = formatDateInput(today);
  if (startDateInput) startDateInput.min = todayStr;
  if (endDateInput)   endDateInput.min   = todayStr;

  // When start date changes, update end date minimum
  if (startDateInput) {
    startDateInput.addEventListener('change', () => {
      if (endDateInput) {
        endDateInput.min = startDateInput.value;
        if (endDateInput.value && endDateInput.value < startDateInput.value) {
          endDateInput.value = startDateInput.value;
        }
      }
      updateSummary();
    });
  }
}

/**
 * Initialize real-time summary updates
 */
function initSummaryUpdates() {
  const trackedInputs = [fullNameInput, studentIdInput, startDateInput, endDateInput];
  trackedInputs.forEach(input => {
    if (input) {
      input.addEventListener('input',  updateSummary);
      input.addEventListener('change', updateSummary);
    }
  });
}

function updateSummary() {
  if (summaryBorrower && fullNameInput) {
    const name = fullNameInput.value || '-';
    const sid  = studentIdInput?.value || '-';
    summaryBorrower.innerHTML = `${escapeHtml(name)}<br><span class="text-xs text-gray-400">${escapeHtml(sid)}</span>`;
  }

  if (summaryDates && startDateInput && endDateInput) {
    const start = startDateInput.value ? formatDateThai(parseDateInput(startDateInput.value)) : '-';
    const end   = endDateInput.value   ? formatDateThai(parseDateInput(endDateInput.value))   : '-';
    summaryDates.textContent = `${start} ถึง ${end}`;
  }
}

/**
 * Handle form submission
 */
async function handleSubmit() {
  if (!submitBtn || submitBtn.disabled) return; // ป้องกัน double submit

  const errors = validateForm();
  if (errors.length > 0) {
    showValidationErrors(errors);
    return;
  }

  if (!currentEquipment) {
    showError('ไม่พบข้อมูลอุปกรณ์');
    return;
  }

  setSubmitLoading(true);

  try {
    // FIX timezone: แปลงวันที่เป็น local Date ด้วย parseDateInput
    const startDate = parseDateInput(startDateInput.value);
    const endDate   = parseDateInput(endDateInput.value);

    const bookingData = {
      equipmentId:   currentEquipment.id,
      assetCode:     currentEquipment.assetCode     || '',
      equipmentName: currentEquipment.title         || '',
      fullName:      fullNameInput.value.trim(),
      studentId:     studentIdInput.value.trim(),
      faculty:       facultyInput?.value.trim()      || '',
      department:    departmentInput?.value.trim()   || '',
      affiliation:   affiliationInput?.value.trim()  || '',
      startDate:     Timestamp.fromDate(startDate),
      endDate:       Timestamp.fromDate(endDate),
      activityName:  activityNameInput.value.trim(),
      reason:        reasonInput.value.trim(),
      status:        'pending',
      createdAt:     serverTimestamp()
    };

    await addDoc(collection(db, 'bookings'), bookingData);

    // Redirect to success page
    window.location.href = 'success.html';

  } catch (error) {
    console.error('Error submitting booking:', error);
    showError('เกิดข้อผิดพลาดในการส่งคำขอ กรุณาลองใหม่อีกครั้ง');
    setSubmitLoading(false);
  }
}

/**
 * Validate form fields — ครอบคลุม faculty, department, affiliation
 */
function validateForm() {
  const errors = [];

  if (!fullNameInput?.value.trim())
    errors.push('กรุณากรอกชื่อ-นามสกุล');

  if (!studentIdInput?.value.trim())
    errors.push('กรุณากรอกรหัสนักศึกษา');

  if (!facultyInput?.value.trim())
    errors.push('กรุณากรอกคณะ');

  if (!departmentInput?.value.trim())
    errors.push('กรุณากรอกสาขาวิชา');

  if (!startDateInput?.value)
    errors.push('กรุณาเลือกวันที่เริ่มใช้');

  if (!endDateInput?.value)
    errors.push('กรุณาเลือกวันที่สิ้นสุด');

  if (startDateInput?.value && endDateInput?.value && startDateInput.value > endDateInput.value)
    errors.push('วันที่สิ้นสุดต้องไม่ก่อนวันที่เริ่มใช้');

  if (!activityNameInput?.value.trim())
    errors.push('กรุณากรอกชื่อโครงการ/กิจกรรม');

  if (!reasonInput?.value.trim())
    errors.push('กรุณากรอกเหตุผลในการยืม');

  if (reasonInput?.value.trim().length > 1000)
    errors.push('เหตุผลการใช้งานต้องไม่เกิน 1,000 ตัวอักษร');

  if (!termsCheckbox?.checked)
    errors.push('กรุณายอมรับเงื่อนไขการยืมอุปกรณ์');

  return errors;
}

/**
 * Show validation errors
 */
function showValidationErrors(errors) {
  const existingErrors = document.getElementById('validation-errors');
  if (existingErrors) existingErrors.remove();

  const errorDiv = document.createElement('div');
  errorDiv.id        = 'validation-errors';
  errorDiv.className = 'mb-4 p-4 bg-red-50 border border-red-200 rounded-xl';
  errorDiv.innerHTML = `
    <div class="flex items-start gap-2">
      <span class="material-symbols-outlined text-red-500 mt-0.5">error</span>
      <div>
        <p class="font-semibold text-red-700 font-['Prompt'] text-sm">กรุณาตรวจสอบข้อมูล</p>
        <ul class="mt-1 text-sm text-red-600 font-['Sarabun'] list-disc list-inside">
          ${errors.map(e => `<li>${escapeHtml(e)}</li>`).join('')}
        </ul>
      </div>
    </div>
  `;

  if (bookingForm) {
    bookingForm.insertBefore(errorDiv, bookingForm.firstChild);
    errorDiv.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  setTimeout(() => {
    errorDiv.classList.add('opacity-0', 'transition-opacity', 'duration-500');
    setTimeout(() => errorDiv.remove(), 500);
  }, 5000);
}

/**
 * Show/hide submit loading state
 */
function setSubmitLoading(loading) {
  if (!submitBtn) return;

  submitBtn.disabled = loading;
  if (loading) {
    submitBtn.innerHTML = `
      <svg class="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
      </svg>
      <span>กำลังส่งคำขอ...</span>
    `;
  } else {
    submitBtn.innerHTML = `
      ยืนยันการส่งคำขอจอง
      <span class="material-symbols-outlined">send</span>
    `;
  }
}

/**
 * Show error message banner
 */
function showError(message) {
  const existingErrors = document.getElementById('validation-errors');
  if (existingErrors) existingErrors.remove();

  const errorDiv = document.createElement('div');
  errorDiv.id        = 'validation-errors';
  errorDiv.className = 'mb-4 p-4 bg-red-50 border border-red-200 rounded-xl';
  errorDiv.innerHTML = `
    <div class="flex items-center gap-2">
      <span class="material-symbols-outlined text-red-500">error</span>
      <p class="text-red-700 font-['Sarabun'] text-sm">${escapeHtml(message)}</p>
    </div>
  `;

  const mainContent = document.querySelector('main') || document.body;
  mainContent.insertBefore(errorDiv, mainContent.firstChild);
}

/**
 * Disable the entire form
 */
function disableForm(message) {
  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.classList.remove('bg-[#f59e0b]', 'bg-secondary', 'hover:shadow-md');
    submitBtn.classList.add('bg-gray-300', 'cursor-not-allowed');
    submitBtn.innerHTML = `
      <span class="material-symbols-outlined">block</span>
      ${escapeHtml(message)}
    `;
  }
}

// ============================================
// Utilities
// ============================================

/**
 * แปลง "YYYY-MM-DD" → local Date ป้องกัน timezone bug
 */
function parseDateInput(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d);
}

/**
 * แปลง Date → "YYYY-MM-DD" สำหรับ input[type=date]
 */
function formatDateInput(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Format date to Thai locale
 */
function formatDateThai(date) {
  if (!(date instanceof Date) || isNaN(date)) return '-';
  return date.toLocaleDateString('th-TH', {
    year: 'numeric', month: 'short', day: 'numeric'
  });
}

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
