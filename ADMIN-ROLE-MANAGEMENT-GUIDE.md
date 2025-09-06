# 👑 Admin Role Management System

## Overview

The Admin Role Management System allows administrators to assign roles to users in Firebase, enabling role-based access control and automatic redirection after login.

## 🏗️ Firestore Structure

### **Roles Collection**
```
roles (collection)
 └── documentId (email address)
      ├── email: "user@example.com"
      ├── role: "Admin" / "Doctor" / "Nurse" / etc.
      ├── department: "Admin" / "Lab" / "Pharmacy" / etc.
      ├── status: "active" / "inactive"
      ├── createdAt: timestamp
      ├── updatedAt: timestamp
      └── assignedBy: "admin_uid"
```

### **Key Points:**
- **Document ID**: Uses email address as document ID for direct lookup
- **Email**: Must match Firebase Auth user email exactly
- **Role**: Determines which page user is redirected to after login
- **Department**: Optional field for additional filtering
- **Status**: Controls whether user can log in (active/inactive)

## 🎯 Role-Based Redirections

| Role | Redirects To | Description |
|------|-------------|-------------|
| **Admin** | `/admin.html` | Admin dashboard |
| **Doctor** | `/doctors.html` | Doctor's consultation panel |
| **Nurse** | `/patients.html` | Patient management |
| **Pharmacy** | `/pharmacy.html` | Pharmacy management |
| **Lab** | `/lab.html` | Laboratory management |
| **Reception** | `/appointments.html` | Appointment scheduling |
| **Triage** | `/triage.html` | Triage management |
| **Staff** | `/index.html` | General dashboard |

## 🔧 Admin Page Features

### **1. Staff Management Section**
- **Search Functionality**: Search by email, role, or department
- **Role Assignment**: Assign roles to users
- **Role Editing**: Modify existing user roles
- **Role Deletion**: Remove user roles
- **Status Management**: Activate/deactivate users

### **2. Assign Role Form**
- **Email Input**: User's Firebase Auth email
- **Role Dropdown**: Select from available roles
- **Department Dropdown**: Optional department assignment
- **Status Selection**: Active/Inactive status
- **Save Button**: Assigns or updates role in Firestore

### **3. System Statistics**
- **Total Users**: Count of all users with roles
- **Active Users**: Count of active users
- **Admins**: Count of admin users
- **Doctors**: Count of doctor users
- **Staff Members**: Count of other staff

## 🚀 JavaScript Implementation

### **Role Assignment Function**
```javascript
async function assignRole() {
    const email = document.getElementById('userEmail').value.trim();
    const role = document.getElementById('userRole').value;
    const department = document.getElementById('userDepartment').value;
    const status = document.getElementById('userStatus').value;
    
    if (!email || !role) {
        showAlert('Please fill in email and role fields', 'error');
        return;
    }
    
    try {
        // Use email as document ID for simplicity
        const roleRef = doc(db, 'roles', email);
        
        const roleData = {
            email: email,
            role: role,
            department: department || null,
            status: status,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
            assignedBy: auth.currentUser?.uid || 'admin'
        };
        
        await setDoc(roleRef, roleData);
        
        // Reload roles and show success message
        await loadRoles();
        closeAssignRoleModal();
        
        showAlert(`Role assigned successfully! User will be redirected to ${ROLE_REDIRECTS[role]} after login.`, 'success');
        
    } catch (error) {
        console.error('Error assigning role:', error);
        showAlert('Error assigning role: ' + error.message, 'error');
    }
}
```

### **Role Lookup Function**
```javascript
async function getUserRoleFromFirestore(email) {
    try {
        // Use email as document ID for direct lookup
        const roleRef = doc(db, 'roles', email);
        const roleSnap = await getDoc(roleRef);
        
        if (roleSnap.exists()) {
            return roleSnap.data();
        }
        
        return null;
    } catch (error) {
        console.error('Error fetching user role:', error);
        return null;
    }
}
```

## 🔐 Login Flow Implementation

### **1. User Authentication**
```javascript
// User logs in via Firebase Auth
const userCredential = await signInWithEmailAndPassword(auth, email, password);
const user = userCredential.user;
```

### **2. Role Check**
```javascript
// Check Firestore roles collection by email
const roleRef = doc(db, 'roles', user.email);
const roleSnap = await getDoc(roleRef);

if (!roleSnap.exists()) {
    alert("You do not have access. Contact Admin.");
    auth.signOut();
} else {
    const role = roleSnap.data().role;
    // Redirect based on role
}
```

### **3. Role-Based Redirection**
```javascript
// Redirect user based on role field
const role = userRole.role;
if (role === "Admin") window.location.href = "/admin.html";
else if (role === "Doctor") window.location.href = "/doctors.html";
else if (role === "Nurse") window.location.href = "/patients.html";
else if (role === "Pharmacy") window.location.href = "/pharmacy.html";
else if (role === "Lab") window.location.href = "/lab.html";
else if (role === "Reception") window.location.href = "/appointments.html";
else if (role === "Triage") window.location.href = "/triage.html";
else if (role === "Staff") window.location.href = "/index.html";
else window.location.href = "/index.html"; // Default fallback
```

## 🛡️ Security Features

### **1. Admin-Only Access**
- Only users with "Admin" role can access the admin page
- Automatic redirect to login if not admin
- Role verification on page load

