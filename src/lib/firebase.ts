import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";
const app = initializeApp({
  apiKey: "AIzaSyBt1yCwMogOZYxdyYFH3bS6w3WLJTmZ1fk",
  authDomain: "smooa-c1945.firebaseapp.com",
  projectId: "smooa-c1945",
  storageBucket: "smooa-c1945.firebasestorage.app",
  messagingSenderId: "587754619956",
  appId: "1:587754619956:web:6fb872ea679b514c42f661",
});
export const db = getFirestore(app);
export const auth = getAuth(app);
