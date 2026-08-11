/**
 * PRINCE ALEX DIGITAL HMS — Admissions Module
 * 
 * Handles:
 * - Loading and displaying admissions from Firestore
 * - Search and filter functionality
 * - Discharge patient
 * - Status management
 */

import { db, collection, query, where, getDocs, orderBy, updateDoc, doc, serverTimestamp, addDoc, getDoc, limit } from "./firebase-config.js";
import { requireAuth } from "./auth-guard.js"; // Corrected import
import { loadSidebar } from "./sidebar.js";
import { showToast, showLoading, hideLoading, showConfirm, showModal, closeModal } from "./notifications.js";
import { debug, debugError } from "./debug.js";
import { getTenantId, getCurrentUser, hasPermission, PERMISSIONS } from "./permissions.js";

document.addEventListener("DOMContentLoaded", async () => {
    debug("Admissions page: Initializing...");
    showLoading("Loading admissions...");
    try {
        const user = await requireAuth();
        if (!user) return;

        // Load role-based sidebar navigation
        await loadSidebar();
        await loadAdmissions();
        setupSearch();
        setupFilter();
        hideLoading();
        debug("Admissions page: Initialization complete.");
    } catch (error) {
        debugError("Admissions page initialization error:", error);
        hideLoading();
        showToast("Unable to load admissions page. Please try again.", "error");
    }
});

let currentAdmissions = [];
let availableMedicines = [];
let currentFilters = { search: "", status: "" };

async function loadAdmissions() {
    debug("Loading admissions...");
    const tenantId = getTenantId();
    if (!tenantId) return;
    try {
        const q = query(
            collection(db, "admissions"),
            where("tenantId", "==", tenantId),
            orderBy("createdAt", "desc")
        );
        const snapshot = await getDocs(q);
        currentAdmissions = [];
        snapshot.forEach((doc) => {
            currentAdmissions.push({ id: doc.id, ...doc.data() });
        });
        debug("Admissions loaded:", currentAdmissions.length);
        renderAdmissions(currentAdmissions);
        updateAdmissionCount(currentAdmissions.length);
        await loadMedicineOptions(); // Load medicines for prescription modal
    } catch (error) {
        debugError("Error loading admissions:", error);
        showToast("Unable to load admissions. Please try again.", "error");
        renderEmptyState("Unable to load admissions.");
    }
}

function renderAdmissions(admissions) {
    const tbody = document.getElementById("admissions-tbody");
    if (!tbody) return;
    if (admissions.length === 0) {
        tbody.innerHTML = `<tr><td colspan="8"><div class="table-empty"><div class="empty-icon"><svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 21h18"/><path d="M5 21V7l8-4v18"/></svg></div><h3>No admissions found</h3></div></td></tr>`;
        return;
    }
    tbody.innerHTML = admissions.map((adm) => {
        const patientName = adm.patientName || "—";
        const status = adm.status || "admitted";
        return `
            <tr>
                <td>${escapeHtml(patientName)}</td>
                <td>${escapeHtml(adm.patientId || "")}</td>
                <td>${formatDate(adm.admissionDate)}</td>
                <td>${adm.dischargeDate ? formatDate(adm.dischargeDate) : "—"}</td>
                <td>${escapeHtml(adm.wardName || "")}</td>
                <td>${escapeHtml(adm.bedNumber || "")}</td>
                <td><span class="badge badge-${getStatusBadge(status)}">${escapeHtml(status)}</span></td>
                <td class="text-right">
                    <div class="table-actions">
                        ${status === "admitted" ? `
                            <button class="btn btn-sm btn-primary" onclick="prescribeForAdmittedPatient('${adm.id}')">Prescribe</button>
                            <button class="btn btn-sm btn-success" onclick="dischargePatient('${adm.id}', '${escapeHtml(patientName)}')">Discharge</button>
                        ` : ""}
                        <button class="btn btn-sm btn-outline" onclick="viewAdmission('${adm.id}')"><svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg> View</button>
                    </div>
                </td>
            </tr>
        `;
    }).join("");
}

function renderEmptyState(message) {
    const tbody = document.getElementById("admissions-tbody");
    if (!tbody) return;
    tbody.innerHTML = `<tr><td colspan="8"><div class="table-empty"><div class="empty-icon"><svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 21h18"/><path d="M5 21V7l8-4v18"/></svg></div><h3>${escapeHtml(message)}</h3></div></td></tr>`;
}

