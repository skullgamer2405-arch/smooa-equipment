// ============================================
// Catalog Module — Equipment Catalog Page
// สโมสรนักศึกษาราชวิทยาลัยจุฬาภรณ์
// ============================================

import {
  db,
  collection, query, orderBy, onSnapshot
} from './firebase-config.js';

// ---- State ----
let allEquipment    = [];
let currentCategory = 'all';
let searchKeyword   = '';

// Map data-category values to Firestore category names
const CATEGORY_MAP = {
  'all':       null,
  'sports':    'กีฬา',
  'misc':      'อุปกรณ์จิปาถะ',
  'inventory': 'ครุภัณฑ์'
};

// เก็บ unsubscribe function
let unsubscribeSnapshot = null;

// ---- DOM Elements ----
const equipmentGrid    = document.getElementById('equipment-grid');
const newEquipmentList = document.getElementById('new-equipment-list');
const searchInput      = document.getElementById('search-input');
const loadingSpinner   = document.getElementById('loading-spinner');

// Stats elements on landing page
const statAvailableEl  = document.getElementById('stat-available-items');
const statTotalEl      = document.getElementById('stat-total-items');
const statPendingEl    = document.getElementById('stat-pending-requests');
const statBorrowedEl   = document.getElementById('stat-borrowed-items');

// ---- Initialize ----
document.addEventListener('DOMContentLoaded', () => {
  // Check URL params (e.g. ?category=sports or ?search=ball)
  const urlParams = new URLSearchParams(window.location.search);
  const catParam = urlParams.get('category');
  const searchParam = urlParams.get('search');

  if (catParam && CATEGORY_MAP.hasOwnProperty(catParam)) {
    currentCategory = catParam;
  }
  if (searchParam) {
    searchKeyword = searchParam.trim().toLowerCase();
    if (searchInput) {
      searchInput.value = searchParam;
    }
  }

  initCatalog();
  initSearch();
  initCategoryFilters();
  initLandingStats();
});

// Cleanup เมื่อออกจากหน้า
let unsubscribeStats = null;
window.addEventListener('beforeunload', () => {
  if (unsubscribeSnapshot) unsubscribeSnapshot();
  if (unsubscribeStats) unsubscribeStats();
});

/**
 * Load and display summary stats for landing page in real-time
 */
function initLandingStats() {
  if (!statAvailableEl && !statPendingEl && !statBorrowedEl) return;

  // Listen to bookings collection for pending & borrowed counts
  const bookingsQuery = query(collection(db, 'bookings'));
  unsubscribeStats = onSnapshot(bookingsQuery, (snapshot) => {
    let pendingCount = 0;
    let borrowedCount = 0;

    snapshot.docs.forEach(docSnap => {
      const data = docSnap.data();
      if (data.status === 'pending') {
        pendingCount++;
      } else if (data.status === 'approved' || data.status === 'borrowed') {
        borrowedCount++;
      }
    });

    if (statPendingEl) statPendingEl.textContent = pendingCount.toLocaleString('th-TH');
    if (statBorrowedEl) statBorrowedEl.textContent = borrowedCount.toLocaleString('th-TH');
  }, (err) => {
    console.warn('Could not fetch bookings stats:', err);
    if (statPendingEl && statPendingEl.textContent === '-') statPendingEl.textContent = '0';
    if (statBorrowedEl && statBorrowedEl.textContent === '-') statBorrowedEl.textContent = '0';
  });
}

/**
 * Update equipment stats cards
 */
function updateEquipmentStats() {
  if (!statAvailableEl && !statTotalEl) return;

  const total = allEquipment.length;
  const available = allEquipment.filter(item => item.status === 'available').length;
  const unavailable = total - available;

  if (statAvailableEl) statAvailableEl.textContent = available.toLocaleString('th-TH');
  if (statTotalEl) statTotalEl.textContent = total.toLocaleString('th-TH');

  // If bookings query is delayed, we can also supplement borrowed from unavailable equipment
  if (statBorrowedEl && (statBorrowedEl.textContent === '-' || statBorrowedEl.textContent === '0') && unavailable > 0) {
    statBorrowedEl.textContent = unavailable.toLocaleString('th-TH');
  }
}

/**
 * Load equipment from Firestore with real-time updates
 */
function initCatalog() {
  showLoading(true);

  const q = query(collection(db, 'equipment'), orderBy('createdAt', 'desc'));

  unsubscribeSnapshot = onSnapshot(q, (snapshot) => {
    allEquipment = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
    renderEquipment();
    renderNewEquipmentAnnouncements();
    updateEquipmentStats();
    showLoading(false);
  }, (error) => {
    console.error('Error loading equipment:', error);
    showLoading(false);

    // แสดง error state ที่ดีขึ้น แยก online/offline
    if (!navigator.onLine || error.code === 'unavailable') {
      showOfflineState();
    } else {
      showEmptyState('เกิดข้อผิดพลาดในการโหลดข้อมูล กรุณาลองใหม่อีกครั้ง');
    }
  });
}

/**
 * Initialize search functionality
 */
