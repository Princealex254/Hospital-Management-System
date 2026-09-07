﻿﻿﻿/**
 * PRINCE ALEX DIGITAL HMS — Dashboard Module
 * 
 * Loads real-time statistics from Firestore and renders them on the dashboard.
 * Each stat card pulls actual data from the relevant Firestore collections.
 */

import { db, collection, query, where, getCountFromServer, onSnapshot, serverTimestamp, addDoc } from "./firebase-config.js";
import { requireAuth } from "./auth-guard.js";
import { loadSidebar } from "./sidebar.js";
import { showToast } from "./notifications.js";
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

        // Show the dashboard shell while statistics load independently.
        hidePreLoader();

        // Load all dashboard data
        loadDashboardStats();

        // Replace all emojis with SVG icons
        replaceEmojisWithIcons(document.querySelector('.main-content'));

        // Set up refresh button
        const refreshBtn = document.getElementById("refresh-dashboard");
        if (refreshBtn) {
            refreshBtn.addEventListener("click", async () => {
                await loadDashboardStats();
                showToast("Dashboard refreshed.", "success");
            });
        }

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
    { id: "stat-pending-prescriptions", icon: "pharmacy", label: "Pending Prescriptions", loader: "loadPendingPrescriptions" }
];

/**
 * Renders the stat cards HTML with proper icons
 */
function renderStatCards() {
    const statsContainer = document.getElementById("dashboard-stats");
    if (!statsContainer) return;

    const colors = ['var(--color-primary)', 'var(--color-info)', 'var(--color-secondary)', 
                    'var(--color-success)', 'var(--color-warning)', '#6d28d9'];

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
            loadPendingPrescriptions(tenantId)
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
        const snapshot = await getCountFromServer(q);
        const count = snapshot.data().count;
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
        const snapshot = await getCountFromServer(q);
        const count = snapshot.data().count;
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
        const snapshot = await getCountFromServer(q);
        const count = snapshot.data().count;
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
        const snapshot = await getCountFromServer(q);
        const count = snapshot.data().count;
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
        const snapshot = await getCountFromServer(q);
        const count = snapshot.data().count;
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
        const snapshot = await getCountFromServer(q);
        const count = snapshot.data().count;
        updateStat("stat-pending-prescriptions", count);
        debug("Pending prescriptions:", count);
    } catch (error) {
        debugError("Error loading pending prescriptions:", error);
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