function updateAdmissionCount(count) {
    const el = document.getElementById("admission-count");
    if (el) el.textContent = `${count} admission${count !== 1 ? "s" : ""}`;
}

function setupSearch() {
    const searchInput = document.getElementById("admission-search");
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
    const filtered = currentAdmissions.filter((adm) => {
        if (currentFilters.search) {
            const name = (adm.patientName || "").toLowerCase();
            const pid = (adm.patientId || "").toLowerCase();
            if (!name.includes(currentFilters.search) && !pid.includes(currentFilters.search)) return false;
        }
        if (currentFilters.status && adm.status !== currentFilters.status) return false;
        return true;
    });
    renderAdmissions(filtered);
    updateAdmissionCount(filtered.length);
}

window.dischargePatient = async function(admissionId, patientName) {
    debug("Discharge patient:", admissionId, patientName);
    if (!hasPermission(PERMISSIONS.ADMISSION_UPDATE)) {
        showToast("You don't have permission to discharge patients.", "error");
        return;
    }
    const confirmed = await showConfirm(
        "Discharge Patient",
        `Are you sure you want to discharge "${patientName}"?`,
        "Discharge",
        "Cancel"
    );
    if (!confirmed) return;
    try {
        showLoading("Discharging patient...");

        // Get the admission document to find the associated visitId and bedId
        const admissionDoc = await getDoc(doc(db, "admissions", admissionId));
        if (!admissionDoc.exists()) {
            throw new Error("Admission record not found.");
        }
        const admissionData = admissionDoc.data();

        // 1. Update the admission status to 'discharged'
        await updateDoc(doc(db, "admissions", admissionId), {
            status: "discharged",
            dischargeDate: serverTimestamp(),
            updatedAt: serverTimestamp()
        });

        // 2. Update the OPD visit status to 'BILLING_PENDING'
        if (admissionData.visitId) {
            await updateDoc(doc(db, "opd", admissionData.visitId), {
                status: "BILLING_PENDING",
                updatedAt: serverTimestamp()
            });
            debug(`Visit ${admissionData.visitId} moved to billing queue.`);
        } else {
            debugError("No visitId found for this admission. Cannot move to billing queue.");
        }

        // 3. Free up the bed
        if (admissionData.bedId) {
            await updateDoc(doc(db, "beds", admissionData.bedId), {
                status: "available",
                patientId: null,
                patientName: null
            });
            debug(`Bed ${admissionData.bedId} is now available.`);
        }

        await addDoc(collection(db, "auditLogs"), {
            tenantId: getTenantId(),
            userId: getCurrentUser()?.uid || "",
            action: "DISCHARGE_PATIENT",
            module: "admissions",
            recordId: admissionId,
            details: { patientName },
            createdAt: serverTimestamp()
        });
        hideLoading();
        showToast(`Patient "${patientName}" has been discharged.`, "success");
        await loadAdmissions();
    } catch (error) {
        debugError("Error discharging patient:", error);
        hideLoading();
        showToast("Unable to discharge patient. Please try again.", "error");
    }
};

window.viewAdmission = function(admissionId) {
    const admission = currentAdmissions.find(a => a.id === admissionId);
    if (!admission) {
        showToast("Admission record not found.", "error");
        return;
    }

    const modalHtml = `
        <div class="modal" style="max-width: 600px;">
            <div class="modal-header">
                <h3>Admission Details</h3>
                <button class="modal-close" data-modal-close>&times;</button>
            </div>
            <div class="modal-body">
                <div class="form-section">
                    <div class="form-grid form-grid-2">
                        <div><strong>Patient:</strong> ${escapeHtml(admission.patientName)}</div>
                        <div><strong>Patient ID:</strong> ${escapeHtml(admission.patientId)}</div>
                        <div><strong>Admit Date:</strong> ${formatDate(admission.admissionDate)}</div>
                        <div><strong>Discharge Date:</strong> ${admission.dischargeDate ? formatDate(admission.dischargeDate) : "—"}</div>
                        <div><strong>Ward:</strong> ${escapeHtml(admission.wardName)}</div>
                        <div><strong>Bed:</strong> ${escapeHtml(admission.bedNumber)}</div>
                        <div><strong>Attending Doctor:</strong> ${escapeHtml(admission.doctorName || "N/A")}</div>
                        <div><strong>Status:</strong> <span class="badge badge-${getStatusBadge(admission.status)}">${escapeHtml(admission.status)}</span></div>
                    </div>
                </div>
                <div class="form-section">
                    <div class="form-group">
                        <label class="form-label">Reason for Admission</label>
                        <p>${escapeHtml(admission.reason || "Not specified")}</p>
                    </div>
                    <div class="form-group">
                        <label class="form-label">Admission Notes</label>
                        <p>${escapeHtml(admission.notes || "No notes provided.")}</p>
                    </div>
                </div>
            </div>
            <div class="modal-footer">
                <button class="btn btn-secondary" data-modal-close>Close</button>
                <a href="patient-profile.html?id=${admission.patientId}" class="btn btn-primary">View Full Profile</a>
            </div>
        </div>
    `;
    showModal(modalHtml, "Admission Details");
};

