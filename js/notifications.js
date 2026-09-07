/**
 * PRINCE ALEX DIGITAL HMS — Notifications & Toast System
 * 
 * Provides:
 * - Toast messages (success, error, warning, info)
 * - Loading indicators
 * - Confirmation dialogs
 * - Real-time notification listener from Firestore
 */

import { db, collection, query, where, orderBy, onSnapshot, addDoc, updateDoc, doc, serverTimestamp, getDocs } from "./firebase-config.js";
import { getTenantId, getCurrentUser } from "./permissions.js";
import { debug, debugError } from "./debug.js";

// ─── Toast Messages ──────────────────────────────────────────────────────────

let toastContainer = null;

/**
 * Ensures the toast container exists in the DOM.
 */
function ensureToastContainer() {
    if (!toastContainer) {
        toastContainer = document.getElementById("toast-container");
        if (!toastContainer) {
            toastContainer = document.createElement("div");
            toastContainer.id = "toast-container";
            toastContainer.className = "toast-container";
            document.body.appendChild(toastContainer);
        }
    }
    return toastContainer;
}

/**
 * Shows a toast message.
 * @param {string} message - The message to display
 * @param {string} type - "success" | "error" | "warning" | "info"
 * @param {number} duration - Auto-close duration in ms (0 = no auto-close)
 */
export function showToast(message, type = "info", duration = 5000) {
    const container = ensureToastContainer();

    const toast = document.createElement("div");
    toast.className = `toast toast-${type}`;
    toast.setAttribute("data-toast-id", Date.now().toString());

    const iconMap = {
        success: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>',
        error: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>',
        warning: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>',
        info: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>'
    };

    toast.innerHTML = `
        <div class="toast-icon">${iconMap[type] || iconMap.info}</div>
        <div class="toast-message">${message}</div>
        <button class="toast-close" onclick="this.parentElement.remove()" aria-label="Close">&times;</button>
    `;

    container.appendChild(toast);

    // Auto-close
    if (duration > 0) {
        setTimeout(() => {
            if (toast.parentElement) {
                toast.style.opacity = "0";
                setTimeout(() => toast.remove(), 300);
            }
        }, duration);
    }

    debug("Toast shown:", type, message);
}

// ─── Loading Indicators ──────────────────────────────────────────────────────

/**
 * Shows a loading overlay with an optional message.
 * @param {string} message - Loading message
 */
export function showLoading(message = "Loading...") {
    let overlay = document.getElementById("loading-overlay");
    if (!overlay) {
        overlay = document.createElement("div");
        overlay.id = "loading-overlay";
        overlay.className = "loading-overlay";
        overlay.innerHTML = `
            <div class="loading-spinner">
                <div class="spinner"></div>
                <span class="loading-text">${message}</span>
            </div>
        `;
        document.body.appendChild(overlay);
    } else {
        overlay.querySelector(".loading-text").textContent = message;
        overlay.style.display = "flex";
    }
    debug("Loading shown:", message);
}

/**
 * Hides the loading overlay.
 */
export function hideLoading() {
    const overlay = document.getElementById("loading-overlay");
    if (overlay) {
        overlay.style.display = "none";
    }
    debug("Loading hidden");
}

// ─── Confirmation Dialog ─────────────────────────────────────────────────────

/**
 * Shows a confirmation dialog.
 * @param {string} title - Dialog title
 * @param {string} message - Dialog message
 * @param {string} confirmText - Text for confirm button
 * @param {string} cancelText - Text for cancel button
 * @returns {Promise<boolean>} - Resolves with true if confirmed, false otherwise
 */
export function showConfirm(title, message, confirmText = "Confirm", cancelText = "Cancel") {
    return new Promise((resolve) => {
        const overlay = document.createElement("div");
        overlay.className = "confirm-overlay";
        overlay.innerHTML = `
            <div class="confirm-dialog">
                <div class="confirm-header">
                    <h3>${title}</h3>
                </div>
                <div class="confirm-body">
                    <p>${message}</p>
                </div>
                <div class="confirm-footer">
                    <button class="btn btn-secondary" id="confirm-cancel">${cancelText}</button>
                    <button class="btn btn-primary" id="confirm-ok">${confirmText}</button>
                </div>
            </div>
        `;

        document.body.appendChild(overlay);

        const cleanup = () => {
            overlay.remove();
        };

        overlay.querySelector("#confirm-ok").onclick = () => {
            cleanup();
            resolve(true);
        };

        overlay.querySelector("#confirm-cancel").onclick = () => {
            cleanup();
            resolve(false);
        };

        // Close on overlay click
        overlay.onclick = (e) => {
            if (e.target === overlay) {
                cleanup();
                resolve(false);
            }
        };
    });
}

