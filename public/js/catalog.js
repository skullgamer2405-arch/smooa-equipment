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
const equipmentGrid  = document.getElementById('equipment-grid');
const searchInput    = document.getElementById('search-input');
const loadingSpinner = document.getElementById('loading-spinner');

// ---- Initialize ----
document.addEventListener('DOMContentLoaded', () => {
  initCatalog();
  initSearch();
  initCategoryFilters();
});

// Cleanup เมื่อออกจากหน้า
window.addEventListener('beforeunload', () => {
  if (unsubscribeSnapshot) unsubscribeSnapshot();
});

/**
 * Load equipment from Firestore with real-time updates
 */
function initCatalog() {
  showLoading(true);

  const q = query(collection(db, 'equipment'), orderBy('createdAt', 'desc'));

  unsubscribeSnapshot = onSnapshot(q, (snapshot) => {
    allEquipment = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
    renderEquipment();
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
