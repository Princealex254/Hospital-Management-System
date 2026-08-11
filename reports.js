/**
 * PRINCE ALEX DIGITAL HMS — Reports Module
 * 
 * Handles:
 * - Generating reports from Firestore data
 * - Report type selection (patients, appointments, admissions, revenue, etc.)
 * - Period filtering (today, week, month, custom)
 * - Displaying report results
 */

import { db, collection, query, where, getDocs, orderBy } from "./firebase-config.js";
import { requireAuth } from "./auth-guard.js";
import { loadSidebar } from "./sidebar.js";
import { showToast, showLoading, hideLoading } from "./notifications.js";
import { debug, debugError } from "./debug.js";
import { getTenantId, hasPermission, PERMISSIONS } from "./permissions.js";

document.addEventListener("DOMContentLoaded", async () => {
    debug("Reports page: Initializing...");
    showLoading("Loading reports...");
    try {
        const user = await requireAuth();
        if (!user) return;
        await loadSidebar();
                document.getElementById("page-title").textContent = "Reports";
        setupReportControls();
        hideLoading();
        debug("Reports page: Initialization complete.");
    } catch (error) {
        debugError("Reports page initialization error:", error);
        hideLoading();
        showToast("Unable to load reports page. Please try again.", "error");
    }
});

function setupReportControls() {
    const generateBtn = document.getElementById("generate-report-btn");
    const periodSelect = document.getElementById("report-period");
    const startInput = document.getElementById("report-start");
    const endInput = document.getElementById("report-end");

    if (periodSelect) {
        periodSelect.addEventListener("change", () => {
            const showCustom = periodSelect.value === "custom";
            if (startInput) startInput.style.display = showCustom ? "inline-block" : "none";
            if (endInput) endInput.style.display = showCustom ? "inline-block" : "none";
        });
    }

    if (generateBtn) {
        generateBtn.addEventListener("click", () => {
            if (!hasPermission(PERMISSIONS.REPORT_VIEW)) {
                showToast("You don't have permission to view reports.", "error");
                return;
            }
            generateReport();
        });
    }
}

async function generateReport() {
    debug("Generating report...");
    const tenantId = getTenantId();
    if (!tenantId) return;

    const reportType = document.getElementById("report-type")?.value;
    const period = document.getElementById("report-period")?.value;
    const startDate = document.getElementById("report-start")?.value;
    const endDate = document.getElementById("report-end")?.value;

    const { start, end } = getDateRange(period, startDate, endDate);

    showLoading("Generating report...");

    try {
        let results = [];
        switch (reportType) {
            case "patients":
                results = await getPatientsReport(tenantId, start, end);
                break;
            case "appointments":
                results = await getAppointmentsReport(tenantId, start, end);
                break;
            case "admissions":
                results = await getAdmissionsReport(tenantId, start, end);
                break;
            case "revenue":
                results = await getRevenueReport(tenantId, start, end);
                break;
            case "payments":
                results = await getPaymentsReport(tenantId, start, end);
                break;
            case "pharmacy":
                results = await getPharmacyReport(tenantId);
                break;
            case "laboratory":
                results = await getLaboratoryReport(tenantId, start, end);
                break;
            case "inventory":
                results = await getInventoryReport(tenantId);
                break;
            default:
                results = await getPatientsReport(tenantId, start, end);
        }

        renderReportResults(reportType, results);
        hideLoading();
        debug("Report generated:", reportType, results.length);
    } catch (error) {
        debugError("Error generating report:", error);
        hideLoading();
        showToast("Unable to generate report. Please try again.", "error");
    }
}

function getDateRange(period, startDate, endDate) {
    const now = new Date();
    let start, end;

    switch (period) {
        case "today":
            start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
            end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
            break;
        case "week":
            const day = now.getDay();
            start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - day);
            end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + (6 - day) + 1);
            break;
        case "month":
            start = new Date(now.getFullYear(), now.getMonth(), 1);
            end = new Date(now.getFullYear(), now.getMonth() + 1, 1);
            break;
        case "custom":
            start = startDate ? new Date(startDate) : new Date(0);
            end = endDate ? new Date(endDate) : new Date();
            break;
        default:
            start = new Date(0);
            end = new Date();
    }

    return { start, end };
}

