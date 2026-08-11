/**
 * PRINCE ALEX DIGITAL HMS — Laboratory Dashboard Module
 *
 * Handles:
 * - Loading lab statistics
 * - Pending orders count
 * - In-progress tests count
 * - Completed tests today
 * - Tabbed view for pending, in-progress, and completed orders
 */

import { db, collection, query, where, getDocs, orderBy, serverTimestamp, addDoc, updateDoc, doc } from "./firebase-config.js";
import { requireAuth } from "./auth-guard.js";
import { loadSidebar } from "./sidebar.js";
import { showToast, showLoading, hideLoading } from "./notifications.js";
import { debug, debugError } from "./debug.js";
import { getTenantId, getCurrentUser } from "./permissions.js";

document.addEventListener("DOMContentLoaded", async () => {
    debug("Laboratory page: Initializing...");
    showLoading("Loading laboratory dashboard...");
    try {
        const user = await requireAuth();
        if (!user) return;

        await loadSidebar();
        const pageTitleEl = document.getElementById("page-title");
        if (pageTitleEl) pageTitleEl.textContent = "Laboratory";
        await loadLabDashboard();
        setupTabs();
        hideLoading();
        debug("Laboratory page: Initialization complete.");
    } catch (error) {
        debugError("Laboratory page initialization error:", error);
        hideLoading();
        showToast("Unable to load laboratory page. Please try again.", "error");
    }
});

let allOrders = [];
let allResults = [];

const STAT_CARDS = [
    { id: "pending-orders", label: "Pending Orders", icon: "lab-orders", color: "var(--color-info)" },
    { id: "in-progress-tests", label: "In Progress", icon: "activity", color: "var(--color-warning)" },
    { id: "completed-today", label: "Completed Today", icon: "check", color: "var(--color-success)" },
    { id: "critical-results", label: "Critical Results", icon: "warning", color: "var(--color-error)" },
];

function renderStatCards() {
    const container = document.getElementById("lab-stats");
    if (!container) return;
    container.innerHTML = STAT_CARDS.map(card => `
        <div class="dashboard-stat-card">
            <div class="stat-icon" style="background-color: ${card.color};">
                <span class="icon-placeholder" data-icon="${card.icon}"></span>
            </div>
            <div class="stat-content">
                <div class="stat-value" id="${card.id}">0</div>
                <div class="stat-label">${card.label}</div>
            </div>
        </div>
    `).join('');
}

async function loadLabDashboard() {
    debug("Loading lab dashboard...");
    const tenantId = getTenantId();
    if (!tenantId) return;

    try {
        renderStatCards();

        const ordersQuery = query(
            collection(db, "labOrders"),
            where("tenantId", "==", tenantId),
            orderBy("createdAt", "desc")
        );
        const ordersSnap = await getDocs(ordersQuery);
        allOrders = ordersSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        const resultsQuery = query(
            collection(db, "labResults"),
            where("tenantId", "==", tenantId)
        );
        const resultsSnap = await getDocs(resultsQuery);
        allResults = resultsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        updateStats();
        renderAllTables();

        debug("Lab dashboard loaded.");
    } catch (error) {
        debugError("Error loading lab dashboard:", error);
        showToast("Unable to load lab dashboard. Please try again.", "error");
    }
}

function updateStats() {
    const pendingCount = allOrders.filter(o => ['ordered', 'sample-collected'].includes(o.status)).length;
    const inProgressCount = allOrders.filter(o => o.status === 'in-progress').length;
    const criticalCount = allResults.filter(r => r.isCritical === true && r.status !== 'verified').length;

    document.getElementById("pending-orders").textContent = pendingCount;
    document.getElementById("in-progress-tests").textContent = inProgressCount;
    document.getElementById("critical-results").textContent = criticalCount;

    // Completed today
    const today = new Date();
    const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const completedTodayCount = allOrders.filter(o =>
        ['completed', 'verified'].includes(o.status) &&
        o.updatedAt && o.updatedAt.toDate() >= startOfDay
    ).length;
    document.getElementById("completed-today").textContent = completedTodayCount;
}

function renderAllTables() {
    renderTable('pending', ['ordered', 'sample-collected'], document.getElementById('pending-orders-tbody'));
    renderTable('in-progress', ['in-progress'], document.getElementById('in-progress-tbody'));
    renderTable('completed', ['completed', 'verified'], document.getElementById('completed-results-tbody'));
}

