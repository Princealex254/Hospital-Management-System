/**
 * PRINCE ALEX DIGITAL HMS — Sidebar Component
 * 
 * Dynamically loads the sidebar HTML and sets up navigation.
 * The sidebar adapts based on the user's role and permissions.
 */

import { auth, db, getDoc, doc } from "./firebase-config.js";
import { getCurrentUser, hasPermission, hasRole, ROLES, setCurrentUser } from "./permissions.js";
import { NAV_SECTIONS } from "./navigation.js";
import { debug, debugError } from "./debug.js";
import { showToast } from "./notifications.js";
import { icon } from "./icons.js";
import { logoutUser } from "./auth.js";

/**
 * Loads the sidebar component into the page.
 * @param {string} containerId - The ID of the container element (default: "sidebar-container")
 */
export async function loadSidebar(containerId = "sidebar-container") {
    debug("Loading sidebar...");
    const container = document.getElementById(containerId);
    if (!container) {
        debugError("Sidebar container not found:", containerId);
        return;
    }

    // Render immediately from cached session data if it exists so the menu appears without delay.
    const cachedUser = getCachedUserProfile();
    if (cachedUser) {
        setCurrentUser(cachedUser);
        populateSidebarNav();
        setupSidebarNavHighlighting();
        setupSidebarFooter();
        setupTenantInfo();
        debug("Sidebar loaded from cached session");
        return;
    }

    // Asynchronously populate the dynamic parts of the sidebar when there is no cached profile
    await populateSidebarAsync();

    debug("Sidebar loaded successfully");
}

function getCachedUserProfile() {
    try {
        const storedUser = localStorage.getItem("userProfile");
        if (!storedUser) return null;
        const parsedUser = JSON.parse(storedUser);
        return parsedUser && typeof parsedUser === "object" ? parsedUser : null;
    } catch (error) {
        debugError("Error reading cached user profile:", error);
        return null;
    }
}

/**
 * Populates the sidebar with dynamic content (nav, user info) asynchronously.
 */
async function populateSidebarAsync() {
    try {
        // Wait for auth to be ready
        const user = await waitForAuth();
        if (!user) {
            debug("No user, skipping sidebar population.");
            return;
        }

        // Populate dynamic content
        populateSidebarNav();
        setupSidebarNavHighlighting();
        setupSidebarFooter();
        setupTenantInfo();

    } catch (error) {
        debugError("Error applying sidebar permissions:", error);
    }
}

/**
 * Waits for the auth state to be resolved.
 * @returns {Promise<Object|null>} - The current user profile
 */
async function waitForAuth() {
    const { onAuthStateChanged } = await import("./firebase-config.js");
    
    // If user is already loaded, resolve immediately
    const currentUser = getCurrentUser();
    if (currentUser) {
        return currentUser;
    }
    
    // Otherwise wait for auth state change
    return new Promise((resolve) => {
        const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
            if (firebaseUser) {
                const userDoc = await getDoc(doc(db, "users", firebaseUser.uid));
                if (userDoc.exists()) {
                    const userProfile = userDoc.data();
                    setCurrentUser(userProfile);
                    unsubscribe();
                    resolve(userProfile);
                } else {
                    unsubscribe();
                    resolve(null);
                }
            } else {
                unsubscribe();
                resolve(null);
            }
        });
    });
}

/**
 * Populates the sidebar navigation menu based on user roles and permissions.
 */
