﻿/**
﻿﻿/**
 * PRINCE ALEX DIGITAL HMS — Patient Profile Module
 * 
 * Handles:
 * - Loading patient data from Firestore
 * - Tab navigation (Overview, Medical History, Appointments, etc.)
 * - Loading related data for each tab
 * - Edit patient functionality
 */

import { db, doc, getDoc, collection, query, where, getDocs, orderBy, updateDoc, serverTimestamp, addDoc } from "./firebase-config.js";
import { requireAuth } from "./auth-guard.js";
import { loadSidebar } from "./sidebar.js";
import { showToast, showLoading, hideLoading, showConfirm } from "./notifications.js";
import { debug, debugError } from "./debug.js";
import { icon } from "./icons.js";
import { getTenantId, getCurrentUser, hasPermission, PERMISSIONS, hasRole } from "./permissions.js";

// ─── Global State ────────────────────────────────────────────────────────────

let currentPatient = null;
let currentPatientId = null;

// ─── Initialize Profile Page ─────────────────────────────────────────────────

document.addEventListener("DOMContentLoaded", async () => {
    debug("Patient profile page: Initializing...");

    showLoading("Loading patient profile...");

    try {
        // Require authentication
        const user = await requireAuth();
        if (!user) return;

        // Load shared components
        await loadSidebar();
        
        // Get patient ID from URL
        const urlParams = new URLSearchParams(window.location.search);
        currentPatientId = urlParams.get("id");

        if (!currentPatientId) {
            showToast("No patient ID provided. Redirecting to patients list.", "error");
            window.location.href = "patients.html";
            return;
        }

        // Load patient data
        await loadPatient(currentPatientId);

        // Set up tab navigation
        setupTabs();

        // Set up edit button
        setupEditButton();

        // Set up start visit button
        setupStartVisitButton();
        setupRoleBasedButtons();
        document.getElementById("download-records-btn")?.addEventListener("click", downloadMedicalRecords);

        hideLoading();
        debug("Patient profile page: Initialization complete.");
    } catch (error) {
        debugError("Profile page initialization error:", error);
        hideLoading();
        showToast("Unable to load patient profile. Please try again.", "error");
    }
});

// ─── Load Patient ────────────────────────────────────────────────────────────

/**
 * Loads a single patient from Firestore by document ID.
 * @param {string} patientId - The Firestore document ID
 */
async function loadPatient(patientId) {
    debug("Loading patient:", patientId);
    const tenantId = getTenantId();
    if (!tenantId) return;

    try {
        const patientDoc = await getDoc(doc(db, "patients", patientId));

        if (!patientDoc.exists()) {
            showToast("Patient not found.", "error");
            window.location.href = "patients.html";
            return;
        }

        currentPatient = { id: patientDoc.id, ...patientDoc.data() };

        // Verify tenant access
        if (currentPatient.tenantId !== tenantId) {
            debugError("Tenant mismatch for patient:", patientId);
            showToast("Access denied.", "error");
            window.location.href = "patients.html";
            return;
        }

        debug("Patient loaded:", currentPatient);
        renderPatientHeader();
        renderOverviewTab();
    } catch (error) {
        debugError("Error loading patient:", error);
        showToast("Unable to load patient data. Please try again.", "error");
    }
}

// ─── Render Patient Header ───────────────────────────────────────────────────

/**
 * Renders the patient header card with basic info.
 */
function renderPatientHeader() {
    if (!currentPatient) return;

    const fullName = `${currentPatient.firstName || ""} ${currentPatient.lastName || ""}`.trim();
    const age = calculateAge(currentPatient.dateOfBirth);
    const genderLabel = formatGender(currentPatient.gender);

    // Header card
document.getElementById("profile-patient-name").textContent = fullName;
    document.getElementById("profile-patient-id").textContent = `Patient ID: ${currentPatient.patientId || "—"}`;
    document.getElementById("profile-patient-dob").textContent = `DOB: ${formatDate(currentPatient.dateOfBirth)} (${age})`;
    document.getElementById("profile-gender").textContent = genderLabel;
    document.getElementById("profile-blood-group").textContent = currentPatient.bloodGroup || "—";
    
    // Status badge
    const statusEl = document.getElementById("profile-patient-status");
    if (statusEl) {
        const status = (currentPatient.status || "active").toLowerCase();
        const badgeMap = { active: "success", inactive: "secondary", deceased: "error" };
        statusEl.textContent = (currentPatient.status || "Active");
        statusEl.className = `badge badge-${badgeMap[status] || "secondary"}`;
    }

    // Avatar initials
    const avatar = document.getElementById("profile-avatar");
    if (avatar) {
        avatar.textContent = getInitials(fullName);
    }
}

// ─── Render Overview Tab ─────────────────────────────────────────────────────

/**
 * Renders the overview tab with patient details.
 */
