/**
 * PRINCE ALEX DIGITAL HMS - Subscription Plans Module
 *
 * Loads and displays subscription plans for platform administrators.
 */

import { db, collection, getDocs } from "./firebase-config.js";
import { requireAuth } from "./auth-guard.js";
import { loadSidebar } from "./sidebar.js";
import { showToast, showLoading, hideLoading } from "./notifications.js";
import { debug, debugError } from "./debug.js";

const plansCollection = collection(db, "plans");

document.addEventListener("DOMContentLoaded", async () => {
    debug("Plans page: Initializing...");
    showLoading("Loading plans...");

    try {
        const user = await requireAuth();
        if (!user) return;

        await loadSidebar();
        await loadPlans();
        setupAddPlanButton();
        hideLoading();
        debug("Plans page: Initialization complete.");
    } catch (error) {
        debugError("Plans page initialization error:", error);
        hideLoading();
        renderEmptyState("Unable to load plans.");
        showToast("Unable to load plans. Please try again.", "error");
    }
});

async function loadPlans() {
    try {
        const snapshot = await getDocs(plansCollection);
        const plans = snapshot.docs.map(planDoc => ({ id: planDoc.id, ...planDoc.data() }));
        renderPlans(plans);
        updatePlanCount(plans.length);
        debug("Plans loaded:", plans.length);
    } catch (error) {
        debugError("Error loading plans:", error);
        renderEmptyState("Unable to load plans.");
        showToast("Unable to load plans. Please try again.", "error");
    }
}

function renderPlans(plans) {
    const tbody = document.getElementById("plans-tbody");
    if (!tbody) return;

    if (plans.length === 0) {
        renderEmptyState("No plans found.");
        return;
    }

    tbody.innerHTML = plans.map(plan => {
        const features = Array.isArray(plan.features) ? plan.features.join(", ") : (plan.features || "-");
        const status = plan.status || "active";
        const price = plan.price === undefined || plan.price === null ? "-" : plan.price;

        return `
            <tr>
                <td><strong>${escapeHtml(plan.name || "Unnamed plan")}</strong></td>
                <td>${escapeHtml(String(price))}</td>
                <td>${escapeHtml(plan.duration || "-")}</td>
                <td>${escapeHtml(String(features))}</td>
                <td><span class="badge badge-${status === "active" ? "success" : "error"}">${escapeHtml(status)}</span></td>
                <td class="text-right">-</td>
            </tr>
        `;
    }).join("");
}

function renderEmptyState(message) {
    const tbody = document.getElementById("plans-tbody");
    if (!tbody) return;
    tbody.innerHTML = `<tr><td colspan="6"><div class="table-empty"><h3>${escapeHtml(message)}</h3></div></td></tr>`;
}

function updatePlanCount(count) {
    const countElement = document.getElementById("plan-count");
    if (countElement) countElement.textContent = `${count} plan${count === 1 ? "" : "s"}`;
}

function setupAddPlanButton() {
    const addPlanButton = document.getElementById("add-plan-btn");
    if (!addPlanButton) return;

    addPlanButton.addEventListener("click", () => {
        showToast("Plan creation is not available yet.", "info");
    });
}

function escapeHtml(value) {
    if (!value) return "";
    const div = document.createElement("div");
    div.textContent = value;
    return div.innerHTML;
}

export { loadPlans };
