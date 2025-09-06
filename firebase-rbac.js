// Prince Alex Hospital - Role-Based Access Control (RBAC) System

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

// Role definitions with permissions
const ROLES = {
  ADMIN: {
    name: 'Admin',
    permissions: [
      'users.create', 'users.read', 'users.update', 'users.delete',
      'patients.create', 'patients.read', 'patients.update', 'patients.delete',
      'doctors.create', 'doctors.read', 'doctors.update', 'doctors.delete',
      'appointments.create', 'appointments.read', 'appointments.update', 'appointments.delete',
      'triage.create', 'triage.read', 'triage.update', 'triage.delete',
      'consultations.create', 'consultations.read', 'consultations.update', 'consultations.delete',
      'labRequests.create', 'labRequests.read', 'labRequests.update', 'labRequests.delete',
      'labResults.create', 'labResults.read', 'labResults.update', 'labResults.delete',
      'prescriptions.create', 'prescriptions.read', 'prescriptions.update', 'prescriptions.delete',
      'medicines.create', 'medicines.read', 'medicines.update', 'medicines.delete',
      'billing.create', 'billing.read', 'billing.update', 'billing.delete',
      'departments.create', 'departments.read', 'departments.update', 'departments.delete',
      'reports.read', 'reports.export',
      'system.settings', 'system.backup', 'system.reset'
    ],
    pages: ['admin.html', 'index.html', 'patients.html', 'triage.html', 'doctors.html', 'lab.html', 'pharmacy.html', 'appointments.html', 'billing.html', 'reports.html']
  },
  DOCTOR: {
    name: 'Doctor',
    permissions: [
      'patients.read', 'patients.update',
      'appointments.read', 'appointments.update',
      'triage.read', 'triage.update',
      'consultations.create', 'consultations.read', 'consultations.update',
      'labRequests.create', 'labRequests.read',
      'labResults.read',
      'prescriptions.create', 'prescriptions.read',
      'medicines.read'
    ],
    pages: ['doctors.html', 'index.html', 'patients.html', 'lab.html', 'pharmacy.html']
  },
  NURSE: {
    name: 'Nurse',
    permissions: [
      'patients.create', 'patients.read', 'patients.update',
      'appointments.read',
      'triage.create', 'triage.read', 'triage.update',
      'consultations.read',
      'labRequests.read',
      'labResults.read',
      'prescriptions.read',
      'medicines.read'
    ],
    pages: ['patients.html', 'index.html', 'triage.html', 'lab.html', 'pharmacy.html']
  },
  PHARMACY: {
    name: 'Pharmacy',
    permissions: [
      'prescriptions.read', 'prescriptions.update',
      'medicines.create', 'medicines.read', 'medicines.update',
      'patients.read'
    ],
    pages: ['pharmacy.html', 'index.html', 'patients.html']
  },
  LAB: {
    name: 'Lab',
    permissions: [
      'labRequests.read', 'labRequests.update',
      'labResults.create', 'labResults.read', 'labResults.update',
      'patients.read'
    ],
    pages: ['lab.html', 'index.html', 'patients.html']
  },
  TRIAGE: {
    name: 'Triage',
    permissions: [
      'triage.create', 'triage.read', 'triage.update',
      'patients.create', 'patients.read',
      'appointments.read'
    ],
    pages: ['triage.html', 'index.html', 'patients.html', 'appointments.html']
  },
  RECEPTION: {
    name: 'Reception',
    permissions: [
      'appointments.create', 'appointments.read', 'appointments.update', 'appointments.delete',
      'patients.create', 'patients.read', 'patients.update',
      'billing.create', 'billing.read', 'billing.update',
      'doctors.read'
    ],
    pages: ['appointments.html', 'index.html', 'patients.html', 'billing.html']
  }
};

// Department to Role mapping
const DEPARTMENT_ROLES = {
  'Admin': 'ADMIN',
  'Doctor': 'DOCTOR',
  'Nurse': 'NURSE',
  'Pharmacy': 'PHARMACY',
  'Lab': 'LAB',
  'Triage': 'TRIAGE',
  'Reception': 'RECEPTION'
};

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

// User Management Class
export class UserManager {
  
  // Create a new user with role
  static async createUser(userData) {
    if (!initializeFirebase()) {
      throw new Error('Firebase not initialized');
    }
    
    try {
      const role = DEPARTMENT_ROLES[userData.department] || 'RECEPTION';
      const userWithRole = {
        ...userData,
        role: role,
        permissions: ROLES[role].permissions,
        isActive: true,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };
      
      const docRef = await addDoc(collection(db, 'users'), userWithRole);
      return { id: docRef.id, ...userWithRole };
    } catch (error) {
      console.error('Error creating user:', error);
      throw error;
    }
  }