function initSearch() {
  if (!searchInput) return;

  let debounceTimer;
  searchInput.addEventListener('input', (e) => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      searchKeyword = e.target.value.trim().toLowerCase();
      renderEquipment();
    }, 300);
  });
}

/**
 * Initialize category filter buttons
 */
function initCategoryFilters() {
  const categoryButtons = document.querySelectorAll('[data-category]');
  if (!categoryButtons.length) return;

  // Set initial active state based on currentCategory
  categoryButtons.forEach(b => {
    if (b.dataset.category === currentCategory) {
      b.classList.remove('border', 'border-outline-variant', 'text-on-surface-variant', 'bg-white');
      b.classList.add('bg-primary', 'text-white');
    } else {
      b.classList.remove('bg-primary', 'text-white');
      b.classList.add('border', 'border-outline-variant', 'text-on-surface-variant', 'bg-white');
    }
  });

  categoryButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      categoryButtons.forEach(b => {
        b.classList.remove('bg-primary', 'text-white');
        b.classList.add('border', 'border-outline-variant', 'text-on-surface-variant', 'bg-white');
      });
      btn.classList.remove('border', 'border-outline-variant', 'text-on-surface-variant', 'bg-white');
      btn.classList.add('bg-primary', 'text-white');

      currentCategory = btn.dataset.category;
      renderEquipment();
    });
  });
}

/**
 * Filter and render equipment cards
 */
function renderEquipment() {
  if (!equipmentGrid) return;

  let filtered = [...allEquipment];

  // Filter by category
  const categoryName = CATEGORY_MAP[currentCategory];
  if (categoryName) {
    filtered = filtered.filter(eq => eq.category === categoryName);
  }

  // Filter by search keyword
  if (searchKeyword) {
    filtered = filtered.filter(eq =>
      eq.title?.toLowerCase().includes(searchKeyword) ||
      eq.assetCode?.toLowerCase().includes(searchKeyword) ||
      eq.description?.toLowerCase().includes(searchKeyword)
    );
  }

  if (filtered.length === 0) {
    showEmptyState('ไม่พบอุปกรณ์ที่ตรงกับการค้นหา');
    return;
  }

  equipmentGrid.innerHTML = filtered.map(eq => createEquipmentCard(eq)).join('');

  // Event delegation แทนการ bind ทีละปุ่ม
  equipmentGrid.querySelectorAll('.book-now-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const equipmentId = btn.dataset.equipmentId;
      if (equipmentId) window.location.href = `booking.html?id=${equipmentId}`;
    });
  });
}

/**
 * Create HTML for a single equipment card
 */
function createEquipmentCard(equipment) {
  const isAvailable = equipment.status === 'available';
  const statusText  = isAvailable ? 'ว่าง' : 'ไม่ว่าง';
  const statusColor = isAvailable ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700';

  const returnDateHTML = !isAvailable && equipment.returnDate
    ? `<p class="text-xs text-on-surface-variant mt-1">
        <span class="material-symbols-outlined text-xs align-middle">event</span>
        คืนวันที่: ${formatDate(equipment.returnDate)}
      </p>`
    : '';

  const imageUrl = escapeHtml(equipment.imageUrl || 'https://placehold.co/400x300/1a365d/white?text=No+Image');

  return `
    <div class="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-lg transition-all duration-300 flex flex-col group" data-equipment-id="${equipment.id}">
      <div class="relative overflow-hidden">
        <img src="${imageUrl}" alt="${escapeHtml(equipment.title)}" class="w-full h-48 object-cover group-hover:scale-105 transition-transform duration-500" loading="lazy" onerror="this.src='https://placehold.co/400x300/1a365d/white?text=No+Image'" />
        <span class="absolute top-3 right-3 px-3 py-1 rounded-full text-xs font-semibold ${statusColor}">
          ${statusText}
        </span>
        <span class="absolute top-3 left-3 px-2 py-1 rounded-md text-xs font-medium bg-[#1a365d]/80 text-white backdrop-blur-sm">
          ${escapeHtml(equipment.assetCode || '')}
        </span>
      </div>
      <div class="p-4 flex flex-col flex-1">
        <h3 class="font-semibold text-gray-800 font-['Prompt'] text-sm leading-tight">${escapeHtml(equipment.title)}</h3>
        <p class="text-xs text-gray-500 mt-1 font-['Sarabun']">${escapeHtml(equipment.category || '')}</p>
        ${returnDateHTML}
        <button
          class="book-now-btn mt-auto w-full py-2.5 rounded-lg font-medium text-sm transition-all duration-200 shadow-sm
            ${isAvailable
              ? 'bg-[#1a365d] text-white hover:bg-[#0f2440] active:scale-95'
              : 'bg-gray-100 text-gray-400 cursor-not-allowed'}"
          data-equipment-id="${equipment.id}"
          ${!isAvailable ? 'disabled' : ''}
        >
          ${isAvailable ? 'จองตอนนี้' : 'ไม่พร้อมให้ยืม'}
        </button>
      </div>
    </div>
  `;
}

/**
 * Show/hide loading spinner
 */