function renderOverviewTab() {
    if (!currentPatient) return;
    const content = getTabContent("overview");
    if (!content) return;

const allergies = currentPatient.allergies && currentPatient.allergies.length > 0 ? currentPatient.allergies.join(", ") : "None recorded";
    const chronic = currentPatient.chronicConditions && currentPatient.chronicConditions.length > 0 ? currentPatient.chronicConditions.join(", ") : "None recorded";
    const medicalAlerts = currentPatient.medicalAlerts && currentPatient.medicalAlerts.length > 0 ? currentPatient.medicalAlerts.join(", ") : "None recorded";
    const nextOfKin = currentPatient.nextOfKin || {};
    const insurance = currentPatient.insurance || {};
    const fullName = `${currentPatient.firstName || ""} ${currentPatient.middleName || ""} ${currentPatient.lastName || ""}`.replace(/\s+/g, ' ').trim();
    const addressLine = [currentPatient.address, currentPatient.city, currentPatient.county, currentPatient.postalCode].filter(Boolean).join(", ") || "—";
    const dateOfBirth = formatDate(currentPatient.dateOfBirth);
    const age = calculateAge(currentPatient.dateOfBirth);

    content.innerHTML = `
        <div class="profile-details-grid">
            <div class="detail-section">
                <h3 class="detail-section-title">Personal Information</h3>
<div class="detail-item">
                    <span class="detail-icon">${icon('user', '18')}</span>
                    <span class="detail-label">Full Name</span>
                    <span class="detail-value">${escapeHtml(fullName || "—")}</span>
                </div>
                <div class="detail-item">
                    <span class="detail-icon">${icon('appointments', '18')}</span>
                    <span class="detail-label">Date of Birth</span>
                    <span class="detail-value">${escapeHtml(dateOfBirth)} (${escapeHtml(age)})</span>
                </div>
                <div class="detail-item">
                    <span class="detail-icon">${icon('file', '18')}</span>
                    <span class="detail-label">National ID</span>
                    <span class="detail-value">${escapeHtml(currentPatient.nationalId || "—")}</span>
                </div>
            </div>
            <div class="detail-section">
                <h3 class="detail-section-title">Contact Information</h3>
                <div class="detail-item">
                    <span class="detail-icon">${icon('phone', '18')}</span>
                    <span class="detail-label">Phone</span>
                    <span class="detail-value">${escapeHtml(currentPatient.phone || "—")}</span>
                </div>
                <div class="detail-item">
                    <span class="detail-icon">${icon('mail', '18')}</span>
                    <span class="detail-label">Email</span>
                    <span class="detail-value">${escapeHtml(currentPatient.email || "—")}</span>
                </div>
                <div class="detail-item">
                    <span class="detail-icon">${icon('map-pin', '18')}</span>
                    <span class="detail-label">Address</span>
                    <span class="detail-value">${escapeHtml(addressLine)}</span>
                </div>
            </div>
            <div class="detail-section">
                <h3 class="detail-section-title">Medical Information</h3>
<div class="detail-item">
                    <span class="detail-icon">${icon('info', '18')}</span>
                    <span class="detail-label">Blood Group</span>
                    <span class="detail-value">${escapeHtml(currentPatient.bloodGroup || "—")}</span>
                </div>
                <div class="detail-item">
                    <span class="detail-icon">${icon('alert-triangle', '18')}</span>
                    <span class="detail-label">Allergies</span>
                    <span class="detail-value">${escapeHtml(allergies)}</span>
                </div>
                <div class="detail-item">
                    <span class="detail-icon">${icon('activity', '18')}</span>
                    <span class="detail-label">Chronic Conditions</span>
                    <span class="detail-value">${escapeHtml(chronic)}</span>
                </div>
                <div class="detail-item">
                    <span class="detail-icon">${icon('warning', '18')}</span>
                    <span class="detail-label">Medical Alerts</span>
                    <span class="detail-value">${escapeHtml(medicalAlerts)}</span>
                </div>
            </div>
            <div class="detail-section">
                <h3 class="detail-section-title">Next of Kin</h3>
                <div class="detail-item">
                    <span class="detail-icon">${icon('user', '18')}</span>
                    <span class="detail-label">Name</span>
                    <span class="detail-value">${escapeHtml(nextOfKin.name || "—")}</span>
                </div>
                <div class="detail-item">
                    <span class="detail-icon">${icon('users', '18')}</span>
                    <span class="detail-label">Relationship</span>
                    <span class="detail-value">${escapeHtml(nextOfKin.relationship || "—")}</span>
                </div>
                <div class="detail-item">
                    <span class="detail-icon">${icon('phone', '18')}</span>
                    <span class="detail-label">Phone</span>
                    <span class="detail-value">${escapeHtml(nextOfKin.phone || "—")}</span>
                </div>
            </div>
            <div class="detail-section">
<h3 class="detail-section-title">Insurance Information</h3>
                <div class="detail-item">
                    <span class="detail-icon">${icon('briefcase', '18')}</span>
                    <span class="detail-label">Provider</span>
                    <span class="detail-value">${escapeHtml(insurance.provider || "—")}</span>
                </div>
                <div class="detail-item">
                    <span class="detail-icon">${icon('key', '18')}</span>
                    <span class="detail-label">Membership Number</span>
                    <span class="detail-value">${escapeHtml(insurance.memberNumber || "—")}</span>
                </div>
            </div>
        </div>
    `;
}
// ─── Tab Navigation ──────────────────────────────────────────────────────────

/**
 * Sets up tab navigation for the patient profile.
 * Dynamically creates a content container for each tab so that every tab
 * has a place to render its data (previously only "overview" had one, which
 * caused all the other tabs to appear blank).
 */
function setupTabs() {
    const tabButtons = document.querySelectorAll(".tab-btn");
    const tabContentsContainer = document.getElementById("patient-tabs-content");

    // Ensure a .tab-content div exists for every tab button.
    tabButtons.forEach((button) => {
        const tabName = button.getAttribute("data-tab");
        if (!tabContentsContainer) return;

        let existing = tabContentsContainer.querySelector(`[data-tab-content="${tabName}"]`);
        if (!existing) {
            existing = document.createElement("div");
            existing.className = "tab-content";
            existing.setAttribute("data-tab-content", tabName);
            existing.style.display = "none";
            tabContentsContainer.appendChild(existing);
        }

        button.addEventListener("click", () => {
            const clickedTab = button.getAttribute("data-tab");

            // Update active button
            tabButtons.forEach(btn => btn.classList.remove("active"));
            button.classList.add("active");

            // Show the clicked tab's content, hide all others
            const allContents = tabContentsContainer.querySelectorAll(".tab-content");
            allContents.forEach(content => {
                const isActive = content.getAttribute("data-tab-content") === clickedTab;
                content.classList.toggle("active", isActive);
                content.style.display = isActive ? "block" : "none";
            });

            // Load tab-specific data
            loadTabData(clickedTab);
        });
    });
}

/**
 * Loads data for a specific tab.
 * @param {string} tabName
 */
async function loadTabData(tabName) {
    debug("Loading tab data:", tabName);

    switch (tabName) {
        case "medical-history":
            await loadMedicalHistory();
            break;
        case "appointments":
            await loadPatientAppointments();
            break;
        case "encounters":
            await loadPatientEncounters();
            break;
        case "vitals":
            await loadPatientVitals();
            break;
        case "diagnoses":
            await loadPatientDiagnoses();
            break;
        case "prescriptions":
            await loadPatientPrescriptions();
            break;
        case "laboratory":
            await loadPatientLabResults();
            break;
        case "admissions":
            await loadPatientAdmissions();
            break;
        case "billing":
            await loadPatientInvoices();
            break;
        case "payments":
            await loadPatientPayments();
            break;
        case "documents":
            await loadPatientDocuments();
            break;
    }
}

