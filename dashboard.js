﻿/**
 * PRINCE ALEX DIGITAL HMS — Dashboard Module
 * 
 * Loads real-time statistics from Firestore and renders them on the dashboard.
 * Each stat card pulls actual data from the relevant Firestore collections.
 */

import { db, collection, query, where, getDocs, orderBy, limit, onSnapshot, serverTimestamp, addDoc } from "./firebase-config.js";
import { requireAuth } from "./auth-guard.js";
import { loadSidebar } from "./sidebar.js";
import { showToast, showLoading, hideLoading } from "./notifications.js";
import { debug, debugError } from "./debug.js";
import { icon, replaceEmojisWithIcons } from "./icons.js";
import { getTenantId, getCurrentUser, hasPermission, PERMISSIONS } from "./permissions.js";

// Helper to hide the pre-loader
function hidePreLoader() {
    const preLoader = document.getElementById('pre-loader');
    if (preLoader) {
        preLoader.style.opacity = '0';
        setTimeout(() => preLoader.style.display = 'none', 300);
    }
}

// ─── Initialize Dashboard ────────────────────────────────────────────────────

document.addEventListener("DOMContentLoaded", async () => {
    debug("Dashboard: Initializing...");

    try {
        // Require authentication
        const user = await requireAuth();
        if (!user) return;

        // Load role-based sidebar navigation
        await loadSidebar();

        // Load all dashboard data
        await loadDashboardStats();
        await loadRecentActivity();
        await loadRevenueChart();

        // Replace all emojis with SVG icons
        replaceEmojisWithIcons(document.querySelector('.main-content'));

        // Set up refresh button
        const refreshBtn = document.getElementById("refresh-dashboard");
        if (refreshBtn) {
            refreshBtn.addEventListener("click", async () => {
                await loadDashboardStats();
                await loadRecentActivity();
                await loadRevenueChart();
                showToast("Dashboard refreshed.", "success");
            });
        }

        hidePreLoader();
        debug("Dashboard: Initialization complete.");
    } catch (error) {
        debugError("Dashboard initialization error:", error);
        hidePreLoader();
        showToast("Unable to load dashboard. Please refresh the page.", "error");
    }
});

// ─── Load Dashboard Statistics ───────────────────────────────────────────────

/**
 * Stat card configuration
 */
const STAT_CARDS = [
    { id: "stat-total-patients", icon: "patients", label: "Total Patients", loader: "loadTotalPatients" },
    { id: "stat-todays-appointments", icon: "appointments", label: "Today's Appointments", loader: "loadTodaysAppointments" },
    { id: "stat-current-admissions", icon: "admissions", label: "Current Admissions", loader: "loadCurrentAdmissions" },
    { id: "stat-available-beds", icon: "beds", label: "Available Beds", loader: "loadAvailableBeds" },
    { id: "stat-pending-labs", icon: "laboratory", label: "Pending Lab Tests", loader: "loadPendingLabs" },
    { id: "stat-pending-prescriptions", icon: "pharmacy", label: "Pending Prescriptions", loader: "loadPendingPrescriptions" },
    { id: "stat-todays-revenue", icon: "billing", label: "Today's Revenue", loader: "loadTodaysRevenue" },
    { id: "stat-outstanding-bills", icon: "invoices", label: "Outstanding Bills", loader: "loadOutstandingBills" },
    { id: "stat-low-stock", icon: "warning", label: "Low Stock Items", loader: "loadLowStockMedicines" }
];

/**
 * Renders the stat cards HTML with proper icons
 */
function renderStatCards() {
    const statsContainer = document.getElementById("dashboard-stats");
    if (!statsContainer) return;

    const colors = ['var(--color-primary)', 'var(--color-info)', 'var(--color-secondary)', 
                    'var(--color-success)', 'var(--color-warning)', '#6d28d9', 
                    'var(--color-success-dark)', 'var(--color-error)', 'var(--color-error-dark)'];

    statsContainer.innerHTML = STAT_CARDS.map((card, index) => `
        <div class="dashboard-stat-card">
            <div class="stat-icon" style="background-color: ${colors[index % colors.length]}">
                ${icon(card.icon, '18', 'icon-svg')}
            </div>
            <div class="stat-content">
                <div class="stat-value" id="${card.id}">0</div>
                <div class="stat-label">${card.label}</div>
            </div>
        </div>
    `).join('');
}

