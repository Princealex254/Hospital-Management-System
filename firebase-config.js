/**
 * PRINCE ALEX DIGITAL HMS — Firebase Configuration
 * 
 * This is the SINGLE source of truth for Firebase initialization.
 * Every page imports auth, db, and storage from this file.
 * 
 * Uses Firebase Modular SDK (v12).
 */

import { initializeApp } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-auth.js";
import { getFirestore, enableIndexedDbPersistence } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-storage.js";

// ─── Firebase Project Configuration ─────────────────────────────────────────
// IMPORTANT: Replace this with your own Firebase project's configuration.
// You can find this in your Firebase project settings.
const firebaseConfig = {
  apiKey: "AIzaSyCW0BqYOirnrPRkgvSvtSjK2-OGVTa71uQ",
  authDomain: "princealexdigital-4848c.firebaseapp.com",
  projectId: "princealexdigital-4848c",
  storageBucket: "princealexdigital-4848c.appspot.com",
  messagingSenderId: "1316427677",
  appId: "1:1316427677:web:21bdffbf2095d1d5064174"
};

// ─── Initialize Firebase App ─────────────────────────────────────────────────
const app = initializeApp(firebaseConfig);

// ─── Initialize Services ─────────────────────────────────────────────────────
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);

// ─── Re-export commonly used Firestore functions for convenience ─────────────
export {
    collection,
    doc,
    getDoc,
    getDocs,
    addDoc,
    setDoc,
    updateDoc,
    deleteDoc,
    query,
    where,
    orderBy,
    limit,
    onSnapshot,
    serverTimestamp,
    writeBatch,
} from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";

export {
    onAuthStateChanged,
    signInWithEmailAndPassword,
    createUserWithEmailAndPassword,
    signOut,
    updateProfile,
    sendPasswordResetEmail
} from "https://www.gstatic.com/firebasejs/12.0.0/firebase-auth.js";

export {
    ref,
    uploadBytesResumable,
    getDownloadURL,
    listAll,
    deleteObject
} from "https://www.gstatic.com/firebasejs/12.0.0/firebase-storage.js";

// ─── Enable offline persistence (optional, improves UX) ─────────────────────
enableIndexedDbPersistence(db).catch((err) => {
    if (err.code == 'failed-precondition') {
        console.warn("Firestore persistence failed: Multiple tabs open.");
    } else if (err.code == 'unimplemented') {
        console.warn("Firestore persistence not available in this browser.");
    }
});