// ─── Tab Data Loaders ────────────────────────────────────────────────────────

/**
 * Loads medical history (diagnoses and encounters).
 */
async function loadMedicalHistory() {
    const content = getTabContent("medical-history");
    if (!content || !currentPatient) return;

    showLoading("Loading medical history...");
    const tenantId = getTenantId();

    try {
        // Load diagnoses
        const diagnosesQuery = query(
            collection(db, "diagnoses"),
            where("tenantId", "==", tenantId),
            where("patientId", "==", currentPatient.id),
            orderBy("createdAt", "desc")
        );
        const diagnosesSnap = await getDocs(diagnosesQuery);

        // Load encounters
        const encountersQuery = query(
            collection(db, "encounters"),
            where("tenantId", "==", tenantId),
            where("patientId", "==", currentPatient.id),
            orderBy("createdAt", "desc")
        );
        const encountersSnap = await getDocs(encountersQuery);

        let html = '<div class="form-section"><div class="form-section-title">Diagnoses</div>';
        if (diagnosesSnap.empty) {
            html += '<p class="text-muted">No diagnoses recorded.</p>';
        } else {
            html += '<table class="table table-sm"><thead><tr><th>Date</th><th>Diagnosis</th><th>Doctor</th><th>Notes</th></tr></thead><tbody>';
            diagnosesSnap.forEach((doc) => {
                const d = doc.data();
                html += `<tr>
                    <td>${formatDate(d.createdAt)}</td>
                    <td>${escapeHtml(d.diagnosis || "")}</td>
                    <td>${escapeHtml(d.doctorName || "")}</td>
                    <td>${escapeHtml(d.notes || "")}</td>
                </tr>`;
            });
            html += '</tbody></table>';
        }
        html += '</div>';

        html += '<div class="form-section"><div class="form-section-title">Encounters</div>';
        if (encountersSnap.empty) {
            html += '<p class="text-muted">No encounters recorded.</p>';
        } else {
            html += '<table class="table table-sm"><thead><tr><th>Date</th><th>Type</th><th>Doctor</th><th>Notes</th></tr></thead><tbody>';
            encountersSnap.forEach((doc) => {
                const e = doc.data();
                html += `<tr>
                    <td>${formatDate(e.createdAt)}</td>
                    <td>${escapeHtml(e.type || "")}</td>
                    <td>${escapeHtml(e.doctorName || "")}</td>
                    <td>${escapeHtml(e.notes || "")}</td>
                </tr>`;
            });
            html += '</tbody></table>';
        }
        html += '</div>';

        content.innerHTML = html;
        hideLoading();
    } catch (error) {
        debugError("Error loading medical history:", error);
        content.innerHTML = '<p class="text-error">Unable to load medical history.</p>';
        hideLoading();
    }
}

/**
 * Loads patient appointments.
 */
async function loadPatientAppointments() {
    const content = getTabContent("appointments");
    if (!content || !currentPatient) return;

    showLoading("Loading appointments...");
    const tenantId = getTenantId();

    try {
        const q = query(
            collection(db, "appointments"),
            where("tenantId", "==", tenantId),
            where("patientId", "==", currentPatient.id),
            orderBy("date", "desc")
        );
        const snapshot = await getDocs(q);

        if (snapshot.empty) {
            content.innerHTML = '<p class="text-muted">No appointments found.</p>';
        } else {
            let html = '<table class="table table-sm"><thead><tr><th>Date</th><th>Time</th><th>Doctor</th><th>Status</th></tr></thead><tbody>';
            snapshot.forEach((doc) => {
                const a = doc.data();
                html += `<tr>
                    <td>${formatDate(a.date)}</td>
                    <td>${a.timeSlot || "—"}</td>
                    <td>${escapeHtml(a.doctorName || "")}</td>
                    <td><span class="badge badge-${getStatusBadge(a.status)}">${escapeHtml(a.status || "")}</span></td>
                </tr>`;
            });
            html += '</tbody></table>';
            content.innerHTML = html;
        }
        hideLoading();
    } catch (error) {
        debugError("Error loading appointments:", error);
        content.innerHTML = '<p class="text-error">Unable to load appointments.</p>';
        hideLoading();
    }
}

/**
 * Loads patient encounters.
 */
async function loadPatientEncounters() {
    const content = getTabContent("encounters");
    if (!content || !currentPatient) return;

    showLoading("Loading encounters...");
    const tenantId = getTenantId();

    try {
        const q = query(
            collection(db, "encounters"),
            where("tenantId", "==", tenantId),
            where("patientId", "==", currentPatient.id),
            orderBy("createdAt", "desc")
        );
        const snapshot = await getDocs(q);

        if (snapshot.empty) {
            content.innerHTML = '<p class="text-muted">No encounters found.</p>';
        } else {
            let html = '<table class="table table-sm"><thead><tr><th>Date</th><th>Type</th><th>Doctor</th><th>Notes</th></tr></thead><tbody>';
            snapshot.forEach((doc) => {
                const e = doc.data();
                html += `<tr>
                    <td>${formatDate(e.createdAt)}</td>
                    <td>${escapeHtml(e.type || "")}</td>
                    <td>${escapeHtml(e.doctorName || "")}</td>
                    <td>${escapeHtml(e.notes || "")}</td>
                </tr>`;
            });
            html += '</tbody></table>';
            content.innerHTML = html;
        }
        hideLoading();
    } catch (error) {
        debugError("Error loading encounters:", error);
        content.innerHTML = '<p class="text-error">Unable to load encounters.</p>';
        hideLoading();
    }
}

/**
 * Loads patient vitals.
 */
