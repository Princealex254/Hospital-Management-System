/**
 * PRINCE ALEX DIGITAL HMS — Consultation Module
 * 
 * Handles:
 * - Loading doctors for consultation
 * - Saving consultation notes, diagnosis, prescriptions, and lab orders
 * - Creating encounters, diagnoses, prescriptions, and lab orders in Firestore
 * - Audit logging
 */

import { db, doc, getDoc, collection, addDoc, getDocs, query, where, orderBy, serverTimestamp, limit, updateDoc } from "./firebase-config.js";
import { requireAuth } from "./auth-guard.js";
import { loadSidebar } from "./sidebar.js";
import { showToast, showLoading, hideLoading } from "./notifications.js";
import { debug, debugError } from "./debug.js";
import { getTenantId, getCurrentUser } from "./permissions.js";

// ─── Global State ────────────────────────────────────────────────────────────

let prescriptionItemCount = 0;
let labOrderItemCount = 0;
let currentVisit = null;
let availableMedicines = [];

// ─── Initialize Page ─────────────────────────────────────────────────────────

document.addEventListener("DOMContentLoaded", async () => {
    debug("Consultation page: Initializing...");

    showLoading("Loading consultation...");

    try {
        const user = await requireAuth();
        if (!user) return;

        // Load role-based sidebar navigation
        await loadSidebar();

        const urlParams = new URLSearchParams(window.location.search);
        const visitId = urlParams.get("visitId");

if (visitId) {
            // A visit is specified, load it directly
            document.getElementById("doctor-queue-container").style.display = "none";
            await loadVisitForConsultation(visitId);
        } else {
            // No visit specified, show the doctor's queue and search UI
            await loadDoctorQueue();
            setupQueueRefresh();
            // The search section is now secondary, so we can hide it by default
            // or show it if the queue is empty. For now, let's keep it visible.
            // document.getElementById("patient-selection-container").style.display = "block";
            // await loadDoctors();
            // setupPatientSearch();
        }

// Always set up the form, it will be shown when needed
        setupForm();

        // Load the medicine list for the prescription searchable dropdown
        await loadMedicineOptions();

        hideLoading();
        debug("Consultation page: Initialization complete.");
    } catch (error) {
        debugError("Consultation page initialization error:", error);
        hideLoading();
        showToast("Unable to load consultation page. Please try again.", "error");
    }
});

