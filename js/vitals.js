/**
 * PRINCE ALEX DIGITAL HMS — Vitals Module
 * 
 * Handles:
 * - Recording patient vitals in Firestore
 * - BMI auto-calculation
 * - Loading recent vitals history
 * - Patient search for vitals recording
 */

import { db, collection, addDoc, getDocs, query, where, orderBy, limit, serverTimestamp } from "./firebase-config.js";
import { requireAuth } from "./auth-guard.js";
import { loadNavigation } from "./navigation.js";
import { showToast, showLoading, hideLoading } from "./notifications.js";
import { debug, debugError } from "./debug.js";
import { getTenantId, getCurrentUser } from "./permissions.js";

// ─── Initialize Page ─────────────────────────────────────────────────────────

document.addEventListener("DOMContentLoaded", async () => {
    debug("Vitals page: Initializing...");

    showLoading("Loading vitals page...");

    try {
        const user = await requireAuth();
        if (!user) return;

        // Load role-based sidebar navigation
        await loadNavigation();

        setupForm();
        setupBMICalculation();
        await loadVitalsHistory();

        hideLoading();
        debug("Vitals page: Initialization complete.");
    } catch (error) {
        debugError("Vitals page initialization error:", error);
        hideLoading();
        showToast("Unable to load vitals page. Please try again.", "error");
    }
});

// ─── Form Setup ──────────────────────────────────────────────────────────────

function setupForm() {
    const form = document.getElementById("vitals-form");
    const submitBtn = document.getElementById("submit-btn");
    const btnText = submitBtn.querySelector(".btn-text");
    const btnLoading = submitBtn.querySelector(".btn-loading");

    if (!form) return;

    form.addEventListener("submit", async (e) => {
        e.preventDefault();

        btnText.style.display = "none";
        btnLoading.style.display = "inline";
        submitBtn.disabled = true;

        try {
            await saveVitals();
        } catch (error) {
            debugError("Vitals save error:", error);
            showToast(error.message || "Unable to save vitals. Please try again.", "error");
        } finally {
            btnText.style.display = "inline";
            btnLoading.style.display = "none";
            submitBtn.disabled = false;
        }
    });
}

// ─── BMI Calculation ─────────────────────────────────────────────────────────

/**
 * Sets up auto-calculation of BMI from height and weight.
 */
function setupBMICalculation() {
    const heightInput = document.getElementById("height");
    const weightInput = document.getElementById("weight");
    const bmiInput = document.getElementById("bmi");

    if (!heightInput || !weightInput || !bmiInput) return;

    const calculateBMI = () => {
        const height = parseFloat(heightInput.value);
        const weight = parseFloat(weightInput.value);

        if (height > 0 && weight > 0) {
            const bmi = (weight / ((height / 100) ** 2)).toFixed(1);
            bmiInput.value = bmi;
        } else {
            bmiInput.value = "";
        }
    };

    heightInput.addEventListener("input", calculateBMI);
    weightInput.addEventListener("input", calculateBMI);
}

// ─── Save Vitals ─────────────────────────────────────────────────────────────

/**
 * Collects form data and saves vitals to Firestore.
 */