function showLoading(show) {
  if (loadingSpinner) loadingSpinner.classList.toggle('hidden', !show);
  if (equipmentGrid && show) equipmentGrid.innerHTML = '';
}

/**
 * Show empty state message
 */
function showEmptyState(message) {
  if (!equipmentGrid) return;
  equipmentGrid.innerHTML = `
    <div class="col-span-full flex flex-col items-center justify-center py-16 text-gray-400">
      <span class="material-symbols-outlined text-6xl mb-4">inventory_2</span>
      <p class="text-lg font-['Prompt']">${escapeHtml(message)}</p>
    </div>
  `;
}

/**
 * Show offline / connection error state
 */
function showOfflineState() {
  if (!equipmentGrid) return;
  equipmentGrid.innerHTML = `
    <div class="col-span-full flex flex-col items-center justify-center py-16 text-gray-400">
      <span class="material-symbols-outlined text-6xl mb-4 text-amber-400">wifi_off</span>
      <p class="text-lg font-['Prompt'] text-gray-600">ไม่สามารถโหลดข้อมูลได้</p>
      <p class="text-sm font-['Sarabun'] mt-1">กรุณาตรวจสอบการเชื่อมต่ออินเทอร์เน็ตและรีเฟรชหน้า</p>
      <button onclick="window.location.reload()" class="mt-4 px-5 py-2 bg-[#1a365d] text-white rounded-lg text-sm font-['Sarabun'] hover:bg-[#0f2440] transition-colors">
        รีเฟรช
      </button>
    </div>
  `;
}

/**
 * Format Firestore Timestamp to Thai date string
 */
function formatDate(timestamp) {
  if (!timestamp) return '';
  const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
  return date.toLocaleDateString('th-TH', {
    year: 'numeric', month: 'short', day: 'numeric'
  });
}

/**
 * Render New Equipment Announcements
 */
function renderNewEquipmentAnnouncements() {
  if (!newEquipmentList) return;

  if (allEquipment.length === 0) {
    newEquipmentList.innerHTML = `
      <div class="col-span-full py-8 text-center text-gray-400 font-['Sarabun'] text-sm">
        <span class="material-symbols-outlined text-3xl mb-1 text-gray-300">campaign</span>
        <p>ยังไม่มีประกาศอุปกรณ์ใหม่ในขณะนี้</p>
      </div>
    `;
    return;
  }

  // Take top 4 most recently added items
  const recentItems = allEquipment.slice(0, 4);

  newEquipmentList.innerHTML = recentItems.map(item => {
    const isAvailable = item.status === 'available';
    const imageUrl = escapeHtml(item.imageUrl || 'https://placehold.co/400x300/1a365d/white?text=No+Image');
    const timeStr = item.createdAt ? formatDate(item.createdAt) : 'เพิ่มเมื่อเร็วๆ นี้';

    return `
      <div class="border border-amber-100 bg-gradient-to-b from-amber-50/40 to-white rounded-xl p-3 hover:shadow-md transition-all flex flex-col justify-between group">
        <div>
          <div class="relative rounded-lg overflow-hidden mb-3 aspect-video bg-gray-100">
            <img src="${imageUrl}" alt="${escapeHtml(item.title)}" class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" onerror="this.src='https://placehold.co/400x300/1a365d/white?text=No+Image'" />
            <span class="absolute top-2 left-2 px-2 py-0.5 rounded bg-secondary text-white text-[10px] font-bold font-['Prompt'] shadow-sm flex items-center gap-1">
              <span class="material-symbols-outlined text-[12px]">star</span> เข้าใหม่
            </span>
          </div>
          <div class="flex items-center justify-between text-[11px] text-gray-500 font-['Sarabun'] mb-1">
            <span class="font-medium text-[#1a365d] bg-blue-50 px-2 py-0.5 rounded">${escapeHtml(item.category || 'อุปกรณ์')}</span>
            <span>${timeStr}</span>
          </div>
          <h4 class="font-semibold text-gray-800 font-['Prompt'] text-sm line-clamp-1 group-hover:text-primary transition-colors">${escapeHtml(item.title)}</h4>
          <p class="text-xs text-gray-500 font-['Sarabun'] line-clamp-1 mt-0.5">${escapeHtml(item.description || 'รหัส: ' + (item.assetCode || '-'))}</p>
        </div>
        <div class="mt-3 pt-2 border-t border-gray-100 flex items-center justify-between">
          <span class="text-xs font-semibold ${isAvailable ? 'text-green-600' : 'text-red-500'} font-['Sarabun'] flex items-center gap-1">
            <span class="w-2 h-2 rounded-full ${isAvailable ? 'bg-green-500' : 'bg-red-500'}"></span>
            ${isAvailable ? 'พร้อมใช้งาน' : 'ไม่ว่าง'}
          </span>
          <a href="booking.html?id=${item.id}" class="text-xs font-medium font-['Prompt'] text-primary hover:text-secondary flex items-center gap-0.5">
            ยืมอุปกรณ์ <span class="material-symbols-outlined text-xs">arrow_forward</span>
          </a>
        </div>
      </div>
    `;
  }).join('');
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
