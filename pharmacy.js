/**
 * PRINCE ALEX DIGITAL HMS — Pharmacy Dashboard Module
 * 
 * Handles:
 * - Loading pharmacy summary statistics
 * - Low stock medicines display
 * - Expiring soon medicines display
 * - Pending prescriptions count
 */

import { db, collection, query, where, getDocs, orderBy, serverTimestamp, addDoc } from "./firebase-config.js";
import { requireAuth } from "./auth-guard.js";
import { loadNavigation } from "./navigation.js";
import { showToast, showLoading, hideLoading } from "./notifications.js";
import { debug, debugError } from "./debug.js";
import { getTenantId, getCurrentUser } from "./permissions.js";

document.addEventListener("DOMContentLoaded", async () => {
    debug("Pharmacy page: Initializing...");
    showLoading("Loading pharmacy dashboard...");
    try {
        const user = await requireAuth();
        if (!user) return;

        // Load role-based sidebar navigation
        await loadNavigation();
                const pageTitleEl = document.getElementById("page-title"); if (pageTitleEl) pageTitleEl.textContent = "Pharmacy";
        await loadPharmacyDashboard();
        hideLoading();
        debug("Pharmacy page: Initialization complete.");
    } catch (error) {
        debugError("Pharmacy page initialization error:", error);
        hideLoading();
        showToast("Unable to load pharmacy page. Please try again.", "error");
    }
});

async function loadPharmacyDashboard() {
    debug("Loading pharmacy dashboard...");
    const tenantId = getTenantId();
    if (!tenantId) return;

    try {
        // Load total medicines
        const medicinesQuery = query(
            collection(db, "medicines"),
            where("tenantId", "==", tenantId)
        );
        const medicinesSnap = await getDocs(medicinesQuery);
        document.getElementById("total-medicines").textContent = medicinesSnap.size;

        // Load low stock medicines
        const lowStockQuery = query(
            collection(db, "medicines"),
            where("tenantId", "==", tenantId),
            where("stockQuantity", "<=", 0)
        );
        const lowStockSnap = await getDocs(lowStockQuery);
        document.getElementById("low-stock-count").textContent = lowStockSnap.size;
        renderLowStock(lowStockSnap.docs);

        // Load expiring soon medicines (within 30 days)
        const now = new Date();
        const thirtyDaysLater = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
        const expiringQuery = query(
            collection(db, "medicines"),
            where("tenantId", "==", tenantId),
            where("expiryDate", ">=", now),
            where("expiryDate", "<=", thirtyDaysLater)
        );
        const expiringSnap = await getDocs(expiringQuery);
        document.getElementById("expiring-count").textContent = expiringSnap.size;
        renderExpiring(expiringSnap.docs);

        // Load pending prescriptions
        const pendingQuery = query(
            collection(db, "prescriptions"),
            where("tenantId", "==", tenantId),
            where("status", "==", "pending")
        );
        const pendingSnap = await getDocs(pendingQuery);
        document.getElementById("pending-prescriptions").textContent = pendingSnap.size;

        debug("Pharmacy dashboard loaded.");
    } catch (error) {
        debugError("Error loading pharmacy dashboard:", error);
        showToast("Unable to load pharmacy dashboard. Please try again.", "error");
    }
}

function renderLowStock(docs) {
    const tbody = document.getElementById("low-stock-tbody");
    if (!tbody) return;
    if (docs.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5"><div class="table-empty"><div class="empty-icon"><svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg></div><h3>No low stock medicines</h3></div></td></tr>`;
        return;
    }
    tbody.innerHTML = docs.map((doc) => {
        const med = doc.data();
        return `
            <tr>
                <td>${escapeHtml(med.name || "")}</td>
                <td>${med.stockQuantity || 0}</td>
                <td>${med.minStockLevel || 0}</td>
                <td>${escapeHtml(med.unit || "")}</td>
                <td><span class="badge badge-error">Low Stock</span></td>
            </tr>
        `;
    }).join("");
}

function renderExpiring(docs) {
    const tbody = document.getElementById("expiring-tbody");
    if (!tbody) return;
    if (docs.length === 0) {
        tbody.innerHTML = `<tr><td colspan="4"><div class="table-empty"><div class="empty-icon"><svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg></div><h3>No medicines expiring soon</h3></div></td></tr>`;
        return;
    }
    tbody.innerHTML = docs.map((doc) => {
        const med = doc.data();
        return `
            <tr>
                <td>${escapeHtml(med.name || "")}</td>
                <td>${escapeHtml(med.batchNumber || "")}</td>
                <td>${formatDate(med.expiryDate)}</td>
                <td>${med.stockQuantity || 0}</td>
            </tr>
        `;
    }).join("");
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

export { loadPharmacyDashboard };
