/**
 * PRINCE ALEX DIGITAL HMS — Prescriptions Module
 * 
 * Handles:
 * - Loading and displaying prescriptions from Firestore
 * - Search and filter by status
 * - Dispensing prescriptions
 * - Status management
 * - Audit logging
 */

import { db, collection, query, where, getDocs, orderBy, updateDoc, doc, getDoc, serverTimestamp, addDoc, writeBatch } from "./firebase-config.js";
import { requireAuth } from "./auth-guard.js";
import { loadSidebar } from "./sidebar.js";
import { showToast, showLoading, hideLoading, showModal, closeModal } from "./notifications.js";
import { debug, debugError } from "./debug.js";
import { getTenantId, getCurrentUser, hasPermission, PERMISSIONS } from "./permissions.js";

document.addEventListener("DOMContentLoaded", async () => {
    debug("Prescriptions page: Initializing...");
    showLoading("Loading prescriptions...");
    try {
        const user = await requireAuth();
        if (!user) return;
        await loadSidebar();
        const pageTitleEl = document.getElementById("page-title");
        if (pageTitleEl) pageTitleEl.textContent = "Prescriptions";
        await loadPrescriptions();
        setupSearch();
        setupFilter();
        hideLoading();
        debug("Prescriptions page: Initialization complete.");
    } catch (error) {
        debugError("Prescriptions page initialization error:", error);
        hideLoading();
        showToast("Unable to load prescriptions page. Please try again.", "error");
    }
});

let currentPrescriptions = [];
let currentFilters = { search: "", status: "" };

async function loadPrescriptions() {
    debug("Loading prescriptions...");
    const tenantId = getTenantId();
    if (!tenantId) return;
    try {
        const q = query(
            collection(db, "prescriptions"),
            where("tenantId", "==", tenantId),
            orderBy("createdAt", "desc")
        );
        const snapshot = await getDocs(q);
        currentPrescriptions = [];
        snapshot.forEach((doc) => {
            currentPrescriptions.push({ id: doc.id, ...doc.data() });
        });
        debug("Prescriptions loaded:", currentPrescriptions.length);
        renderPrescriptions(currentPrescriptions);
        updatePrescriptionCount(currentPrescriptions.length);
    } catch (error) {
        debugError("Error loading prescriptions:", error);
        showToast("Unable to load prescriptions. Please try again.", "error");
        renderEmptyState("Unable to load prescriptions.");
    }
}

