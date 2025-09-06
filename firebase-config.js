// Firebase Configuration for Prince Alex Hospital HMS
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyBYfTWtl-N21DxVATxVnhCofgQsVu3xK4M",
  authDomain: "store-e88d9.firebaseapp.com",
  projectId: "store-e88d9",
  storageBucket: "store-e88d9.firebasestorage.app",
  messagingSenderId: "30797525855",
  appId: "1:30797525855:web:335287605ec648f747fcea"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firebase services
const db = getFirestore(app);
const auth = getAuth(app);

// Export Firebase services
export { db, auth, app };