async function loadPatientVitals() {
    const content = getTabContent("vitals");
    if (!content || !currentPatient) return;

    showLoading("Loading vitals...");
    const tenantId = getTenantId();

    try {
        const q = query(
            collection(db, "vitals"),
            where("tenantId", "==", tenantId),
            where("patientId", "==", currentPatient.id),
            orderBy("createdAt", "desc")
        );
        const snapshot = await getDocs(q);

        if (snapshot.empty) {
            content.innerHTML = '<p class="text-muted">No vitals recorded.</p>';
        } else {
            let html = '<table class="table table-sm"><thead><tr><th>Date</th><th>BP (mmHg)</th><th>Heart Rate</th><th>Temperature</th><th>Height</th><th>Weight</th><th>Recorded By</th></tr></thead><tbody>';
            snapshot.forEach((doc) => {
                const v = doc.data();
                html += `<tr>
                    <td>${formatDate(v.createdAt)}</td>
                    <td>${v.bloodPressure ? `${v.bloodPressure.systolic}/${v.bloodPressure.diastolic}` : "—"}</td>
                    <td>${v.heartRate || "—"}</td>
                    <td>${v.temperature || "—"}°C</td>
                    <td>${v.height || "—"}</td>
                    <td>${v.weight || "—"}</td>
                    <td>${escapeHtml(v.recordedBy || "")}</td>
                </tr>`;
            });
            html += '</tbody></table>';
            content.innerHTML = html;
        }
        hideLoading();
    } catch (error) {
        debugError("Error loading vitals:", error);
        content.innerHTML = '<p class="text-error">Unable to load vitals.</p>';
        hideLoading();
    }
}

/**
 * Loads patient diagnoses.
 */
async function loadPatientDiagnoses() {
    const content = getTabContent("diagnoses");
    if (!content || !currentPatient) return;

    showLoading("Loading diagnoses...");
    const tenantId = getTenantId();

    try {
        const q = query(
            collection(db, "diagnoses"),
            where("tenantId", "==", tenantId),
            where("patientId", "==", currentPatient.id),
            orderBy("createdAt", "desc")
        );
        const snapshot = await getDocs(q);

        if (snapshot.empty) {
            content.innerHTML = '<p class="text-muted">No diagnoses recorded.</p>';
        } else {
            let html = '<table class="table table-sm"><thead><tr><th>Date</th><th>Diagnosis</th><th>Type</th><th>Doctor</th><th>Notes</th></tr></thead><tbody>';
            snapshot.forEach((doc) => {
                const d = doc.data();
                html += `<tr>
                    <td>${formatDate(d.createdAt)}</td>
                    <td>${escapeHtml(d.diagnosis || "")}</td>
                    <td>${escapeHtml(d.type || "")}</td>
                    <td>${escapeHtml(d.doctorName || "")}</td>
                    <td>${escapeHtml(d.notes || "")}</td>
                </tr>`;
            });
            html += '</tbody></table>';
            content.innerHTML = html;
        }
        hideLoading();
    } catch (error) {
        debugError("Error loading diagnoses:", error);
        content.innerHTML = '<p class="text-error">Unable to load diagnoses.</p>';
        hideLoading();
    }
}

/**
 * Loads patient prescriptions.
 */
async function loadPatientPrescriptions() {
    const content = getTabContent("prescriptions");
    if (!content || !currentPatient) return;

    showLoading("Loading prescriptions...");
    const tenantId = getTenantId();

    try {
        const q = query(
            collection(db, "prescriptions"),
            where("tenantId", "==", tenantId),
            where("patientId", "==", currentPatient.id),
            orderBy("createdAt", "desc")
        );
        const snapshot = await getDocs(q);

        if (snapshot.empty) {
            content.innerHTML = '<p class="text-muted">No prescriptions found.</p>';
        } else {
            let html = '<table class="table table-sm"><thead><tr><th>Date</th><th>Doctor</th><th>Medicine</th><th>Dosage</th><th>Status</th></tr></thead><tbody>';
            snapshot.forEach((doc) => {
                const p = doc.data();
                const medicines = p.medicines ? p.medicines.map(m => `${m.name} ${m.dosage || ""}`).join(", ") : "—";
                html += `<tr>
                    <td>${formatDate(p.createdAt)}</td>
                    <td>${escapeHtml(p.doctorName || "")}</td>
                    <td>${escapeHtml(medicines)}</td>
                    <td>${escapeHtml(p.dosageInstructions || "")}</td>
                    <td><span class="badge badge-${getStatusBadge(p.status)}">${escapeHtml(p.status || "")}</span></td>
                </tr>`;
            });
            html += '</tbody></table>';
            content.innerHTML = html;
        }
        hideLoading();
    } catch (error) {
        debugError("Error loading prescriptions:", error);
        content.innerHTML = '<p class="text-error">Unable to load prescriptions.</p>';
        hideLoading();
    }
}

/**
 * Loads patient lab results.
 */
async function loadPatientLabResults() {
    const content = getTabContent("laboratory");
    if (!content || !currentPatient) return;

    showLoading("Loading lab results...");
    const tenantId = getTenantId();

    try {
        // Load lab orders for this patient
        const ordersQuery = query(
            collection(db, "labOrders"),
            where("tenantId", "==", tenantId),
            where("patientId", "==", currentPatient.id),
            orderBy("createdAt", "desc")
        );
        const ordersSnap = await getDocs(ordersQuery);

let html = '<div class="form-section"><div class="form-section-title">Lab Orders</div>';
        if (ordersSnap.empty) {
            html += '<p class="text-muted">No lab orders found.</p>';
        } else {
            html += '<table class="table table-sm"><thead><tr><th>Date</th><th>Test</th><th>Doctor</th><th>Status</th></tr></thead><tbody>';
            ordersSnap.forEach((doc) => {
                const o = doc.data();
                const tests = (o.tests && o.tests.length > 0) ? o.tests : [{ testName: o.testName, status: o.status }];
                const testNames = tests.map(t => t.testName).filter(Boolean).join(", ") || o.testName || "";
                html += `<tr>
                    <td>${formatDate(o.createdAt)}</td>
                    <td>${escapeHtml(testNames)}</td>
                    <td>${escapeHtml(o.doctorName || "")}</td>
                    <td><span class="badge badge-${getStatusBadge(o.status)}">${escapeHtml(o.status || "")}</span></td>
                </tr>`;
            });
            html += '</tbody></table>';
        }
        html += '</div>';

        // Load lab results for this patient
        const resultsQuery = query(
            collection(db, "labResults"),
            where("tenantId", "==", tenantId),
            where("patientId", "==", currentPatient.id),
            orderBy("createdAt", "desc")
        );
        const resultsSnap = await getDocs(resultsQuery);

        html += '<div class="form-section"><div class="form-section-title">Lab Results</div>';
        if (resultsSnap.empty) {
            html += '<p class="text-muted">No lab results found.</p>';
        } else {
            html += '<table class="table table-sm"><thead><tr><th>Date</th><th>Test</th><th>Result</th><th>Status</th></tr></thead><tbody>';
            resultsSnap.forEach((doc) => {
                const r = doc.data();
                html += `<tr>
                    <td>${formatDate(r.createdAt)}</td>
                    <td>${escapeHtml(r.testName || "")}</td>
                    <td>${escapeHtml(r.result || "")}</td>
                    <td><span class="badge badge-${getStatusBadge(r.status)}">${escapeHtml(r.status || "")}</span></td>
                </tr>`;
            });
            html += '</tbody></table>';
        }
        html += '</div>';

        content.innerHTML = html;
        hideLoading();
    } catch (error) {
        debugError("Error loading lab results:", error);
        content.innerHTML = '<p class="text-error">Unable to load lab results.</p>';
        hideLoading();
    }
}

