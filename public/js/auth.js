// ============================================
// Auth Module — Admin Authentication
// สโมสรนักศึกษาราชวิทยาลัยจุฬาภรณ์
// ============================================

import {
  auth,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged
} from './firebase-config.js';

/**
 * Login admin with email and password
 */
export async function loginAdmin(email, password) {
  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    return { success: true, user: userCredential.user };
  } catch (error) {
    let message = 'เกิดข้อผิดพลาดในการเข้าสู่ระบบ';
    switch (error.code) {
      case 'auth/user-not-found':
        message = 'ไม่พบบัญชีผู้ใช้นี้ในระบบ';
        break;
      case 'auth/wrong-password':
      case 'auth/invalid-credential':
        message = 'อีเมลหรือรหัสผ่านไม่ถูกต้อง';
        break;
      case 'auth/invalid-email':
        message = 'รูปแบบอีเมลไม่ถูกต้อง';
        break;
      case 'auth/too-many-requests':
        message = 'ลองเข้าสู่ระบบหลายครั้งเกินไป กรุณารอสักครู่';
        break;
      case 'auth/network-request-failed':
        message = 'ไม่สามารถเชื่อมต่อได้ กรุณาตรวจสอบอินเทอร์เน็ต';
        break;
    }
    return { success: false, message };
  }
}

/**
 * Logout admin
 */
export async function logoutAdmin() {
  try {
    await signOut(auth);
    return { success: true };
  } catch (error) {
    return { success: false, message: 'เกิดข้อผิดพลาดในการออกจากระบบ' };
  }
}

/**
 * Check if user is currently authenticated
 */
export function getCurrentUser() {
  return new Promise((resolve) => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      unsubscribe();
      resolve(user);
    });
  });
}

/**
 * Set up auth state listener
 */
export function onAuthChange(callback) {
  return onAuthStateChanged(auth, callback);
}

/**
 * Guard function — redirect to login if not authenticated
 */
export async function requireAuth() {
  const user = await getCurrentUser();
  if (!user) {
    const loginSection     = document.getElementById('login-section');
    const dashboardSection = document.getElementById('dashboard-section');
    const landingBg        = document.getElementById('landing-background');
    if (landingBg)        landingBg.classList.remove('hidden');
    if (loginSection)     loginSection.classList.remove('hidden');
    if (dashboardSection) dashboardSection.classList.add('hidden');
    return null;
  }
  return user;
}

/**
 * Initialize login form handlers on admin page
 * FIX: เพิ่ม null-check ทุก DOM element เพื่อป้องกัน crash
 */
export function initLoginForm() {
  const loginBtn        = document.getElementById('login-btn');
  const emailInput      = document.getElementById('admin-email');
  const passwordInput   = document.getElementById('admin-password');
  const loginError      = document.getElementById('login-error');
  const loginSection    = document.getElementById('login-section');
  const dashboardSection = document.getElementById('dashboard-section');

  // ถ้าไม่มี login button แสดงว่าหน้านี้ไม่ใช่ admin page — skip
  if (!loginBtn) return;

  function showLoginError(message) {
    if (!loginError) return;
    loginError.textContent = message;
    loginError.classList.remove('hidden');
  }

  function hideLoginError() {
    if (!loginError) return;
    loginError.textContent = '';
    loginError.classList.add('hidden');
  }

  function showDashboard() {
    const landingBg = document.getElementById('landing-background');
    if (landingBg)        landingBg.classList.add('hidden');
    if (loginSection)     loginSection.classList.add('hidden');
    if (dashboardSection) dashboardSection.classList.remove('hidden');
  }

  function showLogin() {
    const landingBg = document.getElementById('landing-background');
    if (landingBg)        landingBg.classList.remove('hidden');
    if (loginSection)     loginSection.classList.remove('hidden');
    if (dashboardSection) dashboardSection.classList.add('hidden');
  }

  // Handle login button click
  loginBtn.addEventListener('click', async () => {
    if (!emailInput || !passwordInput) return;

    const email    = emailInput.value.trim();
    const password = passwordInput.value;

    if (!email || !password) {
      showLoginError('กรุณากรอกอีเมลและรหัสผ่าน');
      return;
    }

    // Show loading state
    loginBtn.disabled  = true;
    loginBtn.innerHTML = `
      <svg class="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
      </svg>
      <span>กำลังเข้าสู่ระบบ...</span>
    `;

    const result = await loginAdmin(email, password);

    if (result.success) {
      showDashboard();
      hideLoginError();
    } else {
      showLoginError(result.message);
      loginBtn.disabled  = false;
      loginBtn.innerHTML = `
        <span class="material-symbols-outlined">login</span>
        เข้าสู่ระบบ
      `;
    }
  });

  // Handle Enter key on inputs
  if (passwordInput) {
    passwordInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') loginBtn.click();
    });
  }
  if (emailInput) {
    emailInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && passwordInput) passwordInput.focus();
    });
  }

  // Handle logout button
  const logoutBtn = document.getElementById('logout-btn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', async () => {
      await logoutAdmin();
      showLogin();
      if (emailInput)    emailInput.value    = '';
      if (passwordInput) passwordInput.value = '';
    });
  }

  // Watch auth state — sync UI กับ Firebase auth state
  onAuthChange((user) => {
    if (user) {
      showDashboard();
    } else {
      showLogin();
    }
  });
}