async function saveVitals() {
    debug("Saving vitals...");

    const tenantId = getTenantId();
    if (!tenantId) {
        throw new Error("No tenant ID found. Please log in again.");
    }

    const patientId = document.getElementById("vitals-patient-id").value;
    const patientSearch = document.getElementById("vitals-patient-search").value.trim();
    const recordedBy = document.getElementById("vitals-recorded-by").value.trim();

    if (!patientId || !patientSearch || !recordedBy) {
        throw new Error("Please fill in all required fields (marked with *).");
    }

    // Collect vital signs
    const bpSystolic = document.getElementById("bp-systolic").value;
    const bpDiastolic = document.getElementById("bp-diastolic").value;
    const heartRate = document.getElementById("heart-rate").value;
    const temperature = document.getElementById("temperature").value;
    const respiratoryRate = document.getElementById("respiratory-rate").value;
    const oxygenSaturation = document.getElementById("oxygen-saturation").value;
    const height = document.getElementById("height").value;
    const weight = document.getElementById("weight").value;
    const bmi = document.getElementById("bmi").value;
    const notes = document.getElementById("vitals-notes").value.trim();

    const vitalsData = {
        tenantId,
        patientId,
        patientName: patientSearch,
        recordedBy,
        bloodPressure: {
            systolic: bpSystolic ? parseInt(bpSystolic) : null,
            diastolic: bpDiastolic ? parseInt(bpDiastolic) : null
        },
        heartRate: heartRate ? parseInt(heartRate) : null,
        temperature: temperature ? parseFloat(temperature) : null,
        respiratoryRate: respiratoryRate ? parseInt(respiratoryRate) : null,
        oxygenSaturation: oxygenSaturation ? parseInt(oxygenSaturation) : null,
        height: height ? parseFloat(height) : null,
        weight: weight ? parseFloat(weight) : null,
        bmi: bmi ? parseFloat(bmi) : null,
        notes: notes || null,
        createdAt: serverTimestamp(),
        createdBy: getCurrentUser()?.uid || ""
    };

    showLoading("Saving vitals...");

    const docRef = await addDoc(collection(db, "vitals"), vitalsData);
    debug("Vitals saved with ID:", docRef.id);

    // Log audit
    await addDoc(collection(db, "auditLogs"), {
        tenantId,
        userId: getCurrentUser()?.uid || "",
        action: "CREATE_VITAL",
        module: "vitals",
        recordId: docRef.id,
        details: { patientId, patientName: patientSearch },
        createdAt: serverTimestamp()
    });

    hideLoading();
    showToast("Vitals recorded successfully!", "success");

    // Reset form
    document.getElementById("vitals-form").reset();
    document.getElementById("bmi").value = "";

    // Reload history
    await loadVitalsHistory();
}

// ─── Load Vitals History ─────────────────────────────────────────────────────

/**
 * Loads recent vitals history from Firestore.
 */
async function loadVitalsHistory() {
    debug("Loading vitals history...");
    const tenantId = getTenantId();
    if (!tenantId) return;

    try {
        const q = query(
            collection(db, "vitals"),
            where("tenantId", "==", tenantId),
            orderBy("createdAt", "desc"),
            limit(50)
        );
        const snapshot = await getDocs(q);

        const tbody = document.getElementById("vitals-history-tbody");
        if (!tbody) return;

        if (snapshot.empty) {
            tbody.innerHTML = `
                <tr><td colspan="8">
                    <div class="table-empty">
                        <div class="empty-icon"><svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg></div>
                        <h3>No vitals recorded yet</h3>
                    </div>
                </td></tr>
            `;
            return;
        }

        tbody.innerHTML = snapshot.docs.map((doc) => {
            const v = doc.data();
            const bp = v.bloodPressure ? `${v.bloodPressure.systolic}/${v.bloodPressure.diastolic}` : "—";
            const date = v.createdAt && v.createdAt.toDate
                ? v.createdAt.toDate().toLocaleDateString("en-GB", { year: "numeric", month: "short", day: "numeric" })
                : "—";

            return `
                <tr>
                    <td>${date}</td>
                    <td>${escapeHtml(v.patientName || "")}</td>
                    <td>${bp}</td>
                    <td>${v.heartRate || "—"}</td>
                    <td>${v.temperature || "—"}°C</td>
                    <td>${v.height || "—"}</td>
                    <td>${v.weight || "—"}</td>
                    <td>${escapeHtml(v.recordedBy || "")}</td>
                </tr>
            `;
        }).join("");

        debug("Vitals history loaded:", snapshot.size);
    } catch (error) {
        debugError("Error loading vitals history:", error);
        const tbody = document.getElementById("vitals-history-tbody");
        if (tbody) {
            tbody.innerHTML = `
                <tr><td colspan="8">
                    <div class="table-empty">
                        <div class="empty-icon"><svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg></div>
                        <h3>Unable to load vitals history</h3>
                    </div>
                </td></tr>
            `;
        }
    }
}

// ─── Helper Functions ────────────────────────────────────────────────────────

function escapeHtml(text) {
    if (!text) return "";
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
}

export { saveVitals, loadVitalsHistory };
