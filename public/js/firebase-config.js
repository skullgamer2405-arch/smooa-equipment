// ============================================
// Firebase Configuration — SMO.CRA
// สโมสรนักศึกษาราชวิทยาลัยจุฬาภรณ์
// ============================================

import { initializeApp } from 'https://www.gstatic.com/firebasejs/11.7.3/firebase-app.js';
import { getFirestore, collection, doc, getDocs, getDoc, addDoc, updateDoc, deleteDoc, query, where, orderBy, limit, startAfter, Timestamp, serverTimestamp, onSnapshot } from 'https://www.gstatic.com/firebasejs/11.7.3/firebase-firestore.js';
import { getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/11.7.3/firebase-auth.js';
// Storage ไม่ใช้ (ต้อง Blaze plan) — ใช้ URL รูปภาพจากภายนอกแทน

// TODO: Replace with your actual Firebase config from Firebase Console
// Go to: https://console.firebase.google.com/project/smooa-c1945/settings/general
// Scroll to "Your apps" → Web app → Firebase SDK snippet → Config
const firebaseConfig = {
  apiKey: "AIzaSyBt1yCwMogOZYxdyYFH3bS6w3WLJTmZ1fk",
  authDomain: "smooa-c1945.firebaseapp.com",
  projectId: "smooa-c1945",
  storageBucket: "smooa-c1945.firebasestorage.app",
  messagingSenderId: "587754619956",
  appId: "1:587754619956:web:6fb872ea679b514c42f661"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);


// Export everything for use in other modules
export {
  app, db, auth,
  // Firestore utilities
  collection, doc, getDocs, getDoc, addDoc, updateDoc, deleteDoc,
  query, where, orderBy, limit, startAfter,
  Timestamp, serverTimestamp, onSnapshot,
  // Auth utilities
  signInWithEmailAndPassword, signOut, onAuthStateChanged
};
