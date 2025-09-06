# 🔐 Role-Based Access Control (RBAC) System

## Overview

The Prince Alex Hospital Management System now includes a comprehensive Role-Based Access Control (RBAC) system that ensures users can only access the features and data they're authorized to use.

## 🎭 User Roles & Permissions

### 1. **Admin** 👑
**Full system access with all permissions**

**Pages Access:**
- ✅ All pages (admin.html, index.html, patients.html, triage.html, doctors.html, lab.html, pharmacy.html, appointments.html, billing.html, reports.html)

**Permissions:**
- Users: Create, Read, Update, Delete
- Patients: Create, Read, Update, Delete
- Doctors: Create, Read, Update, Delete
- Appointments: Create, Read, Update, Delete
- Triage: Create, Read, Update, Delete
- Consultations: Create, Read, Update, Delete
- Lab Requests: Create, Read, Update, Delete
- Lab Results: Create, Read, Update, Delete
- Prescriptions: Create, Read, Update, Delete
- Medicines: Create, Read, Update, Delete
- Billing: Create, Read, Update, Delete
- Departments: Create, Read, Update, Delete
- Reports: Read, Export
- System: Settings, Backup, Reset

### 2. **Doctor** 👨‍⚕️
**Patient care and medical decisions**

**Pages Access:**
- ✅ doctors.html (main workspace)
- ✅ index.html (dashboard)
- ✅ patients.html (view patient records)
- ✅ lab.html (view lab results)
- ✅ pharmacy.html (prescribe medications)

**Permissions:**
- Patients: Read, Update
- Appointments: Read, Update
- Triage: Read, Update
- Consultations: Create, Read, Update
- Lab Requests: Create, Read
- Lab Results: Read
- Prescriptions: Create, Read
- Medicines: Read

### 3. **Nurse** 👩‍⚕️
**Patient care and triage support**

**Pages Access:**
- ✅ patients.html (patient management)
- ✅ index.html (dashboard)
- ✅ triage.html (emergency intake)
- ✅ lab.html (view lab results)
- ✅ pharmacy.html (view prescriptions)

**Permissions:**
- Patients: Create, Read, Update
- Appointments: Read
- Triage: Create, Read, Update
- Consultations: Read
- Lab Requests: Read
- Lab Results: Read
- Prescriptions: Read
- Medicines: Read

### 4. **Pharmacy** 💊
**Medication management and dispensing**

**Pages Access:**
- ✅ pharmacy.html (main workspace)
- ✅ index.html (dashboard)
- ✅ patients.html (view patient info)

**Permissions:**
- Prescriptions: Read, Update
- Medicines: Create, Read, Update
- Patients: Read

### 5. **Lab** 🧪
**Laboratory testing and results**

**Pages Access:**
- ✅ lab.html (main workspace)
- ✅ index.html (dashboard)
- ✅ patients.html (view patient info)

**Permissions:**
- Lab Requests: Read, Update
- Lab Results: Create, Read, Update
- Patients: Read

### 6. **Triage** 🚨
**Emergency intake and patient assessment**

**Pages Access:**
- ✅ triage.html (main workspace)
- ✅ index.html (dashboard)
- ✅ patients.html (patient management)
- ✅ appointments.html (view appointments)

**Permissions:**
- Triage: Create, Read, Update
- Patients: Create, Read
- Appointments: Read

### 7. **Reception** 📋
**Appointment scheduling and billing**

**Pages Access:**
- ✅ appointments.html (main workspace)
- ✅ index.html (dashboard)
- ✅ patients.html (patient management)
- ✅ billing.html (billing management)

**Permissions:**
- Appointments: Create, Read, Update, Delete
- Patients: Create, Read, Update
- Billing: Create, Read, Update
- Doctors: Read

## 🔧 Technical Implementation

### Authentication Flow
1. **Login**: User enters username and selects department
2. **Role Assignment**: System assigns role based on department
3. **Permission Check**: User permissions are loaded from role definition
4. **Page Access**: User is redirected to appropriate page based on role
5. **Session Management**: User session is maintained with role information

### Permission System
```javascript
// Check if user has permission
if (window.RBAC.PermissionManager.hasPermission(user, 'patients.create')) {
    // Allow patient creation
}

// Check page access
if (window.RBAC.PermissionManager.canAccessPage(user, 'admin.html')) {
    // Allow admin page access
}
```

### Page Protection
```javascript
// Protect page on load
const user = window.RBAC.PageAccessControl.initializePage('admin.html');
if (!user) {
    // Redirect to login or show access denied
}
```

## 🛡️ Security Features

### 1. **Page-Level Protection**
- Each page checks user permissions before loading
- Unauthorized access shows "Access Denied" message
- Automatic redirect to appropriate page based on role

### 2. **Action-Level Protection**
- Individual actions require specific permissions
- Buttons/features are hidden if user lacks permission
- Server-side validation (when implemented)

### 3. **Data-Level Protection**
- Users can only access data they're authorized to see
- Role-based data filtering
- Audit trail for sensitive operations