async function loadVisitForConsultation(visitOrVisitId) {
    if (typeof visitOrVisitId === 'string') {
        debug("Loading visit for consultation by ID:", visitOrVisitId);
        const visitDocRef = doc(db, "opd", visitOrVisitId);
        const visitDoc = await getDoc(visitDocRef);
        if (!visitDoc.exists()) {
            showToast("Visit not found.", "error");
            document.getElementById("consultation-subtitle").textContent = "Error: Visit not found.";
            return;
        }
        currentVisit = { id: visitDoc.id, ...visitDoc.data() };
    } else {
        currentVisit = visitOrVisitId;
    }

    // Get patient details
    const patientDocRef = doc(db, "patients", currentVisit.patientId);
    const patientDoc = await getDoc(patientDocRef);
    const patientData = patientDoc.exists() ? patientDoc.data() : {};

    const currentUser = getCurrentUser();
    const activeDoctorId = currentVisit.doctorId || currentUser?.uid || "";

    // Populate hidden fields
    document.getElementById("consultation-visit-id").value = currentVisit.id;
    document.getElementById("consultation-patient-id").value = currentVisit.patientId;
    document.getElementById("consultation-doctor-id").value = activeDoctorId;

    // Update UI
    const subtitle = document.getElementById("consultation-subtitle");
    if (subtitle) {
        subtitle.innerHTML = `
            Patient: <strong>${escapeHtml(patientData.name || "Unknown")}</strong> (ID: ${escapeHtml(patientData.patientId || "N/A")})
            <br>
            Visit ID: ${escapeHtml(currentVisit.visitId || "N/A")}
        `;
    }

// Load and display patient information
    await loadPatientInformation(patientData);

    // Display the Chief Complaint captured during triage (stored on the visit).
    const triageChiefComplaint = currentVisit.chiefComplaint || "";
    const infoChiefComplaintEl = document.getElementById("info-chief-complaint");
    if (infoChiefComplaintEl) {
        infoChiefComplaintEl.textContent = triageChiefComplaint || "—";
        if (triageChiefComplaint) {
            infoChiefComplaintEl.style.fontWeight = "600";
            infoChiefComplaintEl.style.color = "var(--color-gray-900)";
        }
    }

    // Prefill the Chief Complaint field in the consultation form so the doctor
    // sees the patient's reason for visit from triage and can refine it if needed.
    const chiefComplaintInput = document.getElementById("chief-complaint");
    if (chiefComplaintInput && triageChiefComplaint) {
        chiefComplaintInput.value = triageChiefComplaint;
    }

    // Load previous visits
    await loadPreviousVisits(currentVisit.patientId);

    // Load and display lab results for this visit (e.g. after labs complete)
    await loadLabResultsForVisit();

    // Show consultation form
    document.getElementById("consultation-form-container").style.display = "block";
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

/**
 * Loads lab results for the current visit and displays them in the patient
 * info panel, along with a suggested next action for the doctor.
 */
async function loadLabResultsForVisit() {
    const resultsDiv = document.getElementById("info-lab-results");
    const nextActionDiv = document.getElementById("info-next-action");
    const statusBadge = document.getElementById("lab-results-status-badge");
    const banner = document.getElementById("lab-results-panel");
    if (!resultsDiv || !currentVisit) return;

    // Helper to update the banner badge + accent based on state.
    const setBannerState = (label, badgeClass, accentClass) => {
        if (statusBadge) {
            statusBadge.textContent = label;
            statusBadge.className = `badge ${badgeClass} lab-results-badge`;
        }
        if (banner) {
            banner.classList.remove("banner-ready", "banner-pending", "banner-none");
            if (accentClass) banner.classList.add(accentClass);
        }
    };

    try {
        const tenantId = getTenantId();
        if (!tenantId) {
            resultsDiv.textContent = "No lab orders for this visit";
            setBannerState("No Results", "badge-secondary", "banner-none");
            return;
        }

        // 1. Find lab orders for this visit
        const ordersQuery = query(
            collection(db, "labOrders"),
            where("tenantId", "==", tenantId),
            where("visitId", "==", currentVisit.id)
        );
        const ordersSnap = await getDocs(ordersQuery);
        const orders = ordersSnap.docs.map(d => ({ id: d.id, ...d.data() }));

        if (orders.length === 0) {
            resultsDiv.textContent = "No lab orders for this visit";
            nextActionDiv.textContent = "No pending lab orders. You may proceed with the consultation.";
            setBannerState("No Results", "badge-secondary", "banner-none");
            return;
        }

        // 2. Find lab results for those orders
        const orderIds = orders.map(o => o.id);
        let results = [];
        if (orderIds.length > 0) {
            const resultsQuery = query(
                collection(db, "labResults"),
                where("tenantId", "==", tenantId),
                where("orderId", "in", orderIds)
            );
            const resultsSnap = await getDocs(resultsQuery);
            results = resultsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        }

// 3. Determine how many orders have results vs still pending.
        //    For grouped orders (with tests[]), consider them pending while any
        //    test is still awaiting a result.
        const pendingTestNames = [];
        orders.forEach(o => {
            const tests = (o.tests && o.tests.length > 0) ? o.tests : [{ testName: o.testName, status: o.status }];
            tests.forEach(t => {
                const tStatus = (t.status || o.status || "ordered").toLowerCase();
                if (!["completed", "verified"].includes(tStatus)) {
                    pendingTestNames.push(t.testName || o.testName);
                }
            });
        });

// Build a readable list of lab results
        if (results.length > 0) {
            const listHtml = results.map(r => {
                // From the doctor's perspective in the consultation, results are
                // available to review. Show "Ready" instead of the raw lab
                // "pending" verification status to avoid confusion.
                const statusLabel = "Ready for review";
                return `
                    <div class="lab-result-item" style="margin-bottom: 6px; padding: 8px; border: 1px solid var(--color-gray-200); border-radius: var(--border-radius-sm);">
                        <div><strong>${escapeHtml(r.testName || "Test")}</strong>
                            <span class="badge badge-success">${statusLabel}</span>
                        </div>
                        <div style="margin-top: 4px; color: var(--color-gray-700);">Result: <strong>${escapeHtml(r.result || "N/A")}</strong></div>
                        ${r.notes ? `<div style="margin-top: 2px; color: var(--color-gray-500); font-size: var(--font-size-xs);">${escapeHtml(r.notes)}</div>` : ""}
                    </div>
                `;
            }).join("");
            resultsDiv.innerHTML = listHtml;
            setBannerState("Results Ready", "badge-success", "banner-ready");
        } else if (pendingTestNames.length > 0) {
            const pendingNames = pendingTestNames.map(n => escapeHtml(n)).join(", ");
            resultsDiv.innerHTML = `<span class="badge badge-warning">Awaiting results</span> ${pendingNames}`;
            setBannerState("Awaiting Results", "badge-warning", "banner-pending");
        } else {
            resultsDiv.textContent = "Lab orders completed. No results recorded.";
            setBannerState("No Results", "badge-secondary", "banner-none");
        }

        // 4. Suggest the next action
        if (results.length > 0) {
            nextActionDiv.innerHTML = `<span class="badge badge-info">Review lab results</span> Review the results above, then finish the consultation (prescribe, order more tests, or discharge).`;
        } else if (pendingTestNames.length > 0) {
            nextActionDiv.innerHTML = `<span class="badge badge-warning">Waiting on lab</span> Lab results are still pending for this visit.`;
        } else {
            nextActionDiv.textContent = "No pending lab orders. You may proceed with the consultation.";
        }

        debug("Lab results loaded for visit:", results.length);
    } catch (error) {
        debugError("Error loading lab results for visit:", error);
        resultsDiv.textContent = "Unable to load lab results.";
        nextActionDiv.textContent = "Unable to determine next action.";
    }
}

/**
 * Loads and displays patient information in the info panel.
 * @param {Object} patientData 
 */
async function loadPatientInformation(patientData) {
    const infoPanel = document.getElementById("patient-info-panel");
    if (!infoPanel) return;

    infoPanel.style.display = "block";

    // Basic info
    document.getElementById("info-patient-name").textContent = patientData.name || "Unknown";
    document.getElementById("info-patient-id").textContent = patientData.patientId || "N/A";
    document.getElementById("info-visit-id").textContent = currentVisit?.visitId || "N/A";
    
    // Calculate age
    if (patientData.dateOfBirth) {
        const dob = patientData.dateOfBirth.toDate ? patientData.dateOfBirth.toDate() : new Date(patientData.dateOfBirth);
        const age = Math.floor((new Date() - dob) / (365.25 * 24 * 60 * 60 * 1000));
        document.getElementById("info-age").textContent = `${age} years`;
    } else {
        document.getElementById("info-age").textContent = "N/A";
    }
    
    document.getElementById("info-gender").textContent = patientData.gender || "N/A";
    document.getElementById("info-blood-group").textContent = patientData.bloodGroup || "N/A";

    // Allergies
    const allergies = patientData.allergies || [];
    document.getElementById("info-allergies").textContent = 
        allergies.length > 0 ? allergies.join(", ") : "None reported";

    // Chronic conditions
    const conditions = patientData.chronicConditions || [];
    document.getElementById("info-chronic-conditions").textContent = 
        conditions.length > 0 ? conditions.join(", ") : "None reported";

    // Current medications (active prescriptions)
    await loadCurrentMedications(currentVisit.patientId);
}

/**
 * Loads current medications for the patient.
 * @param {string} patientId 
 */
async function loadCurrentMedications(patientId) {
    try {
        const tenantId = getTenantId();
        const q = query(
            collection(db, "prescriptions"),
            where("tenantId", "==", tenantId),
            where("patientId", "==", patientId),
            where("status", "==", "pending")
        );
        const snapshot = await getDocs(q);
        
        const medicationsDiv = document.getElementById("info-current-medications");
        if (snapshot.empty) {
            medicationsDiv.textContent = "No active medications";
        } else {
            const meds = [];
            snapshot.forEach(doc => {
                const data = doc.data();
                if (data.medicines && data.medicines.length > 0) {
                    meds.push(...data.medicines.map(m => m.name).filter(Boolean));
                }
            });
            medicationsDiv.textContent = meds.length > 0 ? meds.join(", ") : "No active medications";
        }
    } catch (error) {
        debugError("Error loading current medications:", error);
    }
}

/**
 * Loads previous visits for the patient.
 * @param {string} patientId 
 */
async function loadPreviousVisits(patientId) {
    try {
        const tenantId = getTenantId();
        const q = query(
            collection(db, "opd"),
            where("tenantId", "==", tenantId),
            where("patientId", "==", patientId),
            orderBy("createdAt", "desc"),
            limit(5)
        );
        const snapshot = await getDocs(q);
        
        // For now, just log previous visits - can be displayed in UI later
        const previousVisits = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        debug("Previous visits loaded:", previousVisits.length);
        
        // Store in currentVisit for reference
        currentVisit.previousVisits = previousVisits;
    } catch (error) {
        debugError("Error loading previous visits:", error);
    }
}

async function loadDoctorQueue() {
    debug("Loading doctor's queue...");
    const currentUser = getCurrentUser();
    const tenantId = getTenantId();
    if (!currentUser || !tenantId) return;

    try {
        const q = query(
            collection(db, "opd"),
            where("tenantId", "==", tenantId),
            where("status", "in", ["WAITING_DOCTOR", "TRIAGED", "IN_CONSULTATION"]), // Include IN_CONSULTATION
            // Optionally filter by doctor if visits are pre-assigned
            // where("doctorId", "==", currentUser.uid), 
            orderBy("priority", "asc"),
            orderBy("createdAt", "asc")
        );

        const snapshot = await getDocs(q);
        const queueItems = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        
        renderDoctorQueue(queueItems);

    } catch (error) {
        debugError("Error loading doctor's queue:", error);
        showToast("Could not load your patient queue.", "error");
    }
}

function renderDoctorQueue(queueItems) {
    const tbody = document.getElementById("doctor-queue-tbody");
    if (!tbody) return;

    // Update the queue count badge
    const countEl = document.getElementById("queue-count");
    if (countEl) {
        countEl.textContent = `${queueItems.length} patient${queueItems.length !== 1 ? "s" : ""}`;
    }

    if (queueItems.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" class="text-center text-muted p-4">No patients are currently waiting for consultation.</td></tr>`;
        return;
    }

    tbody.innerHTML = queueItems.map(visit => {
        return `
            <tr>
                <td><strong>${escapeHtml(visit.patientName || 'N/A')}</strong></td>
                <td>${escapeHtml(visit.visitId || 'N/A')}</td>
                <td>
                    <span class="badge badge-${getStatusBadge(visit.status)}">${escapeHtml(visit.status)}</span>
                </td>
                <td><span class="badge badge-warning">${escapeHtml(visit.priority || 'Routine')}</span></td>
                <td class="text-right">
                    <button class="btn btn-sm btn-primary" data-visit-id="${visit.id}">Start Consultation</button>
                </td>
            </tr>
        `;
    }).join('');

    // Add event listeners to the new buttons
    tbody.querySelectorAll('button[data-visit-id]').forEach(button => {
        button.addEventListener('click', async () => {
            const visitId = button.getAttribute('data-visit-id');
            const visitData = queueItems.find(v => v.id === visitId);
            if (visitData) {
                // If status is not already IN_CONSULTATION, update it
                if (visitData.status !== 'IN_CONSULTATION') {
                    await updateDoc(doc(db, "opd", visitId), {
                        status: "IN_CONSULTATION",
                        consultationStart: serverTimestamp(),
                        updatedAt: serverTimestamp()
                    });
                    visitData.status = 'IN_CONSULTATION'; // Update local object
                }
                loadVisitForConsultation(visitData);
            }
        });
    });
}

function getStatusBadge(status) {
    if (!status) return "secondary";
    const s = status.toLowerCase();
    if (s === "registered") return "secondary";
    if (s === "checked_in") return "info";
    if (s === "waiting_triage") return "warning";
    if (s === "triaged") return "primary";
    if (s === "waiting_doctor") return "primary";
    if (s === "in_consultation") return "success"; // Highlight active consultation
    if (s === "services_pending") return "warning";
    // ... other statuses
    return "secondary";
}

// ─── Queue Refresh ───────────────────────────────────────────────────────────

/**
 * Sets up manual refresh button and auto-refresh for the doctor's queue.
 * The queue updates automatically so returned patients (e.g. after lab results)
 * appear without requiring a manual page reload.
 */
function setupQueueRefresh() {
    const refreshBtn = document.getElementById("refresh-consultation-queue");
    if (refreshBtn) {
        refreshBtn.addEventListener("click", async () => {
            await loadDoctorQueue();
            showToast("Queue refreshed.", "success");
        });
    }

    // Auto-refresh the queue every 30 seconds (only when no visit is active).
    setInterval(() => {
        const formContainer = document.getElementById("consultation-form-container");
        const isActiveConsultation = formContainer && formContainer.style.display !== "none";
        if (!isActiveConsultation) {
            loadDoctorQueue();
        }
    }, 30000);
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

        const select = document.getElementById("consultation-doctor");
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

// ─── Patient Search ───────────────────────────────────────────────────────────

/**
 * Sets up patient search functionality with autocomplete.
 */
function setupPatientSearch() {
    const searchInput = document.getElementById("consultation-patient-search");
    const patientIdInput = document.getElementById("consultation-patient-id");
    const startBtn = document.getElementById("start-consultation-btn");

    if (!searchInput) return;

    let searchTimeout;

    // Search on input with debounce
    searchInput.addEventListener("input", (e) => {
        clearTimeout(searchTimeout);
        const query = e.target.value.trim();

        if (query.length < 2) {
            patientIdInput.value = "";
            return;
        }

        searchTimeout = setTimeout(() => {
            searchPatients(query);
        }, 300);
    });

    // Start consultation button
    if (startBtn) {
        startBtn.addEventListener("click", () => {
            if (!patientIdInput.value) {
                showToast("Please select a patient first.", "error");
                return;
            }
            const doctorId = document.getElementById("consultation-doctor").value;
            if (!doctorId) {
                showToast("Please select a doctor.", "error");
                return;
            }
            // Show the consultation form
            document.getElementById("consultation-form-container").style.display = "block";
            // Scroll to the form
            document.getElementById("consultation-patient-id").value = patientIdInput.value;
            document.getElementById("consultation-doctor-id").value = doctorId;

            document.getElementById("consultation-form-container").scrollIntoView({ behavior: "smooth" });
        });
    }

    /**
     * Searches for patients matching the query.
     * @param {string} searchQuery
     */
    async function searchPatients(searchQuery) {
        const tenantId = getTenantId();
        if (!tenantId) return;

        try {
            const q = query(
                collection(db, "patients"),
                where("tenantId", "==", tenantId),
                where("name_lowercase", ">=", searchQuery.toLowerCase()),
                where("name_lowercase", "<=", searchQuery.toLowerCase() + "\uf8ff"),
                limit(10)
            );
            const snapshot = await getDocs(q);

            if (snapshot.empty) {
                // Try searching by patient ID
                const idQuery = query(
                    collection(db, "patients"),
                    where("tenantId", "==", tenantId),
                    where("patientId", ">=", searchQuery),
                    where("patientId", "<=", searchQuery + "\uf8ff")
                );
                const idSnapshot = await getDocs(idQuery);
                
                if (!idSnapshot.empty) {
                    showPatientSuggestions(idSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
                }
            } else {
                showPatientSuggestions(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
            }
        } catch (error) {
            debugError("Error searching patients:", error);
        }
    }

    /**
     * Shows patient suggestions in a dropdown.
     * @param {Array} patients
     */
    function showPatientSuggestions(patients) {
        // Remove existing suggestions
        const existing = document.querySelector(".patient-suggestions");
        if (existing) existing.remove();

        if (patients.length === 0) {
            return;
        }

        // Create suggestions dropdown
        const suggestions = document.createElement("div");
        suggestions.className = "patient-suggestions";
        suggestions.style.cssText = `
            position: absolute;
            top: 100%;
            left: 0;
            right: 0;
            background: white;
            border: 1px solid var(--color-gray-200);
            border-top: none;
            border-radius: 0 0 var(--border-radius-sm) var(--border-radius-sm);
            box-shadow: var(--shadow-md);
            max-height: 200px;
            overflow-y: auto;
            z-index: 1000;
            margin-top: 4px;
        `;

        patients.forEach(patient => {
            const item = document.createElement("div");
            item.style.cssText = `
                padding: 10px 12px;
                cursor: pointer;
                border-bottom: 1px solid var(--color-gray-100);
                transition: background-color var(--transition-fast);
            `;
            item.innerHTML = `
                <div style="font-weight: 500; color: var(--color-gray-900);">${escapeHtml(patient.name || "Unknown")}</div>
                <div style="font-size: var(--font-size-xs); color: var(--color-gray-500); margin-top: 2px;">
                    ${escapeHtml(patient.patientId || "")} • ${escapeHtml(patient.phone || "No phone")}
                </div>
            `;

            item.addEventListener("mouseenter", () => {
                item.style.backgroundColor = "var(--color-gray-50)";
            });

            item.addEventListener("mouseleave", () => {
                item.style.backgroundColor = "white";
            });

            item.addEventListener("click", () => {
                searchInput.value = patient.name || "";
                patientIdInput.value = patient.id;
                suggestions.remove();
            });

            suggestions.appendChild(item);
        });

        // Add suggestions to DOM
        const inputGroup = searchInput.parentElement;
        inputGroup.style.position = "relative";
        inputGroup.appendChild(suggestions);

        // Close on click outside
        setTimeout(() => {
            document.addEventListener("click", function closeSuggestions(e) {
                if (!inputGroup.contains(e.target)) {
                    suggestions.remove();
                    document.removeEventListener("click", closeSuggestions);
                }
            });
        }, 100);
    }
}

// ─── Medicine Options (searchable dropdown) ──────────────────────────────────

/**
 * Loads the tenant's medicines from Firestore and injects a shared <datalist>
 * so every prescription medicine input becomes a searchable dropdown.
 */
async function loadMedicineOptions() {
    const tenantId = getTenantId();
    if (!tenantId) return;

    try {
        const q = query(
            collection(db, "medicines"),
            where("tenantId", "==", tenantId)
        );
        const snapshot = await getDocs(q);
        availableMedicines = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        // Build/update the shared datalist element.
        let datalist = document.getElementById("medicines-datalist");
        if (!datalist) {
            datalist = document.createElement("datalist");
            datalist.id = "medicines-datalist";
            document.body.appendChild(datalist);
        }

        datalist.innerHTML = availableMedicines.map(med => {
            const label = med.name || "";
            const category = med.category ? ` (${med.category})` : "";
            return `<option value="${escapeHtml(label)}" label="${escapeHtml(label + category)}"></option>`;
        }).join("");

        debug("Medicine options loaded:", availableMedicines.length);
    } catch (error) {
        debugError("Error loading medicine options:", error);
    }
}

// ─── Form Setup ──────────────────────────────────────────────────────────────

function setupForm() {
    const form = document.getElementById("consultation-form");
    const submitBtn = document.getElementById("save-consultation-btn");
    const btnText = submitBtn.querySelector(".btn-text");
    const btnLoading = submitBtn.querySelector(".btn-loading");

    if (!form) return;

    form.addEventListener("submit", async (e) => {
        e.preventDefault();

        btnText.style.display = "none";
        btnLoading.style.display = "inline";
        submitBtn.disabled = true;

        try {
            await saveConsultation();
        } catch (error) {
            debugError("Consultation save error:", error);
            showToast(error.message || "Unable to save consultation. Please try again.", "error");
        } finally {
            btnText.style.display = "inline";
            btnLoading.style.display = "none";
            submitBtn.disabled = false;
        }
    });

    const decisionButtons = document.querySelectorAll("[data-consultation-action]");
    decisionButtons.forEach((button) => {
        button.addEventListener("click", () => {
            const action = button.dataset.consultationAction;
            const actionInput = document.getElementById("consultation-action");
            if (actionInput) {
                actionInput.value = action;
            }

            if (action === "admit") {
                handleAdmissionRequest();
                return;
            }

            if (action === "lab" || action === "prescribe" || action === "procedure" || action === "finish") {
                form.requestSubmit();
            }
        });
    });

    const admitBtn = document.getElementById("admit-patient-btn");
    if (admitBtn) {
        admitBtn.addEventListener("click", () => {
            const actionInput = document.getElementById("consultation-action");
            if (actionInput) actionInput.value = "admit";
            handleAdmissionRequest();
        });
    }
}

// ─── Save Consultation ───────────────────────────────────────────────────────

/**
 * Saves the consultation: encounter, diagnosis, prescriptions, and lab orders.
 */
async function saveConsultation() {
    debug("Saving consultation...");

    const tenantId = getTenantId();
    if (!tenantId) {
        throw new Error("No tenant ID found. Please log in again.");
    }

    const visitId = document.getElementById("consultation-visit-id").value;
    const patientId = document.getElementById("consultation-patient-id").value;
    let doctorId = document.getElementById("consultation-doctor-id").value;
    const consultationAction = document.getElementById("consultation-action")?.value || "finish";
    // Get doctor name from current user, as the dropdown might be hidden.
    const currentUser = getCurrentUser();
    if (!doctorId && currentUser?.uid) {
        doctorId = currentUser.uid;
        document.getElementById("consultation-doctor-id").value = doctorId;
    }
    const doctorName = currentUser?.displayName || "Unknown Doctor";
    
    const chiefComplaint = document.getElementById("chief-complaint").value.trim();
    const history = document.getElementById("history").value.trim();
    const examination = document.getElementById("examination").value.trim();
    const assessment = document.getElementById("assessment").value.trim();
    const treatmentPlan = document.getElementById("treatment-plan").value.trim();
    const diagnosis = document.getElementById("diagnosis").value.trim();

    if (!patientId || !diagnosis) {
        throw new Error("Please fill in all required fields.");
    }

    const prescriptionItems = collectPrescriptionItems();
    const labOrders = collectLabOrderItems();

    if (consultationAction === "prescribe" && prescriptionItems.length === 0) {
        throw new Error("Please add at least one medicine before prescribing.");
    }

    if (consultationAction === "lab" && labOrders.length === 0) {
        throw new Error("Please add at least one lab test before placing the order.");
    }

    if (consultationAction === "procedure" && !assessment && !treatmentPlan) {
        throw new Error("Please add a procedure note in the assessment or treatment plan.");
    }

    showLoading("Saving consultation...");

    // 1. Create Encounter
    const encounterRef = await addDoc(collection(db, "encounters"), {
        tenantId,
        patientId,
        visitId,
        doctorId,
        doctorName,
        type: "consultation",
        chiefComplaint: chiefComplaint || null,
        history: history || null,
        examination: examination || null,
        assessment: assessment || null,
        treatmentPlan: treatmentPlan || null,
        createdAt: serverTimestamp(),
        createdBy: getCurrentUser()?.uid || ""
    });
    debug("Encounter created:", encounterRef.id);

    // 2. Create Diagnosis
    const diagnosisRef = await addDoc(collection(db, "diagnoses"), {
        tenantId,
        patientId,
        visitId,
        doctorId,
        doctorName,
        diagnosis,
        type: "primary", // Assuming primary for now
        notes: assessment || null,
        status: "active",
        createdAt: serverTimestamp(),
        createdBy: getCurrentUser()?.uid || ""
    });
    debug("Diagnosis created:", diagnosisRef.id);

// 3. Create Prescriptions (if any)
    if (prescriptionItems.length > 0) {
        // Get patient's full name to store with the prescription so the
        // prescriptions list can display the patient name.
        let patientNameForRx = 'Unknown Patient';
        if (patientId) {
            const patientDoc = await getDoc(doc(db, "patients", patientId));
            if (patientDoc.exists()) {
                patientNameForRx = patientDoc.data().name || patientNameForRx;
            }
        }

        const prescriptionRef = await addDoc(collection(db, "prescriptions"), {
            tenantId,
            patientId,
            patientName: patientNameForRx,
            visitId,
            doctorId,
            doctorName,
            medicines: prescriptionItems,
            dosageInstructions: treatmentPlan || null,
            status: "pending",
            createdAt: serverTimestamp(),
            createdBy: getCurrentUser()?.uid || ""
        });
        debug("Prescription created:", prescriptionRef.id);

        // Log audit
        await addDoc(collection(db, "auditLogs"), {
            tenantId,
            userId: getCurrentUser()?.uid || "",
            action: "CREATE_PRESCRIPTION",
            module: "prescriptions",
            recordId: prescriptionRef.id,
            details: { patientId, medicineCount: prescriptionItems.length },
            createdAt: serverTimestamp()
        });
    }

// 4. Create Lab Orders (if any)
    let patientNameForOrder = 'Unknown Patient';
    if (patientId) {
        const patientDoc = await getDoc(doc(db, "patients", patientId));
        if (patientDoc.exists()) {
            patientNameForOrder = patientDoc.data().name;
        }
    }

    if (labOrders.length > 0) {
        // Group all tests ordered in this consultation into ONE lab order request.
        const tests = labOrders.map(o => ({
            testName: o.testName,
            notes: o.notes || null,
            status: "ordered"
        }));
        const testNameSummary = labOrders.map(o => o.testName).join(", ");

        const labOrderRef = await addDoc(collection(db, "labOrders"), {
            tenantId,
            patientId,
            visitId,
            patientName: patientNameForOrder,
            doctorId,
            doctorName,
            testName: testNameSummary, // comma-joined summary for display/backward-compat
            tests: tests,              // grouped array of tests
            testCount: tests.length,
            status: "ordered",
            priority: "normal",
            createdAt: serverTimestamp(),
            createdBy: getCurrentUser()?.uid || ""
        });
        debug("Grouped lab order created:", labOrderRef.id);

        // Log audit for the grouped order
        await addDoc(collection(db, "auditLogs"), {
            tenantId,
            userId: getCurrentUser()?.uid || "",
            action: "CREATE_LAB_ORDER",
            module: "labOrders",
            recordId: labOrderRef.id,
            details: { patientId, tests: tests.map(t => t.testName), testCount: tests.length },
            createdAt: serverTimestamp()
        });
    }

// 4b. Create Billable Items (Consultation fee + Lab tests + Prescribed medicines)
    await createBillableItems({
        tenantId,
        patientId,
        visitId,
        patientName: patientNameForOrder,
        labCount: labOrders.length,
        labTestNames: labOrders.map(o => o.testName),
        prescriptionItems: prescriptionItems
    });

    // 5. Create Procedure Request if selected as a branch action
    if (consultationAction === "procedure") {
        const procedureDetails = (assessment || treatmentPlan || diagnosis || "Procedure requested").trim();
        const procedureDoc = await addDoc(collection(db, "procedureRequests"), {
            tenantId,
            patientId,
            visitId,
            doctorId,
            doctorName,
            procedureName: procedureDetails,
            notes: procedureDetails,
            status: "requested",
            createdAt: serverTimestamp(),
            createdBy: getCurrentUser()?.uid || ""
        });

        await addDoc(collection(db, "auditLogs"), {
            tenantId,
            userId: getCurrentUser()?.uid || "",
            action: "CREATE_PROCEDURE_REQUEST",
            module: "procedureRequests",
            recordId: procedureDoc.id,
            details: { patientId, doctorId, notes: procedureDetails },
            createdAt: serverTimestamp()
        });
    }

    // 6. Update Visit Status
    if (visitId) {
        let newStatus = "BILLING_PENDING";

        if (consultationAction === "admit") {
            newStatus = "ADMISSION_REQUESTED";
        } else if (consultationAction === "procedure" || consultationAction === "lab" || consultationAction === "prescribe" || prescriptionItems.length > 0 || labOrders.length > 0) {
            newStatus = "SERVICES_PENDING";
        }

        await updateDoc(doc(db, "opd", visitId), { status: newStatus, updatedAt: serverTimestamp() });
    }

    // 5. Log main consultation audit
    await addDoc(collection(db, "auditLogs"), {
        tenantId,
        userId: getCurrentUser()?.uid || "",
        action: "CREATE_CONSULTATION",
        module: "consultation",
        recordId: encounterRef.id,
        details: { patientId, doctorId, diagnosis },
        createdAt: serverTimestamp()
    });

hideLoading();
    showToast("Consultation saved successfully!", "success");

    resetConsultationForm();

    // If there is a doctor's queue on this page, remove the completed visit
    // from it and refresh so the doctor can continue with the next patient
    // without any page redirect.
    if (visitId) {
        const completedVisit = document.querySelector(`#doctor-queue-tbody tr[data-visit-id="${visitId}"]`);
        if (completedVisit) completedVisit.remove();
    }
    if (currentVisit) {
        currentVisit = null;
    }
    if (typeof loadDoctorQueue === "function") {
        loadDoctorQueue();
    }
}

/**
 * Resets the consultation form fields and dynamic item rows so the page is
 * ready for the next patient while staying on the same page (no redirect).
 */
function resetConsultationForm() {
    const form = document.getElementById("consultation-form");
    if (form) form.reset();

    // Clear hidden fields
    const visitIdInput = document.getElementById("consultation-visit-id");
    const patientIdInput = document.getElementById("consultation-patient-id");
    const actionInput = document.getElementById("consultation-action");
    if (visitIdInput) visitIdInput.value = "";
    if (patientIdInput) patientIdInput.value = "";
    if (actionInput) actionInput.value = "finish";

    // Clear dynamic prescription/lab rows.
    const rxContainer = document.getElementById("prescription-items");
    if (rxContainer) {
        rxContainer.querySelectorAll(".form-row").forEach(row => row.remove());
    }
    const labContainer = document.getElementById("lab-order-items");
    if (labContainer) {
        labContainer.querySelectorAll(".form-row").forEach(row => row.remove());
    }
    prescriptionItemCount = 0;
    labOrderItemCount = 0;

// Hide the consultation form so the doctor lands back on the queue.
    const formContainer = document.getElementById("consultation-form-container");
    if (formContainer) formContainer.style.display = "none";
    const doctorQueue = document.getElementById("doctor-queue-container");
    if (doctorQueue) doctorQueue.style.display = "block";

    // Hide the Patient Information panel so no patient data remains on the page
    // after a consultation is saved.
    const infoPanel = document.getElementById("patient-info-panel");
    if (infoPanel) infoPanel.style.display = "none";

    // Clear the trial Chief Complaint display so it doesn't linger for the next
    // patient loaded on this page.
    const infoChiefComplaintEl = document.getElementById("info-chief-complaint");
    if (infoChiefComplaintEl) {
        infoChiefComplaintEl.textContent = "—";
        infoChiefComplaintEl.style.fontWeight = "";
        infoChiefComplaintEl.style.color = "";
    }
}

// ─── Prescription Items ──────────────────────────────────────────────────────

/**
 * Adds a new prescription item row.
 */
window.addPrescriptionItem = function() {
    prescriptionItemCount++;
    const container = document.getElementById("prescription-items");
    const newItem = document.createElement("div");
    newItem.className = "form-row";
    newItem.id = `prescription-item-${prescriptionItemCount}`;
newItem.innerHTML = `
        <div class="form-group" style="flex: 2;">
            <input type="text" id="med-name-${prescriptionItemCount}" class="form-input" list="medicines-datalist" placeholder="Medicine name (type to search)">
        </div>
        <div class="form-group" style="flex: 1;">
            <input type="text" id="med-dosage-${prescriptionItemCount}" class="form-input" placeholder="e.g. 500mg">
        </div>
        <div class="form-group" style="flex: 1;">
            <input type="text" id="med-frequency-${prescriptionItemCount}" class="form-input" placeholder="e.g. BID">
        </div>
        <div class="form-group" style="flex: 0 0 40px;">
            <input type="number" id="med-duration-${prescriptionItemCount}" class="form-input" placeholder="7">
        </div>
        <div class="form-group" style="flex: 0 0 100px;">
            <button type="button" class="btn btn-error btn-sm" onclick="removePrescriptionItem(${prescriptionItemCount})" style="width: 100%;"><svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
        </div>
    `;
    container.appendChild(newItem);
};

/**
 * Removes a prescription item row.
 * @param {number} index
 */
window.removePrescriptionItem = function(index) {
    const item = document.getElementById(`prescription-item-${index}`);
    if (item) {
        item.remove();
    }
};

/**
 * Collects all prescription items from the form.
 * @returns {Array}
 */
function collectPrescriptionItems() {
    const prescriptions = [];
    const container = document.getElementById("prescription-items");
    if (!container) return prescriptions;

    const items = container.querySelectorAll(".form-row");
    items.forEach((item) => {
        const index = item.id.split("-").pop();
        const name = document.getElementById(`med-name-${index}`)?.value.trim();
        const dosage = document.getElementById(`med-dosage-${index}`)?.value.trim();
        const frequency = document.getElementById(`med-frequency-${index}`)?.value.trim();
        const duration = document.getElementById(`med-duration-${index}`)?.value.trim();

        if (name) {
            prescriptions.push({
                name,
                dosage: dosage || null,
                frequency: frequency || null,
                duration: duration ? parseInt(duration) : null
            });
        }
    });

    return prescriptions;
}

// ─── Lab Order Items ─────────────────────────────────────────────────────────

/**
 * Adds a new lab order item row.
 */
window.addLabOrderItem = function() {
    labOrderItemCount++;
    const container = document.getElementById("lab-order-items");
    const newItem = document.createElement("div");
    newItem.className = "form-row";
    newItem.id = `lab-order-${labOrderItemCount}`;
    newItem.innerHTML = `
        <div class="form-group" style="flex: 3;">
            <input type="text" id="lab-test-${labOrderItemCount}" class="form-input" placeholder="e.g. CBC, Blood Sugar">
        </div>
        <div class="form-group" style="flex: 2;">
            <input type="text" id="lab-notes-${labOrderItemCount}" class="form-input" placeholder="Additional notes">
        </div>
        <div class="form-group" style="flex: 0 0 40px;">
            <button type="button" class="btn btn-error btn-sm" onclick="removeLabOrderItem(${labOrderItemCount})" style="width: 100%;"><svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
        </div>
    `;
    container.appendChild(newItem);
};

/**
 * Removes a lab order item row.
 * @param {number} index
 */
window.removeLabOrderItem = function(index) {
    const item = document.getElementById(`lab-order-${index}`);
    if (item) {
        item.remove();
    }
};

/**
 * Collects all lab order items from the form.
 * @returns {Array}
 */
function collectLabOrderItems() {
    const labOrders = [];
    const container = document.getElementById("lab-order-items");
    if (!container) return labOrders;

    const items = container.querySelectorAll(".form-row");
    items.forEach((item) => {
        const index = item.id.split("-").pop();
        const testName = document.getElementById(`lab-test-${index}`)?.value.trim();
        const notes = document.getElementById(`lab-notes-${index}`)?.value.trim();

        if (testName) {
            labOrders.push({
                testName,
                notes: notes || null
            });
        }
    });

    return labOrders;
}

// ─── Cancel Consultation ─────────────────────────────────────────────────────

/**
 * Cancels the consultation and returns to OPD.
 */
window.cancelConsultation = function() {
    window.location.href = "opd.html";
};

/**
 * Handles the request to admit a patient.
 */
async function handleAdmissionRequest() {
    if (!currentVisit) {
        showToast("No active visit to admit.", "error");
        return;
    }

    showLoading("Requesting Admission...");

    try {
        // Update the OPD visit status to indicate an admission has been requested.
        await updateDoc(doc(db, "opd", currentVisit.id), {
            status: "ADMISSION_REQUESTED",
            updatedAt: serverTimestamp()
        });

        debug("Requesting admission for visit:", currentVisit.id);
        // Redirect to admission creation page, passing patient and visit info
        window.location.href = `admission-create.html?visitId=${currentVisit.id}&patientId=${currentVisit.patientId}`;
    } catch (error) {
        debugError("Error requesting admission:", error);
        showToast("Failed to request admission. Please try again.", "error");
    } finally {
        hideLoading();
    }
}

// ─── Billing: Billable Items ─────────────────────────────────────────────────

/**
 * Creates billable items for a visit so the invoice can be itemized.
 * Always adds a Consultation fee (qty 1), plus one item per lab test ordered.
 * Unit prices: consultation fee is pulled from tenant settings; lab test prices
 * are left at 0 so billing staff can fill them in at billing time.
 * @param {Object} params
 */
async function createBillableItems({ tenantId, patientId, visitId, patientName, labCount, labTestNames, prescriptionItems }) {
    try {
        if (!tenantId || !visitId) {
            debug("createBillableItems: missing tenantId/visitId, skipping.");
            return;
        }

        // Fetch the consultation fee from tenant settings.
        let consultationFee = 0;
        try {
            const settingsQuery = query(
                collection(db, "settings"),
                where("tenantId", "==", tenantId),
                limit(1)
            );
            const settingsSnap = await getDocs(settingsQuery);
            if (!settingsSnap.empty) {
                const settings = settingsSnap.docs[0].data();
                consultationFee = settings.consultationFee || 0;
            }
        } catch (e) {
            debugError("Error fetching consultation fee:", e);
        }

let itemCount = 0;

        // 1. Consultation fee line item (single fee, price prefilled from settings).
        //    Only add it once per visit — subsequent saves for the same visit
        //    (e.g. prescribing later, then finishing) must NOT create a duplicate.
        let consultationFeeExists = false;
        try {
            const existingQuery = query(
                collection(db, "billableItems"),
                where("tenantId", "==", tenantId),
                where("visitId", "==", visitId),
                where("source", "==", "consultation")
            );
            const existingSnap = await getDocs(existingQuery);
            consultationFeeExists = !existingSnap.empty;
        } catch (e) {
            debugError("Error checking existing consultation fee:", e);
        }

        if (!consultationFeeExists) {
            await addDoc(collection(db, "billableItems"), {
                tenantId,
                patientId,
                patientName: patientName || "Unknown Patient",
                visitId,
                description: "Consultation Fee",
                qty: 1,
                unitPrice: consultationFee,
                amount: consultationFee,
                source: "consultation",
                createdAt: serverTimestamp(),
                createdBy: getCurrentUser()?.uid || ""
            });
            itemCount++;
        }

// 2. Lab test line items (price filled in at billing).
        if (labTestNames && labTestNames.length > 0) {
            for (const testName of labTestNames) {
                await addDoc(collection(db, "billableItems"), {
                    tenantId,
                    patientId,
                    patientName: patientName || "Unknown Patient",
                    visitId,
                    description: `Lab Test: ${testName}`,
                    qty: 1,
                    unitPrice: 0,
                    amount: 0,
                    source: "lab",
                    createdAt: serverTimestamp(),
                    createdBy: getCurrentUser()?.uid || ""
                });
                itemCount++;
            }
        }

        // 3. Prescribed medicine line items (unit price prefilled from the
        //    medicines collection's configured price).
        if (prescriptionItems && prescriptionItems.length > 0) {
            // Build a lookup of medicine name -> price from the tenant's medicines.
            const medicinePriceMap = {};
            try {
                const medQuery = query(
                    collection(db, "medicines"),
                    where("tenantId", "==", tenantId)
                );
                const medSnap = await getDocs(medQuery);
                medSnap.forEach(medDoc => {
                    const medData = medDoc.data();
                    if (medData && medData.name) {
                        medicinePriceMap[medData.name.toLowerCase()] = parseFloat(medData.price) || 0;
                    }
                });
            } catch (e) {
                debugError("Error loading medicine prices:", e);
            }

            for (const med of prescriptionItems) {
                const medDesc = med.dosage ? `${med.name} (${med.dosage})` : med.name;
                const unitPrice = medicinePriceMap[String(med.name || "").toLowerCase()] || 0;
                const qty = (med.duration && parseInt(med.duration) > 0) ? parseInt(med.duration) : 1;
                await addDoc(collection(db, "billableItems"), {
                    tenantId,
                    patientId,
                    patientName: patientName || "Unknown Patient",
                    visitId,
                    description: `Medicine: ${medDesc}`,
                    qty: qty,
                    unitPrice: unitPrice,
                    amount: qty * unitPrice,
                    source: "medicine",
                    createdAt: serverTimestamp(),
                    createdBy: getCurrentUser()?.uid || ""
                });
                itemCount++;
            }
        }

        debug("Billable items created:", itemCount);
    } catch (error) {
        debugError("Error creating billable items:", error);
    }
}

/**
 * Returns a short description for the consultation fee line item.
 * @returns {string}
 */
function consultationActionDescription() {
    const actionEl = document.getElementById("consultation-action");
    const action = actionEl ? actionEl.value : "finish";
    if (action === "lab") return "Consultation Fee (with Lab Order)";
    if (action === "prescribe") return "Consultation Fee (with Prescription)";
    if (action === "procedure") return "Consultation Fee (with Procedure)";
    return "Consultation Fee";
}

// ─── Helper Functions ────────────────────────────────────────────────────────

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

export { saveConsultation };
