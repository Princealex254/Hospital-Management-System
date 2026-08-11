/**
 * PRINCE ALEX DIGITAL HMS — Settings Module
 * 
 * Handles:
 * - Loading hospital settings from Firestore
 * - Saving hospital settings
 * - Audit logging
 */

import { db, collection, query, where, getDocs, addDoc, updateDoc, doc, serverTimestamp, getDoc } from "./firebase-config.js";
import { requireAuth } from "./auth-guard.js";
import { loadNavigation } from "./navigation.js";
import { showToast, showLoading, hideLoading } from "./notifications.js";
import { debug, debugError } from "./debug.js";
import { getTenantId, getCurrentUser } from "./permissions.js";

document.addEventListener("DOMContentLoaded", async () => {
    debug("Settings page: Initializing...");
    showLoading("Loading settings...");
    try {
        const user = await requireAuth();
        if (!user) return;

        // Load role-based sidebar navigation
        await loadNavigation();
                const pageTitleEl = document.getElementById("page-title"); if (pageTitleEl) pageTitleEl.textContent = "Settings";
        await loadSettings();
        setupForm();
        hideLoading();
        debug("Settings page: Initialization complete.");
    } catch (error) {
        debugError("Settings page initialization error:", error);
        hideLoading();
        showToast("Unable to load settings page. Please try again.", "error");
    }
});

async function loadSettings() {
    debug("Loading settings...");
    const tenantId = getTenantId();
    if (!tenantId) return;
    try {
        const q = query(
            collection(db, "settings"),
            where("tenantId", "==", tenantId)
        );
        const snapshot = await getDocs(q);
        if (!snapshot.empty) {
            const settings = snapshot.docs[0].data();
            document.getElementById("hospital-name").value = settings.hospitalName || "";
            document.getElementById("hospital-phone").value = settings.phone || "";
            document.getElementById("hospital-email").value = settings.email || "";
            document.getElementById("hospital-address").value = settings.address || "";
document.getElementById("currency").value = settings.currency || "KES";
            document.getElementById("timezone").value = settings.timezone || "Africa/Nairobi";
            const consultationFeeEl = document.getElementById("consultation-fee");
            if (consultationFeeEl) {
                consultationFeeEl.value = settings.consultationFee != null ? settings.consultationFee : "";
            }
        }
        debug("Settings loaded.");
    } catch (error) {
        debugError("Error loading settings:", error);
    }
}

function setupForm() {
    const form = document.getElementById("settings-form");
    const submitBtn = document.getElementById("save-btn");
    const btnText = submitBtn.querySelector(".btn-text");
    const btnLoading = submitBtn.querySelector(".btn-loading");
    if (!form) return;
    form.addEventListener("submit", async (e) => {
        e.preventDefault();
        btnText.style.display = "none";
        btnLoading.style.display = "inline";
        submitBtn.disabled = true;
        try {
            await saveSettings();
        } catch (error) {
            debugError("Settings save error:", error);
            showToast(error.message || "Unable to save settings. Please try again.", "error");
        } finally {
            btnText.style.display = "inline";
            btnLoading.style.display = "none";
            submitBtn.disabled = false;
        }
    });
}

async function saveSettings() {
    debug("Saving settings...");
    const tenantId = getTenantId();
    if (!tenantId) throw new Error("No tenant ID found. Please log in again.");

    const hospitalName = document.getElementById("hospital-name").value.trim();
    const phone = document.getElementById("hospital-phone").value.trim();
    const email = document.getElementById("hospital-email").value.trim();
    const address = document.getElementById("hospital-address").value.trim();
const currency = document.getElementById("currency").value;
    const timezone = document.getElementById("timezone").value;
    const consultationFeeEl = document.getElementById("consultation-fee");
    const consultationFee = consultationFeeEl ? parseFloat(consultationFeeEl.value) : null;

    showLoading("Saving settings...");

    const settingsData = {
        tenantId,
        hospitalName,
        phone: phone || null,
        email: email || null,
        address: address || null,
        currency,
        timezone,
        consultationFee: (consultationFee && consultationFee > 0) ? consultationFee : 0,
        updatedAt: serverTimestamp(),
        updatedBy: getCurrentUser()?.uid || ""
    };

    const q = query(
        collection(db, "settings"),
        where("tenantId", "==", tenantId)
    );
    const snapshot = await getDocs(q);

    if (!snapshot.empty) {
        await updateDoc(doc(db, "settings", snapshot.docs[0].id), settingsData);
    } else {
        await addDoc(collection(db, "settings"), {
            ...settingsData,
            createdAt: serverTimestamp()
        });
    }

    await addDoc(collection(db, "auditLogs"), {
        tenantId,
        userId: getCurrentUser()?.uid || "",
        action: "UPDATE_SETTINGS",
        module: "settings",
        details: { hospitalName, currency, timezone },
        createdAt: serverTimestamp()
    });

    hideLoading();
    showToast("Settings saved successfully!", "success");
}

export { saveSettings };
