/**
 * PRINCE ALEX DIGITAL HMS — Admin Dashboard Module
 * 
 * Handles:
 * - Loading platform-wide statistics
 * - Total hospitals, users, subscriptions, plans
 * - Recent hospitals display
 */

import { db, collection, query, where, getDocs, orderBy } from "./firebase-config.js";
import { requireAuth } from "./auth-guard.js";
import { loadNavigation } from "./navigation.js";
import { showToast, showLoading, hideLoading } from "./notifications.js";
import { debug, debugError } from "./debug.js";
import { getTenantId, getCurrentUser, hasPermission, PERMISSIONS } from "./permissions.js";

document.addEventListener("DOMContentLoaded", async () => {
    debug("Admin page: Initializing...");
    showLoading("Loading admin dashboard...");
    try {
        const user = await requireAuth();
        if (!user) return;

        // Load role-based sidebar navigation
        await loadNavigation();
        await loadAdminDashboard();
        hideLoading();
        debug("Admin page: Initialization complete.");
    } catch (error) {
        debugError("Admin page initialization error:", error);
        hideLoading();
        showToast("Unable to load admin page. Please try again.", "error");
    }
});

async function loadAdminDashboard() {
    debug("Loading admin dashboard...");
    try {
        const hospitalsSnap = await getDocs(collection(db, "tenants"));
        document.getElementById("total-hospitals").textContent = hospitalsSnap.size;

        const usersSnap = await getDocs(collection(db, "users"));
        document.getElementById("total-users").textContent = usersSnap.size;

        const subsQuery = query(
            collection(db, "subscriptions"),
            where("status", "==", "active")
        );
        const subsSnap = await getDocs(subsQuery);
        document.getElementById("active-subscriptions").textContent = subsSnap.size;

        const plansSnap = await getDocs(collection(db, "plans"));
        document.getElementById("total-plans").textContent = plansSnap.size;

        const recentHospitalsQuery = query(
            collection(db, "tenants"),
            orderBy("createdAt", "desc")
        );
        const recentSnap = await getDocs(recentHospitalsQuery);
        renderRecentHospitals(recentSnap.docs.slice(0, 10));

        debug("Admin dashboard loaded.");
    } catch (error) {
        debugError("Error loading admin dashboard:", error);
        showToast("Unable to load admin dashboard. Please try again.", "error");
    }
}

function renderRecentHospitals(docs) {
    const tbody = document.getElementById("hospitals-tbody");
    if (!tbody) return;
    if (docs.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5"><div class="table-empty"><div class="empty-icon"><svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 21h18"/><path d="M5 21V7l8-4v18"/><path d="M19 21V11l-6-4"/></svg></div><h3>No hospitals found</h3></div></td></tr>';
        return;
    }
    tbody.innerHTML = docs.map((doc) => {
        const hospital = doc.data();
        const status = hospital.status || "active";
        return `
            <tr>
                <td><strong>${escapeHtml(hospital.name || "")}</strong></td>
                <td>${escapeHtml(hospital.email || "")}</td>
                <td>${escapeHtml(hospital.phone || "")}</td>
                <td><span class="badge badge-${status === "active" ? "success" : "error"}">${escapeHtml(status)}</span></td>
                <td>${formatDate(hospital.createdAt)}</td>
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

export { loadAdminDashboard };
