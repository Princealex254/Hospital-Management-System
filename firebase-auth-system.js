// Prince Alex Hospital - Firebase Email/Password Authentication System

import { 
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  updateProfile
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

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

function initializeFirebase() {
  if (window.firebaseDb && window.firebaseAuth) {
    db = window.firebaseDb;
    auth = window.firebaseAuth;
    return true;
  }
  return false;
}

// Role definitions
const ROLES = {
  ADMIN: {
    name: 'Admin',
    permissions: ['all'],
    pages: ['admin.html', 'index.html', 'patients.html', 'triage.html', 'doctors.html', 'lab.html', 'pharmacy.html', 'appointments.html', 'billing.html', 'reports.html']
  },
  DOCTOR: {
    name: 'Doctor',
    permissions: ['patients.read', 'patients.update', 'consultations.create', 'consultations.read', 'consultations.update', 'labRequests.create', 'labResults.read', 'prescriptions.create'],
    pages: ['doctors.html', 'index.html', 'patients.html', 'lab.html', 'pharmacy.html']
  },
  PHARMACY: {
    name: 'Pharmacy',
    permissions: ['prescriptions.read', 'prescriptions.update', 'medicines.create', 'medicines.read', 'medicines.update'],
    pages: ['pharmacy.html', 'index.html', 'patients.html']
  },
  STAFF: {
    name: 'Staff',
    permissions: ['patients.read', 'appointments.read', 'triage.read'],
    pages: ['index.html', 'patients.html', 'triage.html']
  },
  NURSE: {
    name: 'Nurse',
    permissions: ['patients.create', 'patients.read', 'patients.update', 'triage.create', 'triage.read', 'triage.update'],
    pages: ['patients.html', 'index.html', 'triage.html']
  },
  LAB: {
    name: 'Lab',
    permissions: ['labRequests.read', 'labRequests.update', 'labResults.create', 'labResults.read', 'labResults.update'],
    pages: ['lab.html', 'index.html', 'patients.html']
  },
  RECEPTION: {
    name: 'Reception',
    permissions: ['appointments.create', 'appointments.read', 'appointments.update', 'patients.create', 'patients.read', 'billing.create', 'billing.read'],
    pages: ['appointments.html', 'index.html', 'patients.html', 'billing.html']
  }
};

// Authentication Manager
export class AuthManager {
  
  // Register new user with email/password
  static async register(email, password, displayName, role = 'STAFF') {
    if (!initializeFirebase()) {
      throw new Error('Firebase not initialized');
    }
    
    try {
      // Create user with email/password
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;
      
      // Update user profile
      await updateProfile(user, {
        displayName: displayName
      });
      
      // Store user role in Firestore
      await this.assignRole(user.uid, email, role);
      
      return user;
    } catch (error) {
      console.error('Registration error:', error);
      throw error;
    }
  }
  
  // Login with email/password
  static async login(email, password) {
    if (!initializeFirebase()) {
      throw new Error('Firebase not initialized');
    }
    
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;
      
      // Fetch user role from Firestore
      const userRole = await this.getUserRole(user.uid);
      
      // Store user data locally
      const userData = {
        uid: user.uid,
        email: user.email,
        displayName: user.displayName,
        role: userRole.role,
        permissions: ROLES[userRole.role].permissions,
        accessiblePages: ROLES[userRole.role].pages
      };
      
      localStorage.setItem('currentUser', JSON.stringify(userData));
      
      return userData;
    } catch (error) {
      console.error('Login error:', error);
      throw error;
    }
  }
  
  // Logout user
  static async logout() {
    if (!initializeFirebase()) {
      throw new Error('Firebase not initialized');
    }
    
    try {
      await signOut(auth);
      localStorage.removeItem('currentUser');
      window.location.href = 'login.html';
    } catch (error) {
      console.error('Logout error:', error);
      throw error;
    }
  }
  
  // Get current user
  static getCurrentUser() {
    const userStr = localStorage.getItem('currentUser');
    return userStr ? JSON.parse(userStr) : null;
  }
  
  // Check if user is authenticated
  static isAuthenticated() {
    return this.getCurrentUser() !== null;
  }
  
  // Assign role to user
  static async assignRole(uid, email, role) {
    if (!initializeFirebase()) {
      throw new Error('Firebase not initialized');
    }
    
    try {
      const roleData = {
        uid: uid,
        email: email,
        role: role,
        assignedAt: serverTimestamp(),
        assignedBy: auth.currentUser?.uid || 'system'
      };
      
      await addDoc(collection(db, 'roles'), roleData);
      return true;
    } catch (error) {
      console.error('Error assigning role:', error);
      throw error;
    }
  }
  
  // Get user role from Firestore
  static async getUserRole(uid) {
    if (!initializeFirebase()) {
      throw new Error('Firebase not initialized');
    }
    
    try {
      const q = query(collection(db, 'roles'), where('uid', '==', uid));
      const querySnapshot = await getDocs(q);
      
      if (!querySnapshot.empty) {
        const doc = querySnapshot.docs[0];
        return { id: doc.id, ...doc.data() };
      } else {
        // Default role if not found
        return { role: 'STAFF' };
      }
    } catch (error) {
      console.error('Error getting user role:', error);
      throw error;
    }
  }
  
  // Update user role
  static async updateUserRole(uid, newRole) {
    if (!initializeFirebase()) {
      throw new Error('Firebase not initialized');
    }
    
    try {
      const q = query(collection(db, 'roles'), where('uid', '==', uid));
      const querySnapshot = await getDocs(q);
      
      if (!querySnapshot.empty) {
        const docRef = querySnapshot.docs[0].ref;
        await updateDoc(docRef, {
          role: newRole,
          updatedAt: serverTimestamp(),
          updatedBy: auth.currentUser?.uid
        });
        return true;
      } else {
        throw new Error('User role not found');
      }
    } catch (error) {
      console.error('Error updating user role:', error);
      throw error;
    }
  }
  
  // Get all users with roles
  static async getAllUsersWithRoles() {
    if (!initializeFirebase()) {
      throw new Error('Firebase not initialized');
    }
    
    try {
      const querySnapshot = await getDocs(collection(db, 'roles'));
      return querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
    } catch (error) {
      console.error('Error getting all users:', error);
      throw error;
    }
  }
  
  // Listen to auth state changes
  static onAuthStateChanged(callback) {
    if (!initializeFirebase()) {
      throw new Error('Firebase not initialized');
    }
    
    return onAuthStateChanged(auth, callback);
  }
}

