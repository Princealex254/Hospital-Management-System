/**
 * PRINCE ALEX DIGITAL HMS — Triage Module
 * 
 * Handles:
 * - Loading visit and patient data for triage
 * - Recording vitals, chief complaint, and nursing notes
 * - Setting visit priority
 * - Updating visit status to 'TRIAGED'
 */

import { db, doc, getDoc, addDoc, updateDoc, collection, serverTimestamp } from "./firebase-config.js";
import { requireAuth } from "./auth-guard.js";
import { loadSidebar } from "./sidebar.js";
import { showToast, showLoading, hideLoading } from "./notifications.js";
import { debug, debugError } from "./debug.js";
import { getTenantId, getCurrentUser } from "./permissions.js";

let currentVisit = null;
let currentPatient = null;

// --- INITIALIZATION ---
document.addEventListener("DOMContentLoaded", async () => {
    debug("Triage page: Initializing...");
    showLoading("Loading Triage...");

    try {
        const user = await requireAuth();
        if (!user) return;

        await loadSidebar();

        const urlParams = new URLSearchParams(window.location.search);
        const visitId = urlParams.get("visitId");

        if (!visitId) {
            showToast("No visit ID provided. Redirecting to queue.", "error");
            window.location.href = "queue.html";
            return;
        }

        await loadVisitData(visitId);
        setupForm();

        hideLoading();
        debug("Triage page: Initialization complete.");
    } catch (error) {
        debugError("Triage page initialization error:", error);
        hideLoading();
        showToast("Unable to load triage page. Please try again.", "error");
    }
});

async function loadVisitData(visitId) {
    debug("Loading visit data for triage:", visitId);
    const visitDocRef = doc(db, "opd", visitId);
    const visitDoc = await getDoc(visitDocRef);

    if (!visitDoc.exists()) {
        throw new Error("Visit not found.");
    }

    currentVisit = { id: visitDoc.id, ...visitDoc.data() };

    const patientDocRef = doc(db, "patients", currentVisit.patientId);
    const patientDoc = await getDoc(patientDocRef);

    if (!patientDoc.exists()) {
        throw new Error("Patient associated with this visit not found.");
    }

    currentPatient = { id: patientDoc.id, ...patientDoc.data() };

    // Populate UI
    const subtitle = document.getElementById("triage-subtitle");
    if (subtitle) {
        subtitle.innerHTML = `
            Patient: <strong>${escapeHtml(currentPatient.name)}</strong> (ID: ${escapeHtml(currentPatient.patientId)})
        `;
    }
}

function setupForm() {
    const form = document.getElementById("triage-form");
    if (!form) return;

    form.addEventListener("submit", async (e) => {
        e.preventDefault();
        await saveTriageData();
    });
}

async function saveTriageData() {
    debug("Saving triage data...");
    showLoading("Saving Triage Data...");

    try {
        const tenantId = getTenantId();
        const currentUser = getCurrentUser();

        // Collect form data
        const vitals = {
            temperature: document.getElementById("temperature").value || null,
            heartRate: document.getElementById("heart-rate").value || null,
            respiratoryRate: document.getElementById("respiratory-rate").value || null,
            oxygenSaturation: document.getElementById("oxygen-saturation").value || null,
            bloodPressure: {
                systolic: document.getElementById("bp-systolic").value || null,
                diastolic: document.getElementById("bp-diastolic").value || null,
            },
            weight: document.getElementById("weight").value || null,
            height: document.getElementById("height").value || null,
            painScore: document.getElementById("pain-score").value || null,
        };

        const chiefComplaint = document.getElementById("chief-complaint").value.trim();
        const nursingNotes = document.getElementById("nursing-notes").value.trim();
        const priority = document.getElementById("priority").value;

        if (!chiefComplaint) {
            throw new Error("Chief Complaint is a required field.");
        }

        // 1. Save Vitals to its own collection
        const vitalsRef = await addDoc(collection(db, "vitals"), {
            tenantId,
            patientId: currentPatient.id,
            visitId: currentVisit.id,
            ...vitals,
            recordedBy: currentUser.uid,
            recordedByName: currentUser.displayName,
            createdAt: serverTimestamp(),
        });
        debug("Vitals saved with ID:", vitalsRef.id);

        // 2. Update the Visit document
        await updateDoc(doc(db, "opd", currentVisit.id), {
            status: "TRIAGED",
            priority: priority,
            chiefComplaint: chiefComplaint,
            nursingNotes: nursingNotes || null,
            triageCompleteTime: serverTimestamp(),
            updatedAt: serverTimestamp(),
        });
        debug("Visit status updated to TRIAGED.");

        // 3. Create Audit Log
        await addDoc(collection(db, "auditLogs"), {
            tenantId,
            userId: currentUser.uid,
            action: "COMPLETE_TRIAGE",
            module: "opd",
            recordId: currentVisit.id,
            details: {
                visitId: currentVisit.visitId,
                patientName: currentPatient.name,
                priority: priority,
            },
            createdAt: serverTimestamp(),
        });

        hideLoading();
        showToast("Triage completed successfully!", "success");

        // 4. Redirect back to the queue
        setTimeout(() => {
            window.location.href = "queue.html";
        }, 1000);

    } catch (error) {
        debugError("Error saving triage data:", error);
        hideLoading();
        showToast(error.message || "Failed to save triage data.", "error");
    }
}

function escapeHtml(text) {
    if (!text) return "";
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
}