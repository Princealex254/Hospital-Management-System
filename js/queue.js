/**
 * PRINCE ALEX DIGITAL HMS — Queue Management Module
 *  * Handles:
 * - Loading and displaying the patient queue from Firestore
 * - Real-time queue updates
 * - Status transitions (check-in, in-progress, complete, no-show)
 * - Doctor filtering
 */

import { db, collection, query, where, getDocs, orderBy, updateDoc, doc, getDoc, serverTimestamp, addDoc } from "./firebase-config.js";
import { requireAuth } from "./auth-guard.js";
import { loadSidebar } from "./sidebar.js";
import { showToast, showLoading, hideLoading, showModal, closeModal } from "./notifications.js";
import { debug, debugError } from "./debug.js";
import { icon } from "./icons.js";
import { getTenantId, getCurrentUser, hasPermission, PERMISSIONS } from "./permissions.js";

// ─── Initialize Queue Page ───────────────────────────────────────────────────

document.addEventListener("DOMContentLoaded", async () => {
    debug("Queue page: Initializing...");

    showLoading("Loading queue...");

    try {
        const user = await requireAuth();
        if (!user) return;

        await loadSidebar();

        await loadDoctors();
        await loadQueue();
        setupRefresh();

        hideLoading();
        debug("Queue page: Initialization complete.");
    } catch (error) {
        debugError("Queue page initialization error:", error);
        hideLoading();
        showToast("Unable to load queue page. Please try again.", "error");
    }
});

// ─── Load Queue ──────────────────────────────────────────────────────────────

let currentQueue = [];
let currentFilters = { doctor: "" }; // Filter for doctor

/**
 * Loads the current patient queue from Firestore.
 */
async function loadQueue() {
    debug("Loading queue...");
    const tenantId = getTenantId();
    if (!tenantId) return;

    try {
        const q = query(
            collection(db, "opd"), // Query the 'opd' collection for visits
            where("tenantId", "==", tenantId),
            // Filter for active visit statuses as per the new workflow
            where("status", "in", [
                "REGISTERED", "CHECKED_IN", "WAITING_TRIAGE", "TRIAGED",
                "WAITING_DOCTOR", "IN_CONSULTATION", "SERVICES_PENDING",
                "BILLING_PENDING", "PAYMENT_PENDING", "READY_FOR_CHECKOUT"
            ]),
            orderBy("createdAt", "asc") // Order by creation time for queue
        );
        const snapshot = await getDocs(q);
        currentQueue = [];

        snapshot.forEach((doc) => {
            currentQueue.push({ id: doc.id, ...doc.data() });
        });

        debug("Queue loaded:", currentQueue.length);
        applyFilters(); // Apply filters after loading all active queue items
        updateQueueCount(currentQueue.length);
    } catch (error) {
        debugError("Error loading queue:", error);
        showToast("Unable to load queue. Please try again.", "error");
        renderEmptyState("Unable to load queue.");
    }
}

/**
 * Renders the queue table.
 * @param {Array} queue
 */