/**
 * Loads all dashboard statistics from Firestore.
 * Each function queries the relevant collection with the tenantId filter.
 */
async function loadDashboardStats() {
    debug("Loading dashboard statistics...");
    const tenantId = getTenantId();
    if (!tenantId) {
        debugError("No tenant ID found");
        return;
    }

    try {
        // Render stat cards first
        renderStatCards();

        // Load all stats in parallel
        await Promise.all([
            loadTotalPatients(tenantId),
            loadTodaysAppointments(tenantId),
            loadCurrentAdmissions(tenantId),
            loadAvailableBeds(tenantId),
            loadPendingLabs(tenantId),
            loadPendingPrescriptions(tenantId),
            loadTodaysRevenue(tenantId),
            loadOutstandingBills(tenantId),
            loadLowStockMedicines(tenantId)
        ]);

        debug("All dashboard statistics loaded.");
    } catch (error) {
        debugError("Error loading dashboard statistics:", error);
    }
}

/**
 * Loads total patient count.
 */
async function loadTotalPatients(tenantId) {
    try {
        const q = query(
            collection(db, "patients"),
            where("tenantId", "==", tenantId)
        );
        const snapshot = await getDocs(q);
        const count = snapshot.size;
        updateStat("stat-total-patients", count);
        debug("Total patients:", count);
    } catch (error) {
        debugError("Error loading total patients:", error);
    }
}

/**
 * Loads today's appointment count.
 */
async function loadTodaysAppointments(tenantId) {
    try {
        const today = new Date();
        const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
        const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);

        const q = query(
            collection(db, "appointments"),
            where("tenantId", "==", tenantId),
            where("date", ">=", startOfDay),
            where("date", "<", endOfDay)
        );
        const snapshot = await getDocs(q);
        const count = snapshot.size;
        updateStat("stat-todays-appointments", count);
        debug("Today's appointments:", count);
    } catch (error) {
        debugError("Error loading today's appointments:", error);
    }
}

/**
 * Loads current active admissions count.
 */
async function loadCurrentAdmissions(tenantId) {
    try {
        const q = query(
            collection(db, "admissions"),
            where("tenantId", "==", tenantId),
            where("status", "==", "admitted")
        );
        const snapshot = await getDocs(q);
        const count = snapshot.size;
        updateStat("stat-current-admissions", count);
        debug("Current admissions:", count);
    } catch (error) {
        debugError("Error loading current admissions:", error);
    }
}

/**
 * Loads available beds count.
 */
async function loadAvailableBeds(tenantId) {
    try {
        const q = query(
            collection(db, "beds"),
            where("tenantId", "==", tenantId),
            where("status", "==", "available")
        );
        const snapshot = await getDocs(q);
        const count = snapshot.size;
        updateStat("stat-available-beds", count);
        debug("Available beds:", count);
    } catch (error) {
        debugError("Error loading available beds:", error);
    }
}

/**
 * Loads pending lab tests count.
 */
async function loadPendingLabs(tenantId) {
    try {
        const q = query(
            collection(db, "labOrders"),
            where("tenantId", "==", tenantId),
            where("status", "==", "ordered")
        );
        const snapshot = await getDocs(q);
        const count = snapshot.size;
        updateStat("stat-pending-labs", count);
        debug("Pending lab tests:", count);
    } catch (error) {
        debugError("Error loading pending labs:", error);
    }
}

/**
 * Loads pending prescriptions count.
 */
async function loadPendingPrescriptions(tenantId) {
    try {
        const q = query(
            collection(db, "prescriptions"),
            where("tenantId", "==", tenantId),
            where("status", "==", "pending")
        );
        const snapshot = await getDocs(q);
        const count = snapshot.size;
        updateStat("stat-pending-prescriptions", count);
        debug("Pending prescriptions:", count);
    } catch (error) {
        debugError("Error loading pending prescriptions:", error);
    }
}

