/**
 * PRINCE ALEX DIGITAL HMS — Audit Logs Module
 *
 * Handles:
 * - Loading and displaying audit logs from Firestore
 * - Search and filter by module
 * - Refresh functionality
 */

import { db, collection, query, where, getDocs, orderBy, limit } from "./firebase-config.js";
import { requireAuth } from "./auth-guard.js"; // Corrected import
import { loadNavigation } from "./navigation.js";
import { showToast, showLoading, hideLoading } from "./notifications.js";
import { debug, debugError } from "./debug.js";
import { getTenantId } from "./permissions.js";

document.addEventListener("DOMContentLoaded", async () => {
    debug("Audit logs page: Initializing...");
    showLoading("Loading audit logs...");
    try {
        const user = await requireAuth();
        if (!user) return;

        // Load role-based sidebar navigation
        await loadNavigation();
                const pageTitleEl = document.getElementById("page-title"); if (pageTitleEl) pageTitleEl.textContent = "Audit Logs";
        await loadAuditLogs();
        setupSearch();
        setupFilter();
        setupRefresh();
        hideLoading();
        debug("Audit logs page: Initialization complete.");
    } catch (error) {
        debugError("Audit logs page initialization error:", error);
        hideLoading();
        showToast("Unable to load audit logs page. Please try again.", "error");
    }
});

let currentLogs = [];
let currentFilters = { search: "", module: "", date: "" };

async function loadAuditLogs() {
    debug("Loading audit logs...");
    const tenantId = getTenantId();
    if (!tenantId) return;
    try {
        showLoading("Fetching logs...");

        let logQuery;
        const queryConstraints = [
            where("tenantId", "==", tenantId),
            orderBy("createdAt", "desc")
        ];

        if (currentFilters.date) {
            const selectedDate = new Date(currentFilters.date);
            const startOfDay = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate());
            const endOfDay = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate() + 1);
            queryConstraints.unshift(where("createdAt", "<", endOfDay));
            queryConstraints.unshift(where("createdAt", ">=", startOfDay));
        } else {
            // If no date is selected, only load the 6 most recent logs.
            queryConstraints.push(limit(6));
        }

        logQuery = query(
            collection(db, "auditLogs"),
            ...queryConstraints
        );

        const snapshot = await getDocs(logQuery);
        currentLogs = [];
        snapshot.forEach((doc) => {
            currentLogs.push({ id: doc.id, ...doc.data() });
        });
        debug("Audit logs loaded:", currentLogs.length);
        applyFilters(); // Apply client-side filters like search/module
        populateModuleFilter();
    } catch (error) {
        debugError("Error loading audit logs:", error);
        showToast("Unable to load audit logs. Please try again.", "error");
        renderEmptyState("Unable to load audit logs.");
    }
}

function renderLogs(logs) {
    const tbody = document.getElementById("audit-tbody");
    if (!tbody) return;
    if (logs.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5"><div class="table-empty"><div class="empty-icon"><svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg></div><h3>No audit logs found</h3></div></td></tr>';
        return;
    }
    tbody.innerHTML = logs.map((log) => {
        const details = log.details ? JSON.stringify(log.details) : "";
        return `
            <tr>
                <td>${formatDate(log.createdAt)}</td>
                <td>${escapeHtml(log.userId || "")}</td>
                <td><span class="badge badge-info">${escapeHtml(log.action || "")}</span></td>
                <td>${escapeHtml(log.module || "")}</td>
                <td>${escapeHtml(details)}</td>
            </tr>
        `;
    }).join("");
}

function renderEmptyState(message) {
    const tbody = document.getElementById("audit-tbody");
    if (!tbody) return;
    tbody.innerHTML = `<tr><td colspan="5"><div class="table-empty"><div class="empty-icon"><svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg></div><h3>${escapeHtml(message)}</h3></div></td></tr>`;
}

function updateLogCount(count) {
    const el = document.getElementById("audit-count");
    if (el) el.textContent = `${count} record${count !== 1 ? "s" : ""}`;
}

function populateModuleFilter() {
    const select = document.getElementById("filter-module");
    if (!select) return;
    const modules = [...new Set(currentLogs.map(l => l.module).filter(Boolean))];
    select.innerHTML = '<option value="">All Modules</option>';
    modules.forEach(module => {
        const option = document.createElement("option");
        option.value = module;
        option.textContent = module;
        select.appendChild(option);
    });
}

function setupSearch() {
    const searchInput = document.getElementById("audit-search");
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
    const moduleFilter = document.getElementById("filter-module");
    const dateFilter = document.getElementById("filter-date");

    if (moduleFilter) {
        moduleFilter.addEventListener("change", (e) => {
            currentFilters.module = e.target.value;
            applyFilters();
        });
    }

    if (dateFilter) {
        dateFilter.addEventListener("change", (e) => {
            currentFilters.date = e.target.value;
            // Re-fetch from Firestore when date changes
            loadAuditLogs();
        });
    }
}

function applyFilters() {
    debug("Applying filters:", currentFilters);
    const filtered = currentLogs.filter((log) => {
        if (currentFilters.search) {
            const action = (log.action || "").toLowerCase();
            const module = (log.module || "").toLowerCase();
            if (!action.includes(currentFilters.search) && !module.includes(currentFilters.search)) return false;
        }
        if (currentFilters.module && log.module !== currentFilters.module) return false;
        return true;
    });
    renderLogs(filtered);
    updateLogCount(filtered.length);
}

function setupRefresh() {
    const refreshBtn = document.getElementById("refresh-btn");
    if (refreshBtn) {
        refreshBtn.addEventListener("click", async () => {
            showLoading("Refreshing audit logs...");
            await loadAuditLogs();
            hideLoading();
            showToast("Audit logs refreshed.", "success");
        });
    }
}

function formatDate(date) {
    if (!date) return "—";
    if (date.toDate) date = date.toDate();
    if (date instanceof Date) {
        return date.toLocaleString("en-GB", { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
    }
    return String(date);
}

function escapeHtml(text) {
    if (!text) return "";
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
}

export { loadAuditLogs };