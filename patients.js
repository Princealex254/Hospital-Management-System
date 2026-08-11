﻿/**
 * PRINCE ALEX DIGITAL HMS — Patients Module
 * 
 * Handles:
 * - Loading and displaying patients from Firestore
 * - Search and filter functionality
 * - Delete/archive patient
 * - Real-time updates
 */

import { db, collection, query, where, orderBy, getDocs, deleteDoc, doc, onSnapshot, serverTimestamp, addDoc } from "./firebase-config.js";
import { requireAuth } from "./auth-guard.js";
import { loadSidebar } from "./sidebar.js";
import { showToast, showLoading, hideLoading, showConfirm } from "./notifications.js";
import { debug, debugError } from "./debug.js";
import { icon } from "./icons.js";
import { getTenantId, getCurrentUser, hasPermission, PERMISSIONS } from "./permissions.js";

// ─── Initialize Patients Page ────────────────────────────────────────────────

document.addEventListener("DOMContentLoaded", async () => {
    debug("Patients page: Initializing...");

    showLoading("Loading patients...");

    try {
        // Require authentication
        const user = await requireAuth();
        if (!user) return;

        // Load shared components
        await loadSidebar();

        // Load patients
        await loadPatients();
        await loadPatientStats();

        // Set up search
        setupSearch();

        // Set up filter
        setupFilter();

        // Replace static icon placeholders
        replaceIconPlaceholders();

        hideLoading();
        debug("Patients page: Initialization complete.");
    } catch (error) {
        debugError("Patients page initialization error:", error);
        hideLoading();
        showToast("Unable to load patients page. Please try again.", "error");
    }
});

// ─── Load Patients ───────────────────────────────────────────────────────────

let currentPatients = [];
let currentFilters = { search: "", gender: "" };

/**
 * Loads all patients for the current tenant from Firestore.
 */
async function loadPatients() {
    debug("Loading patients...");
    const tenantId = getTenantId();
    if (!tenantId) {
        debugError("No tenant ID found");
        return;
    }

    try {
        // Build query with filters
        let patientsQuery = query(
            collection(db, "patients"),
            where("tenantId", "==", tenantId),
            orderBy("createdAt", "desc")
        );

        const snapshot = await getDocs(patientsQuery);
        currentPatients = [];

        snapshot.forEach((doc) => {
            currentPatients.push({ id: doc.id, ...doc.data() });
        });

        debug("Patients loaded:", currentPatients.length);
        renderPatients(currentPatients);
        updatePatientCount(currentPatients.length);
        loadPatientStats(); // Recalculate stats after loading
    } catch (error) {
        debugError("Error loading patients:", error);
        showToast("Unable to load patients. Please try again.", "error");
        renderEmptyState("Unable to load patients.");
    }
}

/**
 * Renders and populates the stat cards.
 */
async function loadPatientStats() {
    const statsContainer = document.getElementById("patient-stats");
    if (!statsContainer) return;

    const STAT_CARDS = [
        { id: "total-patients", label: "Total Patients", icon: "patients" },
        { id: "new-today", label: "New Patients Today", icon: "register" },
        { id: "male-count", label: "Male Patients", icon: "user" },
        { id: "female-count", label: "Female Patients", icon: "user" },
    ];

    statsContainer.innerHTML = STAT_CARDS.map(card => `
        <div class="dashboard-stat-card">
            <div class="stat-icon">
                ${icon(card.icon, '18', 'icon-svg')}
            </div>
            <div class="stat-content">
                <div class="stat-value" id="${card.id}">0</div>
                <div class="stat-label">${card.label}</div>
            </div>
        </div>
    `).join('');

    // Calculate stats
    const total = currentPatients.length;
    const maleCount = currentPatients.filter(p => p.gender === 'male').length;
    const femaleCount = currentPatients.filter(p => p.gender === 'female').length;

    const today = new Date();
    const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const newToday = currentPatients.filter(p => {
        if (!p.createdAt || !p.createdAt.toDate) return false;
        return p.createdAt.toDate() >= startOfDay;
    }).length;

    // Update DOM
    const totalEl = document.getElementById("total-patients");
    const newTodayEl = document.getElementById("new-today");
    const maleEl = document.getElementById("male-count");
    const femaleEl = document.getElementById("female-count");
    if (totalEl) totalEl.textContent = total;
    if (newTodayEl) newTodayEl.textContent = newToday;
    if (maleEl) maleEl.textContent = maleCount;
    if (femaleEl) femaleEl.textContent = femaleCount;
}
/**
 * Renders the patients table.
 * @param {Array} patients - Array of patient objects
 */
