/**
 * PRINCE ALEX DIGITAL HMS — Patient Registration Module
 * 
 * Handles:
 * - Patient registration form submission
 * - Unique patient ID generation (PAD-YYYY-XXXXXX format)
 * - Firestore document creation
 * - Audit logging
 */

import { db, collection, addDoc, serverTimestamp, getDoc, doc, getDocs, query, where, orderBy } from "./firebase-config.js";
import { requireAuth } from "./auth-guard.js";
import { loadSidebar } from "./sidebar.js";
import { showToast, showLoading, hideLoading, showModal, closeModal } from "./notifications.js";
import { debug, debugError } from "./debug.js";
import { getTenantId, getCurrentUser } from "./permissions.js";

// ─── Initialize Registration Page ────────────────────────────────────────────

document.addEventListener("DOMContentLoaded", async () => {
    debug("Patient registration page: Initializing...");

    showLoading("Loading registration page...");

    try {
        // Require authentication
        const user = await requireAuth();
        if (!user) return;

        // Load shared components
        await loadSidebar();

        // Set up form submission
        setupForm();

        hideLoading();
        debug("Patient registration page: Initialization complete.");
    } catch (error) {
        debugError("Registration page initialization error:", error);
        hideLoading();
        showToast("Unable to load registration page. Please try again.", "error");
    }
});

// ─── Form Setup ──────────────────────────────────────────────────────────────

/**
 * Sets up the patient registration form event listeners.
 */
function setupForm() {
    const form = document.getElementById("patient-register-form");
    const submitBtn = document.getElementById("submit-btn");
    const btnText = submitBtn.querySelector(".btn-text");
    const btnLoading = submitBtn.querySelector(".btn-loading");

    if (!form) return;

    form.addEventListener("submit", async (e) => {
        e.preventDefault();

        // Show loading state
        btnText.style.display = "none";
        btnLoading.style.display = "inline";
        submitBtn.disabled = true;

        try {
            await registerPatient();
        } catch (error) {
            debugError("Registration error:", error);
            showToast(error.message || "Unable to register patient. Please try again.", "error");
        } finally {
            btnText.style.display = "inline";
            btnLoading.style.display = "none";
            submitBtn.disabled = false;
        }
    });
}

// ─── Register Patient ────────────────────────────────────────────────────────

/**
 * Collects form data and creates a new patient in Firestore.
 */
async function registerPatient() {
    debug("Registering new patient...");

    const tenantId = getTenantId();
    if (!tenantId) {
        throw new Error("No tenant ID found. Please log in again.");
    }

    // Collect form data
    const firstName = document.getElementById("first-name").value.trim();
    const middleName = document.getElementById("middle-name").value.trim();
    const lastName = document.getElementById("last-name").value.trim();
    const dateOfBirth = document.getElementById("date-of-birth").value;
    const gender = document.getElementById("gender").value;
    const phone = document.getElementById("phone").value.trim();
    const email = document.getElementById("email").value.trim();
    const address = document.getElementById("address").value.trim();
    const city = document.getElementById("city").value.trim();
    const county = document.getElementById("county").value.trim();
    const postalCode = document.getElementById("postal-code").value.trim();
    const nationalId = document.getElementById("national-id").value.trim();
    const kinName = document.getElementById("kin-name").value.trim();
    const kinRelationship = document.getElementById("kin-relationship").value.trim();
    const kinPhone = document.getElementById("kin-phone").value.trim();
    const insuranceProvider = document.getElementById("insurance-provider").value.trim();
    const insuranceMemberNumber = document.getElementById("insurance-member-number").value.trim();
    const bloodGroup = document.getElementById("blood-group").value;
    const allergies = document.getElementById("allergies").value.trim();
    const medicalAlerts = document.getElementById("medical-alerts").value.trim();

    // Validate required fields
    if (!firstName || !lastName || !dateOfBirth || !gender) {
        throw new Error("Please fill in all required fields (marked with *).");
    }

    // Generate unique patient ID
    const patientId = await generatePatientId(tenantId);
    debug("Generated patient ID:", patientId);

    // Build patient object
    const patientData = {
        tenantId,
        patientId,
        firstName,
        middleName: middleName || null,
        lastName,
        name: `${firstName} ${middleName} ${lastName}`.replace(/\s+/g, ' ').trim(),
        name_lowercase: `${firstName} ${lastName}`.toLowerCase(),
        dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : null,
        gender,
        phone: phone || null,
        email: email || null,
        address: address || null,
        city: city || null,
        county: county || null,
        postalCode: postalCode || null,
        nationalId: nationalId || null,
        nextOfKin: {
            name: kinName || null,
            relationship: kinRelationship || null,
            phone: kinPhone || null,
        },
        insurance: {
            provider: insuranceProvider || null,
            memberNumber: insuranceMemberNumber || null,
        },
        bloodGroup: bloodGroup || null,
        allergies: allergies ? allergies.split(",").map(a => a.trim()) : [],
        medicalAlerts: medicalAlerts ? medicalAlerts.split(",").map(c => c.trim()) : [],
        status: "active",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        createdBy: getCurrentUser()?.uid || ""
    };

    // Save to Firestore
    showLoading("Saving patient...");

    const docRef = await addDoc(collection(db, "patients"), patientData);
    debug("Patient created with ID:", docRef.id);

    // Log audit
    await addDoc(collection(db, "auditLogs"), {
        tenantId,
        userId: getCurrentUser()?.uid || "",
        action: "CREATE_PATIENT",
        module: "patients",
        recordId: docRef.id,
        details: { patientId, firstName, lastName },
        createdAt: serverTimestamp()
    });

    hideLoading();

    // Show success modal with options
    showRegistrationSuccessModal(docRef.id, patientId, patientData.name);

    return docRef.id;
}

