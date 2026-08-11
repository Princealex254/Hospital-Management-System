﻿/**
 * PRINCE ALEX DIGITAL HMS — Permissions System
 * 
 * Defines roles, permissions, and helper functions for access control.
 * Used both in the UI (to show/hide elements) and in Firestore Security Rules.
 */

// ─── Role Definitions ────────────────────────────────────────────────────────
export const ROLES = {
    SUPER_ADMIN: "SUPER_ADMIN",
    HOSPITAL_ADMIN: "HOSPITAL_ADMIN",
    DOCTOR: "DOCTOR",
    NURSE: "NURSE",
    RECEPTIONIST: "RECEPTIONIST",
    PHARMACIST: "PHARMACIST",
    LAB_TECHNICIAN: "LAB_TECHNICIAN",
    ACCOUNTANT: "ACCOUNTANT",
    CASHIER: "CASHIER",
    INVENTORY_MANAGER: "INVENTORY_MANAGER",
    HR_MANAGER: "HR_MANAGER",
    PROCUREMENT_OFFICER: "PROCUREMENT_OFFICER",
    PATIENT: "PATIENT"
};

// ─── Permission Definitions ──────────────────────────────────────────────────
export const PERMISSIONS = {
    // Patients
    PATIENT_CREATE: "PATIENT_CREATE",
    PATIENT_READ: "PATIENT_READ",
    PATIENT_UPDATE: "PATIENT_UPDATE",
    PATIENT_DELETE: "PATIENT_DELETE",

    // Appointments
    APPOINTMENT_CREATE: "APPOINTMENT_CREATE",
    APPOINTMENT_READ: "APPOINTMENT_READ",
    APPOINTMENT_UPDATE: "APPOINTMENT_UPDATE",
    APPOINTMENT_DELETE: "APPOINTMENT_DELETE",
    QUEUE_MANAGE: "QUEUE_MANAGE",

    // Clinical
    VITALS_CREATE: "VITALS_CREATE",
    VITALS_READ: "VITALS_READ",
    CONSULTATION_CREATE: "CONSULTATION_CREATE",
    CONSULTATION_READ: "CONSULTATION_READ",
    DIAGNOSIS_CREATE: "DIAGNOSIS_CREATE",
    ENCOUNTER_CREATE: "ENCOUNTER_CREATE",

    // Pharmacy
    MEDICINE_CREATE: "MEDICINE_CREATE",
    MEDICINE_READ: "MEDICINE_READ",
    MEDICINE_UPDATE: "MEDICINE_UPDATE",
    MEDICINE_DELETE: "MEDICINE_DELETE",
    PRESCRIPTION_CREATE: "PRESCRIPTION_CREATE",
    PRESCRIPTION_READ: "PRESCRIPTION_READ",
    PRESCRIPTION_DISPENSE: "PRESCRIPTION_DISPENSE",

    // Laboratory
    LAB_ORDER_CREATE: "LAB_ORDER_CREATE",
    LAB_ORDER_READ: "LAB_ORDER_READ",
    LAB_ORDER_UPDATE: "LAB_ORDER_UPDATE",
    LAB_RESULT_CREATE: "LAB_RESULT_CREATE",
    LAB_RESULT_READ: "LAB_RESULT_READ",
    LAB_RESULT_VERIFY: "LAB_RESULT_VERIFY",

    // Admissions
    ADMISSION_CREATE: "ADMISSION_CREATE",
    ADMISSION_READ: "ADMISSION_READ",
    ADMISSION_REQUEST: "ADMISSION_REQUEST",
    ADMISSION_UPDATE: "ADMISSION_UPDATE",
    WARD_MANAGE: "WARD_MANAGE",
    BED_MANAGE: "BED_MANAGE",

    // Billing
    INVOICE_CREATE: "INVOICE_CREATE",
    INVOICE_READ: "INVOICE_READ",
    INVOICE_UPDATE: "INVOICE_UPDATE",
    INVOICE_DELETE: "INVOICE_DELETE",
    PAYMENT_CREATE: "PAYMENT_CREATE",
    PAYMENT_READ: "PAYMENT_READ",

    // Inventory
    INVENTORY_CREATE: "INVENTORY_CREATE",
    INVENTORY_READ: "INVENTORY_READ",
    INVENTORY_UPDATE: "INVENTORY_UPDATE",
    INVENTORY_DELETE: "INVENTORY_DELETE",
    STOCK_MOVEMENT_CREATE: "STOCK_MOVEMENT_CREATE",

    // Procurement
    SUPPLIER_CREATE: "SUPPLIER_CREATE",
    SUPPLIER_READ: "SUPPLIER_READ",
    SUPPLIER_UPDATE: "SUPPLIER_UPDATE",
    SUPPLIER_DELETE: "SUPPLIER_DELETE",
    PURCHASE_ORDER_CREATE: "PURCHASE_ORDER_CREATE",
    PURCHASE_ORDER_READ: "PURCHASE_ORDER_READ",
    PURCHASE_ORDER_UPDATE: "PURCHASE_ORDER_UPDATE",

    // Staff
    STAFF_CREATE: "STAFF_CREATE",
    STAFF_READ: "STAFF_READ",
    STAFF_UPDATE: "STAFF_UPDATE",
    STAFF_DELETE: "STAFF_DELETE",
    ATTENDANCE_MANAGE: "ATTENDANCE_MANAGE",
    LEAVE_MANAGE: "LEAVE_MANAGE",

    // Reports
    REPORT_READ: "REPORT_READ",

    // Admin
    TENANT_MANAGE: "TENANT_MANAGE",
    USER_MANAGE: "USER_MANAGE",
    USER_DELETE: "USER_DELETE",
    PLAN_MANAGE: "PLAN_MANAGE",
    SUBSCRIPTION_MANAGE: "SUBSCRIPTION_MANAGE",
    SETTINGS_UPDATE: "SETTINGS_UPDATE",
    HOSPITAL_MANAGE: "HOSPITAL_MANAGE",

    // Audit
    AUDIT_READ: "AUDIT_READ"
};