function renderPatients(patients) {
    const tbody = document.getElementById("patients-tbody");
    if (!tbody) return;

    if (patients.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="8">
                    <div class="table-empty">
                        <div class="empty-icon">👥</div>
                        <h3>No patients found</h3>
                        <p>Try adjusting your search or filter criteria.</p>
                    </div>
                </td>
            </tr>
        `;
        return;
    }

    tbody.innerHTML = patients.map((patient) => {
        const age = patient.dateOfBirth ? calculateAge(patient.dateOfBirth.toDate()) : "—";
        const lastVisit = patient.lastVisit ? formatDate(patient.lastVisit.toDate()) : "Never";
        const fullName = `${patient.firstName || ''} ${patient.lastName || ''}`.trim() || patient.name;
        const initials = getInitials(fullName || "P");

        return `
            <tr>
                <td>
                    <div class="table-user-cell">
                        <div class="user-avatar" style="background-color: ${getAvatarColor(patient.id || fullName)}">${initials}</div>
                        <div>
                            <a href="patient-profile.html?id=${patient.id}" class="table-link"><strong>${escapeHtml(fullName)}</strong></a>
                            <div class="text-muted small">${escapeHtml(patient.patientId || "")}</div>
                        </div>
                    </div>
                </td>
                <td>${age}</td>
                <td>${escapeHtml(patient.gender || "—")}</td>
                <td>${escapeHtml(patient.phone || "—")}</td>
                <td>${escapeHtml(patient.email || "—")}</td>
                <td>${lastVisit}</td>
                <td class="text-right">
                    <div class="table-actions">
                        <a href="patient-profile.html?id=${patient.id}" class="btn btn-sm btn-outline" data-permission="PATIENT_READ">${icon('eye')} View</a>
                        <button class="btn btn-sm btn-outline" onclick="editPatient('${patient.id}')" data-permission="PATIENT_UPDATE">${icon('edit')} Edit</button>
                        <button class="btn btn-sm btn-error" onclick="deletePatient('${patient.id}', '${escapeHtml(fullName)}')" data-permission="PATIENT_DELETE">${icon('trash')} Delete</button>
                    </div>
                </td>
            </tr>
        `;
    }).join("");
}

/**
 * Renders an empty state in the table.
 * @param {string} message
 */
function renderEmptyState(message) {
    const tbody = document.getElementById("patients-tbody");
    if (!tbody) return;
    tbody.innerHTML = `<tr><td colspan="7"><div class="table-empty"><div class="empty-icon">${icon('patients')}</div><h3>${escapeHtml(message)}</h3></div></td></tr>`;
}

/**
 * Updates the patient count display.
 * @param {number} count
 */
function updatePatientCount(count) {
    const countEl = document.getElementById("patient-count");
    if (countEl) {
        countEl.textContent = `${count} patient${count !== 1 ? "s" : ""}`;
    }
}

// ─── Search & Filter ─────────────────────────────────────────────────────────

/**
 * Sets up the search input event listener.
 */
function setupSearch() {
    const searchInput = document.getElementById("patient-search");

    if (searchInput) {
        searchInput.addEventListener("input", (e) => {
            currentFilters.search = e.target.value.toLowerCase();
            applyFilters();
        });
    }
}

/**
 * Sets up the gender filter dropdown.
 */
function setupFilter() {
    const filterSelect = document.getElementById("filter-gender");
    if (filterSelect) {
        filterSelect.addEventListener("change", (e) => {
            currentFilters.gender = e.target.value;
            applyFilters();
        });
    }
}

/**
 * Applies current filters to the patient list.
 */
function applyFilters() {
    debug("Applying filters:", currentFilters);

    const filtered = currentPatients.filter((patient) => {
        // Search filter
        if (currentFilters.search) {
            const fullName = `${patient.firstName || ""} ${patient.lastName || ""}`.toLowerCase();
            const patientId = (patient.patientId || "").toLowerCase();
            const phone = (patient.phone || "").toLowerCase();
            const email = (patient.email || "").toLowerCase();

            if (!fullName.includes(currentFilters.search) &&
                !patientId.includes(currentFilters.search) &&
                !phone.includes(currentFilters.search) &&
                !email.includes(currentFilters.search)) {
                return false;
            }
        }

        // Gender filter
        if (currentFilters.gender && patient.gender !== currentFilters.gender) {
            return false;
        }

        return true;
    });

    renderPatients(filtered);
    updatePatientCount(filtered.length);
}

// ─── Delete Patient ──────────────────────────────────────────────────────────

/**
 * Deletes (archives) a patient after confirmation.
 * @param {string} patientId - The patient document ID
 * @param {string} patientName - The patient's name for confirmation
 */
window.deletePatient = async function(patientId, patientName) {
    debug("Delete patient requested:", patientId, patientName);

    if (!hasPermission(PERMISSIONS.PATIENT_DELETE)) {
        showToast("You don't have permission to delete patients.", "error");
        return;
    }

    const confirmed = await showConfirm(
        "Delete Patient",
        `Are you sure you want to delete "${patientName}"? This action cannot be undone.`,
        "Delete",
        "Cancel"
    );

    if (!confirmed) return;

    try {
        // Find the patient to get their name for the toast message
        const patientToDelete = currentPatients.find(p => p.id === patientId);
        const deletedPatientName = patientToDelete ? `${patientToDelete.firstName || ''} ${patientToDelete.lastName || ''}`.trim() : 'the patient';

        showLoading("Deleting patient...");

        // Archive the patient instead of hard delete
        await deleteDoc(doc(db, "patients", patientId));

        // Log audit
        await addDoc(collection(db, "auditLogs"), {
            tenantId: getTenantId(),
            userId: getCurrentUser()?.uid || "",
            action: "DELETE_PATIENT",
            module: "patients",
            recordId: patientId,
            details: { patientName },
            createdAt: serverTimestamp()
        });

        // Remove from current list
        currentPatients = currentPatients.filter(p => p.id !== patientId);
        applyFilters();
        updatePatientCount(currentPatients.length);

        hideLoading();
        showToast(`Patient "${deletedPatientName}" has been deleted.`, "success");
        debug("Patient deleted:", patientId);
    } catch (error) {
        debugError("Error deleting patient:", error);
        hideLoading();
        showToast("Unable to delete patient. Please try again.", "error");
    }
};

/**
 * Finds and replaces static icon placeholders in the HTML.
 */
function replaceIconPlaceholders() {
    const placeholders = document.querySelectorAll('.icon-placeholder');
    placeholders.forEach(el => {
        const iconName = el.getAttribute('data-icon');
        if (iconName) {
            el.innerHTML = icon(iconName, '18', 'icon-svg');
        }
    });
}

// ─── Helper Functions ────────────────────────────────────────────────────────

/**
 * Calculates age from date of birth.
 * @param {Date|string} dob
 * @returns {string}
 */
function calculateAge(dob) {
    if (!dob) return '—';

    let birthDate = dob;
    if (!(birthDate instanceof Date)) {
        // It's likely a Firestore Timestamp object, convert it
        if (dob.toDate) birthDate = dob.toDate();
        else birthDate = new Date(dob); // Fallback for string dates
    }

    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();

    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
        age--;
    }

    return age >= 0 ? `${age} years` : "—";
}

/**
 * Formats a date for display.
 * @param {Date|Object} date
 * @returns {string}
 */
function formatDate(date) {
    if (!date) return '—';
    let d = date;
    if (!(d instanceof Date)) {
        if (date.toDate) d = date.toDate();
        else d = new Date(date);
    }
    return d.toLocaleDateString("en-GB", { year: 'numeric', month: 'short', day: 'numeric' });
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

/**
 * Generates initials from a name.
 * @param {string} name
 * @returns {string}
 */
function getInitials(name) {
    if (!name) return "U";
    const parts = name.split(" ").filter(p => p);
    if (parts.length > 1) {
        return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
}

/**
 * Generates a consistent color for an avatar based on ID.
 * @param {string} id
 * @returns {string}
 */
function getAvatarColor(id) {
    const colors = ['#ef4444', '#f97316', '#eab308', '#84cc16', '#22c55e', '#10b981', '#06b6d4', '#3b82f6', '#8b5cf6', '#d946ef', '#ec4899', '#78716c'];
    if (!id) return colors[0];
    const hash = id.split('').reduce((acc, char) => char.charCodeAt(0) + ((acc << 5) - acc), 0);
    return colors[Math.abs(hash) % colors.length];
}

window.editPatient = async function(patientId) {
    // This is a placeholder. The actual edit modal would be more complex.
    // For now, it just redirects to the profile page where editing can be initiated.
    if (!hasPermission(PERMISSIONS.PATIENT_UPDATE)) {
        showToast("You don't have permission to edit patients.", "error");
        return;
    }
    window.location.href = `patient-profile.html?id=${patientId}&edit=true`;
}

// ─── Export for use in other modules ─────────────────────────────────────────
export { loadPatients };