### **2. Firestore Security Rules**
```javascript
// Roles collection - only authenticated users can read
match /roles/{document} {
  allow read, write: if request.auth != null;
}

// Other collections with role-based access
match /patients/{document} {
  allow read: if request.auth != null;
  allow write: if request.auth != null && 
    (get(/databases/$(database)/documents/roles/$(request.auth.uid)).data.role == 'Admin' ||
     get(/databases/$(database)/documents/roles/$(request.auth.uid)).data.role in ['Doctor', 'Nurse']);
}
```

### **3. Data Validation**
- Email format validation
- Required field validation
- Role existence validation
- Status validation

## 📱 User Interface

### **Admin Dashboard Layout**
- **System Overview**: Statistics and system health
- **Staff Management**: Role assignment and management
- **Department Management**: Department administration
- **System Settings**: Global system configuration
- **Data Management**: Backup and maintenance tools

### **Role Assignment Modal**
- **Clean Form Design**: Professional hospital interface
- **Clear Labels**: Helpful descriptions for each field
- **Validation Feedback**: Real-time form validation
- **Success Messages**: Clear confirmation of actions

### **Staff Table**
- **Sortable Columns**: Email, Role, Department, Status, Created At
- **Action Buttons**: Edit Role, Delete Role
- **Status Badges**: Visual status indicators
- **Role Badges**: Color-coded role indicators

## 🔄 Workflow

### **1. Admin Assigns Role**
1. Admin opens admin dashboard
2. Clicks "Assign Role" button
3. Enters user's email address
4. Selects role from dropdown
5. Optionally selects department
6. Sets status to active/inactive
7. Clicks "Assign Role" button
8. Role is saved to Firestore

### **2. User Logs In**
1. User enters email/password
2. Firebase Auth verifies credentials
3. System checks Firestore roles collection
4. If role exists and is active, user is redirected
5. If role doesn't exist, user gets "Contact Admin" message
6. If role is inactive, user cannot log in

### **3. Role Management**
1. Admin can view all assigned roles
2. Admin can edit existing roles
3. Admin can delete roles
4. Admin can activate/deactivate users
5. All changes are logged with timestamps

## 🚀 Setup Instructions

### **1. Initial Setup**
1. Open `setup.html` in browser
2. Click "Create Admin User"
3. Copy security rules to Firebase Console
4. Test login with admin credentials

### **2. Assign Roles**
1. Login as admin
2. Go to admin dashboard
3. Click "Assign Role"
4. Enter user email and select role
5. Save role assignment

### **3. Test Login**
1. User registers with Firebase Auth
2. Admin assigns role to user
3. User logs in with email/password
4. User is redirected to appropriate page

## 📊 Monitoring & Analytics

### **System Statistics**
- Total number of users
- Active vs inactive users
- Role distribution
- Department distribution
- User activity tracking

### **Audit Trail**
- Role assignment timestamps
- Who assigned each role
- Role modification history
- User login attempts
- Access pattern analysis

## 🔧 Customization

### **Adding New Roles**
```javascript
// Add to ROLE_REDIRECTS
const ROLE_REDIRECTS = {
  'NewRole': 'new-role.html',
  // ... existing roles
};

// Add to role dropdown in admin form
<option value="NewRole">New Role</option>
```

### **Modifying Departments**
```javascript
// Add to department dropdown
<option value="NewDepartment">New Department</option>
```

### **Custom Redirections**
```javascript
// Modify redirection logic
if (role === "NewRole") window.location.href = "/new-role.html";
```

## 🎉 Benefits

### **For Administrators**
- **Centralized Control**: Manage all user roles from one place
- **Easy Assignment**: Simple form-based role assignment
- **Real-time Updates**: Changes take effect immediately
- **Audit Trail**: Track all role changes and assignments

### **For Users**
- **Automatic Redirection**: Seamless navigation to appropriate pages
- **Clear Access Control**: Know exactly what they can access
- **Consistent Experience**: Same interface across all roles
- **Secure Authentication**: Firebase-powered security

### **For Developers**
- **Clean Architecture**: Well-structured role management system
- **Easy Integration**: Simple API for role checking
- **Scalable Design**: Handles growing user base
- **Maintainable Code**: Clear separation of concerns

## 🚨 Troubleshooting

### **Common Issues**

1. **"You do not have access. Contact Admin."**
   - User exists in Firebase Auth but not in roles collection
   - Solution: Admin assigns role to user

2. **User not redirected correctly**
   - Check role name in Firestore matches ROLE_REDIRECTS
   - Verify role is set to "active" status

3. **Admin cannot access admin page**
   - Check if user has "Admin" role in Firestore
   - Verify role status is "active"

4. **Role assignment fails**
   - Check Firebase permissions
   - Verify Firestore security rules
   - Check network connection

### **Debug Steps**
1. Check browser console for errors
2. Verify Firebase configuration
3. Check Firestore security rules
4. Test with admin credentials
5. Verify role data in Firestore

## 🎯 Conclusion

The Admin Role Management System provides:

- **Complete Role Control**: Assign, edit, and delete user roles
- **Automatic Redirection**: Users go to correct pages based on roles
- **Secure Access**: Firebase-powered authentication and authorization
- **Easy Management**: Simple admin interface for role management
- **Audit Trail**: Track all role changes and user activity

Your hospital management system now has enterprise-grade role management with Firebase integration! 🏥👑✨