// ─── Role to Permissions Mapping ─────────────────────────────────────────────
export const ROLE_PERMISSIONS = {
    [ROLES.SUPER_ADMIN]: Object.values(PERMISSIONS),

    [ROLES.HOSPITAL_ADMIN]: [
        PERMISSIONS.PATIENT_CREATE, PERMISSIONS.PATIENT_READ, PERMISSIONS.PATIENT_UPDATE, PERMISSIONS.PATIENT_DELETE,
        PERMISSIONS.APPOINTMENT_READ, PERMISSIONS.APPOINTMENT_CREATE, PERMISSIONS.APPOINTMENT_UPDATE, PERMISSIONS.APPOINTMENT_DELETE,
        PERMISSIONS.VITALS_CREATE, PERMISSIONS.VITALS_READ,
        PERMISSIONS.CONSULTATION_CREATE, PERMISSIONS.CONSULTATION_READ,
        PERMISSIONS.DIAGNOSIS_CREATE, PERMISSIONS.ENCOUNTER_CREATE,
        PERMISSIONS.PRESCRIPTION_CREATE, PERMISSIONS.PRESCRIPTION_READ, PERMISSIONS.PRESCRIPTION_DISPENSE,
        PERMISSIONS.LAB_ORDER_CREATE, PERMISSIONS.LAB_ORDER_READ, PERMISSIONS.LAB_RESULT_CREATE, PERMISSIONS.LAB_RESULT_READ, PERMISSIONS.LAB_RESULT_VERIFY,
        PERMISSIONS.QUEUE_MANAGE,
        PERMISSIONS.ADMISSION_READ, PERMISSIONS.ADMISSION_CREATE, PERMISSIONS.ADMISSION_UPDATE,
        PERMISSIONS.WARD_MANAGE, PERMISSIONS.BED_MANAGE,
        PERMISSIONS.INVOICE_READ, PERMISSIONS.INVOICE_CREATE, PERMISSIONS.INVOICE_UPDATE, PERMISSIONS.INVOICE_DELETE,
        PERMISSIONS.PAYMENT_READ, PERMISSIONS.PAYMENT_CREATE,
        PERMISSIONS.MEDICINE_CREATE, PERMISSIONS.MEDICINE_READ, PERMISSIONS.MEDICINE_UPDATE, PERMISSIONS.MEDICINE_DELETE,
        PERMISSIONS.INVENTORY_READ, PERMISSIONS.INVENTORY_CREATE, PERMISSIONS.INVENTORY_UPDATE, PERMISSIONS.INVENTORY_DELETE,
        PERMISSIONS.STOCK_MOVEMENT_CREATE,
        PERMISSIONS.SUPPLIER_READ, PERMISSIONS.SUPPLIER_CREATE, PERMISSIONS.SUPPLIER_UPDATE, PERMISSIONS.SUPPLIER_DELETE,
        PERMISSIONS.PURCHASE_ORDER_READ, PERMISSIONS.PURCHASE_ORDER_CREATE, PERMISSIONS.PURCHASE_ORDER_UPDATE,
        PERMISSIONS.STAFF_READ, PERMISSIONS.STAFF_CREATE, PERMISSIONS.STAFF_UPDATE, PERMISSIONS.STAFF_DELETE,
        PERMISSIONS.ATTENDANCE_MANAGE, PERMISSIONS.LEAVE_MANAGE,
        PERMISSIONS.USER_MANAGE, PERMISSIONS.USER_DELETE,
        PERMISSIONS.REPORT_READ,
        PERMISSIONS.SETTINGS_UPDATE,
        PERMISSIONS.HOSPITAL_MANAGE,
        PERMISSIONS.AUDIT_READ
    ],

    [ROLES.DOCTOR]: [
        PERMISSIONS.PATIENT_READ, // Full clinical history
        PERMISSIONS.APPOINTMENT_READ, PERMISSIONS.APPOINTMENT_UPDATE,
        PERMISSIONS.QUEUE_MANAGE, // To see waiting patients and manage their status
        PERMISSIONS.VITALS_READ, // To view vitals recorded by nurse
        PERMISSIONS.CONSULTATION_CREATE, PERMISSIONS.CONSULTATION_READ, PERMISSIONS.DIAGNOSIS_CREATE,
        PERMISSIONS.PRESCRIPTION_CREATE, PERMISSIONS.PRESCRIPTION_READ,
        PERMISSIONS.LAB_ORDER_CREATE, PERMISSIONS.LAB_ORDER_READ, PERMISSIONS.LAB_RESULT_READ, PERMISSIONS.ADMISSION_REQUEST,
        PERMISSIONS.ADMISSION_CREATE, PERMISSIONS.ADMISSION_READ, PERMISSIONS.ADMISSION_UPDATE, // To admit and discharge
        PERMISSIONS.INVOICE_READ // To see patient's billing status
    ],

    [ROLES.NURSE]: [
        PERMISSIONS.PATIENT_READ,
        PERMISSIONS.APPOINTMENT_READ, PERMISSIONS.APPOINTMENT_UPDATE,
        PERMISSIONS.QUEUE_MANAGE, // To manage triage queue
        PERMISSIONS.VITALS_CREATE, PERMISSIONS.VITALS_READ,
        PERMISSIONS.ENCOUNTER_CREATE, // For nursing notes
        PERMISSIONS.LAB_ORDER_READ, PERMISSIONS.LAB_RESULT_READ,
        PERMISSIONS.ADMISSION_READ, PERMISSIONS.ADMISSION_UPDATE, // For inpatient care
        PERMISSIONS.BED_MANAGE // To see bed status
    ],

    [ROLES.RECEPTIONIST]: [
        PERMISSIONS.PATIENT_CREATE, PERMISSIONS.PATIENT_READ, PERMISSIONS.PATIENT_UPDATE, // Basic info update
        PERMISSIONS.APPOINTMENT_CREATE, PERMISSIONS.APPOINTMENT_READ, PERMISSIONS.APPOINTMENT_UPDATE, PERMISSIONS.APPOINTMENT_DELETE,
        PERMISSIONS.QUEUE_MANAGE, // Check-in patients
        PERMISSIONS.INVOICE_READ, // To see what a patient owes
        PERMISSIONS.PAYMENT_CREATE, PERMISSIONS.PAYMENT_READ // Can also act as cashier
    ],

    [ROLES.PHARMACIST]: [
        PERMISSIONS.PRESCRIPTION_READ, PERMISSIONS.PRESCRIPTION_DISPENSE,
        PERMISSIONS.MEDICINE_READ,
        PERMISSIONS.INVENTORY_READ, // To check stock
        PERMISSIONS.STOCK_MOVEMENT_CREATE // Dispensing is a stock movement
    ],

    [ROLES.LAB_TECHNICIAN]: [
        PERMISSIONS.LAB_ORDER_READ, PERMISSIONS.LAB_ORDER_UPDATE, PERMISSIONS.LAB_RESULT_VERIFY, // To update status and verify
        PERMISSIONS.LAB_RESULT_CREATE, PERMISSIONS.LAB_RESULT_READ,
        PERMISSIONS.INVENTORY_READ // To check for reagents/supplies
    ],

    [ROLES.ACCOUNTANT]: [
        PERMISSIONS.INVOICE_CREATE, PERMISSIONS.INVOICE_READ, PERMISSIONS.INVOICE_UPDATE,
        PERMISSIONS.PAYMENT_CREATE, PERMISSIONS.PAYMENT_READ,
        PERMISSIONS.SUPPLIER_READ,
        PERMISSIONS.PURCHASE_ORDER_READ,
        PERMISSIONS.REPORT_READ
    ],

    [ROLES.CASHIER]: [
        PERMISSIONS.PAYMENT_CREATE, PERMISSIONS.PAYMENT_READ,
        PERMISSIONS.INVOICE_READ
    ],

    [ROLES.INVENTORY_MANAGER]: [
        PERMISSIONS.INVENTORY_CREATE, PERMISSIONS.INVENTORY_READ, PERMISSIONS.INVENTORY_UPDATE, PERMISSIONS.INVENTORY_DELETE,
        PERMISSIONS.STOCK_MOVEMENT_CREATE,
        PERMISSIONS.MEDICINE_CREATE, PERMISSIONS.MEDICINE_READ, PERMISSIONS.MEDICINE_UPDATE, PERMISSIONS.MEDICINE_DELETE,
        PERMISSIONS.SUPPLIER_READ,
        PERMISSIONS.PURCHASE_ORDER_READ,
        PERMISSIONS.REPORT_READ
    ],

    [ROLES.HR_MANAGER]: [
        PERMISSIONS.STAFF_CREATE, PERMISSIONS.STAFF_READ,
        PERMISSIONS.ATTENDANCE_MANAGE, PERMISSIONS.LEAVE_MANAGE,
        PERMISSIONS.REPORT_READ
    ],

    [ROLES.PROCUREMENT_OFFICER]: [
        PERMISSIONS.INVENTORY_READ,
        PERMISSIONS.SUPPLIER_CREATE, PERMISSIONS.SUPPLIER_READ, PERMISSIONS.SUPPLIER_UPDATE,
        PERMISSIONS.PURCHASE_ORDER_CREATE, PERMISSIONS.PURCHASE_ORDER_READ, PERMISSIONS.PURCHASE_ORDER_UPDATE,
        PERMISSIONS.REPORT_READ
    ],

    [ROLES.PATIENT]: [
        PERMISSIONS.PATIENT_READ,
        PERMISSIONS.APPOINTMENT_READ,
        PERMISSIONS.PRESCRIPTION_READ,
        PERMISSIONS.LAB_RESULT_READ,
        PERMISSIONS.INVOICE_READ,
        PERMISSIONS.PAYMENT_READ
    ]
};

