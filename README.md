# PRINCE ALEX DIGITAL HMS

A professional, multi-tenant, Firebase-powered Hospital Management SaaS platform built with **HTML5, CSS3, Vanilla JavaScript (ES6+), and Firebase**.

## Overview

PRINCE ALEX DIGITAL HMS is a complete hospital management system designed as a multi-tenant SaaS platform. It supports multiple hospitals/clinics on a single Firebase project, with tenant isolation, role-based access control, and real-time data synchronization.

## Architecture

### Tech Stack
- **Frontend**: HTML5, CSS3, Vanilla JavaScript (ES6+)
- **Backend**: Firebase Firestore (database), Firebase Auth (authentication), Firebase Storage (documents)
- **SDK**: Firebase JavaScript SDK v12 (Modular)
- **No frameworks**: No React, Vue, Angular, or bundlers

### Multi-Tenant Design
```
tenants/          — Hospital/clinic profiles
users/            — User accounts (linked to tenants)
plans/            — Subscription plans
subscriptions/    — Tenant subscriptions
platformAdmins/   — Super admin accounts
```

### Tenant-Specific Data
```
patients/         — Patient records
appointments/     — Appointment scheduling
encounters/       — Clinical encounters
vitals/           — Patient vitals
diagnoses/        — Medical diagnoses
prescriptions/    — Doctor prescriptions
medicines/        — Medicine catalog
labOrders/        — Laboratory orders
labResults/       — Lab test results
admissions/       — Patient admissions
wards/            — Ward definitions
beds/             — Bed management
departments/      — Hospital departments
invoices/         — Billing invoices
payments/         — Payment records
insuranceClaims/  — Insurance claims
inventory/        — Inventory items
stockMovements/   — Stock movement logs
suppliers/        — Supplier records
purchaseOrders/   — Purchase orders
staff/            — Staff records
attendance/       — Staff attendance
leaveRequests/    — Leave requests
notifications/    — User notifications
documents/        — Medical documents
auditLogs/        — Audit trail
settings/         — Tenant settings
```

## File Structure

```
prince-alex-hms/
├── index.html              # Landing page
├── login.html              # Authentication page
├── dashboard.html          # Main dashboard
├── patients.html           # Patient list
├── patient-register.html   # Patient registration
├── patient-profile.html    # Patient profile
├── appointments.html       # Appointment list
├── appointment-create.html # New appointment
├── queue.html              # Patient queue
├── opd.html                # OPD management
├── consultation.html       # Doctor consultation
├── vitals.html             # Vitals recording
├── admissions.html         # Admissions list
├── admission-create.html   # New admission
├── wards.html              # Ward management
├── beds.html               # Bed management
├── pharmacy.html           # Pharmacy dashboard
├── medicines.html          # Medicine management
├── prescriptions.html      # Prescription list
├── laboratory.html         # Lab dashboard
├── lab-orders.html         # Lab orders
├── lab-results.html        # Lab results
├── billing.html            # Billing dashboard
├── invoices.html           # Invoice list
├── payments.html           # Payment list
├── receipts.html           # Receipt list
├── insurance.html          # Insurance management
├── insurance-claims.html   # Insurance claims
├── inventory.html          # Inventory management
├── stock-movements.html    # Stock movements
├── suppliers.html          # Supplier management
├── purchase-orders.html    # Purchase orders
├── staff.html              # Staff management
├── attendance.html         # Attendance tracking
├── leave.html              # Leave management
├── reports.html            # Reports dashboard
├── notifications.html      # Notifications page
├── audit-logs.html         # Audit logs
├── settings.html           # Settings
├── admin.html              # SaaS admin panel
├── hospitals.html          # Hospital management
├── subscriptions.html      # Subscription management
├── plans.html              # Plan management
├── css/
│   ├── style.css           # Main stylesheet
│   ├── dashboard.css       # Dashboard styles
│   ├── forms.css           # Form styles
│   ├── tables.css          # Table styles
│   └── responsive.css      # Responsive design
├── js/
│   ├── firebase-config.js  # Firebase initialization (single source)
│   ├── auth.js             # Authentication logic
│   ├── auth-guard.js       # Page protection
│   ├── permissions.js      # Role & permission system
│   ├── sidebar.js          # Sidebar component
│   ├── header.js           # Header component
│   ├── notifications.js    # Toast, loading, confirm, notifications
│   ├── debug.js            # Debug utility
│   ├── dashboard.js        # Dashboard logic
│   ├── patients.js         # Patient list logic
│   ├── patient-register.js # Patient registration logic
│   ├── patient-profile.js  # Patient profile logic
│   └── ...                 # Module-specific JS files
├── components/
│   ├── sidebar.html        # Sidebar HTML
│   ├── header.html         # Header HTML
│   ├── modal.html          # Modal template
│   └── footer.html         # Footer HTML
├── firestore.rules         # Firestore security rules
├── storage.rules           # Firebase Storage security rules
├── firestore.indexes.json  # Firestore composite indexes
├── firebase.json           # Firebase project config
└── README.md               # This file
```