/**
 * Loads today's revenue total.
 */
async function loadTodaysRevenue(tenantId) {
    try {
        const today = new Date();
        const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
        const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);

        const q = query(
            collection(db, "payments"),
            where("tenantId", "==", tenantId),
            where("paymentDate", ">=", startOfDay),
            where("paymentDate", "<", endOfDay)
        );
        const snapshot = await getDocs(q);

        let total = 0;
        snapshot.forEach((doc) => {
            const data = doc.data();
            total += parseFloat(data.amount) || 0;
        });

        updateStat("stat-todays-revenue", formatCurrency(total));
        debug("Today's revenue:", total);
    } catch (error) {
        debugError("Error loading today's revenue:", error);
    }
}

/**
 * Loads outstanding bills total.
 */
async function loadOutstandingBills(tenantId) {
    try {
        const q = query(
            collection(db, "invoices"),
            where("tenantId", "==", tenantId),
            where("status", "==", "pending")
        );
        const snapshot = await getDocs(q);

        let total = 0;
        snapshot.forEach((doc) => {
            const data = doc.data();
            total += parseFloat(data.totalAmount) || 0;
        });

        updateStat("stat-outstanding-bills", formatCurrency(total));
        debug("Outstanding bills:", total);
    } catch (error) {
        debugError("Error loading outstanding bills:", error);
    }
}

/**
 * Loads low stock medicines count.
 */
async function loadLowStockMedicines(tenantId) {
    try {
        const q = query(
            collection(db, "medicines"),
            where("tenantId", "==", tenantId),
            where("stockQuantity", "<=", 10)
        );
        const snapshot = await getDocs(q);
        const count = snapshot.size;
        updateStat("stat-low-stock", count);
        debug("Low stock medicines:", count);
    } catch (error) {
        debugError("Error loading low stock medicines:", error);
    }
}

// ─── Load Recent Activity ────────────────────────────────────────────────────

/**
 * Loads recent audit log entries for the activity feed.
 */
async function loadRecentActivity() {
    debug("Loading recent activity...");
    const tenantId = getTenantId();
    if (!tenantId) return;

    try {
        const q = query(
            collection(db, "auditLogs"),
            where("tenantId", "==", tenantId),
            orderBy("createdAt", "desc"),
            limit(10)
        );
        const snapshot = await getDocs(q);

        const activityList = document.getElementById("activity-list");
        if (!activityList) return;

        if (snapshot.empty) {
            activityList.innerHTML = `
                <li class="activity-item">
                    <div class="activity-icon">📊</div>
                    <div class="activity-content">
                        <div class="activity-title">No recent activity</div>
                        <div class="activity-desc">Activity will appear here as actions are performed.</div>
                    </div>
                </li>
            `;
            return;
        }

        const activityIcons = {
            CREATE_PATIENT: "👥",
            UPDATE_PATIENT: "edit",
            CREATE_APPOINTMENT: "📅",
            UPDATE_APPOINTMENT: "📅",
            CREATE_CONSULTATION: "🩺",
            CREATE_PRESCRIPTION: "💊",
            CREATE_LAB_ORDER: "🔬",
            CREATE_LAB_RESULT: "📊",
            CREATE_ADMISSION: "🏨",
            CREATE_INVOICE: "🧾",
            CREATE_PAYMENT: "💳",
            CREATE_MEDICINE: "💉",
            STOCK_UPDATE: "inventory",
            CREATE_USER: "user",
            LOGIN: "key"
        };

        const items = [];
        snapshot.forEach((doc) => {
            const data = doc.data();
            const iconName = activityIcons[data.action] || "file";
            const time = formatTimeAgo(data.createdAt);
            items.push(`
                <li class="activity-item">
                    <div class="activity-icon">${icon(iconName, '18')}</div>
                    <div class="activity-content">
                        <div class="activity-title">${escapeHtml(data.action || "Unknown action")}</div>
                        <div class="activity-desc">${escapeHtml(data.module || "")} • ${escapeHtml(data.userId || "")}</div>
                    </div>
                    <div class="activity-time">${time}</div>
                </li>
            `);
        });

        activityList.innerHTML = items.join("");
        debug("Recent activity loaded:", items.length, "items");
    } catch (error) {
        debugError("Error loading recent activity:", error);
    }
}