/**
 * Prescription workflow for admitted patients
 */
let prescriptionItemCount = 0;

async function loadMedicineOptions() {
    const tenantId = getTenantId();
    if (!tenantId) return;
    try {
        const q = query(collection(db, "medicines"), where("tenantId", "==", tenantId));
        const snapshot = await getDocs(q);
        availableMedicines = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        let datalist = document.getElementById("medicines-datalist");
        if (!datalist) {
            datalist = document.createElement("datalist");
            datalist.id = "medicines-datalist";
            document.body.appendChild(datalist);
        }
        datalist.innerHTML = availableMedicines.map(med => `<option value="${escapeHtml(med.name)}"></option>`).join("");
        debug("Medicine options loaded for prescription:", availableMedicines.length);
    } catch (error) {
        debugError("Error loading medicine options:", error);
    }
}

window.prescribeForAdmittedPatient = function(admissionId) {
    if (!hasPermission(PERMISSIONS.PRESCRIPTION_CREATE)) {
        showToast("You don't have permission to create prescriptions.", "error");
        return;
    }
    const admission = currentAdmissions.find(a => a.id === admissionId);
    if (!admission) {
        showToast("Admission record not found.", "error");
        return;
    }

    prescriptionItemCount = 0;

    const modalHtml = `
        <div class="modal" style="max-width: 700px;">
            <div class="modal-header">
                <h3>Prescribe for ${escapeHtml(admission.patientName)}</h3>
                <button class="modal-close" data-modal-close>&times;</button>
            </div>
            <div class="modal-body">
                <div class="form-section">
                    <div class="form-section-title">Medicines</div>
                    <div id="prescription-items"></div>
                    <button type="button" class="btn btn-sm btn-outline mt-2" onclick="addPrescriptionItem()">
                        Add Medicine
                    </button>
                </div>
                <div class="form-group">
                    <label class="form-label" for="prescription-notes">Notes / Instructions</label>
                    <textarea id="prescription-notes" class="form-textarea" rows="3" placeholder="e.g., Take with food."></textarea>
                </div>
            </div>
            <div class="modal-footer">
                <button class="btn btn-secondary" data-modal-close>Cancel</button>
                <button class="btn btn-primary" onclick="saveInpatientPrescription('${admissionId}')">Save Prescription</button>
            </div>
        </div>
    `;
    showModal(modalHtml, "Prescribe Medication");
    addPrescriptionItem(); // Add the first item row
};

window.addPrescriptionItem = function() {
    prescriptionItemCount++;
    const container = document.getElementById("prescription-items");
    const newItem = document.createElement("div");
    newItem.className = "form-row";
    newItem.id = `prescription-item-${prescriptionItemCount}`;
    newItem.innerHTML = `
        <div class="form-group" style="flex: 2;"><input type="text" list="medicines-datalist" class="form-input" placeholder="Medicine name"></div>
        <div class="form-group" style="flex: 1;"><input type="text" class="form-input" placeholder="Dosage (e.g. 500mg)"></div>
        <div class="form-group" style="flex: 1;"><input type="text" class="form-input" placeholder="Frequency (e.g. BID)"></div>
        <div class="form-group" style="flex: 0 0 80px;"><input type="number" class="form-input" placeholder="Days"></div>
        <div class="form-group" style="flex: 0 0 40px;"><button type="button" class="btn btn-error btn-sm" onclick="this.closest('.form-row').remove()">X</button></div>
    `;
    container.appendChild(newItem);
};