/**
 * Loads patient admissions.
 */
async function loadPatientAdmissions() {
    const content = getTabContent("admissions");
    if (!content || !currentPatient) return;

    showLoading("Loading admissions...");
    const tenantId = getTenantId();

    try {
        const q = query(
            collection(db, "admissions"),
            where("tenantId", "==", tenantId),
            where("patientId", "==", currentPatient.id),
            orderBy("createdAt", "desc")
        );
        const snapshot = await getDocs(q);

        if (snapshot.empty) {
            content.innerHTML = '<p class="text-muted">No admissions found.</p>';
        } else {
            let html = '<table class="table table-sm"><thead><tr><th>Date</th><th>Admit Date</th><th>Discharge Date</th><th>Ward</th><th>Bed</th><th>Status</th></tr></thead><tbody>';
            snapshot.forEach((doc) => {
                const a = doc.data();
                html += `<tr>
                    <td>${formatDate(a.createdAt)}</td>
                    <td>${formatDate(a.admissionDate)}</td>
                    <td>${a.dischargeDate ? formatDate(a.dischargeDate) : "—"}</td>
                    <td>${escapeHtml(a.wardName || "")}</td>
                    <td>${escapeHtml(a.bedNumber || "")}</td>
                    <td><span class="badge badge-${getStatusBadge(a.status)}">${escapeHtml(a.status || "")}</span></td>
                </tr>`;
            });
            html += '</tbody></table>';
            content.innerHTML = html;
        }
        hideLoading();
    } catch (error) {
        debugError("Error loading admissions:", error);
        content.innerHTML = '<p class="text-error">Unable to load admissions.</p>';
        hideLoading();
    }
}

/**
 * Loads patient invoices.
 */
async function loadPatientInvoices() {
    const content = getTabContent("billing");
    if (!content || !currentPatient) return;

    showLoading("Loading invoices...");
    const tenantId = getTenantId();

    try {
        const invoicesQuery = query(
            collection(db, "invoices"),
            where("tenantId", "==", tenantId),
            where("patientId", "==", currentPatient.id),
            orderBy("createdAt", "desc")
        );
        const snapshot = await getDocs(invoicesQuery);

        if (snapshot.empty) {
            content.innerHTML = '<p class="text-muted">No invoices found.</p>';
        } else {
            let html = '';
            snapshot.forEach((doc) => {
                const inv = doc.data();
                const subtotal = parseFloat(inv.subtotal) || 0;
                const discount = parseFloat(inv.discount) || 0;
                const total = subtotal - discount;
                const paid = parseFloat(inv.amountPaid) || 0;
                const balance = total - paid;
                const billTo = inv.billToName || inv.patientName || "—";
                const items = Array.isArray(inv.items) ? inv.items : [];

                let itemsHtml = '';
                if (items.length === 0) {
                    itemsHtml = '<tr><td colspan="4" class="text-center p-2 text-muted">No itemized line items.</td></tr>';
                } else {
                    itemsHtml = items.map(item => {
                        const qty = item.qty || item.quantity || 1;
                        const unitPrice = parseFloat(item.unitPrice) || 0;
                        const amount = qty * unitPrice;
                        return `<tr>
                            <td style="padding: 6px 4px;">${escapeHtml(item.description || "Item")}</td>
                            <td style="padding: 6px 4px;" class="text-center">${qty}</td>
                            <td style="padding: 6px 4px;" class="text-right">${formatCurrency(unitPrice)}</td>
                            <td style="padding: 6px 4px;" class="text-right">${formatCurrency(amount)}</td>
                        </tr>`;
                    }).join('');
                }

                html += `
                    <div class="card mb-4">
                        <div class="form-section-title" style="display: flex; justify-content: space-between; align-items: center;">
                            <span>${escapeHtml(inv.invoiceNumber || "Invoice")}</span>
                            <span class="badge badge-${getStatusBadge(inv.status)}">${escapeHtml(inv.status || "")}</span>
                        </div>
                        <div class="form-grid form-grid-3" style="margin: 12px 0; font-size: var(--font-size-sm);">
                            <div><strong>Date:</strong> ${formatDate(inv.createdAt)}</div>
                            <div><strong>Bill To:</strong> ${escapeHtml(billTo)}</div>
                            <div><strong>Total:</strong> ${formatCurrency(total)}</div>
                        </div>
                        <div class="table-container">
                            <table class="table table-sm">
                                <thead>
                                    <tr>
                                        <th>Description</th>
                                        <th class="text-center" style="width: 60px;">Qty</th>
                                        <th class="text-right">Unit Price</th>
                                        <th class="text-right">Amount</th>
                                    </tr>
                                </thead>
                                <tbody>${itemsHtml}</tbody>
                            </table>
                        </div>
                    </div>
                `;
            });
            content.innerHTML = html;
        }
        hideLoading();
    } catch (error) {
        debugError("Error loading invoices:", error);
        content.innerHTML = '<p class="text-error">Unable to load invoices.</p>';
        hideLoading();
    }
}

/**
 * Loads patient payments.
 */