// ─── Load Revenue Chart ──────────────────────────────────────────────────────

/**
 * Loads revenue data for the last 7 days and renders a simple bar chart.
 */
async function loadRevenueChart() {
    debug("Loading revenue chart...");
    const tenantId = getTenantId();
    if (!tenantId) return;

    try {
        const today = new Date();
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(today.getDate() - 6);

        const q = query(
            collection(db, "payments"),
            where("tenantId", "==", tenantId),
            where("paymentDate", ">=", sevenDaysAgo),
            orderBy("paymentDate", "desc")
        );
        const snapshot = await getDocs(q);

        // Aggregate by day
        const dailyRevenue = {};
        for (let i = 0; i < 7; i++) {
            const d = new Date();
            d.setDate(today.getDate() - i);
            const dateKey = d.toISOString().split("T")[0];
            dailyRevenue[dateKey] = 0;
        }

        snapshot.forEach((doc) => {
            const data = doc.data();
            const date = data.paymentDate;
            if (date && date.toDate) {
                const dateKey = date.toDate().toISOString().split("T")[0];
                if (dailyRevenue[dateKey] !== undefined) {
                    dailyRevenue[dateKey] += parseFloat(data.amount) || 0;
                }
            }
        });

        // Render simple bar chart
        const chartEl = document.getElementById("revenue-chart");
        if (!chartEl) return;

        const maxRevenue = Math.max(...Object.values(dailyRevenue), 1);
        const days = Object.keys(dailyRevenue).reverse();

        let chartHTML = '<div class="bar-chart"><div class="bar-chart-grid">';
        days.forEach((day) => {
            const amount = dailyRevenue[day];
            const height = (amount / maxRevenue) * 100;
            const dayLabel = new Date(day).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
            chartHTML += `
                <div class="bar-item">
                    <div class="bar-value">${formatCurrencyCompact(amount)}</div>
                    <div class="bar" style="height: ${height}%"></div>
                    <div class="bar-label">${dayLabel}</div>
                </div>
            `;
        });
        chartHTML += '</div></div>';

        chartEl.innerHTML = chartHTML;
        debug("Revenue chart rendered.");
    } catch (error) {
        debugError("Error loading revenue chart:", error);
        const chartEl = document.getElementById("revenue-chart");
        if (chartEl) {
            chartEl.innerHTML = '<p style="color: var(--color-gray-500);">Unable to load chart data.</p>';
        }
    }
}

// ─── Helper Functions ────────────────────────────────────────────────────────

/**
 * Updates a stat card value.
 * @param {string} elementId - The element ID
 * @param {string|number} value - The value to display
 */
function updateStat(elementId, value) {
    const el = document.getElementById(elementId);
    if (el) {
        el.textContent = value;
    }
}

/**
 * Formats a number as currency.
 * @param {number} amount
 * @returns {string}
 */
function formatCurrency(amount) {
    return new Intl.NumberFormat("en-KE", {
        style: "currency",
        currency: "KES"
    }).format(amount);
}

/**
 * Formats a number as compact currency.
 * @param {number} amount
 * @returns {string}
 */
function formatCurrencyCompact(amount) {
    if (amount >= 1000) {
        return "KSh " + (amount / 1000).toFixed(1) + "k";
    }
    return "KSh " + amount;
}

/**
 * Formats a timestamp for time-ago display.
 * @param {Object} timestamp - Firestore timestamp
 * @returns {string}
 */
function formatTimeAgo(timestamp) {
    if (!timestamp) return "";
    if (timestamp.toDate) {
        const date = timestamp.toDate();
        const now = new Date();
        const diffMs = now - date;
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);

        if (diffMins < 1) return "Just now";
        if (diffMins < 60) return `${diffMins}m ago`;
        if (diffHours < 24) return `${diffHours}h ago`;
        if (diffDays < 7) return `${diffDays}d ago`;
        return date.toLocaleDateString();
    }
    return "";
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