function populateSidebarNav() {
    const container = document.getElementById("sidebar-container");
    if (!container) return;

    const user = getCurrentUser();
    if (!user) return;

    const isSuperAdmin = hasRole(ROLES.SUPER_ADMIN);
    let menuHtml = "";

    NAV_SECTIONS.forEach(section => {
        // Check if section is role-restricted (e.g., for SUPER_ADMIN)
        if (section.role && !hasRole(section.role) && !isSuperAdmin) {
            return;
        }

        // Filter items in the section based on permissions
        const visibleItems = section.items.filter(item => {
            if (isSuperAdmin) return true; // Super admin sees all
            if (item.role) return hasRole(item.role);
            if (item.permission) return hasPermission(item.permission);
            return true; // Item requires no specific permission/role
        });

        if (visibleItems.length > 0) {
            menuHtml += `
                <li class="nav-section">
                    <span class="nav-section-title">${escapeHtml(section.title)}</span>
                </li>
            `;
            visibleItems.forEach(item => {
                menuHtml += `
                    <li>
                        <a href="${item.href}" class="nav-item ${isCurrentPage(item.href) ? 'active' : ''}">
                            <span class="nav-icon">${icon(item.icon)}</span>
                            <span class="nav-label">${escapeHtml(item.label)}</span>
                        </a>
                    </li>
                `;
            });
        }
    });

    const sidebarHtml = `
        <div class="sidebar" id="sidebar">
            <div class="sidebar-header">
                <div class="sidebar-logo">
                    <span class="logo-icon">${icon('opd', '24')}</span>
                    <span class="logo-text">PRINCE ALEX</span>
                </div>
                <button class="sidebar-close" id="sidebar-close" aria-label="Close sidebar">
                    <span>${icon('close', '18')}</span>
                </button>
            </div>

            <div class="sidebar-tenant" id="sidebar-tenant">
                <div class="tenant-name" id="sidebar-tenant-name"></div>
                <div class="user-badge">
                    <span class="user-avatar" id="sidebar-user-avatar"></span>
                    <span class="user-role" id="sidebar-user-role"></span>
                </div>
            </div>

            <nav class="sidebar-nav">
                <ul>
                    <li>
                        <a href="dashboard.html" class="nav-item ${isCurrentPage('dashboard.html') ? 'active' : ''}">
                            <span class="nav-icon">${icon('dashboard', '18')}</span>
                            <span class="nav-label">Dashboard</span>
                        </a>
                    </li>
                    ${menuHtml}
                </ul>
            </nav>

            <div class="sidebar-footer">
                <a href="settings.html" class="nav-item">
                    <span class="nav-icon">${icon('help', '18')}</span>
                    <span class="nav-label">Help & Support</span>
                </a>
                <a href="#" class="nav-item" id="sidebar-logout">
                    <span class="nav-icon">${icon('close', '18')}</span>
                    <span class="nav-label">Logout</span>
                </a>
            </div>
        </div>
    `;

    container.innerHTML = sidebarHtml;
}

/**
 * Sets up sidebar navigation — highlights the current page.
 */
function setupSidebarNavHighlighting() {
    const currentPage = window.location.pathname.split("/").pop() || "dashboard.html";
    const navLinks = document.querySelectorAll(".sidebar-nav .nav-item");

    navLinks.forEach((link) => {
        const linkPage = link.getAttribute("href");
        if (linkPage === currentPage) {
            link.classList.add("active");
        }

    });

    // Set up sidebar close button
    const closeBtn = document.getElementById("sidebar-close");
    if (closeBtn) {
        closeBtn.addEventListener("click", toggleSidebar);
    }
}

/**
 * Sets up the sidebar footer actions (e.g. logout).
 */
function setupSidebarFooter() {
    const logoutBtn = document.getElementById("sidebar-logout");
    if (logoutBtn) {
        logoutBtn.addEventListener("click", async (e) => {
            e.preventDefault();
            await logoutUser();
        });
    }
}

/**
 * Sets up tenant information in the sidebar.
 */
function setupTenantInfo() {
    const user = getCurrentUser();
    if (!user) return;

    const tenantNameEl = document.getElementById("sidebar-tenant-name");
    const userRoleEl = document.getElementById("sidebar-user-role");
    const userAvatarEl = document.getElementById("sidebar-user-avatar");

    if (tenantNameEl) {
        tenantNameEl.textContent = user.tenantName || "PRINCE ALEX DIGITAL HMS";
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
 * Toggles the sidebar on mobile.
 */
export function toggleSidebar() {
    const sidebar = document.querySelector(".sidebar");
    if (sidebar) {
        sidebar.classList.toggle("open");
    }
}

/**
 * Checks if the given href matches the current page.
 * @param {string} href
 * @returns {boolean}
 */
function isCurrentPage(href) {
    const currentPage = window.location.pathname.split("/").pop() || "dashboard.html";
    return href === currentPage;
}

function escapeHtml(text) {
    if (!text) return "";
    return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
}

// ─── Mobile sidebar toggle button ────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", () => {
    const toggleBtn = document.getElementById("sidebar-toggle");
    if (toggleBtn) {
        toggleBtn.addEventListener("click", toggleSidebar);
    }
});
