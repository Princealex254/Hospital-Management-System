// Prince Alex Hospital - Firebase Authentication System

import { 
  collection, 
  doc, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  getDocs, 
  getDoc, 
  query, 
  where, 
  orderBy, 
  onSnapshot,
  serverTimestamp 
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// Initialize Firebase services
let db, auth;

// Initialize Firebase when available
function initializeFirebase() {
  if (window.firebaseDb && window.firebaseAuth) {
    db = window.firebaseDb;
    auth = window.firebaseAuth;
    return true;
  }
  return false;
}

// Collection names
const COLLECTIONS = {
  USERS: 'users',
  PATIENTS: 'patients',
  DOCTORS: 'doctors',
  APPOINTMENTS: 'appointments',
  TRIAGE: 'triage',
  CONSULTATIONS: 'consultations',
  LAB_REQUESTS: 'labRequests',
  LAB_RESULTS: 'labResults',
  PRESCRIPTIONS: 'prescriptions',
  MEDICINES: 'medicines',
  BILLING: 'billing',
  DEPARTMENTS: 'departments',
  SYSTEM_SETTINGS: 'systemSettings'
};

// Generic CRUD operations for Firebase
class FirebaseService {
  
  // Create a new document
  static async create(collectionName, data) {
    if (!initializeFirebase()) {
      throw new Error('Firebase not initialized');
    }
    
    try {
      const docRef = await addDoc(collection(db, collectionName), {
        ...data,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      return { id: docRef.id, ...data };
    } catch (error) {
      console.error('Error creating document:', error);
      throw error;
    }
  }

  // Read all documents from a collection
  static async getAll(collectionName, orderByField = 'createdAt', orderDirection = 'desc') {
    if (!initializeFirebase()) {
      throw new Error('Firebase not initialized');
    }
    
    try {
      const q = query(
        collection(db, collectionName),
        orderBy(orderByField, orderDirection)
      );
      const querySnapshot = await getDocs(q);
      return querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
    } catch (error) {
      console.error('Error getting documents:', error);
      throw error;
    }
  }

  // Read a single document
  static async getById(collectionName, docId) {
    if (!initializeFirebase()) {
      throw new Error('Firebase not initialized');
    }
    
    try {
      const docRef = doc(db, collectionName, docId);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        return { id: docSnap.id, ...docSnap.data() };
      } else {
        return null;
      }
    } catch (error) {
      console.error('Error getting document:', error);
      throw error;
    }
  }

  // Update a document
  static async update(collectionName, docId, data) {
    if (!initializeFirebase()) {
      throw new Error('Firebase not initialized');
    }
    
    try {
      const docRef = doc(db, collectionName, docId);
      await updateDoc(docRef, {
        ...data,
        updatedAt: serverTimestamp()
      });
      return { id: docId, ...data };
    } catch (error) {
      console.error('Error updating document:', error);
      throw error;
    }
  }

  // Delete a document
  static async delete(collectionName, docId) {
    if (!initializeFirebase()) {
      throw new Error('Firebase not initialized');
    }
    
    try {
      await deleteDoc(doc(db, collectionName, docId));
      return true;
    } catch (error) {
      console.error('Error deleting document:', error);
      throw error;
    }
  }

  // Query documents with conditions
  static async query(collectionName, conditions = [], orderByField = 'createdAt', orderDirection = 'desc') {
    if (!initializeFirebase()) {
      throw new Error('Firebase not initialized');
    }
    
    try {
      let q = collection(db, collectionName);
      
      // Add where conditions
      conditions.forEach(condition => {
        q = query(q, where(condition.field, condition.operator, condition.value));
      });
      
      // Add ordering
      q = query(q, orderBy(orderByField, orderDirection));
      
      const querySnapshot = await getDocs(q);
      return querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
    } catch (error) {
      console.error('Error querying documents:', error);
      throw error;
    }
  }

  // Real-time listener
  static subscribe(collectionName, callback, orderByField = 'createdAt', orderDirection = 'desc') {
    if (!initializeFirebase()) {
      throw new Error('Firebase not initialized');
    }
    
    const q = query(
      collection(db, collectionName),
      orderBy(orderByField, orderDirection)
    );
    
    return onSnapshot(q, (querySnapshot) => {
      const data = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      callback(data);
    });
  }
}

// Get current user from localStorage (fallback)
function getCurrentUser() {
  return JSON.parse(localStorage.getItem('currentUser') || 'null');
}

// Set current user in localStorage (fallback)
function setCurrentUser(user) {
  localStorage.setItem('currentUser', JSON.stringify(user));
}

// Clear current user session
function clearSession() {
  localStorage.removeItem('currentUser');
}

// Role-based redirect mapping
const roleRedirects = {
  'Admin': 'admin.html',
  'Doctor': 'doctors.html',
  'Nurse': 'patients.html',
  'Pharmacy': 'pharmacy.html',
  'Lab': 'lab.html',
  'Triage': 'triage.html',
  'Reception': 'appointments.html'
};

// Login form handler
document.addEventListener('DOMContentLoaded', function() {
  // Wait for Firebase to initialize
  const checkFirebase = setInterval(() => {
    if (initializeFirebase()) {
      clearInterval(checkFirebase);
      initializeSampleData();
    }
  }, 100);
  
  const loginForm = document.getElementById('loginForm');
  
  if (loginForm) {
    loginForm.addEventListener('submit', function(e) {
      e.preventDefault();
      
      const username = document.getElementById('username').value.trim();
      const department = document.getElementById('department').value;
      
      if (!username || !department) {
        alert('Please fill in all fields');
        return;
      }
      
      // Create user object
      const user = {
        username: username,
        department: department,
        loginTime: new Date().toISOString()
      };
      
      // Store user session
      setCurrentUser(user);
      
      // Redirect based on role
      const redirectUrl = roleRedirects[department] || 'index.html';
      window.location.href = redirectUrl;
    });
  }
});

// Logout function
function logout() {
  if (confirm('Are you sure you want to logout?')) {
    clearSession();
    window.location.href = 'login.html';
  }
}

// Check authentication and redirect if not logged in
function checkAuth() {
  const currentUser = getCurrentUser();
  if (!currentUser) {
    window.location.href = 'login.html';
    return false;
  }
  return currentUser;
}

// Get hospital data from Firebase
async function getHospitalData() {
  try {
    if (!initializeFirebase()) {
      // Fallback to localStorage
      return JSON.parse(localStorage.getItem('hospitalData') || '{}');
    }
    
    const data = {};
    for (const [key, collectionName] of Object.entries(COLLECTIONS)) {
      try {
        data[key.toLowerCase()] = await FirebaseService.getAll(collectionName);
      } catch (error) {
        console.warn(`Error loading ${collectionName}:`, error);
        data[key.toLowerCase()] = [];
      }
    }
    return data;
  } catch (error) {
    console.error('Error getting hospital data:', error);
    return JSON.parse(localStorage.getItem('hospitalData') || '{}');
  }
}

// Save hospital data to Firebase
async function saveHospitalData(data) {
  try {
    if (!initializeFirebase()) {
      // Fallback to localStorage
      localStorage.setItem('hospitalData', JSON.stringify(data));
      return;
    }
    
    // Save each collection separately
    for (const [key, collectionName] of Object.entries(COLLECTIONS)) {
      const collectionData = data[key.toLowerCase()];
      if (collectionData && Array.isArray(collectionData)) {
        // Note: This is a simplified approach. In production, you'd want to handle updates more efficiently
        for (const item of collectionData) {
          if (item.id) {
            try {
              await FirebaseService.update(collectionName, item.id, item);
            } catch (error) {
              console.warn(`Error updating ${collectionName} item:`, error);
            }
          }
        }
      }
    }
  } catch (error) {
    console.error('Error saving hospital data:', error);
    // Fallback to localStorage
    localStorage.setItem('hospitalData', JSON.stringify(data));
  }
}

// Generate unique ID
function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

// Format date for display
function formatDate(dateString) {
  const date = new Date(dateString);
  return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
}

// Show alert message
function showAlert(message, type = 'success') {
  const alertDiv = document.createElement('div');
  alertDiv.className = `alert alert-${type}`;
  alertDiv.textContent = message;
  
  const container = document.querySelector('.main-content') || document.body;
  container.insertBefore(alertDiv, container.firstChild);
  
  setTimeout(() => {
    alertDiv.remove();
  }, 5000);
}

// Initialize sample data in Firebase
async function initializeSampleData() {
  try {
    if (!initializeFirebase()) return;
    
    // Check if doctors exist
    const doctors = await FirebaseService.getAll(COLLECTIONS.DOCTORS);
    if (doctors.length === 0) {
      const sampleDoctors = [
        {
          name: 'Dr. Sarah Johnson',
          specialization: 'Cardiology',
          department: 'Cardiology',
          contact: '555-0101',
          status: 'active'
        },
        {
          name: 'Dr. Michael Chen',
          specialization: 'Neurology',
          department: 'Neurology',
          contact: '555-0102',
          status: 'active'
        },
        {
          name: 'Dr. Emily Rodriguez',
          specialization: 'Pediatrics',
          department: 'Pediatrics',
          contact: '555-0103',
          status: 'active'
        },
        {
          name: 'Dr. David Wilson',
          specialization: 'Emergency Medicine',
          department: 'Emergency',
          contact: '555-0104',
          status: 'active'
        }
      ];
      
      for (const doctor of sampleDoctors) {
        await FirebaseService.create(COLLECTIONS.DOCTORS, doctor);
      }
    }
    
    // Check if medicines exist
    const medicines = await FirebaseService.getAll(COLLECTIONS.MEDICINES);
    if (medicines.length === 0) {
      const sampleMedicines = [
        {
          name: 'Paracetamol',
          type: 'Tablet',
          strength: '500mg',
          quantity: 1000,
          minStock: 100,
          price: 0.50,
          supplier: 'MedSupply Inc'
        },
        {
          name: 'Amoxicillin',
          type: 'Capsule',
          strength: '250mg',
          quantity: 500,
          minStock: 50,
          price: 2.00,
          supplier: 'PharmaCorp'
        },
        {
          name: 'Ibuprofen',
          type: 'Tablet',
          strength: '400mg',
          quantity: 25,
          minStock: 50,
          price: 1.50,
          supplier: 'MedSupply Inc'
        },
        {
          name: 'Cough Syrup',
          type: 'Syrup',
          strength: '100ml',
          quantity: 200,
          minStock: 30,
          price: 5.00,
          supplier: 'HealthPlus'
        }
      ];
      
      for (const medicine of sampleMedicines) {
        await FirebaseService.create(COLLECTIONS.MEDICINES, medicine);
      }
    }
  } catch (error) {
    console.error('Error initializing sample data:', error);
  }
}

// Initialize page with authentication check
function initPage() {
  const currentUser = checkAuth();
  if (!currentUser) return;
  
  // Update welcome message
  const welcomeElement = document.querySelector('.welcome-message');
  if (welcomeElement) {
    welcomeElement.textContent = `Welcome ${currentUser.username} – Department: ${currentUser.department}`;
  }
  
  // Update sidebar user info
  const userInfoElement = document.querySelector('.user-info');
  if (userInfoElement) {
    userInfoElement.innerHTML = `
      <h3>${currentUser.username}</h3>
      <p>${currentUser.department}</p>
    `;
  }
  
  return currentUser;
}

// Export Firebase service for use in other modules
window.FirebaseService = FirebaseService;
window.COLLECTIONS = COLLECTIONS;
