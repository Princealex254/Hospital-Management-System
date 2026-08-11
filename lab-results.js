/**
 * PRINCE ALEX DIGITAL HMS — Lab Results Module
 * 
 * Handles:
 * - Loading and displaying lab results from Firestore
 * - Search and filter by status
 * - Result verification
 * - Result rejection
 * - Audit logging
 */

import { db, collection, query, where, getDocs, orderBy, updateDoc, doc, serverTimestamp, addDoc } from "./firebase-config.js";
import { requireAuth } from "./auth-guard.js";
import { loadSidebar } from "./sidebar.js";
import { showToast, showLoading, hideLoading, showConfirm } from "./notifications.js";
import { debug, debugError } from "./debug.js";
import { getTenantId, getCurrentUser, hasPermission, PERMISSIONS } from "./permissions.js";

document.addEventListener("DOMContentLoaded", async () => {
    debug("Lab results page: Initializing...");
    showLoading("Loading lab results...");
    try {
        const user = await requireAuth();
        if (!user) return;
        await loadSidebar();
        const pageTitleEl = document.getElementById("page-title");
        if (pageTitleEl) pageTitleEl.textContent = "Lab Results";
        await loadLabResults();
        setupSearch();
        setupFilter();
        hideLoading();
        debug("Lab results page: Initialization complete.");
    } catch (error) {
        debugError("Lab results page initialization error:", error);
        hideLoading();
        showToast("Unable to load lab results page. Please try again.", "error");
    }
});

let currentResults = [];
let currentFilters = { search: "", status: "" };

async function loadLabResults() {
    debug("Loading lab results...");
    const tenantId = getTenantId();
    if (!tenantId) return;
    try {
        const q = query(
            collection(db, "labResults"),
            where("tenantId", "==", tenantId),
            orderBy("createdAt", "desc")
        );
        const snapshot = await getDocs(q);
        currentResults = [];
        snapshot.forEach((doc) => {
            currentResults.push({ id: doc.id, ...doc.data() });
        });
        debug("Lab results loaded:", currentResults.length);
        renderLabResults(currentResults);
        updateResultCount(currentResults.length);
    } catch (error) {
        debugError("Error loading lab results:", error);
        showToast("Unable to load lab results. Please try again.", "error");
        renderEmptyState("Unable to load lab results.");
    }
}

function renderLabResults(results) {
    const tbody = document.getElementById("lab-results-tbody");
    if (!tbody) return;
    if (results.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7"><div class="table-empty"><div class="empty-icon"><svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="9" rx="1"/><rect x="14" y="3" width="7" height="5" rx="1"/><rect x="14" y="12" width="7" height="9" rx="1"/><rect x="3" y="16" width="7" height="5" rx="1"/></svg></div><h3>No lab results found</h3></div></td></tr>`;
        return;
    }
    tbody.innerHTML = results.map((result) => {
        const status = result.status || "pending";
        return `
            <tr>
                <td>${formatDate(result.createdAt)}</td>
                <td>${escapeHtml(result.patientName || "")}</td>
                <td>${escapeHtml(result.testName || "")}</td>
                <td>${escapeHtml(result.result || "")}</td>
                <td><span class="badge badge-${getStatusBadge(status)}">${escapeHtml(status)}</span></td>
                <td>${escapeHtml(result.verifiedBy || "")}</td>
                <td class="text-right">
                    <div class="table-actions">
                        ${status === "pending"
                            ? `<button class="btn btn-sm btn-success" onclick="verifyResult('${result.id}')"><svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg> Verify</button>
                               <button class="btn btn-sm btn-error" onclick="rejectResult('${result.id}')"><svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg> Reject</button>`
                            : ""
                        }
                    </div>
                </td>
            </tr>
        `;
    }).join("");
}

function renderEmptyState(message) {
    const tbody = document.getElementById("lab-results-tbody");
    if (!tbody) return;
    tbody.innerHTML = `<tr><td colspan="7"><div class="table-empty"><div class="empty-icon"><svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="9" rx="1"/><rect x="14" y="3" width="7" height="5" rx="1"/><rect x="14" y="12" width="7" height="9" rx="1"/><rect x="3" y="16" width="7" height="5" rx="1"/></svg></div><h3>${escapeHtml(message)}</h3></div></td></tr>`;
}

function updateResultCount(count) {
    const el = document.getElementById("lab-result-count");
    if (el) el.textContent = `${count} result${count !== 1 ? "s" : ""}`;
}

function setupSearch() {
    const searchInput = document.getElementById("lab-result-search");
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
    const filtered = currentResults.filter((result) => {
        if (currentFilters.search) {
            const patientName = (result.patientName || "").toLowerCase();
            const testName = (result.testName || "").toLowerCase();
            if (!patientName.includes(currentFilters.search) && !testName.includes(currentFilters.search)) return false;
        }
        if (currentFilters.status && result.status !== currentFilters.status) return false;
        return true;
    });
    renderLabResults(filtered);
    updateResultCount(filtered.length);
}

window.verifyResult = async function(resultId) {
    debug("Verifying result:", resultId);
    if (!hasPermission(PERMISSIONS.LAB_RESULT_VERIFY)) {
        showToast("You don't have permission to verify lab results.", "error");
        return;
    }
    try {
        showLoading("Verifying result...");
        await updateDoc(doc(db, "labResults", resultId), {
            status: "verified",
            verifiedBy: getCurrentUser()?.uid || "",
            verifiedAt: serverTimestamp(),
            updatedAt: serverTimestamp()
        });
        await addDoc(collection(db, "auditLogs"), {
            tenantId: getTenantId(),
            userId: getCurrentUser()?.uid || "",
            action: "VERIFY_LAB_RESULT",
            module: "labResults",
            recordId: resultId,
            createdAt: serverTimestamp()
        });
        hideLoading();
        showToast("Lab result verified successfully!", "success");
        await loadLabResults();
    } catch (error) {
        debugError("Error verifying result:", error);
        hideLoading();
        showToast("Unable to verify result. Please try again.", "error");
    }
};

window.rejectResult = async function(resultId) {
    debug("Rejecting result:", resultId);
    if (!hasPermission(PERMISSIONS.LAB_RESULT_VERIFY)) {
        showToast("You don't have permission to reject lab results.", "error");
        return;
    }
    const confirmed = await showConfirm(
        "Reject Result",
        "Are you sure you want to reject this lab result?",
        "Reject",
        "Cancel"
    );
    if (!confirmed) return;
    try {
        showLoading("Rejecting result...");
        await updateDoc(doc(db, "labResults", resultId), {
            status: "rejected",
            rejectedBy: getCurrentUser()?.uid || "",
            rejectedAt: serverTimestamp(),
            updatedAt: serverTimestamp()
        });
        await addDoc(collection(db, "auditLogs"), {
            tenantId: getTenantId(),
            userId: getCurrentUser()?.uid || "",
            action: "REJECT_LAB_RESULT",
            module: "labResults",
            recordId: resultId,
            createdAt: serverTimestamp()
        });
        hideLoading();
        showToast("Lab result rejected.", "success");
        await loadLabResults();
    } catch (error) {
        debugError("Error rejecting result:", error);
        hideLoading();
        showToast("Unable to reject result. Please try again.", "error");
    }
};

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
    if (s.includes("verified")) return "success";
    if (s.includes("pending")) return "warning";
    if (s.includes("rejected")) return "error";
    return "secondary";
}

function escapeHtml(text) {
    if (!text) return "";
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
}

export { loadLabResults };