async function loadPatientPayments() {
    const content = getTabContent("payments");
    if (!content || !currentPatient) return;

    showLoading("Loading payments...");
    const tenantId = getTenantId();

    try {
        const q = query(
            collection(db, "payments"),
            where("tenantId", "==", tenantId),
            where("patientId", "==", currentPatient.id),
            orderBy("createdAt", "desc")
        );
        const snapshot = await getDocs(q);

        if (snapshot.empty) {
            content.innerHTML = '<p class="text-muted">No payments found.</p>';
        } else {
            let html = '<table class="table table-sm"><thead><tr><th>Date</th><th>Amount</th><th>Method</th><th>Reference</th></tr></thead><tbody>';
            snapshot.forEach((doc) => {
                const p = doc.data();
                html += `<tr>
                    <td>${formatDate(p.createdAt)}</td>
                    <td>${formatCurrency(p.amount)}</td>
                    <td>${escapeHtml(p.method || "")}</td>
                    <td>${escapeHtml(p.reference || "")}</td>
                </tr>`;
            });
            html += '</tbody></table>';
            content.innerHTML = html;
        }
        hideLoading();
    } catch (error) {
        debugError("Error loading payments:", error);
        content.innerHTML = '<p class="text-error">Unable to load payments.</p>';
        hideLoading();
    }
}

/**
 * Loads patient documents.
 */
async function loadPatientDocuments() {
    const content = getTabContent("documents");
    if (!content || !currentPatient) return;

    showLoading("Loading documents...");
    const tenantId = getTenantId();

    try {
        const q = query(
            collection(db, "documents"),
            where("tenantId", "==", tenantId),
            where("patientId", "==", currentPatient.id),
            orderBy("createdAt", "desc")
        );
        const snapshot = await getDocs(q);

        if (snapshot.empty) {
            content.innerHTML = '<p class="text-muted">No documents found.</p>';
        } else {
            let html = '<table class="table table-sm"><thead><tr><th>Date</th><th>Type</th><th>Description</th><th>File</th></tr></thead><tbody>';
            snapshot.forEach((doc) => {
                const d = doc.data();
                const fileLink = d.fileUrl
                    ? `<a href="${d.fileUrl}" target="_blank" class="text-primary">View</a>`
                    : "—";
                html += `<tr>
                    <td>${formatDate(d.createdAt)}</td>
                    <td>${escapeHtml(d.type || "")}</td>
                    <td>${escapeHtml(d.description || "")}</td>
                    <td>${fileLink}</td>
                </tr>`;
            });
            html += '</tbody></table>';
            content.innerHTML = html;
        }
        hideLoading();
    } catch (error) {
        debugError("Error loading documents:", error);
        content.innerHTML = '<p class="text-error">Unable to load documents.</p>';
        hideLoading();
    }
}

// ─── Edit Patient ────────────────────────────────────────────────────────────

/**
 * Sets up the edit patient button.
 */
function setupEditButton() {
    const editBtn = document.getElementById("edit-patient-btn");
    if (editBtn) {
        editBtn.addEventListener("click", () => {
            if (!currentPatient) return;
            window.location.href = `patient-profile.html?id=${currentPatient.id}&edit=true`;
        });
    }
}

/**
 * Sets up the start visit button.
 */
function setupStartVisitButton() {
    const startVisitBtn = document.getElementById("start-visit-btn");
    if (startVisitBtn) {
        startVisitBtn.addEventListener("click", () => {
            if (!currentPatient) {
                showToast("Patient data not loaded.", "error");
                return;
            }
            startPatientVisit(currentPatient.id);
        });
    }
}

/**
 * Starts a walk-in visit for the patient from their profile.
 * @param {string} patientDocId - The patient's Firestore document ID
 */
async function startPatientVisit(patientDocId) {
    debug("Starting visit for patient:", patientDocId);
    
    try {
        showLoading("Starting visit...");
        
        const tenantId = getTenantId();
        const currentUser = getCurrentUser();
        
        if (!tenantId || !currentUser) {
            throw new Error("Unable to start visit. Please log in again.");
        }

        // Check if the patient already has an active visit
        const activeStatuses = [
            "REGISTERED", "CHECKED_IN", "WAITING_TRIAGE", "TRIAGED",
            "WAITING_DOCTOR", "IN_CONSULTATION", "SERVICES_PENDING",
            "BILLING_PENDING", "PAYMENT_PENDING", "READY_FOR_CHECKOUT"
        ];
        const activeVisitQuery = query(
            collection(db, "opd"),
            where("tenantId", "==", tenantId),
            where("patientId", "==", patientDocId),
            where("status", "in", activeStatuses)
        );
        const activeVisitSnapshot = await getDocs(activeVisitQuery);
        if (!activeVisitSnapshot.empty) {
            const activeVisit = activeVisitSnapshot.docs[0].data();
            throw new Error(`This patient already has an active visit (ID: ${activeVisit.visitId}, Status: ${activeVisit.status}). Please complete the existing visit before starting a new one.`);
        }

        // Get patient data
        const patientDoc = await getDoc(doc(db, "patients", patientDocId));
        if (!patientDoc.exists()) {
            throw new Error("Patient not found.");
        }
        const patientData = patientDoc.data();
        const patientId = patientData.patientId;

        // Generate visit ID
        const visitId = await generateVisitId(tenantId);
        debug("Generated visit ID:", visitId);

        // Create visit in 'opd' collection
        const visitRef = await addDoc(collection(db, "opd"), {
            tenantId,
            patientId: patientDocId, // Document ID
            patientPatientId: patientId, // Human-readable ID
            patientName: patientData.name,
            visitId: visitId,
            type: "walk-in",
            status: "REGISTERED",
            department: "General OPD",
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
            createdBy: currentUser.uid
        });

        debug("Visit created:", visitRef.id);

        // Log audit
        await addDoc(collection(db, "auditLogs"), {
            tenantId,
            userId: currentUser.uid,
            action: "CREATE_VISIT",
            module: "opd",
            recordId: visitRef.id,
            details: { 
                visitId: visitId,
                patientId: patientId,
                patientName: patientData.name,
                type: "walk-in"
            },
            createdAt: serverTimestamp()
        });

        hideLoading();
        showToast(`Visit ${visitId} started successfully!`, "success");

        // Redirect to queue to see the new visit
        setTimeout(() => {
            window.location.href = `queue.html?visitId=${visitRef.id}`;
        }, 1000);

    } catch (error) {
        debugError("Error starting visit:", error);
        hideLoading();
        showToast(error.message || "Unable to start visit. Please try again.", "error");
    }
}

// ─── Helper Functions ────────────────────────────────────────────────────────

/**
 * Gets a tab content element by tab name.
 * @param {string} tabName
 * @returns {HTMLElement|null}
 */
function getTabContent(tabName) {
    return document.querySelector(`[data-tab-content="${tabName}"]`);
}

