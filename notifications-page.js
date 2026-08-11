/**
 * PRINCE ALEX DIGITAL HMS — Notifications Page Module
 * 
 * Handles:
 * - Loading and displaying notifications from Firestore
 * - Marking notifications as read
 * - Refresh functionality
 */

import { db, collection, query, where, getDocs, orderBy, updateDoc, doc, serverTimestamp } from "./firebase-config.js";
import { requireAuth } from "./auth-guard.js";
import { loadSidebar } from "./sidebar.js";
import { showToast, showLoading, hideLoading } from "./notifications.js";
import { debug, debugError } from "./debug.js";
import { getTenantId, getCurrentUser } from "./permissions.js";

document.addEventListener("DOMContentLoaded", async () => {
    debug("Notifications page: Initializing...");
    showLoading("Loading notifications...");
    try {
        const user = await requireAuth();
        if (!user) return;
        await loadSidebar();
                document.getElementById("page-title").textContent = "Notifications";
        await loadNotifications();
        setupRefresh();
        hideLoading();
        debug("Notifications page: Initialization complete.");
    } catch (error) {
        debugError("Notifications page initialization error:", error);
        hideLoading();
        showToast("Unable to load notifications page. Please try again.", "error");
    }
});

let currentNotifications = [];

async function loadNotifications() {
    debug("Loading notifications...");
    const tenantId = getTenantId();
    const userId = getCurrentUser()?.uid;
    if (!tenantId) return;
    try {
        const q = query(
            collection(db, "notifications"),
            where("tenantId", "==", tenantId),
            where("userId", "==", userId),
            orderBy("createdAt", "desc")
        );
        const snapshot = await getDocs(q);
        currentNotifications = [];
        snapshot.forEach((doc) => {
            currentNotifications.push({ id: doc.id, ...doc.data() });
        });
        debug("Notifications loaded:", currentNotifications.length);
        renderNotifications(currentNotifications);
        updateNotificationCount(currentNotifications.length);
    } catch (error) {
        debugError("Error loading notifications:", error);
        showToast("Unable to load notifications. Please try again.", "error");
        renderEmptyState("Unable to load notifications.");
    }
}

function renderNotifications(notifications) {
    const container = document.getElementById("notifications-list");
    if (!container) return;
    if (notifications.length === 0) {
        container.innerHTML = '<div class="table-empty"><div class="empty-icon"><svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg></div><h3>No notifications found</h3></div>';
        return;
    }
    container.innerHTML = notifications.map((notification) => {
        const isRead = notification.isRead || false;
        return `
            <div class="notification-item ${isRead ? "" : "unread"}" onclick="markNotificationRead('${notification.id}')">
                <div class="notification-icon">${getNotificationIcon(notification.type)}</div>
                <div class="notification-content">
                    <div class="notification-title">${escapeHtml(notification.title || "")}</div>
                    <div class="notification-message">${escapeHtml(notification.message || "")}</div>
                    <div class="notification-time">${formatDate(notification.createdAt)}</div>
                </div>
                ${isRead ? "" : '<span class="badge badge-info">New</span>'}
            </div>
        `;
    }).join("");
}

function renderEmptyState(message) {
    const container = document.getElementById("notifications-list");
    if (!container) return;
    container.innerHTML = `<div class="table-empty"><div class="empty-icon"><svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg></div><h3>${escapeHtml(message)}</h3></div>`;
}

function updateNotificationCount(count) {
    const el = document.getElementById("notification-count");
    if (el) el.textContent = `${count} notification${count !== 1 ? "s" : ""}`;
}

function getNotificationIcon(type) {
    const icons = {
        appointment: "<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>",
        patient: "<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>",
        lab: "<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 21h8"/><path d="M12 17v4"/><path d="M8 3h8"/><path d="M10 3v6a4 4 0 0 1-4 4h12a4 4 0 0 1-4-4V3"/></svg>",
        pharmacy: "<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.5 20h3a6.5 6.5 0 0 0 0-13h-3a6.5 6.5 0 0 0 0 13z"/><path d="M12 7v13"/></svg>",
        billing: "<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>",
        inventory: "<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 8l-9-5-9 5v8l9 5 9-5V8z"/><path d="M3 8l9 5 9-5"/><line x1="12" y1="13" x2="12" y2="21"/></svg>",
        system: "<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>",
        default: "<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>"
    };
    return icons[type] || icons.default;
}

window.markNotificationRead = async function(notificationId) {
    debug("Marking notification read:", notificationId);
    try {
        await updateDoc(doc(db, "notifications", notificationId), {
            isRead: true,
            readAt: serverTimestamp()
        });
        const notification = currentNotifications.find(n => n.id === notificationId);
        if (notification) notification.isRead = true;
        renderNotifications(currentNotifications);
    } catch (error) {
        debugError("Error marking notification read:", error);
    }
};

function setupRefresh() {
    const refreshBtn = document.getElementById("refresh-btn");
    if (refreshBtn) {
        refreshBtn.addEventListener("click", async () => {
            showLoading("Refreshing notifications...");
            await loadNotifications();
            hideLoading();
            showToast("Notifications refreshed.", "success");
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

export { loadNotifications };