function renderTable(type, statuses, tbody) {
    if (!tbody) return;

    const filteredOrders = allOrders.filter(o => statuses.includes(o.status));

    if (filteredOrders.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" class="text-center p-4">No orders in this category.</td></tr>`;
        return;
    }

    tbody.innerHTML = filteredOrders.map(order => {
        const tests = (order.tests && order.tests.length > 0) ? order.tests : [{ testName: order.testName }];
        const testNames = tests.map(t => t.testName).filter(Boolean).join(", ") || order.testName || "";
        const testBadge = tests.length > 1 ? ` <span class="badge badge-secondary">${tests.length} tests</span>` : "";

        let resultCell = '';
        if (type === 'completed') {
            const resultsForOrder = allResults.filter(r => r.orderId === order.id);
            resultCell = `<td>${resultsForOrder.map(r => `${r.testName}: <strong>${escapeHtml(r.result)}</strong>`).join('<br>')}</td>`;
        } else {
            resultCell = `<td>${escapeHtml(order.doctorName || "")}</td>`;
        }

        return `
            <tr>
                <td>${formatDate(order.createdAt)}</td>
                <td>${escapeHtml(order.patientName || "")}</td>
                <td>${escapeHtml(testNames)}${testBadge}</td>
                ${resultCell}
                <td><span class="badge badge-${getStatusBadge(order.status)}">${escapeHtml(order.status)}</span></td>
                <td class="text-right">${renderActionButtons(order)}</td>
            </tr>
        `;
    }).join('');
}

function renderActionButtons(order) {
    const status = order.status;
    let buttons = '';

    if (status === 'ordered') {
        buttons += `<button class="btn btn-sm btn-primary" onclick="updateOrderStatus('${order.id}', 'sample-collected')">Collect Sample</button>`;
    }
    if (status === 'sample-collected') {
        buttons += `<button class="btn btn-sm btn-info" onclick="updateOrderStatus('${order.id}', 'in-progress')">Start Processing</button>`;
    }
    if (status === 'in-progress') {
        buttons += `<a href="lab-orders.html" class="btn btn-sm btn-warning">Enter Result</a>`;
    }
    if (status === 'completed') {
        buttons += `<a href="lab-results.html" class="btn btn-sm btn-success">Verify Result</a>`;
    }
    return buttons;
}

window.updateOrderStatus = async function(orderId, newStatus) {
    debug(`Updating order ${orderId} to ${newStatus}`);
    showLoading("Updating status...");

    try {
        const orderRef = doc(db, "labOrders", orderId);
        await updateDoc(orderRef, {
            status: newStatus,
            updatedAt: serverTimestamp()
        });

        await addDoc(collection(db, "auditLogs"), {
            tenantId: getTenantId(),
            userId: getCurrentUser()?.uid || "",
            action: `UPDATE_LAB_ORDER_STATUS`,
            module: "laboratory",
            recordId: orderId,
            details: { newStatus },
            createdAt: serverTimestamp()
        });

        showToast("Order status updated.", "success");
        await loadLabDashboard(); // Reload all data
    } catch (error) {
        debugError(`Error updating order ${orderId}:`, error);
        showToast("Failed to update order status.", "error");
    } finally {
        hideLoading();
    }
}

function setupTabs() {
    const tabButtons = document.querySelectorAll(".tab-btn");
    const tabContents = document.querySelectorAll(".tab-content");

    tabButtons.forEach(button => {
        button.addEventListener("click", () => {
            const tab = button.dataset.tab;

            tabButtons.forEach(btn => btn.classList.remove("active"));
            button.classList.add("active");

            tabContents.forEach(content => {
                content.classList.toggle("active", content.dataset.tabContent === tab);
            });
        });
    });
}

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
    if (s === 'completed' || s === 'verified') return "success";
    if (s === 'in-progress') return "info";
    if (s === 'sample-collected') return "warning";
    if (s === 'ordered') return "primary";
    if (s === 'cancelled' || s === 'rejected') return "error";
    return "secondary";
}

function escapeHtml(text) {
    if (!text) return "";
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
}

export { loadLabDashboard };
