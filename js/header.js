/**
 * PRINCE ALEX DIGITAL HMS — Header Component
 * 
 * Dynamically loads the header HTML and sets up:
 * - User profile dropdown
 * - Notification bell with real-time updates
 * - Search functionality
 */

import { getCurrentUser, getTenantId } from "./permissions.js";
import { initNotificationListener, markNotificationRead, showToast } from "./notifications.js";
import { logoutUser } from "./auth.js";
import { debug, debugError } from "./debug.js";
import { replaceEmojisWithIcons } from "./icons.js";

/**
 * Loads the header component into the page.
 * @param {string} containerId - The ID of the container element (default: "header-container")
 */
export async function loadHeader(containerId = "header-container") {
    debug("Loading header...");
    try {
        const response = await fetch("components/header.html");
        const html = await response.text();

        const container = document.getElementById(containerId);
        if (!container) {
            debugError("Header container not found:", containerId);
            return;
        }

        container.innerHTML = html;

        // Set up user info
        setupUserInfo();

        // Set up notification listener
        setupNotifications();

        // Set up event handlers
        setupHeaderEvents();

        // Replace any remaining emoji icons with SVG icons
        replaceEmojisWithIcons();

        debug("Header loaded successfully");
    } catch (error) {
        debugError("Error loading header:", error);
        showToast("Unable to load header. Please refresh the page.", "error");
    }
}

/**
 * Sets up user information in the header.
 */
function setupUserInfo() {
    const user = getCurrentUser();
    if (!user) return;

    const userNameEl = document.getElementById("header-user-name");
    const userRoleEl = document.getElementById("header-user-role");
    const userAvatarEl = document.getElementById("header-user-avatar");

    if (userNameEl) {
        userNameEl.textContent = user.displayName || user.name || user.email || "User";
    }

    if (userRoleEl) {
        userRoleEl.textContent = formatRoleLabel(user.role);
    }

    if (userAvatarEl) {
        userAvatarEl.textContent = getUserInitials(user);
    }
}

/**
 * Formats a role string for display.
 * @param {string} role
 * @returns {string}
 */
function formatRoleLabel(role) {
    if (!role) return "User";
    return role.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, l => l.toUpperCase());
}

/**
 * Gets user initials for avatar.
 * @param {Object} user
 * @returns {string}
 */
function getUserInitials(user) {
    const name = user.displayName || user.name || user.email || "U";
    const parts = name.split(" ");
    if (parts.length >= 2) {
        return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
}

/**
 * Sets up the real-time notification listener.
 */
function setupNotifications() {
    const user = getCurrentUser();
    if (!user) return;

    const unsubscribe = initNotificationListener(user.uid, (notifications) => {
        const badge = document.getElementById("notification-badge");
        const list = document.getElementById("notification-list");

        if (badge) {
            const unreadCount = notifications.filter(n => !n.isRead).length;
            badge.textContent = unreadCount;
            badge.style.display = unreadCount > 0 ? "flex" : "none";
        }

        if (list) {
            if (notifications.length === 0) {
                list.innerHTML = '<li class="notification-empty">No notifications</li>';
            } else {
                list.innerHTML = notifications.slice(0, 10).map(n => `
                    <li class="notification-item ${n.isRead ? "read" : "unread"}" data-id="${n.id}">
                        <div class="notification-title">${escapeHtml(n.title)}</div>
                        <div class="notification-message">${escapeHtml(n.message)}</div>
                        <div class="notification-time">${formatTime(n.createdAt)}</div>
                    </li>
                `).join("");
            }
        }

        // Add click handlers for notifications
        const items = document.querySelectorAll(".notification-item");
        items.forEach((item) => {
            item.addEventListener("click", () => {
                const id = item.getAttribute("data-id");
                markNotificationRead(id);
                item.classList.add("read");
                const badge = document.getElementById("notification-badge");
                if (badge) {
                    const count = parseInt(badge.textContent) - 1;
                    badge.textContent = count;
                    badge.style.display = count > 0 ? "flex" : "none";
                }
            });
        });
    });

    // Store unsubscribe for cleanup
    window._notificationUnsubscribe = unsubscribe;
}

/**
 * Sets up header event handlers.
 */
function setupHeaderEvents() {
    // Logout button
    const logoutBtn = document.getElementById("header-logout");
    if (logoutBtn) {
        logoutBtn.addEventListener("click", async (e) => {
            e.preventDefault();
            await logoutUser();
        });
    }

    // Notification bell toggle
    const notifBell = document.getElementById("notification-bell");
    if (notifBell) {
        notifBell.addEventListener("click", (e) => {
            e.stopPropagation();
            const dropdown = document.getElementById("notification-dropdown");
            if (dropdown) {
                dropdown.classList.toggle("open");
            }
        });
    }

    // User profile dropdown toggle
    const userProfile = document.getElementById("header-user-profile");
    if (userProfile) {
        userProfile.addEventListener("click", (e) => {
            e.stopPropagation();
            const dropdown = document.getElementById("user-dropdown");
            if (dropdown) {
                dropdown.classList.toggle("open");
            }
        });
    }

    // Close dropdowns when clicking outside
    document.addEventListener("click", () => {
        const dropdowns = document.querySelectorAll(".dropdown.open");
        dropdowns.forEach(d => d.classList.remove("open"));
    });
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

/**
 * Formats a timestamp for display.
 * @param {Object} timestamp - Firestore timestamp
 * @returns {string}
 */
function formatTime(timestamp) {
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