/**
 * Calculates age from date of birth.
 * @param {Date|Object} dob
 * @returns {string}
 */
function calculateAge(dob) {
    if (!dob) return "—";
    let birthDate;
    if (dob.toDate) {
        birthDate = dob.toDate();
    } else if (dob instanceof Date) {
        birthDate = dob;
    } else {
        birthDate = new Date(dob);
    }
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
        age--;
    }
    return age > 0 ? `${age} years` : `${Math.max(0, age)} years`;
}

/**
 * Formats a date for display.
 * @param {Date|Object} date
 * @returns {string}
 */
function formatDate(date) {
    if (!date) return "—";
    if (date.toDate) {
        date = date.toDate();
    }
    return date.toLocaleDateString("en-GB", {
        year: "numeric",
        month: "short",
        day: "numeric"
    });
}

/**
 * Formats a number as currency.
 * @param {number} amount
 * @returns {string}
 */
function formatCurrency(amount) {
    if (!amount) return "KSh 0";
    return new Intl.NumberFormat("en-KE", {
        style: "currency",
        currency: "KES"
    }).format(parseFloat(amount));
}

/**
 * Formats gender for display.
 * @param {string} gender
 * @returns {string}
 */
function formatGender(gender) {
    if (!gender) return "—";
    const map = { male: "Male", female: "Female", other: "Other" };
    return map[gender] || gender;
}

/**
 * Gets user initials.
 * @param {string} name
 * @returns {string}
 */
