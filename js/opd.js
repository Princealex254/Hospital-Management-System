﻿/**
 * PRINCE ALEX DIGITAL HMS — OPD Management Module
 *
 * Handles:
 * - OPD patient check-in
 * - Loading today's OPD patients
 * - Doctor assignment
 * - Status management
 */

import { db, collection, query, where, getDocs, orderBy, addDoc, serverTimestamp, updateDoc, doc, limit, getDoc } from "./firebase-config.js";
import { requireAuth } from "./auth-guard.js";
import { loadSidebar } from "./sidebar.js";
import { showToast, showLoading, hideLoading } from "./notifications.js";
import { debug, debugError } from "./debug.js";
import { getTenantId, getCurrentUser, hasPermission, PERMISSIONS } from "./permissions.js";

// ─── Initialize OPD Page ─────────────────────────────────────────────────────

document.addEventListener("DOMContentLoaded", async () => {
    debug("OPD page: Initializing...");

    showLoading("Loading OPD...");

    try {
        const user = await requireAuth();
        if (!user) return;

        await loadSidebar();

        await loadDoctors();
        await loadCheckInPatients();
        await loadOPDPatients();
        setupCheckIn();
        setupRefresh();

        hideLoading();
        debug("OPD page: Initialization complete.");
    } catch (error) {
        debugError("OPD page initialization error:", error);
        hideLoading();
        showToast("Unable to load OPD page. Please try again.", "error");
    }
});

let checkInPatients = [];

async function loadCheckInPatients() {
    debug("Loading patients for check-in...");
    const tenantId = getTenantId();
    if (!tenantId) return;

    try {
        const q = query(
            collection(db, "patients"),
            where("tenantId", "==", tenantId),
            orderBy("name")
        );
        const snapshot = await getDocs(q);
        checkInPatients = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        debug("Check-in patients loaded:", checkInPatients.length);
    } catch (error) {
        debugError("Error loading patients for check-in:", error);
    }
}
// ─── Load Doctors ────────────────────────────────────────────────────────────

async function loadDoctors() {
    debug("Loading doctors...");
    const tenantId = getTenantId();
    if (!tenantId) return;

    try {
        const q = query(
            collection(db, "users"),
            where("tenantId", "==", tenantId),
            where("role", "==", "DOCTOR")
        );
        const snapshot = await getDocs(q);

        const select = document.getElementById("checkin-doctor");
        if (!select) return;

        select.innerHTML = '<option value="">Select Doctor</option>';

        snapshot.forEach((doc) => {
            const staff = doc.data();
            const option = document.createElement("option");
            option.value = staff.uid || doc.id;
            option.textContent = staff.name || staff.displayName || "Unknown";
            select.appendChild(option);
        });

        debug("Doctors loaded:", snapshot.size);
    } catch (error) {
        debugError("Error loading doctors:", error);
    }
}

// ─── Load OPD Patients ───────────────────────────────────────────────────────

let currentOPDPatients = [];

async function loadOPDPatients() {
    debug("Loading OPD patients...");
    const tenantId = getTenantId();
    if (!tenantId) return;

    try {
        const today = new Date();
        const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
        const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);

        const q = query(
            collection(db, "opd"), // Query the 'opd' collection for visits
            where("tenantId", "==", tenantId),
            where("createdAt", ">=", startOfDay), // Use createdAt for walk-ins
            where("createdAt", "<", endOfDay), // Filter by creation date for today's visits
            orderBy("timeSlot", "asc")
        );
        const snapshot = await getDocs(q);
        currentOPDPatients = [];

        snapshot.forEach((doc) => {
            currentOPDPatients.push({ id: doc.id, ...doc.data() });
        });

        debug("OPD patients loaded:", currentOPDPatients.length);
        renderOPDPatients(currentOPDPatients);
        updateOPDCount(currentOPDPatients.length);
    } catch (error) {
        debugError("Error loading OPD patients:", error);
        showToast("Unable to load OPD patients. Please try again.", "error");
        renderEmptyState("Unable to load OPD patients.");
    }
}