function renderQueue(queue) {
    const tbody = document.getElementById("queue-tbody");
    if (!tbody) return;

    if (queue.length === 0) {
        tbody.innerHTML = `
            <tr><td colspan="6">
                <div class="table-empty">
                    <div class="empty-icon"><svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg></div>
                    <h3>No patients in queue</h3>
                    <p>All caught up! No patients are currently waiting.</p>
                </div>
            </td></tr>
        `;
        return;
    }

    // Sort by priority and time
    const sorted = [...queue].sort((a, b) => { // 'a' and 'b' are visit objects
        const priorityOrder = { "Emergency": 0, "High Priority": 1, "Urgent": 2, "Routine": 3 };
        const aPriority = priorityOrder[a.priority || "Routine"] ?? 3;
        const bPriority = priorityOrder[b.priority || "Routine"] ?? 3;
        if (aPriority !== bPriority) return aPriority - bPriority;
        // If priority is the same, sort by creation time (earliest first)
        return (a.createdAt?.toDate() || 0) - (b.createdAt?.toDate() || 0);
    });

    tbody.innerHTML = sorted.map((apt, index) => {
        const patientName = apt.patientName || "—";
        const doctorName = apt.doctorName || "—";
        const time = formatTime(apt.createdAt); // Use visit creation time
        const status = apt.status || "REGISTERED";
        const priority = apt.priority || "Routine";

        return `
            <tr>
                <td><strong>${index + 1}</strong></td>
                <td>${escapeHtml(patientName)}</td>
                <td>${escapeHtml(doctorName)}</td>
                <td>${time}</td>
                <td>
                    <span class="badge badge-${getStatusBadge(status)}">${escapeHtml(status)}</span>
                    <span class="badge badge-${getPriorityBadge(priority)}">${escapeHtml(priority)}</span>
                </td>
<td class="text-right">
                    <div class="table-actions">
                        ${status === "REGISTERED"
                            ? `<button type="button" class="btn btn-sm btn-success" onclick="checkInVisit('${apt.id}')">${icon('check', '18')} Check-in</button>`
                            : ""
                        }
                        ${status === "CHECKED_IN" || status === "WAITING_TRIAGE"
                            ? `<button type="button" class="btn btn-sm btn-info" onclick="startTriage('${apt.id}')">${icon('vitals', '18')} Triage</button>`
                            : ""
                        }
                        ${(status === "TRIAGED" || status === "WAITING_DOCTOR")
                            ? `<button type="button" class="btn btn-sm btn-primary" onclick="startConsultation('${apt.id}')">${icon('consultation', '18')} Consult</button>`
                            : ""
                        }
                        ${status === "IN_CONSULTATION"
                            ? `<button type="button" class="btn btn-sm btn-success" onclick="endConsultation('${apt.id}')">${icon('check', '18')} End Consult</button>`
                            : ""
                        }
                        ${status === "SERVICES_PENDING" || status === "BILLING_PENDING" || status === "PAYMENT_PENDING" || status === "READY_FOR_CHECKOUT"
                            ? `<a href="patient-profile.html?id=${apt.patientId}" class="btn btn-sm btn-outline">${icon('eye', '18')} View Visit</a>`
                            : ""
                        }
                        <button type="button" class="btn btn-sm btn-error" onclick="markVisitNoShow('${apt.id}', '${escapeHtml(patientName)}')">${icon('close', '18')} No-show</button>
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
    const tbody = document.getElementById("queue-tbody");
    if (!tbody) return;
    tbody.innerHTML = ` 
        <tr><td colspan="6"> 
            <div class="table-empty">${icon('appointments', '48')}
                <h3>${escapeHtml(message)}</h3>
            </div>
        </td></tr>
    `;
}

/**
 * Updates the queue count badge.
 * @param {number} count
 */
function updateQueueCount(count) {
    const el = document.getElementById("queue-count");
    if (el) {
        el.textContent = `${count} patient${count !== 1 ? "s" : ""} in queue`;
    }
}

// ─── Load Doctors for Filter ─────────────────────────────────────────────────

/**
 * Loads doctors for the filter dropdown.
 */
async function loadDoctors() {
    debug("Loading doctors for filter...");
    const tenantId = getTenantId();
    if (!tenantId) return;

    try {
        const q = query(
            collection(db, "users"), // Query the 'users' collection for staff
            where("tenantId", "==", tenantId),
            where("role", "==", "DOCTOR")
        );
        const snapshot = await getDocs(q);

        const select = document.getElementById("filter-doctor");
        if (!select) return;

        select.innerHTML = '<option value="">All Doctors</option>';

        snapshot.forEach((doc) => {
            const staff = doc.data();
            const option = document.createElement("option");
            option.value = staff.uid || doc.id; // Use UID for doctor ID
            option.textContent = staff.displayName || "Unknown"; // Use displayName
            select.appendChild(option);
        });

        // Set up filter change
        select.addEventListener("change", (e) => {
            filterByDoctor(e.target.value);
        });
        
        debug("Doctors loaded for filter:", snapshot.size);
    } catch (error) {
        debugError("Error loading doctors for filter:", error);
    }
}

/**
 * Filters the queue by doctor.
 * @param {string} doctorId
 */
function filterByDoctor(doctorId) {
    currentFilters.doctor = doctorId;
    applyFilters();
}

/**
 * Applies current filters to the queue list.
 */
function applyFilters() {
    let filtered = currentQueue;

    if (currentFilters.doctor) {
        filtered = filtered.filter(apt => apt.doctorId === currentFilters.doctor);
    }

    renderQueue(filtered);
    updateQueueCount(filtered.length); // Update count for filtered list
}

// ─── Queue Actions ───────────────────────────────────────────────────────────

/**
 * Checks in a patient (moves from scheduled to checked-in).
 * @param {string} appointmentId
 */
window.checkInVisit = async function(visitId) {
    debug("Check-in visit:", visitId);

    if (!hasPermission(PERMISSIONS.QUEUE_MANAGE)) { // Assuming RECEPTIONIST has QUEUE_MANAGE
        showToast("You don't have permission to check in patients.", "error");
        return;
    }

    // Find the visit in the current queue to get the patientId.
    const visit = currentQueue.find(v => v.id === visitId);
    if (!visit) {
        showToast("Visit not found.", "error");
        return;
    }

    // Prefill insurance details from the patient record if available.
    let patientInsurance = { provider: "", memberNumber: "" };
    try {
        const patientDoc = visit.patientId ? await getDoc(doc(db, "patients", visit.patientId)) : null;
        if (patientDoc && patientDoc.exists()) {
            const ins = patientDoc.data().insurance || {};
            patientInsurance = { provider: ins.provider || "", memberNumber: ins.memberNumber || "" };
        }
    } catch (e) {
        debugError("Error loading patient insurance:", e);
    }

    const modalHtml = `
        <div class="modal" style="max-width: 520px;">
            <div class="modal-header">
                <h3>Check-in — Payment Mode</h3>
                <button class="modal-close" data-modal-close>&times;</button>
            </div>
            <div class="modal-body">
                <div class="form-section" style="margin-bottom: 20px; padding-bottom: 20px; border-bottom: 1px solid #e5e7eb;">
                    <div class="form-grid form-grid-2">
                        <div><strong>Patient:</strong> ${escapeHtml(visit.patientName || "—")}</div>
                        <div><strong>Visit ID:</strong> ${escapeHtml(visit.visitId || "—")}</div>
                    </div>
                </div>
                <div class="form-group">
                    <label class="form-label required" for="ck-payment-type">Payment Mode</label>
                    <select id="ck-payment-type" class="form-select">
                        <option value="self">Self-Pay (Patient)</option>
                        <option value="insurance">Insurance</option>
                    </select>
                </div>
                <div class="form-group" id="ck-insurance-section" style="display: none;">
                    <label class="form-label" for="ck-insurance-provider">Insurance Provider</label>
                    <input type="text" id="ck-insurance-provider" class="form-input" value="${escapeHtml(patientInsurance.provider)}">
                </div>
                <div class="form-group" id="ck-insurance-section-2" style="display: none;">
                    <label class="form-label" for="ck-insurance-number">Membership Number</label>
                    <input type="text" id="ck-insurance-number" class="form-input" value="${escapeHtml(patientInsurance.memberNumber)}">
                </div>
            </div>
<div class="modal-footer">
                <button type="button" class="btn btn-secondary" data-modal-close>Cancel</button>
                <button type="button" class="btn btn-primary" onclick="confirmCheckIn('${visitId}')">Check In</button>
            </div>
        </div>
    `;

    showModal(modalHtml, "Payment Mode");

    const typeSelect = document.getElementById("ck-payment-type");
    if (typeSelect) {
        typeSelect.addEventListener("change", () => {
            const isInsurance = typeSelect.value === "insurance";
            document.getElementById("ck-insurance-section").style.display = isInsurance ? "block" : "none";
            document.getElementById("ck-insurance-section-2").style.display = isInsurance ? "block" : "none";
        });
    }
};

window.confirmCheckIn = async function(visitId) {
    debug("Confirming check-in for visit:", visitId);

    const paymentType = document.getElementById("ck-payment-type")?.value || "self";
    const insuranceProvider = document.getElementById("ck-insurance-provider")?.value.trim() || null;
    const insuranceNumber = document.getElementById("ck-insurance-number")?.value.trim() || null;

    const billTo = paymentType === "insurance" ? "insurance" : "patient";
    const billToName = paymentType === "insurance" ? (insuranceProvider || "Insurance") : (currentQueue.find(v => v.id === visitId)?.patientName || "Patient");

    try {
        showLoading("Checking in patient...");
        await updateDoc(doc(db, "opd", visitId), {
            status: "CHECKED_IN",
            checkInTime: serverTimestamp(),
            paymentType,
            billTo,
            billToName,
            insuranceProvider,
            insuranceNumber,
            updatedAt: serverTimestamp()
        });

        await addDoc(collection(db, "auditLogs"), {
            tenantId: getTenantId(),
            userId: getCurrentUser()?.uid || "",
            action: "CHECK_IN_VISIT",
            module: "opd",
            recordId: visitId,
            details: { paymentType, billTo, billToName },
            createdAt: serverTimestamp()
        });

        closeModal();
        hideLoading();
        showToast("Patient checked in successfully.", "success");
        await loadQueue();
    } catch (error) {
        debugError("Error checking in visit:", error);
        hideLoading();
        showToast("Unable to check in visit. Please try again.", "error");
    }
};

/**
 * Starts triage for a patient.
 * @param {string} visitId
 */
window.startTriage = async function(visitId) {
    debug("Start triage for visit:", visitId);

    if (!hasPermission(PERMISSIONS.VITALS_CREATE)) { // Assuming NURSE has VITALS_CREATE
        showToast("You don't have permission to start triage.", "error");
        return;
    }

    try {
        showLoading("Starting triage...");
        await updateDoc(doc(db, "opd", visitId), {
            status: "WAITING_TRIAGE",
            triageStartTime: serverTimestamp(),
            updatedAt: serverTimestamp()
        });

        await addDoc(collection(db, "auditLogs"), {
            tenantId: getTenantId(),
            userId: getCurrentUser()?.uid || "",
            action: "START_TRIAGE",
            module: "opd",
            recordId: visitId,
            createdAt: serverTimestamp()
        });

        hideLoading();
        showToast("Triage started.", "success");
        // Redirect to a triage page
        window.location.href = `triage.html?visitId=${visitId}`;
    } catch (error) {
        debugError("Error starting triage:", error);
        hideLoading();
        showToast("Unable to start triage. Please try again.", "error");
    }
};

/**
 * Starts consultation for a patient.
 * @param {string} visitId
 */
window.startConsultation = async function(visitId) {
    debug("Start consultation:", visitId);

    if (!hasPermission(PERMISSIONS.CONSULTATION_CREATE)) { // Assuming DOCTOR has CONSULTATION_CREATE
        showToast("You don't have permission to start consultations.", "error");
        return;
    }

    try {
        showLoading("Starting consultation...");
        await updateDoc(doc(db, "opd", visitId), {
            status: "IN_CONSULTATION",
            consultationStart: serverTimestamp(),
            updatedAt: serverTimestamp()
        });

        await addDoc(collection(db, "auditLogs"), {
            tenantId: getTenantId(),
            userId: getCurrentUser()?.uid || "",
            action: "START_CONSULTATION",
            module: "opd",
            recordId: visitId,
            createdAt: serverTimestamp()
        });

        hideLoading();
        showToast("Consultation started.", "success");
        // Redirect to the consultation page with the visit ID
        window.location.href = `consultation.html?visitId=${visitId}`;
    } catch (error) {
        debugError("Error starting consultation for visit:", error);
        hideLoading();
        showToast("Unable to start consultation for visit. Please try again.", "error");
    }
};

/**
 * Ends a consultation.
 * @param {string} visitId
 */
window.endConsultation = async function(visitId) {
    debug("End consultation for visit:", visitId);

    if (!hasPermission(PERMISSIONS.CONSULTATION_CREATE)) { // Assuming DOCTOR has CONSULTATION_CREATE
        showToast("You don't have permission to complete consultations.", "error");
        return;
    }

    try {
        showLoading("Completing consultation...");
        await updateDoc(doc(db, "opd", visitId), {
            status: "SERVICES_PENDING", // Or "BILLING_PENDING" if no services are ordered
            consultationEnd: serverTimestamp(),
            updatedAt: serverTimestamp()
        });

        await addDoc(collection(db, "auditLogs"), {
            tenantId: getTenantId(),
            userId: getCurrentUser()?.uid || "",
            action: "COMPLETE_CONSULTATION",
            module: "opd",
            recordId: visitId,
            createdAt: serverTimestamp()
        });

        hideLoading();
        showToast("Consultation completed.", "success");
        await loadQueue();
    } catch (error) {
        debugError("Error ending consultation for visit:", error);
        hideLoading();
        showToast("Unable to end consultation for visit. Please try again.", "error");
    }
};

/**
 * Marks a visit as no-show.
 * @param {string} visitId
 * @param {string} patientName
 */
window.markVisitNoShow = async function(visitId, patientName) {
    debug("Mark no-show for visit:", visitId, patientName);

    if (!hasPermission(PERMISSIONS.QUEUE_MANAGE)) { // Assuming RECEPTIONIST has QUEUE_MANAGE
        showToast("You don't have permission to update appointments.", "error");
        return;
    }

    try {
        showLoading("Marking as no-show...");
        await updateDoc(doc(db, "opd", visitId), {
            status: "NO_SHOW",
            updatedAt: serverTimestamp()
        });

        await addDoc(collection(db, "auditLogs"), {
            tenantId: getTenantId(),
            userId: getCurrentUser()?.uid || "",
            action: "MARK_NO_SHOW",
            module: "opd",
            recordId: visitId,
            details: { patientName },
            createdAt: serverTimestamp()
        });

        hideLoading();
        showToast(`Patient "${patientName}" marked as no-show.`, "success");
        await loadQueue();
    } catch (error) { // Changed from appointmentId to visitId
        debugError("Error marking no-show:", error);
        hideLoading();
        showToast("Unable to mark as no-show. Please try again.", "error");
    }
};

// ─── Refresh ─────────────────────────────────────────────────────────────────

/**
 * Sets up the refresh button.
 */
function setupRefresh() {
    const refreshBtn = document.getElementById("refresh-queue");
    if (refreshBtn) {
        refreshBtn.addEventListener("click", async () => {
            showLoading("Refreshing queue...");
            await loadQueue();
            hideLoading();
            showToast("Queue refreshed.", "success");
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

function getPriorityBadge(priority) {
    if (!priority) return "secondary";
    const p = priority.toLowerCase();
    if (p === "emergency") return "error";
    if (p === "high priority") return "error";
    if (p === "urgent") return "warning";
    if (p === "routine") return "info";
    return "secondary";
}

function formatTime(timestamp) {
    if (!timestamp) return "—";
    if (timestamp.toDate) timestamp = timestamp.toDate();
    if (timestamp instanceof Date) {
        return timestamp.toLocaleTimeString("en-US", { hour: '2-digit', minute: '2-digit', hour12: true });
    }
    return String(timestamp);
}

function escapeHtml(text) {
    if (!text) return "";
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
}

export { loadQueue };