/**
 * Closes the currently active modal.
 */
export function closeModal() {
    const overlay = document.querySelector(".modal-overlay");
    if (overlay) {
        overlay.style.opacity = "0";
        setTimeout(() => {
            if (overlay.parentElement) {
                overlay.remove();
            }
        }, 300); // Match transition duration
        debug("Modal closed programmatically.");
    }
}

if (typeof window !== "undefined") {
    window.closeModal = closeModal;
    window.showModal = showModal;
}

/**
 * Shows a modal dialog with the given HTML content.
 * @param {string} html - The HTML content for the modal body
 * @param {string} title - Optional modal title
 * @param {Function} onClose - Optional callback when modal is closed
 */
export function showModal(html, title = "", onClose = null) {
    closeModal(); // Close any existing modal first
    const existing = document.querySelector(".modal-overlay");
    if (existing) {
        existing.remove();
    }

    const overlay = document.createElement("div");
    overlay.className = "modal-overlay";
    overlay.innerHTML = `
        ${html}
    `;

    document.body.appendChild(overlay);

    // Show the modal
    setTimeout(() => {
        overlay.style.display = "flex";
        overlay.style.opacity = "1";
    }, 10);

    // Attach close handlers to any element with data-modal-close
    const closeButtons = overlay.querySelectorAll("[data-modal-close]");
    closeButtons.forEach(btn => {
        btn.addEventListener("click", (e) => {
            e.preventDefault();
            closeModal();
        });
    });

    // Close on overlay click
    overlay.addEventListener("click", e => {
        if (e.target === overlay) {
            closeModal();
        }
    });

    // Handle ESC key to close
    const escHandler = (e) => {
        if (e.key === "Escape") {
            closeModal();
            document.removeEventListener("keydown", escHandler);
        }
    };
    document.addEventListener("keydown", escHandler);
}

// ─── Firestore Notifications ─────────────────────────────────────────────────

/**
 * Sets up a real-time listener for user notifications from Firestore.
 * @param {string} userId - The current user's ID
 * @param {Function} callback - Called with (notifications) when notifications change
 */
export function initNotificationListener(userId, callback) {
    if (!userId) {
        debugError("Notification listener: No userId provided");
        return;
    }

    debug("Setting up notification listener for user:", userId);

    const tenantId = getTenantId();
    let notificationsQuery = query(
        collection(db, "notifications"),
        where("tenantId", "==", tenantId),
        where("userId", "==", userId),
        orderBy("createdAt", "desc")
    );

    const unsubscribe = onSnapshot(notificationsQuery, (snapshot) => {
        const notifications = [];
        snapshot.forEach((doc) => {
            notifications.push({ id: doc.id, ...doc.data() });
        });
        debug("Notifications updated:", notifications.length);
        callback(notifications);
    }, (error) => {
        debugError("Notification listener error:", error);
    });

    return unsubscribe;
}

/**
 * Marks a notification as read.
 * @param {string} notificationId
 */
export async function markNotificationRead(notificationId) {
    try {
        await updateDoc(doc(db, "notifications", notificationId), {
            isRead: true,
            readAt: serverTimestamp()
        });
        debug("Notification marked as read:", notificationId);
    } catch (error) {
        debugError("Error marking notification read:", error);
    }
}

/**
 * Creates a new notification in Firestore.
 * @param {Object} params - { tenantId, userId, title, message, type, link }
 */
export async function createNotification({ tenantId, userId, title, message, type = "info", link = null }) {
    try {
        await addDoc(collection(db, "notifications"), {
            tenantId,
            userId,
            title,
            message,
            type,
            link,
            isRead: false,
            createdAt: serverTimestamp()
        });
        debug("Notification created:", { userId, title });
    } catch (error) {
        debugError("Error creating notification:", error);
    }
}
