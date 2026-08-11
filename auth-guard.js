/**
 * PRINCE ALEX DIGITAL HMS — Auth Guard
 * 
 * Protects pages that require authentication.
 * Redirects unauthenticated users to login.html.
 * 
 * Usage: Include this script on any page that requires auth.
 * It will automatically check auth state and redirect if needed.
 */

import { auth, db, doc, getDoc } from "./firebase-config.js";
import { onAuthStateChanged } from "./firebase-config.js";
import { setCurrentUser } from "./permissions.js";
import { debug, debugError } from "./debug.js";
import { showToast } from "./notifications.js";

/**
 * Checks if the user is authenticated.
 * If not, redirects to login.html.
 * If yes, loads the user profile and resolves with it.
 * 
 * @returns {Promise<Object|null>} - Resolves with user profile or null
 */
export async function requireAuth() {
    debug("Auth guard: checking authentication...");

    return new Promise((resolve) => {
        onAuthStateChanged(auth, async (firebaseUser) => {
            if (!firebaseUser) {
                debug("Auth guard: No user signed in. Redirecting to login.");
                window.location.href = "login.html";
                resolve(null);
                return;
            }

            try {
                // Load user profile from Firestore
                const userDoc = await getDoc(doc(db, "users", firebaseUser.uid));

                if (!userDoc.exists()) {
                    debugError("Auth guard: User document not found for UID:", firebaseUser.uid);
                    window.location.href = "login.html";
                    resolve(null);
                    return;
                }

                const userProfile = userDoc.data();

                // Check account status
                if (userProfile.accountStatus === "SUSPENDED" || userProfile.accountStatus === "INACTIVE") {
                    debugError("Auth guard: Account is " + userProfile.accountStatus);
                    window.location.href = "login.html";
                    resolve(null);
                    return;
                }

                // Store user profile for permission checks
                setCurrentUser(userProfile);
                debug("Auth guard: User authenticated:", userProfile);
                resolve(userProfile);
            } catch (error) {
                debugError("Auth guard error:", error);
                window.location.href = "login.html";
                resolve(null);
            }
        });
    });
}

/**
 * Checks if the current user has a specific permission.
 * If not, shows an error message and optionally redirects.
 * 
 * @param {string} permission - The permission to check
 * @param {string} redirectUrl - Optional URL to redirect to if permission denied
 * @returns {Promise<boolean>}
 */
export async function requirePermission(permission, redirectUrl = null) {
    const { hasPermission } = await import("./permissions.js");
    const user = await requireAuth();

    if (!user) return false;

    if (!hasPermission(permission)) {
        debugError("Permission denied:", permission);
        showToast("You don't have permission to perform this action.", "error");
        if (redirectUrl) {
            window.location.href = redirectUrl;
        }
        return false;
    }

    return true;
}

// ─── Auto-run on page load ───────────────────────────────────────────────────
// When this script is loaded, it automatically checks auth.
// Pages that need auth should call requireAuth() explicitly.
debug("Auth guard module loaded.");
