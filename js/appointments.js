/**
 * PRINCE ALEX DIGITAL HMS — Appointments Module
 * 
 * Handles:
 * - Loading and displaying appointments from Firestore
 * - Search and filter functionality
 * - Status updates (check-in, complete, cancel, no-show)
 * - Real-time updates
 */

import { db, collection, query, where, getDocs, orderBy, updateDoc, doc, serverTimestamp, addDoc } from "./firebase-config.js";
import { requireAuth } from "./auth-guard.js";
import { loadSidebar } from "./sidebar.js";
import { showToast, showLoading, hideLoading, showConfirm } from "./notifications.js";
import { debug, debugError } from "./debug.js";
import { getTenantId, getCurrentUser, hasPermission, PERMISSIONS } from "./permissions.js";

// ─── Initialize Appointments Page ────────────────────────────────────────────

document.addEventListener("DOMContentLoaded", async () => {
    debug("Appointments page: Initializing...");

    showLoading("Loading appointments...");

    try {
        const user = await requireAuth();
        if (!user) return;

        await loadSidebar();

        await loadAppointments();
        setupSearch();
        setupFilter();

        hideLoading();
        debug("Appointments page: Initialization complete.");
    } catch (error) {
        debugError("Appointments page initialization error:", error);
        hideLoading();
        showToast("Unable to load appointments page. Please try again.", "error");
    }
});

// ─── Global State ────────────────────────────────────────────────────────────

let currentAppointments = [];
let currentFilters = { search: "", status: "", date: "" };

// ─── Load Appointments ───────────────────────────────────────────────────────

/**
 * Loads all appointments for the current tenant from Firestore.
 */
async function loadAppointments() {
    debug("Loading appointments...");
    const tenantId = getTenantId();
    if (!tenantId) return;

    try {
        const q = query(
            collection(db, "appointments"),
            where("tenantId", "==", tenantId),
            orderBy("date", "desc")
        );
        const snapshot = await getDocs(q);
        currentAppointments = [];

        snapshot.forEach((doc) => {
            currentAppointments.push({ id: doc.id, ...doc.data() });
        });

        debug("Appointments loaded:", currentAppointments.length);
        renderAppointments(currentAppointments);
        updateAppointmentCount(currentAppointments.length);
    } catch (error) {
        debugError("Error loading appointments:", error);
        showToast("Unable to load appointments. Please try again.", "error");
        renderEmptyState("Unable to load appointments.");
    }
}

/**
 * Renders the appointments table.
 * @param {Array} appointments
 */
function renderAppointments(appointments) {
    const tbody = document.getElementById("appointments-tbody");
    if (!tbody) return;

    if (appointments.length === 0) {
        tbody.innerHTML = `
            <tr><td colspan="7">
                <div class="table-empty">
                    <div class="empty-icon"><svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg></div>
                    <h3>No appointments found</h3>
                    <p>Try adjusting your search or filter criteria.</p>
                </div>
            </td></tr>
        `;
        return;
    }

    tbody.innerHTML = appointments.map((apt) => {
        const patientName = apt.patientName || "—";
        const doctorName = apt.doctorName || "—";
        const department = apt.department || "—";
        const date = formatDate(apt.date);
        const time = apt.timeSlot || "—";
        const status = apt.status || "scheduled";

        return `
            <tr>
                <td>${date}</td>
                <td>${time}</td>
                <td>${escapeHtml(patientName)}</td>
                <td>${escapeHtml(doctorName)}</td>
                <td>${escapeHtml(department)}</td>
                <td><span class="badge badge-${getStatusBadge(status)}">${escapeHtml(status)}</span></td>
                <td class="text-right">
                    <div class="table-actions">
                        <a href="patient-profile.html?id=${apt.patientId || ""}" class="btn btn-sm btn-outline">
                            <span><svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg></span> View
                        </a>
                        <button class="btn btn-sm btn-success" onclick="updateAppointmentStatus('${apt.id}', 'checked-in')" data-permission="APPOINTMENT_UPDATE">
                            <span><svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg></span> Check-in
                        </button>
                        <button class="btn btn-sm btn-error" onclick="cancelAppointment('${apt.id}', '${escapeHtml(patientName)}')" data-permission="APPOINTMENT_DELETE">
                            <span><svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></span> Cancel
                        </button>
                    </div>
                </td>
            </tr>
        `;
    }).join("");
}

/**
 * Renders an empty state.
 * @param {string} message
 */
function renderEmptyState(message) {
    const tbody = document.getElementById("appointments-tbody");
    if (!tbody) return;
    tbody.innerHTML = `
        <tr><td colspan="7">
            <div class="table-empty">
                <div class="empty-icon"><svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg></div>
                <h3>${escapeHtml(message)}</h3>
            </div>
        </td></tr>
    `;
}

/**
 * Updates the appointment count display.
 * @param {number} count
 */
function updateAppointmentCount(count) {
    const el = document.getElementById("appointment-count");
    if (el) {
        el.textContent = `${count} appointment${count !== 1 ? "s" : ""}`;
    }
}

// ─── Search & Filter ─────────────────────────────────────────────────────────

function setupSearch() {
    const searchInput = document.getElementById("appointment-search");
    const searchBtn = document.getElementById("search-btn");

    if (searchInput) {
        searchInput.addEventListener("input", (e) => {
            currentFilters.search = e.target.value.toLowerCase();
            applyFilters();
        });
    }

    if (searchBtn) {
        searchBtn.addEventListener("click", applyFilters);
    }
}