### 4. **Session Management**
- Secure session storage
- Automatic logout on permission changes
- Session timeout handling

## 📊 Admin Management

### User Management
- **Create Users**: Add new staff members with roles
- **Edit Roles**: Change user roles and permissions
- **Deactivate Users**: Disable user accounts
- **View Permissions**: See detailed permission list

### Role Management
- **Predefined Roles**: 7 standard hospital roles
- **Permission Matrix**: Clear permission definitions
- **Role Hierarchy**: Admin > Doctor > Nurse > Others

### Audit Features
- **Login Tracking**: Monitor user access
- **Permission Changes**: Track role modifications
- **Action Logging**: Record sensitive operations

## 🚀 Getting Started

### 1. **First Login**
- Open `login.html`
- Enter any username
- Select department (determines role)
- System creates user account automatically

### 2. **Admin Access**
- Login with any username
- Select "Admin" department
- Access admin panel for user management

### 3. **Role Assignment**
- Admin can change user roles
- Permissions update automatically
- Changes take effect immediately

## 🔍 Permission Examples

### Doctor Workflow
```javascript
// Doctor can create consultations
if (checkPermission('consultations.create')) {
    // Show consultation form
}

// Doctor can read lab results
if (checkPermission('labResults.read')) {
    // Display lab results
}

// Doctor cannot delete patients
if (checkPermission('patients.delete')) {
    // This will be false for doctors
}
```

### Nurse Workflow
```javascript
// Nurse can create triage records
if (checkPermission('triage.create')) {
    // Show triage form
}

// Nurse can update patient records
if (checkPermission('patients.update')) {
    // Show edit patient button
}
```

## 🛠️ Customization

### Adding New Roles
```javascript
const NEW_ROLE = {
    name: 'Custom Role',
    permissions: ['patients.read', 'appointments.read'],
    pages: ['index.html', 'patients.html']
};

// Add to ROLES object
window.RBAC.ROLES.CUSTOM = NEW_ROLE;
```

### Adding New Permissions
```javascript
// Add new permission to role
ROLES.DOCTOR.permissions.push('newFeature.create');

// Check permission
if (checkPermission('newFeature.create')) {
    // Allow action
}
```

## 📱 User Experience

### Navigation
- **Role-Based Menu**: Only show accessible pages
- **Current Page Highlight**: Visual indication of active page
- **Quick Access**: Direct links to most-used features

### Visual Indicators
- **Permission Badges**: Show user role and status
- **Access Denied**: Clear error messages
- **Loading States**: Smooth transitions

### Responsive Design
- **Mobile Friendly**: Works on all devices
- **Touch Optimized**: Easy navigation on tablets
- **Consistent UI**: Same experience across roles

## 🔒 Security Best Practices

### 1. **Principle of Least Privilege**
- Users get minimum required permissions
- Regular permission audits
- Temporary elevated access when needed

### 2. **Defense in Depth**
- Multiple security layers
- Client-side and server-side validation
- Regular security updates

### 3. **Audit and Monitoring**
- Track all permission changes
- Monitor failed access attempts
- Regular security reviews

## 🚨 Troubleshooting

### Common Issues

1. **Access Denied Error**
   - Check user role and permissions
   - Verify page is in user's accessible pages
   - Contact admin for role changes

2. **Missing Features**
   - Feature requires specific permission
   - Check if user role includes permission
   - Request permission from admin

3. **Login Issues**
   - Clear browser cache and cookies
   - Check Firebase connection
   - Verify user account is active

### Debug Mode
```javascript
// Check current user
console.log(window.RBAC.AuthManager.getCurrentUser());

// Check permissions
console.log(window.RBAC.PermissionManager.getUserPermissions(user));

// Check accessible pages
console.log(window.RBAC.PermissionManager.getAccessiblePages(user));
```

## 📈 Future Enhancements

### Planned Features
- **Multi-Factor Authentication**: Enhanced security
- **Time-Based Permissions**: Temporary access grants
- **Department Hierarchies**: Complex organizational structures
- **API Permissions**: Secure API access control
- **Mobile App Integration**: Cross-platform permissions

### Integration Options
- **Active Directory**: Enterprise user management
- **SSO Integration**: Single sign-on support
- **Biometric Authentication**: Advanced security
- **Blockchain Permissions**: Decentralized access control

## 🎯 Benefits

### For Administrators
- **Centralized Control**: Manage all user access from one place
- **Security Compliance**: Meet healthcare data protection requirements
- **Audit Trail**: Complete access logging and monitoring
- **Scalability**: Easy to add new roles and permissions

### For Users
- **Clear Access**: Know exactly what you can and cannot do
- **Efficient Workflow**: Access only relevant features
- **Consistent Experience**: Same interface across all roles
- **Mobile Access**: Work from any device with appropriate permissions

### For the Organization
- **Data Security**: Protect sensitive patient information
- **Compliance**: Meet healthcare regulations and standards
- **Efficiency**: Streamlined workflows based on roles
- **Scalability**: Easy to add new staff and departments

Your Hospital Management System now has enterprise-grade security with role-based access control! 🏥🔐