  // Get user by ID
  static async getUserById(userId) {
    if (!initializeFirebase()) {
      throw new Error('Firebase not initialized');
    }
    
    try {
      const docRef = doc(db, 'users', userId);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        return { id: docSnap.id, ...docSnap.data() };
      } else {
        return null;
      }
    } catch (error) {
      console.error('Error getting user:', error);
      throw error;
    }
  }

  // Get user by username
  static async getUserByUsername(username) {
    if (!initializeFirebase()) {
      throw new Error('Firebase not initialized');
    }
    
    try {
      const q = query(
        collection(db, 'users'),
        where('username', '==', username)
      );
      const querySnapshot = await getDocs(q);
      
      if (!querySnapshot.empty) {
        const doc = querySnapshot.docs[0];
        return { id: doc.id, ...doc.data() };
      } else {
        return null;
      }
    } catch (error) {
      console.error('Error getting user by username:', error);
      throw error;
    }
  }

  // Update user role and permissions
  static async updateUserRole(userId, newRole) {
    if (!initializeFirebase()) {
      throw new Error('Firebase not initialized');
    }
    
    try {
      const userRef = doc(db, 'users', userId);
      await updateDoc(userRef, {
        role: newRole,
        permissions: ROLES[newRole].permissions,
        updatedAt: serverTimestamp()
      });
      return true;
    } catch (error) {
      console.error('Error updating user role:', error);
      throw error;
    }
  }

  // Get all users
  static async getAllUsers() {
    if (!initializeFirebase()) {
      throw new Error('Firebase not initialized');
    }
    
    try {
      const querySnapshot = await getDocs(collection(db, 'users'));
      return querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
    } catch (error) {
      console.error('Error getting all users:', error);
      throw error;
    }
  }

  // Deactivate user
  static async deactivateUser(userId) {
    if (!initializeFirebase()) {
      throw new Error('Firebase not initialized');
    }
    
    try {
      const userRef = doc(db, 'users', userId);
      await updateDoc(userRef, {
        isActive: false,
        updatedAt: serverTimestamp()
      });
      return true;
    } catch (error) {
      console.error('Error deactivating user:', error);
      throw error;
    }
  }
}

// Permission Management Class
export class PermissionManager {
  
  // Check if user has specific permission
  static hasPermission(user, permission) {
    if (!user || !user.permissions) {
      return false;
    }
    
    // Admin has all permissions
    if (user.role === 'ADMIN') {
      return true;
    }
    
    return user.permissions.includes(permission);
  }

  // Check if user can access specific page
  static canAccessPage(user, pageName) {
    if (!user || !user.role) {
      return false;
    }
    
    const role = ROLES[user.role];
    if (!role) {
      return false;
    }
    
    return role.pages.includes(pageName);
  }

  // Check if user can perform action on resource
  static canPerformAction(user, resource, action) {
    const permission = `${resource}.${action}`;
    return this.hasPermission(user, permission);
  }

  // Get user's accessible pages
  static getAccessiblePages(user) {
    if (!user || !user.role) {
      return [];
    }
    
    const role = ROLES[user.role];
    return role ? role.pages : [];
  }

  // Get user's permissions
  static getUserPermissions(user) {
    if (!user || !user.role) {
      return [];
    }
    
    const role = ROLES[user.role];
    return role ? role.permissions : [];
  }
}

// Authentication Manager
export class AuthManager {
  
  // Login user with role validation
  static async login(username, department) {
    try {
      // Check if user exists in database
      let user = await UserManager.getUserByUsername(username);
      
      if (!user) {
        // Create new user if doesn't exist
        user = await UserManager.createUser({
          username: username,
          department: department,
          email: `${username}@hospital.com`,
          contact: 'N/A',
          role: DEPARTMENT_ROLES[department] || 'RECEPTION'
        });
      } else {
        // Update last login
        await UserManager.updateUserRole(user.id, DEPARTMENT_ROLES[department] || 'RECEPTION');
      }
      
      // Store user session
      localStorage.setItem('currentUser', JSON.stringify(user));
      
      return user;
    } catch (error) {
      console.error('Login error:', error);
      throw error;
    }
  }

  // Logout user
  static logout() {
    localStorage.removeItem('currentUser');
    window.location.href = 'login.html';
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

  // Redirect based on user role
  static redirectBasedOnRole(user) {
    const accessiblePages = PermissionManager.getAccessiblePages(user);
    const defaultPage = accessiblePages[0] || 'index.html';
    window.location.href = defaultPage;
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
      welcomeElement.textContent = `Welcome ${user.username} – ${user.department}`;
    }
    
    const userInfoElement = document.querySelector('.user-info');
    if (userInfoElement) {
      userInfoElement.innerHTML = `
        <h3>${user.username}</h3>
        <p>${user.department} (${user.role})</p>
      `;
    }
  }
}

// Action Permission Decorator
export function requirePermission(permission) {
  return function(target, propertyKey, descriptor) {
    const originalMethod = descriptor.value;
    
    descriptor.value = function(...args) {
      const user = AuthManager.getCurrentUser();
      
      if (!PermissionManager.hasPermission(user, permission)) {
        showAlert('You do not have permission to perform this action', 'error');
        return false;
      }
      
      return originalMethod.apply(this, args);
    };
    
    return descriptor;
  };
}

// Export for global access
window.RBAC = {
  ROLES,
  DEPARTMENT_ROLES,
  UserManager,
  PermissionManager,
  AuthManager,
  PageAccessControl,
  requirePermission
};