// ─── Patient ID Generation ───────────────────────────────────────────────────

/**
 * Generates a unique patient ID in the format PAD-YYYY-XXXXXX.
 * The number is sequential based on existing patients in the current year.
 * 
 * @param {string} tenantId
 * @returns {Promise<string>}
 */
async function generatePatientId(tenantId) {
    const year = new Date().getFullYear();

    try {
        // Query for existing patients this year to find the next sequence number
        const startOfYear = new Date(year, 0, 1);
        const endOfYear = new Date(year, 11, 31, 23, 59, 59);

        const q = query(
            collection(db, "patients"),
            where("tenantId", "==", tenantId),
            where("createdAt", ">=", startOfYear),
            where("createdAt", "<=", endOfYear),
            orderBy("createdAt", "desc")
        );

        const snapshot = await getDocs(q);
        const nextSequence = snapshot.size + 1;

        // Format: PAD-2026-000001
        const sequenceStr = String(nextSequence).padStart(6, "0");
        return `PAD-${year}-${sequenceStr}`;
    } catch (error) {
        debugError("Error generating patient ID:", error);
        // Fallback: use timestamp-based ID
        const timestamp = Date.now().toString().slice(-6);
        return `PAD-${year}-${timestamp}`;
    }
}

// ─── Registration Success Modal ──────────────────────────────────────────────

/**
 * Shows a success modal with options after patient registration.
 * @param {string} patientDocId - The Firestore document ID
 * @param {string} patientId - The generated patient ID (PAD-YYYY-NNNNNN)
 * @param {string} patientName - The patient's full name
 */
function showRegistrationSuccessModal(patientDocId, patientId, patientName) {
    const modalHtml = `
        <div class="modal" style="max-width: 500px;">
            <div class="modal-header">
                <h3>Patient Registered Successfully</h3>
            </div>
            <div class="modal-body" style="text-align: center; padding: 32px 24px;">
                <div style="font-size: 3rem; margin-bottom: 16px;">✅</div>
                <h4 style="margin-bottom: 8px; color: var(--color-gray-900);">${escapeHtml(patientName)}</h4>
                <p style="font-size: var(--font-size-lg); font-weight: 600; color: var(--color-primary); margin-bottom: 24px;">
                    ${patientId}
                </p>
                <div style="display: flex; flex-direction: column; gap: 12px;">
                    <button class="btn btn-primary" onclick="startWalkInVisit('${patientDocId}')" style="width: 100%;">
                        <span><svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg></span>
                        Start Walk-in Visit
                    </button>
                    <button class="btn btn-outline" onclick="bookAppointment('${patientDocId}')" style="width: 100%;">
                        <span><svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg></span>
                        Book Appointment
                    </button>
                    <a href="patient-profile.html?id=${patientDocId}" class="btn btn-secondary" style="width: 100%;">
                        <span><svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg></span>
                        View Patient
                    </a>
                </div>
            </div>
        </div>
    `;
    
    showModal(modalHtml, "Registration Complete");
}

/**
 * Starts a walk-in visit for the patient.
 * @param {string} patientDocId - The patient's Firestore document ID
 */
window.startWalkInVisit = async function(patientDocId) {
    debug("Starting walk-in visit for patient:", patientDocId);
    
    try {
        showLoading("Starting visit...");
        
        const tenantId = getTenantId();
        const currentUser = getCurrentUser();
        
        if (!tenantId || !currentUser) {
            throw new Error("Unable to start visit. Please log in again.");
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

        // Create visit
        const visitRef = await addDoc(collection(db, "opd"), {
            tenantId,
            patientId: patientDocId, // Document ID
            patientPatientId: patientId,
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
        closeModal();
        showToast(`Visit ${visitId} started successfully!`, "success");

        // Redirect to queue
        setTimeout(() => {
            window.location.href = `queue.html?visitId=${visitRef.id}`;
        }, 1000);

    } catch (error) {
        debugError("Error starting walk-in visit:", error);
        hideLoading();
        showToast(error.message || "Unable to start visit. Please try again.", "error");
    }
};

/**
 * Books an appointment for the patient.
 * @param {string} patientDocId - The patient's Firestore document ID
 */
window.bookAppointment = function(patientDocId) {
    // Redirect to appointment creation with patient pre-selected
    setTimeout(() => {
        window.location.href = `appointment-create.html?patientId=${patientDocId}`;
    }, 300);
};

/**
 * Generates a unique visit ID in the format VIS-YYYY-NNNNNN.
 * @param {string} tenantId
 * @returns {Promise<string>}
 */
async function generateVisitId(tenantId) {
    const year = new Date().getFullYear();

    try {
        // Query for existing visits this year to find the next sequence number
        const startOfYear = new Date(year, 0, 1);
        const endOfYear = new Date(year, 11, 31, 23, 59, 59);

        const q = query(
            collection(db, "opd"),
            where("tenantId", "==", tenantId),
            where("createdAt", ">=", startOfYear),
            where("createdAt", "<=", endOfYear),
            orderBy("createdAt", "desc")
        );

        const snapshot = await getDocs(q);
        const nextSequence = snapshot.size + 1;

        // Format: VIS-2026-000001
        const sequenceStr = String(nextSequence).padStart(6, "0");
        return `VIS-${year}-${sequenceStr}`;
    } catch (error) {
        debugError("Error generating visit ID:", error);
        // Fallback: use timestamp-based ID
        const timestamp = Date.now().toString().slice(-6);
        return `VIS-${year}-${timestamp}`;
    }
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

// ─── Export ──────────────────────────────────────────────────────────────────
export { registerPatient, generatePatientId };
