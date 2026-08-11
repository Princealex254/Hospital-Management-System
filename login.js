/**
 * PRINCE ALEX DIGITAL HMS — Login Page Logic
 * 
 * Handles:
 * - Login form submission
 * - Button loading state management
 * - Password reset requests
 */

import { loginUser, resetPassword } from "./auth.js";
import { showToast } from "./notifications.js";
import { debug, debugError } from "./debug.js";

document.addEventListener("DOMContentLoaded", () => {
    const loginForm = document.getElementById("login-form");
    const forgotPasswordLink = document.getElementById("forgot-password-link");
    const resetForm = document.getElementById("reset-form");
    const backToLoginLink = document.getElementById("back-to-login-link");

    if (loginForm) {
        loginForm.addEventListener("submit", handleLogin);
    }

    if (forgotPasswordLink) {
        forgotPasswordLink.addEventListener("click", showResetView);
    }

    if (resetForm) {
        resetForm.addEventListener("submit", handlePasswordReset);
    }

    if (backToLoginLink) {
        backToLoginLink.addEventListener("click", (e) => {
            e.preventDefault();
            showLoginView();
        });
    }
});

async function handleLogin(e) {
    e.preventDefault();

    const form = e.target;
    const email = form.email.value;
    const password = form.password.value;
    const submitBtn = form.querySelector('button[type="submit"]');
    const btnText = submitBtn.querySelector(".btn-text");
    const btnLoading = submitBtn.querySelector(".btn-loading");

    // Set loading state
    submitBtn.disabled = true;
    btnText.style.display = "none";
    btnLoading.style.display = "inline";

    try {
        const userProfile = await loginUser(email, password);

        // If login fails, loginUser returns null.
        // We need to reset the button so the user can try again.
        if (!userProfile) {
            submitBtn.disabled = false;
            btnText.style.display = "inline";
            btnLoading.style.display = "none";
        }
        // On success, loginUser handles the redirect, so we do nothing.

    } catch (error) {
        // This is a fallback, but loginUser should handle its own errors.
        debugError("Unhandled login error in UI:", error);
        showToast("An unexpected error occurred.", "error");
        submitBtn.disabled = false;
        btnText.style.display = "inline";
        btnLoading.style.display = "none";
    }
}

async function handlePasswordReset(e) {
    e.preventDefault();
    const email = document.getElementById("reset-email").value;
    if (email) {
        const success = await resetPassword(email);
        if (success) {
            // On success, show the login view again so they can sign in after resetting
            showLoginView();
        }
    }
}

function showResetView(e) {
    e.preventDefault();
    document.getElementById("login-view").style.display = "none";
    document.getElementById("reset-view").style.display = "block";
}

function showLoginView() {
    document.getElementById("reset-view").style.display = "none";
    document.getElementById("login-view").style.display = "block";
}