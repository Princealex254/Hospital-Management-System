/**
 * PRINCE ALEX DIGITAL HMS — Navigation Module
 * 
 * Defines the application's navigation structure for the sidebar.
 */

import { getCurrentUser, hasPermission, hasAreaAccess, hasRole, ROLES } from "./permissions.js";
import { icon } from "./icons.js";
import { debug, debugError } from "./debug.js";

// ─── Navigation Item Definitions ─────────────────────────────────────────────
// Each section may restrict its items to an assigned access area.
// If permission is set, the item shows only when the user has that permission.
// If role is set, the item shows only when the user has that role.

export const NAV_SECTIONS = [
    {
        title: "Patients", area: "PATIENTS",
        items: [
            { label: "Patients", href: "../patients/", icon: "patients", permission: "PATIENT_READ" },
            { label: "Register Patient", href: "../patient-register/", icon: "register", permission: "PATIENT_CREATE" }
        ]
    },
    {
        title: "Appointments", area: "APPOINTMENTS",
        items: [
            { label: "Appointments", href: "../appointments/", icon: "appointments", permission: "APPOINTMENT_READ" },
            { label: "New Appointment", href: "../appointment-create/", icon: "new-appointment", permission: "APPOINTMENT_CREATE" },
            { label: "Queue", href: "../queue/", icon: "appointments", permission: "APPOINTMENT_READ" }
        ]
    },
    {
        title: "Clinical", area: "CLINICAL",
        items: [
            { label: "OPD", href: "../opd/", icon: "opd", permission: "APPOINTMENT_READ" },
            { label: "Consultation", href: "../consultation/", icon: "consultation", permission: "CONSULTATION_CREATE" },
            { label: "Triage", href: "../triage/", icon: "vitals", permission: "VITALS_CREATE" },
            { label: "Vitals History", href: "../vitals/", icon: "activity", permission: "VITALS_READ" }
        ]
    },
    {
        title: "Admissions", area: "ADMISSIONS",
        items: [
            { label: "Admissions", href: "../admissions/", icon: "admissions", permission: "ADMISSION_READ" },
            { label: "New Admission", href: "../admission-create/", icon: "new-admission", permission: "ADMISSION_CREATE" },
            { label: "Wards", href: "../wards/", icon: "wards", permission: "WARD_MANAGE" },
            { label: "Beds", href: "../beds/", icon: "beds", permission: "BED_MANAGE" }
        ]
    },
    {
        title: "Pharmacy", area: "PHARMACY",
        items: [
            { label: "Pharmacy", href: "../pharmacy/", icon: "pharmacy", permission: "PRESCRIPTION_READ" },
            { label: "Medicines", href: "../medicines/", icon: "medicines", permission: "MEDICINE_CREATE" },
            { label: "Prescriptions", href: "../prescriptions/", icon: "prescriptions", permission: "PRESCRIPTION_READ" }
        ]
    },
    {
        title: "Laboratory", area: "LABORATORY",
        items: [
            { label: "Laboratory", href: "../laboratory/", icon: "laboratory", permission: "LAB_ORDER_READ" },
            { label: "Lab Orders", href: "../lab-orders/", icon: "lab-orders", permission: "LAB_ORDER_CREATE" },
            { label: "Lab Results", href: "../lab-results/", icon: "lab-results", permission: "LAB_RESULT_READ" }
        ]
    },
    {
        title: "Billing", area: "BILLING",
        items: [
            { label: "Billing", href: "../billing/", icon: "billing", permission: "INVOICE_READ" },
            { label: "Invoices", href: "../invoices/", icon: "invoices", permission: "INVOICE_READ" },
            { label: "Payments", href: "../payments/", icon: "payments", permission: "PAYMENT_CREATE" },
            { label: "Receipts", href: "../receipts/", icon: "receipts", permission: "PAYMENT_READ" }
        ]
    },
    {
        title: "Inventory", area: "INVENTORY",
        items: [
            { label: "Inventory", href: "../inventory/", icon: "inventory", permission: "INVENTORY_READ" },
            { label: "Stock Movements", href: "../stock-movements/", icon: "stock-movements", permission: "STOCK_MOVEMENT_CREATE" },
            { label: "Suppliers", href: "../suppliers/", icon: "suppliers", permission: "SUPPLIER_CREATE" },
            { label: "Purchase Orders", href: "../purchase-orders/", icon: "purchase-orders", permission: "PURCHASE_ORDER_CREATE" }
        ]
    },
    {
        title: "Staff", area: "STAFF",
        items: [
            { label: "Staff", href: "../staff/", icon: "staff", permission: "STAFF_READ" },
            { label: "Attendance", href: "../attendance/", icon: "attendance", permission: "ATTENDANCE_MANAGE" },
            { label: "Leave", href: "../leave/", icon: "leave", permission: "LEAVE_MANAGE" }
        ]
    },
    {
        title: "Reports & Settings", area: "REPORTS",
        items: [
            { label: "Reports", href: "../reports/", icon: "reports", permission: "REPORT_READ" },
            { label: "Audit Logs", href: "../audit-logs/", icon: "audit-logs", permission: "AUDIT_READ" },
            { label: "Settings", href: "../settings/", icon: "settings", permission: "SETTINGS_UPDATE" }
        ]
    },
    {
        title: "SaaS Admin",
        role: ROLES.SUPER_ADMIN,
        items: [
            { label: "Admin Panel", href: "../admin/", icon: "admin", role: ROLES.SUPER_ADMIN },
            { label: "Hospitals", href: "../hospitals/", icon: "hospitals", role: ROLES.SUPER_ADMIN },
            { label: "Subscriptions", href: "../subscriptions/", icon: "subscriptions", role: ROLES.SUPER_ADMIN },
            { label: "Plans", href: "../plans/", icon: "plans", role: ROLES.SUPER_ADMIN }
        ]
    }
];