## Getting Started

### Prerequisites
- A Firebase project (create one at [Firebase Console](https://console.firebase.google.com/))
- Firebase Blaze or Spark plan (for Firestore)
- A web server (for local development)

### Setup

1. **Clone or download** this repository.

2. **Configure Firebase**:
   - Open `js/firebase-config.js`
   - Replace the Firebase config with your project's config
   - Enable Authentication (Email/Password provider)
   - Create a Firestore database in test mode
   - Deploy the security rules: `firebase deploy --only firestore:rules`

3. **Deploy Firestore indexes**:
   ```bash
   firebase deploy --only firestore:indexes
   ```

4. **Deploy storage rules**:
   ```bash
   firebase deploy --only storage
   ```

5. **Serve locally**:
   ```bash
   firebase emulators:start
   # or
   npx serve .
   ```

6. **Create initial data**:
   - Create a tenant document in the `tenants` collection
   - Create a user in Firebase Auth
   - Create a user document in the `users` collection with:
     ```javascript
     {
       tenantId: "your-tenant-id",
       role: "HOSPITAL_ADMIN",
       permissions: [...],
       accountStatus: "ACTIVE",
       displayName: "Admin User",
       email: "admin@hospital.com"
     }
     ```

### Usage

1. Navigate to `login.html`
2. Sign in with your credentials
3. You'll be redirected to the dashboard
4. Use the sidebar to navigate between modules

## Role System

| Role | Description |
|------|-------------|
| SUPER_ADMIN | Platform administrator (full access) |
| HOSPITAL_ADMIN | Hospital administrator |
| DOCTOR | Medical doctor |
| NURSE | Nursing staff |
| RECEPTIONIST | Front desk staff |
| PHARMACIST | Pharmacy staff |
| LAB_TECHNICIAN | Laboratory technician |
| ACCOUNTANT | Accounting staff |
| CASHIER | Billing/cashier staff |
| INVENTORY_MANAGER | Inventory manager |
| HR_MANAGER | HR manager |
| PROCUREMENT_OFFICER | Procurement officer |
| PATIENT | Patient (limited access) |

## Security

- All Firestore operations are protected by security rules
- Tenant isolation is enforced at the database level
- Users cannot modify their own `tenantId`, `role`, or `permissions`
- Audit logs are append-only
- Medical documents are protected in Firebase Storage

## Development Guidelines

1. **One purpose per file**: Each JS file has a clear responsibility
2. **No minification**: Code is always readable
3. **Debug mode**: Use `debug()` for development logging
4. **Error handling**: All Firebase operations use try/catch
5. **Loading states**: Show loading indicators for async operations
6. **Permission checks**: Both UI and backend enforce permissions

## License

© 2026 Prince Alex Digital HMS. All rights reserved.