function renderOPDPatients(patients) {
    const tbody = document.getElementById("opd-tbody");
    if (!tbody) return;

    if (patients.length === 0) {
        tbody.innerHTML = `
            <tr><td colspan="6">
                <div class="table-empty">
                    <div class="empty-icon"><svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 21h18"/><path d="M5 21V7l8-4v18"/><path d="M19 21V11l-6-4"/></svg></div>
                    <h3>No OPD patients today</h3>
                </div>
            </td></tr>
        `;
        return;
    }

    tbody.innerHTML = patients.map((apt, index) => {
        const patientName = apt.patientName || "—"; // apt is now a visit
        const doctorName = apt.doctorName || "—"; // Doctor might not be assigned yet
        const time = formatTime(apt.createdAt); // Use visit creation time
        const status = apt.status || "REGISTERED"; // Initial status for a new visit

        return `
            <tr>
                <td><strong>${index + 1}</strong></td>
                <td>${escapeHtml(patientName)}</td>
                <td>${escapeHtml(doctorName)}</td>
                <td>${time}</td> 
                <td><span class="badge badge-${getStatusBadge(status)}">${escapeHtml(status)}</span></td>
                <td class="text-right">
                    <div class="table-actions">
                        ${status === "REGISTERED"
                            ? `<button class="btn btn-sm btn-success" onclick="checkInVisitFromOPD('${apt.id}')"><svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg> Check-in</button>`
                            : ""
                        }
                        <a href="consultation.html?visitId=${apt.id}" class="btn btn-sm btn-outline"><svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg> Consult</a>
                    </div>
                </td>
            </tr>
        `;
    }).join("");
}

function formatTime(timestamp) {
    if (!timestamp) return "—";
    if (timestamp.toDate) timestamp = timestamp.toDate();
    if (timestamp instanceof Date) {
        return timestamp.toLocaleTimeString("en-US", { hour: '2-digit', minute: '2-digit', hour12: true });
    }
    return String(timestamp);
}


function renderEmptyState(message) {
    const tbody = document.getElementById("opd-tbody");
    if (!tbody) return;
    tbody.innerHTML = `
        <tr><td colspan="6">
            <div class="table-empty">
                <div class="empty-icon"><svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 21h18"/><path d="M5 21V7l8-4v18"/><path d="M19 21V11l-6-4"/></svg></div>
                <h3>${escapeHtml(message)}</h3>
            </div>
        </td></tr>
    `;
}

function updateOPDCount(count) {
    const el = document.getElementById("opd-count");
    if (el) {
        el.textContent = `${count} patients`;
    }
}

// ─── Check-in ────────────────────────────────────────────────────────────────