async function getPatientsReport(tenantId, start, end) {
    const q = query(
        collection(db, "patients"),
        where("tenantId", "==", tenantId),
        where("createdAt", ">=", start),
        where("createdAt", "<", end),
        orderBy("createdAt", "desc")
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

async function getAppointmentsReport(tenantId, start, end) {
    const q = query(
        collection(db, "appointments"),
        where("tenantId", "==", tenantId),
        where("date", ">=", start),
        where("date", "<", end),
        orderBy("date", "desc")
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

async function getAdmissionsReport(tenantId, start, end) {
    const q = query(
        collection(db, "admissions"),
        where("tenantId", "==", tenantId),
        where("admissionDate", ">=", start),
        where("admissionDate", "<", end),
        orderBy("admissionDate", "desc")
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

async function getRevenueReport(tenantId, start, end) {
    const q = query(
        collection(db, "payments"),
        where("tenantId", "==", tenantId),
        where("paymentDate", ">=", start),
        where("paymentDate", "<", end),
        orderBy("paymentDate", "desc")
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

async function getPaymentsReport(tenantId, start, end) {
    return getRevenueReport(tenantId, start, end);
}

async function getPharmacyReport(tenantId) {
    const q = query(
        collection(db, "medicines"),
        where("tenantId", "==", tenantId),
        orderBy("name")
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

async function getLaboratoryReport(tenantId, start, end) {
    const q = query(
        collection(db, "labOrders"),
        where("tenantId", "==", tenantId),
        where("createdAt", ">=", start),
        where("createdAt", "<", end),
        orderBy("createdAt", "desc")
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

async function getInventoryReport(tenantId) {
    const q = query(
        collection(db, "inventory"),
        where("tenantId", "==", tenantId),
        orderBy("name")
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

function renderReportResults(reportType, results) {
    const container = document.getElementById("report-results");
    const countEl = document.getElementById("report-count");
    if (!container) return;

    if (countEl) countEl.textContent = `${results.length} records`;

    if (results.length === 0) {
        container.innerHTML = '<div class="table-empty"><div class="empty-icon"><svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="9" rx="1"/><rect x="14" y="3" width="7" height="5" rx="1"/><rect x="14" y="12" width="7" height="9" rx="1"/><rect x="3" y="16" width="7" height="5" rx="1"/></svg></div><h3>No records found for this report</h3></div>';
        return;
    }

    let html = '<table class="table"><thead><tr>';

    switch (reportType) {
        case "patients":
            html += '<th>Patient ID</th><th>Name</th><th>Gender</th><th>Phone</th><th>Created</th>';
            html += '</tr></thead><tbody>';
            results.forEach(r => {
                html += `<tr><td>${escapeHtml(r.patientId || "")}</td><td>${escapeHtml((r.firstName || "") + " " + (r.lastName || ""))}</td><td>${escapeHtml(r.gender || "")}</td><td>${escapeHtml(r.phone || "")}</td><td>${formatDate(r.createdAt)}</td></tr>`;
            });
            break;
        case "appointments":
            html += '<th>Date</th><th>Patient</th><th>Doctor</th><th>Status</th>';
            html += '</tr></thead><tbody>';
            results.forEach(r => {
                html += `<tr><td>${formatDate(r.date)}</td><td>${escapeHtml(r.patientName || "")}</td><td>${escapeHtml(r.doctorName || "")}</td><td>${escapeHtml(r.status || "")}</td></tr>`;
            });
            break;
        case "admissions":
            html += '<th>Patient</th><th>Admit Date</th><th>Ward</th><th>Bed</th><th>Status</th>';
            html += '</tr></thead><tbody>';
            results.forEach(r => {
                html += `<tr><td>${escapeHtml(r.patientName || "")}</td><td>${formatDate(r.admissionDate)}</td><td>${escapeHtml(r.wardName || "")}</td><td>${escapeHtml(r.bedNumber || "")}</td><td>${escapeHtml(r.status || "")}</td></tr>`;
            });
            break;
        case "revenue":
        case "payments":
            html += '<th>Date</th><th>Patient</th><th>Amount</th><th>Method</th><th>Reference</th>';
            html += '</tr></thead><tbody>';
            results.forEach(r => {
                html += `<tr><td>${formatDate(r.paymentDate)}</td><td>${escapeHtml(r.patientName || "")}</td><td>${formatCurrency(r.amount)}</td><td>${escapeHtml(r.method || "")}</td><td>${escapeHtml(r.reference || "")}</td></tr>`;
            });
            break;
        case "pharmacy":
            html += '<th>Medicine</th><th>Stock</th><th>Min Stock</th><th>Price</th><th>Expiry</th>';
            html += '</tr></thead><tbody>';
            results.forEach(r => {
                html += `<tr><td>${escapeHtml(r.name || "")}</td><td>${r.stockQuantity || 0}</td><td>${r.minStockLevel || 0}</td><td>${formatCurrency(r.price)}</td><td>${formatDate(r.expiryDate)}</td></tr>`;
            });
            break;
        case "laboratory":
            html += '<th>Date</th><th>Patient</th><th>Test</th><th>Status</th>';
            html += '</tr></thead><tbody>';
            results.forEach(r => {
                html += `<tr><td>${formatDate(r.createdAt)}</td><td>${escapeHtml(r.patientName || "")}</td><td>${escapeHtml(r.testName || "")}</td><td>${escapeHtml(r.status || "")}</td></tr>`;
            });
            break;
        case "inventory":
            html += '<th>Item</th><th>Category</th><th>Stock</th><th>Min Stock</th><th>Expiry</th>';
            html += '</tr></thead><tbody>';
            results.forEach(r => {
                html += `<tr><td>${escapeHtml(r.name || "")}</td><td>${escapeHtml(r.category || "")}</td><td>${r.stockQuantity || 0}</td><td>${r.minStockLevel || 0}</td><td>${formatDate(r.expiryDate)}</td></tr>`;
            });
            break;
        default:
            html += '<th>Record</th>';
            html += '</tr></thead><tbody>';
            results.forEach(r => {
                html += `<tr><td>${escapeHtml(r.id || "")}</td></tr>`;
            });
    }

    html += '</tbody></table>';
    container.innerHTML = html;
}

function formatCurrency(amount) {
    if (!amount) return "KSh 0";
    return new Intl.NumberFormat("en-KE", { style: "currency", currency: "KES" }).format(parseFloat(amount));
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

export { generateReport };