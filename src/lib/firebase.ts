import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { firebaseConfig } from "../../shared/firebase-config.js";
const app = initializeApp(firebaseConfig(import.meta.env));
export const db = getFirestore(app);
export const auth = getAuth(app);