// ─── Current User State ──────────────────────────────────────────────────────
let currentUser = null;

function hasFullAccessRole(role) {
    return role === ROLES.SUPER_ADMIN || role === ROLES.HOSPITAL_ADMIN;
}

/**
 * Sets the current authenticated user with their role and permissions.
 * @param {Object} user - User object from Firestore
 */
export function setCurrentUser(user) {
    currentUser = user;
}

/**
 * Gets the current authenticated user.
 * @returns {Object|null}
 */
export function getCurrentUser() {
    return currentUser;
}

/**
 * Gets the current user's tenant ID.
 * @returns {string|null}
 */
export function getTenantId() {
    return currentUser?.tenantId || null;
}

/**
 * Gets the current user's role.
 * @returns {string|null}
 */
export function getUserRole() {
    return currentUser?.role || null;
}

/**
 * Gets the current user's permissions array.
 * @returns {Array<string>}
 */
export function getUserPermissions() {
    if (!currentUser) return [];

    if (hasFullAccessRole(currentUser.role)) {
        return Object.values(PERMISSIONS);
    }

    // Use explicit permissions if set, otherwise derive from role
    if (currentUser.permissions && Array.isArray(currentUser.permissions)) {
        return currentUser.permissions;
    }
    return ROLE_PERMISSIONS[currentUser.role] || [];
}

