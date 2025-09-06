# 🔐 Firebase Email/Password Authentication System

## Overview

This comprehensive Firebase authentication system provides secure email/password login with role-based access control for the Prince Alex Hospital Management System.

## 🏗️ System Architecture

### Components
1. **Firebase Authentication** - Email/password login
2. **Firestore Database** - Role storage and user management
3. **Role-Based Access Control** - Permission system
4. **Page Protection** - Dynamic access control
5. **Admin Dashboard** - User and role management

## 🔧 Implementation Files

### Core Files
- `firebase-auth-system.js` - Main authentication system
- `login-auth.html` - Login/register page
- `login-handler.js` - Login form handling
- `admin-dashboard.js` - Admin role management
- `page-protection-auth.js` - Page access control
- `patients-auth.html` - Example protected page
- `patients-auth-example.js` - Example page logic

## 🎭 User Roles & Permissions

### 1. **Admin** 👑
- **Full system access**
- **Pages**: All pages
- **Permissions**: All permissions
- **Can**: Manage users, assign roles, access all features

### 2. **Doctor** 👨‍⚕️
- **Patient care focus**
- **Pages**: doctors.html, index.html, patients.html, lab.html, pharmacy.html
- **Permissions**: patients.read, patients.update, consultations.create, labRequests.create, prescriptions.create
- **Can**: View patients, create consultations, request lab tests, prescribe medications

### 3. **Pharmacy** 💊
- **Medication management**
- **Pages**: pharmacy.html, index.html, patients.html
- **Permissions**: prescriptions.read, prescriptions.update, medicines.create, medicines.read, medicines.update
- **Can**: Manage prescriptions, update medicine inventory

### 4. **Staff** 👥
- **General access**
- **Pages**: index.html, patients.html, triage.html
- **Permissions**: patients.read, appointments.read, triage.read
- **Can**: View patient information, read appointments

### 5. **Nurse** 👩‍⚕️
- **Patient care**
- **Pages**: patients.html, index.html, triage.html
- **Permissions**: patients.create, patients.read, patients.update, triage.create, triage.read, triage.update
- **Can**: Manage patients, create triage records

### 6. **Lab** 🧪
- **Laboratory work**
- **Pages**: lab.html, index.html, patients.html
- **Permissions**: labRequests.read, labRequests.update, labResults.create, labResults.read, labResults.update
- **Can**: Process lab requests, create lab results

### 7. **Reception** 📋
- **Appointments and billing**
- **Pages**: appointments.html, index.html, patients.html, billing.html
- **Permissions**: appointments.create, appointments.read, appointments.update, patients.create, patients.read, billing.create, billing.read
- **Can**: Manage appointments, handle billing

## 🚀 Getting Started

### 1. **Firebase Setup**
```bash
# Enable Authentication in Firebase Console
1. Go to Firebase Console → Authentication
2. Enable Email/Password authentication
3. Enable Firestore Database
4. Set up security rules
```

### 2. **Security Rules**
```javascript
// Firestore Rules
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Roles collection - only authenticated users can read
    match /roles/{document} {
      allow read, write: if request.auth != null;
    }
    
    // Other collections with role-based access
    match /patients/{document} {
      allow read: if request.auth != null;
      allow write: if request.auth != null && 
        (get(/databases/$(database)/documents/roles/$(request.auth.uid)).data.role == 'ADMIN' ||
         get(/databases/$(database)/documents/roles/$(request.auth.uid)).data.role in ['DOCTOR', 'NURSE']);
    }
  }
}
```

### 3. **First Admin User**
```javascript
// Create first admin user
const adminEmail = 'admin@hospital.com';
const adminPassword = 'Admin123!';
const adminName = 'System Administrator';

// Register admin
await window.FirebaseAuth.AuthManager.register(adminEmail, adminPassword, adminName, 'ADMIN');
```

## 📱 Login System

### Login Page Features
- **Email/Password Authentication**
- **User Registration**
- **Password Reset**
- **Role-based Redirect**