window.saveInpatientPrescription = async function(admissionId) {
    const admission = currentAdmissions.find(a => a.id === admissionId);
    if (!admission) {
        showToast("Admission record not found.", "error");
        return;
    }

    const prescriptionItems = [];
    const itemRows = document.querySelectorAll("#prescription-items .form-row");
    itemRows.forEach(row => {
        const inputs = row.querySelectorAll("input");
        const name = inputs[0].value.trim();
        if (name) {
            prescriptionItems.push({
                name,
                dosage: inputs[1].value.trim() || null,
                frequency: inputs[2].value.trim() || null,
                duration: inputs[3].value ? parseInt(inputs[3].value, 10) : null,
            });
        }
    });

    if (prescriptionItems.length === 0) {
        showToast("Please add at least one medicine.", "error");
        return;
    }

    const notes = document.getElementById("prescription-notes").value.trim();
    const currentUser = getCurrentUser();
    const tenantId = getTenantId();

    showLoading("Saving Prescription...");

    try {
        // 1. Create Prescription document
        const prescriptionRef = await addDoc(collection(db, "prescriptions"), {
            tenantId,
            patientId: admission.patientId,
            patientName: admission.patientName,
            visitId: admission.visitId, // Link to the original visit for billing continuity
            admissionId: admission.id,
            doctorId: currentUser.uid,
            doctorName: currentUser.displayName,
            medicines: prescriptionItems,
            dosageInstructions: notes || null,
            status: "pending",
            createdAt: serverTimestamp(),
            createdBy: currentUser.uid,
        });

        // 2. Create Billable Items for this prescription
        await createBillableItemsForPrescription(admission, prescriptionItems);

        // 3. Create Audit Log
        await addDoc(collection(db, "auditLogs"), {
            tenantId,
            userId: currentUser.uid,
            action: "CREATE_INPATIENT_PRESCRIPTION",
            module: "admissions",
            recordId: prescriptionRef.id,
            details: { patientName: admission.patientName, medicineCount: prescriptionItems.length },
            createdAt: serverTimestamp(),
        });

        hideLoading();
        closeModal();
        showToast("Prescription saved and sent to pharmacy.", "success");

    } catch (error) {
        debugError("Error saving inpatient prescription:", error);
        hideLoading();
        showToast("Failed to save prescription.", "error");
    }
};

async function createBillableItemsForPrescription(admission, prescriptionItems) {
    const tenantId = getTenantId();
    const currentUser = getCurrentUser();

    if (!admission.visitId) {
        debugWarn("No visitId on admission, cannot create billable items for prescription.");
        return;
    }

    // Build a lookup of medicine name -> price from the tenant's medicines.
    const medicinePriceMap = {};
    availableMedicines.forEach(med => {
        if (med.name) {
            medicinePriceMap[med.name.toLowerCase()] = parseFloat(med.price) || 0;
        }
    });

    for (const med of prescriptionItems) {
        const medDesc = med.dosage ? `${med.name} (${med.dosage})` : med.name;
        const unitPrice = medicinePriceMap[String(med.name || "").toLowerCase()] || 0;
        const qty = (med.duration && parseInt(med.duration) > 0) ? parseInt(med.duration) : 1;

        await addDoc(collection(db, "billableItems"), {
            tenantId,
            patientId: admission.patientId,
            patientName: admission.patientName,
            visitId: admission.visitId,
            description: `Inpatient Medicine: ${medDesc}`,
            qty: qty,
            unitPrice: unitPrice,
            amount: qty * unitPrice,
            source: "inpatient-pharmacy",
            createdAt: serverTimestamp(),
            createdBy: currentUser.uid,
        });
    }
    debug(`${prescriptionItems.length} billable items created for inpatient prescription.`);
}

function formatDate(date) {
    if (!date) return "—";
    if (date.toDate) date = date.toDate();
    if (date instanceof Date) {
        return date.toLocaleDateString("en-GB", { year: "numeric", month: "short", day: "numeric" });
    }
    return String(date);
}

function getStatusBadge(status) {
    if (!status) return "secondary";
    const s = status.toLowerCase();
    if (s.includes("discharged")) return "success";
    if (s.includes("admitted")) return "info";
    if (s.includes("cancelled")) return "error";
    return "secondary";
}

function escapeHtml(text) {
    if (!text) return "";
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
}

export { loadAdmissions };
