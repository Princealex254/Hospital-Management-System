/**
 * PRINCE ALEX DIGITAL HMS — Authentication Module
 * 
 * Handles:
 * - Login / Logout
 * - Password reset
 * - Loading user profile from Firestore (role, tenantId, permissions)
 * - Session persistence
 */

import { auth, db, signInWithEmailAndPassword, signOut, onAuthStateChanged, sendPasswordResetEmail } from "./firebase-config.js";
import { doc, getDoc, setDoc, collection, query, where, getDocs, serverTimestamp } from "./firebase-config.js";
import { setCurrentUser, getTenantId } from "./permissions.js";
import { debug, debugError } from "./debug.js";
import { showToast } from "./notifications.js";

// ─── Login ───────────────────────────────────────────────────────────────────

/**
 * Signs in a user with email and password.
 * After successful auth, loads the user's profile from Firestore
 * to determine tenantId, role, and permissions.
 * 
 * @param {string} email
 * @param {string} password
 * @returns {Promise<Object|null>} - The user profile object on success, or null on failure.
 */
export async function loginUser(email, password) {
    debug("Login attempt for:", email);
    try {
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        const firebaseUser = userCredential.user;
        debug("Firebase auth success, UID:", firebaseUser.uid);

        // Load user profile from Firestore
        const userDoc = await getDoc(doc(db, "users", firebaseUser.uid));

        if (!userDoc.exists()) {
            throw new Error("User profile not found in Firestore. Please contact your administrator.");
        }

        const userProfile = userDoc.data();
        debug("User profile loaded:", userProfile);

        // Check account status
        if (userProfile.accountStatus === "SUSPENDED" || userProfile.accountStatus === "INACTIVE") {
            await signOut(auth);
            throw new Error("Your account is " + userProfile.accountStatus.toLowerCase() + ". Please contact your administrator.");
        }

        // Store user profile for permission checks
        setCurrentUser(userProfile);

        // Persist tenantId and user profile in localStorage for instant access
        if (userProfile.tenantId) {
            localStorage.setItem("tenantId", userProfile.tenantId);
        }
        localStorage.setItem("userProfile", JSON.stringify(userProfile));

        // Redirect to dashboard
        window.location.href = "dashboard.html";

        return userProfile;
    } catch (error) {
        debugError("Login error:", error);
        showToast("Login failed. Please check your credentials and try again.", "error");
        return null;
    }
}

// ─── Logout ──────────────────────────────────────────────────────────────────

/**
 * Signs out the current user and redirects to login page.
 */
export async function logoutUser() {
    debug("Logging out user...");
    try {
        await signOut(auth);
        localStorage.removeItem("tenantId");
        localStorage.removeItem("userProfile");
        window.location.href = "login.html";
    } catch (error) {
        debugError("Logout error:", error);
        showToast("Unable to log out. Please try again.", "error");
    }
}

// ─── Password Reset ──────────────────────────────────────────────────────────

/**
 * Sends a password reset email to the given email address.
 * @param {string} email
 */
export async function resetPassword(email) {
    debug("Password reset requested for:", email);

    // For security, always show a generic success message to prevent email enumeration.
    const successMessage = "If an account with that email exists, a password reset link has been sent.";

    try {
        // Check if a user with this email exists in the 'users' collection.
        const usersRef = collection(db, "users");
        const q = query(usersRef, where("email", "==", email));
        const querySnapshot = await getDocs(q);

        if (querySnapshot.empty) {
            debug("Password reset requested for non-existent user, showing generic message:", email);
            showToast(successMessage, "success");
            return true; // Return true to the UI to complete the flow.
        }

        await sendPasswordResetEmail(auth, email);
        showToast(successMessage, "success");
        return true;
    } catch (error) {
        debugError("Password reset error:", error);
        showToast("Unable to send reset email. Please try again.", "error");
        return false;
    }
}

// ─── Session Management ──────────────────────────────────────────────────────

/**
 * Sets up an auth state listener.
 * When the user's auth state changes, this loads their Firestore profile
 * and calls the provided callback with the profile.
 * 
 * @param {Function} callback - Called with (userProfile) when auth state is resolved
 */
export function initAuthListener(callback) {
    onAuthStateChanged(auth, async (firebaseUser) => {
        debug("Auth state changed. User:", firebaseUser?.uid || "null");

        if (!firebaseUser) {
            // No user is signed in
            setCurrentUser(null);
            callback(null);
            return;
        }

        try {
            // Load user profile from Firestore
            const userDoc = await getDoc(doc(db, "users", firebaseUser.uid));

            if (!userDoc.exists()) {
                debugError("User document not found for UID:", firebaseUser.uid);
                setCurrentUser(null);
                callback(null);
                return;
            }

            const userProfile = userDoc.data();
            setCurrentUser(userProfile);

            // Cache user profile for instant sidebar render on next page load
            if (userProfile.tenantId) {
                localStorage.setItem("tenantId", userProfile.tenantId);
            }
            localStorage.setItem("userProfile", JSON.stringify(userProfile));

            debug("User profile loaded via listener:", userProfile);

            callback(userProfile);
        } catch (error) {
            debugError("Error loading user profile:", error);
            setCurrentUser(null);
            callback(null);
        }
    });
}

// ─── Helper: Get current Firebase user ───────────────────────────────────────

/**
 * Returns the current Firebase auth user (or null).
 * @returns {Object|null}
 */
export function getCurrentFirebaseUser() {
    return auth.currentUser;
}