/**
 * Loads and renders the navigation sidebar based on user permissions.
 * This function should be called on page load to populate the sidebar.
 */
export async function loadNavigation() {
    debug("Loading navigation...");
    
    const sidebarContainer = document.getElementById("sidebar-container");
    if (!sidebarContainer) {
        debugError("Sidebar container not found");
        return;
    }

    const user = getCurrentUser();
    if (!user) {
        debugError("No user found when loading navigation");
        return;
    }

    const userRole = user.role;
    const userPermissions = user.permissions || [];

    // Build navigation HTML
    let navHtml = `
        <div class="sidebar">
            <div class="sidebar-header">
                <div class="sidebar-logo">
                    <div class="logo-icon">
                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 21h18"/><path d="M5 21V7l8-4v18"/><path d="M19 21V11l-6-4"/></svg>
                    </div>
                    <span>PRINCE ALEX HMS</span>
                </div>
            </div>
            <div class="sidebar-tenant">
                <div class="tenant-name">${escapeHtml(user.hospitalName || "Hospital")}</div>
                <div class="user-badge">
                    <div class="user-avatar">${(user.name || "U").charAt(0).toUpperCase()}</div>
                    <div>
                        <div style="font-size: var(--font-size-sm); font-weight: 500; color: var(--color-gray-900);">${escapeHtml(user.name || "User")}</div>
                        <div class="user-role">${formatRole(userRole)}</div>
                    </div>
                </div>
            </div>
            <nav class="sidebar-nav">
    `;

    // Render each section
    NAV_SECTIONS.forEach(section => {
        // Check if section has a role requirement
        if (section.role && !hasRole(section.role)) {
            return; // Skip this section
        }
        if (section.area && !hasAreaAccess(section.area)) return;

        // Filter items based on permissions
        const visibleItems = section.items.filter(item => {
            if (item.role && !hasRole(item.role)) {
                return false;
            }
            if (item.permission && !hasPermission(item.permission)) {
                return false;
            }
            return true;
        });

        // Skip section if no items are visible
        if (visibleItems.length === 0) {
            return;
        }

        // Add section title
        navHtml += `<div class="nav-section"><div class="nav-section-title">${section.title}</div><ul>`;

        // Add items
        visibleItems.forEach(item => {
            const currentFolder = window.location.pathname.replace(/\/+$/, "" ).split("/").filter(Boolean).pop() || "";
            const itemSlug = (item.href || "" ).replace(/^\.\.\//, "" ).replace(/\/+$/, "" ).split(/[?#]/)[0];
            const isActive = itemSlug !== "" && itemSlug === currentFolder;
            navHtml += `
                <li>
                    <a href="${item.href}" class="nav-item ${isActive ? 'active' : ''}">
                        <span class="nav-icon">${icon(item.icon, '18', 'icon-svg')}</span>
                        <span class="nav-label">${item.label}</span>
                    </a>
                </li>
            `;
        });

        navHtml += `</ul></div>`;
    });

    navHtml += `
            </nav>
            <div class="sidebar-footer">
                <a href="../login/" class="nav-item" onclick="localStorage.removeItem('userProfile'); localStorage.removeItem('tenantId');">
                    <span class="nav-icon">${icon('log-out', '18', 'icon-svg')}</span>
                    <span class="nav-label">Logout</span>
                </a>
            </div>
        </div>
    `;

    sidebarContainer.innerHTML = navHtml;
    debug("Navigation loaded successfully");
}

/**
 * Formats a role name for display.
 * @param {string} role - The role constant
 * @returns {string} Formatted role name
 */
function formatRole(role) {
    if (!role) return "User";
    return role.replace(/_/g, " ").replace(/\b\w/g, l => l.toUpperCase());
}

/**
 * Escapes HTML to prevent XSS.
 * @param {string} text
 * @returns {string}
 */
function escapeHtml(text) {
    if (!text) return "";
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
}