function setupCheckIn() {
    const checkInBtn = document.getElementById("checkin-btn");
    const patientSelectContainer = document.getElementById("checkin-patient-select-container");
    if (!patientSelectContainer) return;

    const selectControl = patientSelectContainer.querySelector(".select-control");
    const selectValue = patientSelectContainer.querySelector(".select-value");
    const searchInput = patientSelectContainer.querySelector(".select-search");
    const optionsList = patientSelectContainer.querySelector(".options-list");
    const patientIdInput = document.getElementById("checkin-patient-id");

    const renderPatientOptions = (patients) => {
        optionsList.innerHTML = "";
        if (patients.length === 0) {
            optionsList.innerHTML = `<div class="select-option-empty" style="padding: 10px 12px; color: var(--color-gray-500);">No patients found</div>`;
            return;
        }
        patients.forEach(p => {
            const option = document.createElement("div");
            option.className = "select-option";
            option.dataset.id = p.id;
            option.innerHTML = `
                <div style="font-weight: 600;">${escapeHtml(p.name)}</div>
                <div style="font-size: 11px; color: var(--color-gray-500);">${escapeHtml(p.patientId || p.id)}</div>
            `;
            option.addEventListener("click", () => {
                patientIdInput.value = p.id;
                selectValue.textContent = p.name;
                selectValue.classList.remove("placeholder");
                patientSelectContainer.querySelector(".select-container").classList.remove("open");
            });
            optionsList.appendChild(option);
        });
    };

    selectControl.addEventListener("click", () => {
        const container = patientSelectContainer.querySelector(".select-container");
        container.classList.toggle("open");
        if (container.classList.contains("open")) {
            searchInput.focus();
            renderPatientOptions(checkInPatients);
        }
    });

    searchInput.addEventListener("input", (e) => {
        const query = e.target.value.toLowerCase();
        const filtered = checkInPatients.filter(p =>
            (p.name || "").toLowerCase().includes(query) ||
            (p.patientId || "").toLowerCase().includes(query)
        );
        renderPatientOptions(filtered);
    });

    if (checkInBtn) {
        checkInBtn.addEventListener("click", async () => {
            const doctorSelect = document.getElementById("checkin-doctor");

            if (!patientIdInput.value) {
                showToast("Please select a patient from the suggestions.", "error");
                return;
            }
            if (!doctorSelect.value) {
                showToast("Please select a doctor.", "error");
                return;
            }

            // This is a walk-in check-in, so we create a new appointment
            await createWalkInVisit(patientIdInput.value, doctorSelect.value);
        });
    }
}

/**
 * Checks in an OPD patient.
 * @param {string} appointmentId
 */
window.checkInOPDPatient = async function(appointmentId) {
    debug("Check-in OPD patient:", appointmentId);

    if (!hasPermission(PERMISSIONS.APPOINTMENT_UPDATE)) {
        showToast("You don't have permission to check in patients.", "error");
        return;
    }

    try {
        showLoading("Checking in patient...");

        await updateDoc(doc(db, "appointments", appointmentId), {
            status: "checked-in",
            checkInTime: serverTimestamp(),
            updatedAt: serverTimestamp()
        });

        await addDoc(collection(db, "auditLogs"), {
            tenantId: getTenantId(),
            userId: getCurrentUser()?.uid || "",
            action: "CHECK_IN_OPD",
            module: "opd",
            recordId: appointmentId,
            createdAt: serverTimestamp()
        });

        hideLoading();
        showToast("Patient checked in successfully.", "success");
        await loadOPDPatients();
    } catch (error) {
        debugError("Error checking in OPD patient:", error);
        hideLoading();
        showToast("Unable to check in patient. Please try again.", "error");
    }
};

async function createWalkInVisit(patientId, doctorId) { // Renamed function
    const tenantId = getTenantId();
    const patientDoc = await getDoc(doc(db, "patients", patientId));
    const doctorDoc = await getDoc(doc(db, "users", doctorId));

    if (!patientDoc.exists() || !doctorDoc.exists()) {
        showToast("Invalid patient or doctor selected. Please ensure both exist.", "error");
        return;
    }

    const patientName = patientDoc.data().name;
    const doctorName = doctorDoc.data().displayName || "Unknown Doctor";

    // Generate a unique visit ID
    const visitId = await generateVisitId(tenantId);

    const visitData = {
        tenantId,
        patientId,
        patientName,
        doctorId,
        doctorName,
        visitId,
        department: doctorDoc.data().department || "General",
        type: "walk-in",
        status: "REGISTERED", // Initial status for a walk-in visit
        notes: "Walk-in patient",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        createdBy: getCurrentUser()?.uid || ""
    };

    try {
        showLoading("Creating walk-in visit...");
        // Create a document in the 'opd' collection, not 'appointments'
        const docRef = await addDoc(collection(db, "opd"), visitData);

        await addDoc(collection(db, "auditLogs"), {
            tenantId,
            userId: getCurrentUser()?.uid || "",
            action: "CREATE_WALK_IN_APPOINTMENT",
            module: "opd",
            recordId: docRef.id,
            details: { visitId, patientName, doctorName },
            createdAt: serverTimestamp()
        });

        showToast("Walk-in visit created successfully!", "success");
        await loadOPDPatients();
    } catch (error) {
        debugError("Error creating walk-in visit:", error);
        showToast("Failed to create walk-in visit.", "error");
    } finally {
        hideLoading();
    }
}