// Permission Manager
export class PermissionManager {
  
  // Check if user has specific permission
  static hasPermission(user, permission) {
    if (!user || !user.permissions) {
      return false;
    }
    
    // Admin has all permissions
    if (user.permissions.includes('all')) {
      return true;
    }
    
    return user.permissions.includes(permission);
  }
  
  // Check if user can access specific page
  static canAccessPage(user, pageName) {
    if (!user || !user.accessiblePages) {
      return false;
    }
    
    return user.accessiblePages.includes(pageName);
  }
  
  // Get user's accessible pages
  static getAccessiblePages(user) {
    if (!user || !user.accessiblePages) {
      return [];
    }
    
    return user.accessiblePages;
  }
}

// Page Access Control
export class PageAccessControl {
  
  // Protect page based on user permissions
  static protectPage(pageName) {
    const user = AuthManager.getCurrentUser();
    
    if (!user) {
      window.location.href = 'login.html';
      return false;
    }
    
    if (!PermissionManager.canAccessPage(user, pageName)) {
      this.showAccessDenied();
      return false;
    }
    
    return true;
  }
  
  // Show access denied message
  static showAccessDenied() {
    document.body.innerHTML = `
      <div style="display: flex; justify-content: center; align-items: center; height: 100vh; background: #f8f9fa;">
        <div style="text-align: center; padding: 40px; background: white; border-radius: 10px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
          <h1 style="color: #e74c3c; margin-bottom: 20px;">🚫 Access Denied</h1>
          <p style="color: #7f8c8d; margin-bottom: 30px;">You don't have permission to access this page.</p>
          <button onclick="window.location.href='index.html'" style="background: #3498db; color: white; border: none; padding: 12px 24px; border-radius: 5px; cursor: pointer;">
            Go to Dashboard
          </button>
        </div>
      </div>
    `;
  }
  
  // Initialize page with role-based navigation
  static initializePage(pageName) {
    if (!this.protectPage(pageName)) {
      return null;
    }
    
    const user = AuthManager.getCurrentUser();
    this.updateNavigation(user);
    this.updateUserInfo(user);
    
    return user;
  }
  
  // Update navigation based on user permissions
  static updateNavigation(user) {
    const accessiblePages = PermissionManager.getAccessiblePages(user);
    const navMenu = document.querySelector('.nav-menu');
    
    if (navMenu) {
      // Clear existing menu
      navMenu.innerHTML = '';
      
      // Add accessible pages
      const navigationItems = [
        { id: 'index', title: 'Dashboard', icon: '📊', url: 'index.html' },
        { id: 'patients', title: 'Patients', icon: '👥', url: 'patients.html' },
        { id: 'triage', title: 'Triage', icon: '🚨', url: 'triage.html' },
        { id: 'doctors', title: 'Doctors', icon: '👨‍⚕️', url: 'doctors.html' },
        { id: 'lab', title: 'Laboratory', icon: '🧪', url: 'lab.html' },
        { id: 'pharmacy', title: 'Pharmacy', icon: '💊', url: 'pharmacy.html' },
        { id: 'appointments', title: 'Appointments', icon: '📅', url: 'appointments.html' },
        { id: 'billing', title: 'Billing', icon: '💰', url: 'billing.html' },
        { id: 'reports', title: 'Reports', icon: '📈', url: 'reports.html' },
        { id: 'admin', title: 'Admin', icon: '⚙️', url: 'admin.html' }
      ];
      
      navigationItems.forEach(item => {
        if (accessiblePages.includes(item.url)) {
          const navItem = document.createElement('li');
          navItem.className = 'nav-item';
          
          const navLink = document.createElement('a');
          navLink.href = item.url;
          navLink.className = 'nav-link';
          navLink.innerHTML = `
            <span class="nav-icon">${item.icon}</span>
            ${item.title}
          `;
          
          // Highlight current page
          if (window.location.pathname.includes(item.url)) {
            navLink.classList.add('active');
          }
          
          navItem.appendChild(navLink);
          navMenu.appendChild(navItem);
        }
      });
    }
  }
  
  // Update user info display
  static updateUserInfo(user) {
    const welcomeElement = document.querySelector('.welcome-message');
    if (welcomeElement) {
      welcomeElement.textContent = `Welcome ${user.displayName || user.email} – ${user.role}`;
    }
    
    const userInfoElement = document.querySelector('.user-info');
    if (userInfoElement) {
      userInfoElement.innerHTML = `
        <h3>${user.displayName || user.email}</h3>
        <p>${user.role}</p>
      `;
    }
  }
}

// Export for global access
window.FirebaseAuth = {
  AuthManager,
  PermissionManager,
  PageAccessControl,
  ROLES
};