function renderPrescriptions(prescriptions) {
    const tbody = document.getElementById("prescriptions-tbody");
    if (!tbody) return;
    if (prescriptions.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6"><div class="table-empty"><div class="empty-icon"><svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg></div><h3>No prescriptions found</h3></div></td></tr>`;
        return;
    }
    tbody.innerHTML = prescriptions.map((pres) => {
        const patientName = pres.patientName || "—";
        const doctorName = pres.doctorName || "—";
        const medicines = pres.medicines ? pres.medicines.map(m => `${m.name} ${m.dosage || ""}`).join(", ") : "—";
        const status = pres.status || "pending";
        return `
            <tr>
                <td>${formatDate(pres.createdAt)}</td>
                <td>${escapeHtml(patientName)}</td>
                <td>${escapeHtml(doctorName)}</td>
                <td>${escapeHtml(medicines)}</td>
                <td><span class="badge badge-${getStatusBadge(status)}">${escapeHtml(status)}</span></td>
<td class="text-right">
                    <div class="table-actions">
                        ${status === "pending" ? `<button class="btn btn-sm btn-success" onclick="dispensePrescription('${pres.id}')"><svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.5 20h3a6.5 6.5 0 0 0 0-13h-3a6.5 6.5 0 0 0 0 13z"/><path d="M12 7v13"/></svg> Dispense</button>` : ""}
                        <button class="btn btn-sm btn-outline" onclick="viewPrescription('${pres.id}')"><svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg> View</button>
                    </div>
                </td>
            </tr>
        `;
    }).join("");
}

function renderEmptyState(message) {
    const tbody = document.getElementById("prescriptions-tbody");
    if (!tbody) return;
    tbody.innerHTML = `<tr><td colspan="6"><div class="table-empty"><div class="empty-icon"><svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg></div><h3>${escapeHtml(message)}</h3></div></td></tr>`;
}

function updatePrescriptionCount(count) {
    const el = document.getElementById("prescription-count");
    if (el) el.textContent = `${count} prescription${count !== 1 ? "s" : ""}`;
}

function setupSearch() {
    const searchInput = document.getElementById("prescription-search");
    const searchBtn = document.getElementById("search-btn");
    if (searchInput) {
        searchInput.addEventListener("input", (e) => {
            currentFilters.search = e.target.value.toLowerCase();
            applyFilters();
        });
    }
    if (searchBtn) searchBtn.addEventListener("click", applyFilters);
}

function setupFilter() {
    const statusFilter = document.getElementById("filter-status");
    if (statusFilter) {
        statusFilter.addEventListener("change", (e) => {
            currentFilters.status = e.target.value;
            applyFilters();
        });
    }
}

function applyFilters() {
    debug("Applying filters:", currentFilters);
    const filtered = currentPrescriptions.filter((pres) => {
        if (currentFilters.search) {
            const patientName = (pres.patientName || "").toLowerCase();
            const doctorName = (pres.doctorName || "").toLowerCase();
            if (!patientName.includes(currentFilters.search) && !doctorName.includes(currentFilters.search)) return false;
        }
        if (currentFilters.status && pres.status !== currentFilters.status) return false;
        return true;
    });
    renderPrescriptions(filtered);
    updatePrescriptionCount(filtered.length);
}

window.dispensePrescription = async function(prescriptionId) {
    debug("Dispensing prescription:", prescriptionId);
    if (!hasPermission(PERMISSIONS.PRESCRIPTION_DISPENSE)) {
        showToast("You don't have permission to dispense prescriptions.", "error");
        return;
    }

const pres = currentPrescriptions.find(p => p.id === prescriptionId);
    if (!pres) {
        showToast("Prescription record not found.", "error");
        return;
    }

    const medicines = pres.medicines || [];
    if (medicines.length === 0) {
        showToast("This prescription has no medicines to dispense.", "error");
        return;
    }

    // Resolve the patient name; older records may not store patientName, so
    // fall back to fetching the patient doc by patientId.
    let patientName = pres.patientName || "";
    if (!patientName && pres.patientId) {
        try {
            const patientDoc = await getDoc(doc(db, "patients", pres.patientId));
            if (patientDoc.exists()) {
                patientName = patientDoc.data().name || "";
            }
        } catch (e) {
            debugError("Error fetching patient for dispense overlay:", e);
        }
    }
    if (!patientName) patientName = "Unknown Patient";

    // Build the dispensing overlay with a checkbox for each listed medicine so
    // the pharmacist ticks the ones actually handed out.
    const medRows = medicines.map((m, i) => `
        <tr>
            <td>
                <input type="checkbox" class="dispense-check" data-med-index="${i}" id="dispense-med-${i}" checked>
            </td>
            <td>${escapeHtml(m.name || "—")}</td>
            <td>${escapeHtml(m.dosage || "—")}</td>
            <td>${escapeHtml(m.frequency || "—")}</td>
            <td>${m.duration ? escapeHtml(String(m.duration)) : "—"}</td>
        </tr>
    `).join("");

    const modalHtml = `
        <div class="modal" style="max-width: 680px;">
            <div class="modal-header">
                <h3>Dispense Prescription</h3>
                <button class="modal-close" data-modal-close>&times;</button>
            </div>
            <div class="modal-body">
                <div class="form-section" style="margin-bottom: 20px; padding-bottom: 20px; border-bottom: 1px solid #e5e7eb;">
                    <h4 style="margin-bottom: 15px; color: #374151;">Prescription Information</h4>
                    <div class="form-grid form-grid-2">
                        <div><strong>Patient:</strong> ${escapeHtml(patientName)}</div>
                        <div><strong>Patient ID:</strong> ${escapeHtml(pres.patientId || "N/A")}</div>
                        <div><strong>Doctor:</strong> ${escapeHtml(pres.doctorName || "Unknown Doctor")}</div>
                        <div><strong>Date:</strong> ${formatDate(pres.createdAt)}</div>
                        <div><strong>Status:</strong> ${escapeHtml(pres.status || "pending")}</div>
                    </div>
                </div>
                <div class="form-section">
                    <h4 style="margin-bottom: 15px; color: #374151;">Medicines to Dispense</h4>
                    <p style="margin-bottom: 12px; color: var(--color-gray-600); font-size: var(--font-size-sm);">
                        Tick the medicines you are handing out, then click "Confirm Dispense".
                    </p>
                    <div class="table-container">
                        <table class="table">
                            <thead>
                                <tr>
                                    <th style="width: 40px;">Give</th>
                                    <th>Medicine</th>
                                    <th>Dosage</th>
                                    <th>Frequency</th>
                                    <th>Days</th>
                                </tr>
                            </thead>
                            <tbody>${medRows}</tbody>
                        </table>
                    </div>
                </div>
            </div>
            <div class="modal-footer">
                <button class="btn btn-secondary" data-modal-close>Cancel</button>
                <button class="btn btn-success" onclick="confirmDispense('${prescriptionId}')">Confirm Dispense</button>
            </div>
        </div>
    `;

    showModal(modalHtml, "Dispense Prescription");
};

/**
 * Confirms the dispensing of the selected medicines and saves the result.
 * @param {string} prescriptionId
 */
window.confirmDispense = async function(prescriptionId) {
    const pres = currentPrescriptions.find(p => p.id === prescriptionId);
    if (!pres) {
        showToast("Prescription record not found.", "error");
        return;
    }

    // Collect the medicines that were ticked as given.
    const checked = document.querySelectorAll(".dispense-check:checked");
    if (checked.length === 0) {
        showToast("Please tick at least one medicine to dispense.", "error");
        return;
    }

    const givenMedicines = [];
    checked.forEach(cb => {
        const idx = parseInt(cb.getAttribute("data-med-index"), 10);
        const med = (pres.medicines || [])[idx];
        if (med) {
            givenMedicines.push({ ...med, givenAt: new Date().toISOString() });
        }
    });

    try {
        showLoading("Dispensing prescription...");

        await updateDoc(doc(db, "prescriptions", prescriptionId), {
            status: "dispensed",
            dispensedAt: serverTimestamp(),
            dispensedBy: getCurrentUser()?.uid || "",
            dispensedMedicines: givenMedicines,
            updatedAt: serverTimestamp()
        });

        await addDoc(collection(db, "auditLogs"), {
            tenantId: getTenantId(),
            userId: getCurrentUser()?.uid || "",
            action: "DISPENSE_PRESCRIPTION",
            module: "prescriptions",
            recordId: prescriptionId,
            details: { medicineCount: givenMedicines.length, medicines: givenMedicines.map(m => m.name) },
            createdAt: serverTimestamp()
        });

        // Advance the patient's OPD visit to the next stage (billing) once the
        // prescription is dispensed. This keeps the queue workflow moving.
        if (pres.visitId) {
            try {
                await updateDoc(doc(db, "opd", pres.visitId), {
                    status: "BILLING_PENDING",
                    prescriptionDispensedAt: serverTimestamp(),
                    updatedAt: serverTimestamp()
                });

                await addDoc(collection(db, "auditLogs"), {
                    tenantId: getTenantId(),
                    userId: getCurrentUser()?.uid || "",
                    action: "PRESCRIPTION_DISPENSED_TO_BILLING",
                    module: "prescriptions",
                    recordId: pres.visitId,
                    details: { prescriptionId, patientId: pres.patientId },
                    createdAt: serverTimestamp()
                });

                debug("Visit moved to billing after dispensing:", pres.visitId);
            } catch (visitError) {
                debugError("Error advancing visit to billing after dispensing:", visitError);
            }
        }

        closeModal();
        hideLoading();
        showToast("Prescription dispensed successfully!", "success");
        await loadPrescriptions();
    } catch (error) {
        debugError("Error dispensing prescription:", error);
        hideLoading();
        showToast("Unable to dispense prescription. Please try again.", "error");
    }
};

/**
 * Opens a modal overlay showing the prescription details: patient details,
 * prescribing doctor, and the full list of medicines.
 * @param {string} prescriptionId
 */
window.viewPrescription = async function(prescriptionId) {
    debug("Viewing prescription:", prescriptionId);
    try {
        const pres = currentPrescriptions.find(p => p.id === prescriptionId);
        if (!pres) {
            showToast("Prescription record not found.", "error");
            return;
        }

        // Resolve the patient name (fall back to fetching the patient doc for
        // older records that don't have patientName stored).
        let patientName = pres.patientName || "";
        let patientIdLabel = pres.patientId || "N/A";
        if (!patientName && pres.patientId) {
            try {
                const patientDoc = await getDoc(doc(db, "patients", pres.patientId));
                if (patientDoc.exists()) {
                    patientName = patientDoc.data().name || "";
                }
            } catch (e) {
                debugError("Error fetching patient for prescription overlay:", e);
            }
        }
        if (!patientName) patientName = "Unknown Patient";

        const doctorName = pres.doctorName || "Unknown Doctor";
        const medicines = pres.medicines || [];

        const medicinesHtml = medicines.length === 0
            ? `<tr><td colspan="6" class="text-center text-muted">No medicines recorded</td></tr>`
            : medicines.map((m, i) => `
                <tr>
                    <td>${i + 1}</td>
                    <td>${escapeHtml(m.name || "—")}</td>
                    <td>${escapeHtml(m.dosage || "—")}</td>
                    <td>${escapeHtml(m.frequency || "—")}</td>
                    <td>${m.duration ? escapeHtml(String(m.duration)) : "—"}</td>
                    <td>${escapeHtml(m.instructions || "—")}</td>
                </tr>
            `).join("");

        const modalHtml = `
            <div class="modal" style="max-width: 720px;">
                <div class="modal-header">
                    <h3>Prescription Details</h3>
                    <button class="modal-close" data-modal-close>&times;</button>
                </div>
                <div class="modal-body">
                    <div class="form-section" style="margin-bottom: 20px; padding-bottom: 20px; border-bottom: 1px solid #e5e7eb;">
                        <h4 style="margin-bottom: 15px; color: #374151;">Patient Information</h4>
                        <div class="form-grid form-grid-2">
                            <div><strong>Patient:</strong> ${escapeHtml(patientName)}</div>
                            <div><strong>Patient ID:</strong> ${escapeHtml(patientIdLabel)}</div>
                        </div>
                    </div>
                    <div class="form-section" style="margin-bottom: 20px; padding-bottom: 20px; border-bottom: 1px solid #e5e7eb;">
                        <h4 style="margin-bottom: 15px; color: #374151;">Prescription Information</h4>
                        <div class="form-grid form-grid-2">
                            <div><strong>Prescribed By (Doctor):</strong> ${escapeHtml(doctorName)}</div>
                            <div><strong>Date:</strong> ${formatDate(pres.createdAt)}</div>
                            <div><strong>Status:</strong> <span class="badge badge-${getStatusBadge(pres.status || "pending")}">${escapeHtml(pres.status || "pending")}</span></div>
                            <div><strong>Instructions:</strong> ${escapeHtml(pres.dosageInstructions || "—")}</div>
                        </div>
                    </div>
                    <div class="form-section">
                        <h4 style="margin-bottom: 15px; color: #374151;">Medicines</h4>
                        <div class="table-container">
                            <table class="table">
                                <thead>
                                    <tr>
                                        <th>#</th>
                                        <th>Medicine</th>
                                        <th>Dosage</th>
                                        <th>Frequency</th>
                                        <th>Duration (days)</th>
                                        <th>Instructions</th>
                                    </tr>
                                </thead>
                                <tbody>${medicinesHtml}</tbody>
                            </table>
                        </div>
                    </div>
                </div>
                <div class="modal-footer">
                    <button class="btn btn-secondary" data-modal-close>Close</button>
                </div>
            </div>
        `;

        showModal(modalHtml, "Prescription Details");
    } catch (error) {
        debugError("Error viewing prescription:", error);
        showToast("Unable to view prescription. Please try again.", "error");
    }
};

function getStatusBadge(status) {
    if (!status) return "secondary";
    const s = status.toLowerCase();
    if (s.includes("dispensed") || s.includes("completed")) return "success";
    if (s.includes("pending")) return "warning";
    if (s.includes("cancelled")) return "error";
    return "secondary";
}

function formatDate(date) {
    if (!date) return "—";
    if (date.toDate) date = date.toDate();
    if (date instanceof Date) {
        return date.toLocaleDateString("en-GB", { year: "numeric", month: "short", day: "numeric" });
    }
    return String(date);
}

function escapeHtml(text) {
    if (!text) return "";
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
}

export { loadPrescriptions };