function getInitials(name) {
    const parts = name.split(" ");
    if (parts.length >= 2) {
        return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
}

/**
 * Gets the CSS badge class for a status.
 * @param {string} status
 * @returns {string}
 */
function getStatusBadge(status) {
    if (!status) return "secondary";
    const s = status.toLowerCase();
    if (s.includes("paid") || s.includes("completed") || s.includes("active") || s.includes("available") || s.includes("confirmed")) return "success";
    if (s.includes("pending")) return "warning";
    if (s.includes("cancelled") || s.includes("cancelled") || s.includes("deleted") || s.includes("occupied") || s.includes("maintenance")) return "error";
    if (s.includes("reserved")) return "info";
    return "secondary";
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
 * Hides or shows buttons based on the current user's role.
 */
function setupRoleBasedButtons() {
    const downloadBtn = document.getElementById("download-records-btn");
    if (downloadBtn) {
        const requiredRole = downloadBtn.getAttribute("data-role");
        if (requiredRole && !hasRole(requiredRole)) {
            downloadBtn.style.display = "none";
        }
    }
    // Add checks for other role-based buttons here if needed
}

/**
 * Compiles and downloads a comprehensive medical record for the current patient.
 */
async function downloadMedicalRecords() {
    if (!currentPatient) {
        showToast("Patient data not loaded.", "error");
        return;
    }

    showLoading("Compiling Medical Records...");

    try {
        const tenantId = getTenantId();
        const patientId = currentPatient.id;

        // --- Fetch all related data in parallel ---
        const [
            encounters,
            diagnoses,
            vitals,
            prescriptions,
            labOrders,
            admissions
        ] = await Promise.all([
            getDocs(query(collection(db, "encounters"), where("tenantId", "==", tenantId), where("patientId", "==", patientId), orderBy("createdAt", "desc"))),
            getDocs(query(collection(db, "diagnoses"), where("tenantId", "==", tenantId), where("patientId", "==", patientId), orderBy("createdAt", "desc"))),
            getDocs(query(collection(db, "vitals"), where("tenantId", "==", tenantId), where("patientId", "==", patientId), orderBy("createdAt", "desc"))),
            getDocs(query(collection(db, "prescriptions"), where("tenantId", "==", tenantId), where("patientId", "==", patientId), orderBy("createdAt", "desc"))),
            getDocs(query(collection(db, "labOrders"), where("tenantId", "==", tenantId), where("patientId", "==", patientId), orderBy("createdAt", "desc"))),
            getDocs(query(collection(db, "admissions"), where("tenantId", "==", tenantId), where("patientId", "==", patientId), orderBy("createdAt", "desc")))
        ]);

        // --- Helper to render a section ---
        const renderSection = (title, data, renderFn) => {
            let body = `<p>No ${title.toLowerCase()} recorded.</p>`;
            if (data.docs.length > 0) {
                body = renderFn(data.docs.map(d => d.data()));
            }
            return `<div class="record-section"><h2>${title}</h2>${body}</div>`;
        };

        // --- Render each section to HTML ---
        const encountersHtml = renderSection("Encounters", encounters, (items) => `
            <table><thead><tr><th>Date</th><th>Type</th><th>Doctor</th><th>Chief Complaint</th></tr></thead><tbody>
            ${items.map(e => `<tr><td>${formatDate(e.createdAt)}</td><td>${escapeHtml(e.type)}</td><td>${escapeHtml(e.doctorName)}</td><td>${escapeHtml(e.chiefComplaint)}</td></tr>`).join('')}
            </tbody></table>`);

        const diagnosesHtml = renderSection("Diagnoses", diagnoses, (items) => `
            <table><thead><tr><th>Date</th><th>Diagnosis</th><th>Doctor</th><th>Status</th></tr></thead><tbody>
            ${items.map(d => `<tr><td>${formatDate(d.createdAt)}</td><td>${escapeHtml(d.diagnosis)}</td><td>${escapeHtml(d.doctorName)}</td><td>${escapeHtml(d.status)}</td></tr>`).join('')}
            </tbody></table>`);

        const vitalsHtml = renderSection("Vitals History", vitals, (items) => `
            <table><thead><tr><th>Date</th><th>BP</th><th>HR</th><th>Temp</th><th>Weight</th><th>Height</th></tr></thead><tbody>
            ${items.map(v => `<tr><td>${formatDate(v.createdAt)}</td><td>${v.bloodPressure ? `${v.bloodPressure.systolic}/${v.bloodPressure.diastolic}` : '—'}</td><td>${v.heartRate || '—'}</td><td>${v.temperature || '—'}°C</td><td>${v.weight || '—'}kg</td><td>${v.height || '—'}cm</td></tr>`).join('')}
            </tbody></table>`);

        const prescriptionsHtml = renderSection("Prescriptions", prescriptions, (items) => `
            <table><thead><tr><th>Date</th><th>Doctor</th><th>Medicines</th><th>Status</th></tr></thead><tbody>
            ${items.map(p => `<tr><td>${formatDate(p.createdAt)}</td><td>${escapeHtml(p.doctorName)}</td><td>${p.medicines.map(m => m.name).join(', ')}</td><td>${escapeHtml(p.status)}</td></tr>`).join('')}
            </tbody></table>`);

        const labOrdersHtml = renderSection("Laboratory Orders", labOrders, (items) => `
            <table><thead><tr><th>Date</th><th>Doctor</th><th>Tests</th><th>Status</th></tr></thead><tbody>
            ${items.map(o => `<tr><td>${formatDate(o.createdAt)}</td><td>${escapeHtml(o.doctorName)}</td><td>${escapeHtml(o.testName)}</td><td>${escapeHtml(o.status)}</td></tr>`).join('')}
            </tbody></table>`);

        const admissionsHtml = renderSection("Admissions", admissions, (items) => `
            <table><thead><tr><th>Admit Date</th><th>Discharge Date</th><th>Ward</th><th>Reason</th></tr></thead><tbody>
            ${items.map(a => `<tr><td>${formatDate(a.admissionDate)}</td><td>${a.dischargeDate ? formatDate(a.dischargeDate) : '—'}</td><td>${escapeHtml(a.wardName)}</td><td>${escapeHtml(a.reason)}</td></tr>`).join('')}
            </tbody></table>`);

        // --- Patient Demographics ---
        const patientName = `${currentPatient.firstName || ""} ${currentPatient.lastName || ""}`.trim();
        const demographicsHtml = `
            <div class="record-section">
                <h2>Patient Information</h2>
                <div class="demographics">
                    <div><strong>Name:</strong> ${escapeHtml(patientName)}</div>
                    <div><strong>Patient ID:</strong> ${escapeHtml(currentPatient.patientId)}</div>
                    <div><strong>DOB:</strong> ${formatDate(currentPatient.dateOfBirth)} (${calculateAge(currentPatient.dateOfBirth)})</div>
                    <div><strong>Gender:</strong> ${escapeHtml(currentPatient.gender)}</div>
                    <div><strong>Phone:</strong> ${escapeHtml(currentPatient.phone)}</div>
                    <div><strong>Email:</strong> ${escapeHtml(currentPatient.email)}</div>
                    <div><strong>Blood Group:</strong> ${escapeHtml(currentPatient.bloodGroup)}</div>
                    <div><strong>Allergies:</strong> ${escapeHtml(currentPatient.allergies?.join(', ') || 'None')}</div>
                    <div><strong>Chronic Conditions:</strong> ${escapeHtml(currentPatient.chronicConditions?.join(', ') || 'None')}</div>
                </div>
            </div>
        `;

        // --- Assemble the final HTML document ---
        const hospitalName = getCurrentUser()?.hospitalName || "PRINCE ALEX DIGITAL HMS";
        const printDate = new Date().toLocaleString('en-GB');
        const printedBy = getCurrentUser()?.displayName || getCurrentUser()?.name || "Unknown User";

        const finalHtml = `
            <html>
            <head>
                <title>Medical Record for ${escapeHtml(patientName)}</title>
                <style>
                    body { font-family: Arial, sans-serif; margin: 20px; color: #333; }
                    .header { text-align: center; border-bottom: 2px solid #000; padding-bottom: 10px; margin-bottom: 20px; }
                    .header h1 { margin: 0; }
                    .header p { margin: 5px 0; color: #666; }
                    .record-section { margin-bottom: 30px; page-break-inside: avoid; }
                    .record-section h2 { font-size: 1.2em; border-bottom: 1px solid #ccc; padding-bottom: 5px; margin-bottom: 10px; }
                    .demographics { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 20px; }
                    table { width: 100%; border-collapse: collapse; font-size: 0.9em; }
                    th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
                    th { background-color: #f2f2f2; }
                    tbody tr:nth-child(odd) { background-color: #f9f9f9; }
                    .verification-section { 
                        margin-top: 50px; 
                        padding-top: 20px; 
                        border-top: 1px solid #ccc; 
                        display: flex; 
                        justify-content: space-between; 
                        align-items: flex-end;
                        page-break-inside: avoid;
                    }
                    .printed-by p { margin: 5px 0; font-size: 0.9em; }
                    .stamp-area { 
                        border: 2px dashed #ccc; 
                        width: 180px; 
                        height: 120px; 
                        text-align: center; 
                        color: #ccc; 
                        padding-top: 45px; 
                        font-size: 0.9em;
                    }
                    .footer { text-align: center; font-size: 0.8em; color: #888; margin-top: 30px; border-top: 1px solid #ccc; padding-top: 10px; }
                    @media print {
                        body { margin: 1cm; }
                        .footer { position: fixed; bottom: 10px; width: 95%; }
                    }
                </style>
            </head>
            <body>
                <div class="header">
                    <h1>${escapeHtml(hospitalName)}</h1>
                    <p>CONFIDENTIAL MEDICAL RECORD</p>
                </div>
                
                ${demographicsHtml}
                ${encountersHtml}
                ${diagnosesHtml}
                ${vitalsHtml}
                ${prescriptionsHtml}
                ${labOrdersHtml}
                ${admissionsHtml}

                <div class="verification-section">
                    <div class="printed-by">
                        <p><strong>Printed By:</strong> ${escapeHtml(printedBy)}</p>
                        <p><strong>Signature:</strong> _________________________</p>
                    </div>
                    <div class="stamp-area">
                        Official Stamp
                    </div>
                </div>

                <div class="footer">
                    Generated on ${printDate}. This is an official computer-generated document from ${escapeHtml(hospitalName)}.
                </div>

                <script>
                    window.onload = function() {
                        window.print();
                    };
                <\/script>
            </body>
            </html>
        `;

        // --- Open in new window and print ---
        const printWindow = window.open("", "_blank");
        if (printWindow) {
            printWindow.document.open();
            printWindow.document.write(finalHtml);
            printWindow.document.close();
        } else {
            showToast("Could not open print window. Please disable your pop-up blocker.", "warning");
        }

    } catch (error) {
        debugError("Error compiling medical records:", error);
        showToast("Failed to generate medical records.", "error");
    } finally {
        hideLoading();
    }
}