function setupFilter() {
    const statusFilter = document.getElementById("filter-status");
    const dateFilter = document.getElementById("filter-date");

    if (statusFilter) {
        statusFilter.addEventListener("change", (e) => {
            currentFilters.status = e.target.value;
            applyFilters();
        });
    }

    if (dateFilter) {
        dateFilter.addEventListener("change", (e) => {
            currentFilters.date = e.target.value;
            applyFilters();
        });
    }
}

function applyFilters() {
    debug("Applying filters:", currentFilters);

    const filtered = currentAppointments.filter((apt) => {
        if (currentFilters.search) {
            const patientName = (apt.patientName || "").toLowerCase();
            const doctorName = (apt.doctorName || "").toLowerCase();
            if (!patientName.includes(currentFilters.search) && !doctorName.includes(currentFilters.search)) {
                return false;
            }
        }

        if (currentFilters.status && apt.status !== currentFilters.status) {
            return false;
        }

        if (currentFilters.date) {
            const aptDate = formatDateKey(apt.date);
            if (aptDate !== currentFilters.date) {
                return false;
            }
        }

        return true;
    });

    renderAppointments(filtered);
    updateAppointmentCount(filtered.length);
}

// ─── Status Updates ──────────────────────────────────────────────────────────

/**
 * Updates an appointment's status.
 * @param {string} appointmentId
 * @param {string} newStatus
 */
window.updateAppointmentStatus = async function(appointmentId, newStatus) {
    debug("Updating appointment status:", appointmentId, newStatus);

    if (!hasPermission(PERMISSIONS.APPOINTMENT_UPDATE)) {
        showToast("You don't have permission to update appointments.", "error");
        return;
    }

    try {
        showLoading("Updating appointment...");

        await updateDoc(doc(db, "appointments", appointmentId), {
            status: newStatus,
            updatedAt: serverTimestamp()
        });

        // Log audit
        await addDoc(collection(db, "auditLogs"), {
            tenantId: getTenantId(),
            userId: getCurrentUser()?.uid || "",
            action: "UPDATE_APPOINTMENT",
            module: "appointments",
            recordId: appointmentId,
            details: { newStatus },
            createdAt: serverTimestamp()
        });

        // Update local state
        const apt = currentAppointments.find(a => a.id === appointmentId);
        if (apt) {
            apt.status = newStatus;
        }

        hideLoading();
        showToast("Appointment status updated.", "success");
        debug("Appointment status updated:", appointmentId, newStatus);
    } catch (error) {
        debugError("Error updating appointment status:", error);
        hideLoading();
        showToast("Unable to update appointment. Please try again.", "error");
    }
};

/**
 * Cancels an appointment after confirmation.
 * @param {string} appointmentId
 * @param {string} patientName
 */
window.cancelAppointment = async function(appointmentId, patientName) {
    debug("Cancel appointment requested:", appointmentId, patientName);

    if (!hasPermission(PERMISSIONS.APPOINTMENT_DELETE)) {
        showToast("You don't have permission to cancel appointments.", "error");
        return;
    }

    const confirmed = await showConfirm(
        "Cancel Appointment",
        `Are you sure you want to cancel the appointment for "${patientName}"?`,
        "Cancel Appointment",
        "Keep"
    );

    if (!confirmed) return;

    try {
        showLoading("Cancelling appointment...");

        await updateDoc(doc(db, "appointments", appointmentId), {
            status: "cancelled",
            updatedAt: serverTimestamp()
        });

        // Log audit
        await addDoc(collection(db, "auditLogs"), {
            tenantId: getTenantId(),
            userId: getCurrentUser()?.uid || "",
            action: "CANCEL_APPOINTMENT",
            module: "appointments",
            recordId: appointmentId,
            details: { patientName },
            createdAt: serverTimestamp()
        });

        // Update local state
        const apt = currentAppointments.find(a => a.id === appointmentId);
        if (apt) {
            apt.status = "cancelled";
        }

        hideLoading();
        showToast(`Appointment for "${patientName}" has been cancelled.`, "success");
        debug("Appointment cancelled:", appointmentId);
    } catch (error) {
        debugError("Error cancelling appointment:", error);
        hideLoading();
        showToast("Unable to cancel appointment. Please try again.", "error");
    }
};

// ─── Helper Functions ────────────────────────────────────────────────────────

function formatDate(date) {
    if (!date) return "—";
    if (date.toDate) date = date.toDate();
    if (date instanceof Date) {
        return date.toLocaleDateString("en-GB", { year: "numeric", month: "short", day: "numeric" });
    }
    return String(date);
}

function formatDateKey(date) {
    if (!date) return "";
    if (date.toDate) date = date.toDate();
    if (date instanceof Date) {
        return date.toISOString().split("T")[0];
    }
    return "";
}

function getStatusBadge(status) {
    if (!status) return "secondary";
    const s = status.toLowerCase();
    if (s.includes("completed") || s.includes("confirmed") || s.includes("checked-in")) return "success";
    if (s.includes("scheduled") || s.includes("in-progress")) return "info";
    if (s.includes("pending")) return "warning";
    if (s.includes("cancelled") || s.includes("no-show")) return "error";
    return "secondary";
}

function escapeHtml(text) {
    if (!text) return "";
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
}

export { loadAppointments };