/**
 * Generates a unique visit ID in the format VIS-YYYY-NNNNNN.
 * @param {string} tenantId
 * @returns {Promise<string>}
 */
async function generateVisitId(tenantId) {
    const year = new Date().getFullYear();
    try {
        const q = query(
            collection(db, "opd"),
            where("tenantId", "==", tenantId),
            where("createdAt", ">=", new Date(year, 0, 1)),
            where("createdAt", "<=", new Date(year, 11, 31, 23, 59, 59)),
            orderBy("createdAt", "desc")
        );
        const snapshot = await getDocs(q);
        const nextSequence = snapshot.size + 1;
        const sequenceStr = String(nextSequence).padStart(6, "0");
        return `VIS-${year}-${sequenceStr}`;
    } catch (error) {
        debugError("Error generating visit ID:", error);
        return `VIS-${year}-${Date.now().toString().slice(-6)}`;
    }
}

/**
 * Checks in an OPD patient (updates visit status).
 * This is for existing visits in the OPD list.
 * @param {string} visitId
 */
window.checkInVisitFromOPD = async function(visitId) {
    debug("Check-in visit from OPD:", visitId);
    if (!hasPermission(PERMISSIONS.QUEUE_MANAGE)) { // Assuming RECEPTIONIST has QUEUE_MANAGE
        showToast("You don't have permission to check in patients.", "error");
        return;
    }
    try {
        showLoading("Checking in patient...");
        await updateDoc(doc(db, "opd", visitId), {
            status: "CHECKED_IN",
            checkInTime: serverTimestamp(),
            updatedAt: serverTimestamp()
        });
        await addDoc(collection(db, "auditLogs"), {
            tenantId: getTenantId(),
            userId: getCurrentUser()?.uid || "",
            action: "CHECK_IN_OPD_VISIT",
            module: "opd",
            recordId: visitId,
            createdAt: serverTimestamp()
        });
        showToast("Patient checked in successfully!", "success");
        await loadOPDPatients();
    } catch (error) {
        debugError("Error checking in visit from OPD:", error);
        showToast("Failed to check in patient.", "error");
    } finally {
        hideLoading();
    }
}

// ─── Refresh ─────────────────────────────────────────────────────────────────

function setupRefresh() {
    const refreshBtn = document.getElementById("refresh-opd");
    if (refreshBtn) {
        refreshBtn.addEventListener("click", async () => {
            showLoading("Refreshing OPD...");
            await loadOPDPatients();
            hideLoading();
            showToast("OPD refreshed.", "success");
        });
    }
}

// ─── Helper Functions ────────────────────────────────────────────────────────

function getStatusBadge(status) {
    if (!status) return "secondary";
    const s = status.toLowerCase();
    if (s === "registered") return "secondary";
    if (s === "checked_in") return "info";
    if (s === "waiting_triage") return "warning";
    if (s === "triaged") return "primary";
    if (s === "waiting_doctor") return "primary";
    if (s === "in_consultation") return "info";
    if (s === "services_pending") return "warning";
    if (s === "services_completed") return "success";
    if (s === "billing_pending") return "warning";
    if (s === "payment_pending") return "warning";
    if (s === "ready_for_checkout") return "success";
    if (s === "completed") return "success";
    if (s === "no-show") return "error";
    if (s === "cancelled") return "error";
    if (s === "scheduled" || s === "confirmed") return "warning"; // For appointments that are not yet visits
    return "secondary";
}

function escapeHtml(text) {
    if (!text) return "";
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
}

export { loadOPDPatients };