/**
 * Checks if the current user has a specific permission.
 * @param {string} permission - The permission to check
 * @returns {boolean}
 */
export function hasPermission(permission) {
    if (!currentUser) return false;

    if (hasFullAccessRole(currentUser.role)) {
        return true;
    }

    const permissions = getUserPermissions();
    return permissions.includes(permission);
}

/**
 * Checks if the current user has any of the specified permissions.
 * @param {Array<string>} permissions - Array of permissions to check
 * @returns {boolean}
 */
export function hasAnyPermission(permissions) {
    if (!currentUser) return false;
    if (hasFullAccessRole(currentUser.role)) {
        return true;
    }
    const userPerms = getUserPermissions();
    return permissions.some(p => userPerms.includes(p));
}

/**
 * Checks if the current user has all of the specified permissions.
 * @param {Array<string>} permissions - Array of permissions to check
 * @returns {boolean}
 */
export function hasAllPermissions(permissions) {
    if (!currentUser) return false;
    if (hasFullAccessRole(currentUser.role)) {
        return true;
    }
    const userPerms = getUserPermissions();
    return permissions.every(p => userPerms.includes(p));
}

/**
 * Checks if the current user has a specific role.
 * @param {string} role - The role to check
 * @returns {boolean}
 */
export function hasRole(role) {
    if (!currentUser) return false;
    return currentUser.role === role;
}

/**
 * Checks if the current user has any of the specified roles.
 * @param {Array<string>} roles - Array of roles to check
 * @returns {boolean}
 */
export function hasAnyRole(roles) {
    if (!currentUser) return false;
    return roles.includes(currentUser.role);
}

/**
 * Hides or shows an element based on permission.
 * @param {string} elementId - The element ID
 * @param {string} permission - The required permission
 */
export function requirePermission(elementId, permission) {
    const el = document.getElementById(elementId);
    if (!el) return;
    if (hasPermission(permission)) {
        el.style.display = "";
    } else {
        el.style.display = "none";
    }
}

/**
 * Hides or shows an element based on role.
 * @param {string} elementId - The element ID
 * @param {string} role - The required role
 */
export function requireRole(elementId, role) {
    const el = document.getElementById(elementId);
    if (!el) return;
    if (hasRole(role)) {
        el.style.display = "";
    } else {
        el.style.display = "none";
    }
}