### Login Flow
```javascript
// 1. User enters email/password
const userData = await window.FirebaseAuth.AuthManager.login(email, password);

// 2. System fetches user role from Firestore
const userRole = await window.FirebaseAuth.AuthManager.getUserRole(user.uid);

// 3. User data stored locally
localStorage.setItem('currentUser', JSON.stringify(userData));

// 4. Redirect to appropriate dashboard
redirectToDashboard(userData);
```

### Registration Flow
```javascript
// 1. User fills registration form
const user = await window.FirebaseAuth.AuthManager.register(email, password, displayName, role);

// 2. Role stored in Firestore
await window.FirebaseAuth.AuthManager.assignRole(user.uid, email, role);

// 3. User can now login
```

## 🛡️ Page Protection

### Automatic Protection
```javascript
// Page automatically protected on load
const user = window.FirebaseAuth.PageAccessControl.initializePage('admin.html');

// If user doesn't have access, shows "Access Denied"
// If user has access, loads page with role-based navigation
```

### Permission-Based UI
```html
<!-- Hide element if user lacks permission -->
<div data-permission="patients.create">
    <button>Add Patient</button>
</div>

<!-- Disable button if user lacks permission -->
<button data-permission-button="patients.delete">Delete Patient</button>

<!-- Show only to specific roles -->
<div data-role="ADMIN,DOCTOR">
    <p>Admin/Doctor only content</p>
</div>
```

### JavaScript Permission Checks
```javascript
// Check permission before action
if (checkPermission('patients.create')) {
    // Allow patient creation
}

// Require permission for function
requirePermission('patients.delete', () => {
    // Delete patient
});

// Check role
const user = window.FirebaseAuth.AuthManager.getCurrentUser();
if (user.role === 'ADMIN') {
    // Admin only code
}
```

## 👑 Admin Dashboard

### User Management
- **View All Users** - List of all registered users
- **Assign Roles** - Change user roles and permissions
- **Reset Passwords** - Generate temporary passwords
- **Deactivate Users** - Disable user accounts

### Role Assignment
```javascript
// Update user role
await window.FirebaseAuth.AuthManager.updateUserRole(userUid, newRole);

// Role automatically updates permissions and accessible pages
```

### User Creation
```javascript
// Admin creates new user
const tempPassword = generateTempPassword();
const user = await window.FirebaseAuth.AuthManager.register(email, tempPassword, displayName, role);

// User receives temporary password and must change on first login
```

## 🔒 Security Features

### Authentication Security
- **Firebase Authentication** - Industry-standard security
- **Email Verification** - Optional email verification
- **Password Requirements** - Minimum 6 characters
- **Session Management** - Automatic logout on permission changes

### Authorization Security
- **Role-Based Access** - Granular permission system
- **Page-Level Protection** - Unauthorized access blocked
- **Action-Level Protection** - Individual features protected
- **Data-Level Protection** - Role-based data filtering

### Data Security
- **Firestore Security Rules** - Server-side validation
- **Encrypted Storage** - Firebase handles encryption
- **Audit Trail** - Track user actions and role changes

## 📊 Database Structure

### Firestore Collections

#### `roles` Collection
```javascript
{
  uid: "user123",
  email: "doctor@hospital.com",
  role: "DOCTOR",
  assignedAt: "2024-01-01T00:00:00Z",
  assignedBy: "admin123",
  updatedAt: "2024-01-01T00:00:00Z",
  updatedBy: "admin123"
}
```

#### `users` Collection (Optional)
```javascript
{
  uid: "user123",
  email: "doctor@hospital.com",
  displayName: "Dr. John Smith",
  contact: "555-0123",
  department: "Cardiology",
  isActive: true,
  createdAt: "2024-01-01T00:00:00Z",
  updatedAt: "2024-01-01T00:00:00Z"
}
```

## 🎯 Usage Examples

### Creating a Protected Page
```html
<!DOCTYPE html>
<html>
<head>
    <title>Protected Page</title>
    <script type="module">
        // Firebase initialization
        import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
        // ... Firebase config
    </script>
</head>
<body>
    <!-- Page content -->
    <div data-permission="patients.read">
        <h1>Patient List</h1>
    </div>
    
    <button data-permission-button="patients.create">Add Patient</button>
    
    <script src="firebase-auth-system.js"></script>
    <script src="page-protection-auth.js"></script>
    <script>
        function initPage(user) {
            // Page-specific initialization
            console.log('User:', user);
        }
    </script>
</body>
</html>
```

### Adding Permission Checks
```javascript
// Check permission before action
function addPatient() {
    if (!requirePermission('patients.create', () => true)) {
        return; // Permission denied
    }
    
    // Proceed with patient creation
    // ...
}

// Conditional UI based on permissions
function setupUI(user) {
    if (checkPermission('patients.delete')) {
        document.getElementById('deleteButton').style.display = 'block';
    }
    
    if (user.role === 'ADMIN') {
        document.getElementById('adminPanel').style.display = 'block';
    }
}
```

## 🚨 Error Handling

### Common Errors
```javascript
// Handle authentication errors
try {
    await window.FirebaseAuth.AuthManager.login(email, password);
} catch (error) {
    switch (error.code) {
        case 'auth/user-not-found':
            showAlert('No account found with this email');
            break;
        case 'auth/wrong-password':
            showAlert('Incorrect password');
            break;
        case 'auth/invalid-email':
            showAlert('Invalid email address');
            break;
        default:
            showAlert('Login failed. Please try again.');
    }
}
```

### Permission Errors
```javascript
// Handle permission errors
function performAction() {
    if (!checkPermission('required.permission')) {
        showAlert('You do not have permission to perform this action', 'error');
        return;
    }
    
    // Proceed with action
}
```

## 🔧 Customization

### Adding New Roles
```javascript
// Add new role to ROLES object
window.FirebaseAuth.ROLES.NEW_ROLE = {
    name: 'New Role',
    permissions: ['patients.read', 'appointments.read'],
    pages: ['index.html', 'patients.html']
};
```

### Adding New Permissions
```javascript
// Add permission to existing role
window.FirebaseAuth.ROLES.DOCTOR.permissions.push('newFeature.create');

// Check new permission
if (checkPermission('newFeature.create')) {
    // Allow action
}
```

### Custom Page Protection
```javascript
// Custom page protection logic
function customPageProtection() {
    const user = window.FirebaseAuth.AuthManager.getCurrentUser();
    
    if (!user) {
        window.location.href = 'login.html';
        return false;
    }
    
    // Custom permission logic
    if (user.role === 'ADMIN' || user.role === 'DOCTOR') {
        return true;
    }
    
    window.FirebaseAuth.PageAccessControl.showAccessDenied();
    return false;
}
```

## 📈 Performance Optimization

### Caching
- **User Data** - Cached in localStorage
- **Permissions** - Cached in memory
- **Role Data** - Cached locally

### Lazy Loading
- **Firebase Modules** - Loaded on demand
- **Page Components** - Loaded based on permissions
- **User Data** - Fetched only when needed

## 🚀 Deployment

### Production Setup
1. **Firebase Project** - Create production project
2. **Security Rules** - Implement strict rules
3. **Authentication** - Enable email/password
4. **Firestore** - Set up database
5. **Hosting** - Deploy to Firebase Hosting

### Environment Configuration
```javascript
// Production Firebase config
const firebaseConfig = {
    apiKey: "your-production-api-key",
    authDomain: "your-project.firebaseapp.com",
    projectId: "your-project-id",
    storageBucket: "your-project.appspot.com",
    messagingSenderId: "your-sender-id",
    appId: "your-app-id"
};
```

## 🎉 Benefits

### For Developers
- **Secure Authentication** - Firebase handles security
- **Role-Based Access** - Granular permission control
- **Easy Integration** - Simple API for permission checks
- **Scalable** - Handles growing user base

### For Administrators
- **User Management** - Centralized user control
- **Role Assignment** - Easy role management
- **Audit Trail** - Track user actions
- **Security** - Enterprise-grade security

### For Users
- **Secure Login** - Protected accounts
- **Role-Appropriate Access** - See only relevant features
- **Consistent Experience** - Same interface across roles
- **Mobile Friendly** - Works on all devices

Your Hospital Management System now has enterprise-grade Firebase authentication with comprehensive role-based access control! 🏥🔐✨
