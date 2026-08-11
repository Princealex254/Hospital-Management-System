/**
 * PRINCE ALEX DIGITAL HMS — Lab Orders Module
 * 
 * Handles:
 * - Loading and displaying lab orders
 * - Filtering by status
 * - Updating order status (e.g., collect sample, enter result)
 */

import { db, collection, query, where, getDocs, orderBy, updateDoc, doc, serverTimestamp, addDoc } from "./firebase-config.js";
import { requireAuth } from "./auth-guard.js";
import { loadSidebar } from "./sidebar.js"; // Corrected import
import { showToast, showLoading, hideLoading, showConfirm, showModal, closeModal, createNotification } from "./notifications.js";
import { debug, debugError } from "./debug.js";
import { getTenantId, getCurrentUser, hasPermission, PERMISSIONS } from "./permissions.js";
import { icon } from "./icons.js";

let currentOrders = [];
let currentFilters = { search: "", status: "" };

document.addEventListener("DOMContentLoaded", async () => {
    debug("Lab Orders page: Initializing...");
    showLoading("Loading Lab Orders...");

    try {
        const user = await requireAuth();
        if (!user) return;

        await loadSidebar();
        const pageTitleEl = document.getElementById("page-title");
        if (pageTitleEl) pageTitleEl.textContent = "Lab Orders";

        await loadLabOrders();
        setupEventListeners();

        hideLoading();
        debug("Lab Orders page: Initialization complete.");
    } catch (error) {
        debugError("Lab Orders page initialization error:", error);
        hideLoading();
        showToast("Unable to load lab orders. Please try again.", "error");
    }
});

function setupEventListeners() {
    const searchInput = document.getElementById("order-search");
    const statusFilter = document.getElementById("filter-status");
    const refreshBtn = document.getElementById("refresh-btn");

    if (searchInput) {
        searchInput.addEventListener("input", (e) => {
            currentFilters.search = e.target.value.toLowerCase();
            applyFilters();
        });
    }

    if (statusFilter) {
        statusFilter.addEventListener("change", (e) => {
            currentFilters.status = e.target.value;
            applyFilters();
        });
    }

    if (refreshBtn) {
        refreshBtn.addEventListener("click", loadLabOrders);
    }
}

async function loadLabOrders() {
    debug("Loading lab orders...");
    const tenantId = getTenantId();
    if (!tenantId) return;

    try {
        showLoading("Fetching orders...");
        const q = query(
            collection(db, "labOrders"),
            where("tenantId", "==", tenantId),
            orderBy("createdAt", "desc")
        );
        const snapshot = await getDocs(q);
        currentOrders = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        
        applyFilters();
        hideLoading();
    } catch (error) {
        debugError("Error loading lab orders:", error);
        hideLoading();
        showToast("Failed to load lab orders.", "error");
    }
}

function applyFilters() {
    let filteredOrders = [...currentOrders];

    if (currentFilters.search) {
        filteredOrders = filteredOrders.filter(order => 
            (order.patientName?.toLowerCase().includes(currentFilters.search)) ||
            (order.testName?.toLowerCase().includes(currentFilters.search))
        );
    }

    if (currentFilters.status) {
        filteredOrders = filteredOrders.filter(order => order.status === currentFilters.status);
    }

    renderLabOrders(filteredOrders);
}

function renderLabOrders(orders) {
    const tbody = document.getElementById("lab-orders-tbody");
    const countEl = document.getElementById("order-count");

    if (countEl) {
        countEl.textContent = `${orders.length} order(s)`;
    }

    if (!tbody) return;

    if (orders.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" class="text-center p-4">No lab orders found.</td></tr>`;
        return;
    }

tbody.innerHTML = orders.map(order => {
        const status = order.status || 'ordered';
        const tests = (order.tests && order.tests.length > 0) ? order.tests : [{ testName: order.testName, status: order.status }];
        const testNames = tests.map(t => t.testName).filter(Boolean).join(", ") || order.testName || 'N/A';
        return `
            <tr>
                <td>${formatDate(order.createdAt)}</td>
                <td><strong>${escapeHtml(order.patientName || 'N/A')}</strong></td>
                <td>
                    ${escapeHtml(testNames)}
                    ${tests.length > 1 ? ` <span class="badge badge-secondary">${tests.length} tests</span>` : ""}
                </td>
                <td>${escapeHtml(order.doctorName || 'N/A')}</td>
                <td><span class="badge badge-${getStatusBadge(status)}">${escapeHtml(status)}</span></td>
                <td class="text-right">
                    <div class="table-actions">
                        <button class="btn btn-sm btn-outline" onclick="window.viewLabOrder('${order.id}')">${icon('eye', '18')} View</button>
                        ${renderActionButtons(order)}
                    </div>
                </td>
            </tr>
        `;
    }).join('');

    // Add event listeners for action buttons
    tbody.querySelectorAll('[data-action]').forEach(button => {
        button.addEventListener('click', handleActionClick);
    });
}

function renderActionButtons(order) {
    const status = order.status;
    let buttons = '';

if (status === 'ordered') {
        buttons += `<button type="button" class="btn btn-sm btn-primary" data-action="collect-sample" data-id="${order.id}">${icon('check', '18')} Collect Sample</button>`;
    }
    if (status === 'sample-collected') {
        buttons += `<button type="button" class="btn btn-sm btn-info" data-action="start-processing" data-id="${order.id}">${icon('activity', '18')} Start Processing</button>`;
    }
    if (status === 'in-progress') {
        buttons += `<button type="button" class="btn btn-sm btn-warning" data-action="enter-result" data-id="${order.id}">${icon('edit', '18')} Enter Result</button>`;
    }
    if (status === 'completed') {
        buttons += `<button type="button" class="btn btn-sm btn-success" data-action="verify-result" data-id="${order.id}">${icon('check', '18')} Verify Result</button>`;
    }
    if (status === 'verified') {
        buttons += `<a href="lab-results.html?orderId=${order.id}" class="btn btn-sm btn-outline">${icon('eye', '18')} View Result</a>`;
    }
    if (status === 'rejected') {
        buttons += `<button type="button" class="btn btn-sm btn-error" data-action="reprocess-order" data-id="${order.id}">${icon('refresh', '18')} Reprocess</button>`;
    }

    return buttons;
}

async function handleActionClick(e) {
    e.preventDefault();
    const button = e.target.closest('[data-action]');
    if (!button) return;
    const action = button.dataset.action;
    const orderId = button.dataset.id;

    switch (action) {
        case 'collect-sample':
            await updateOrderStatus(orderId, 'sample-collected', 'Sample collected successfully.');
            break;
        case 'start-processing':
            await updateOrderStatus(orderId, 'in-progress', 'Order marked as in-progress.');
            break;
        case 'enter-result':
            await showProcessResultModal(orderId);
            break;
        case 'verify-result':
            if (!hasPermission(PERMISSIONS.LAB_RESULT_VERIFY)) {
                showToast("You don't have permission to verify results.", "error");
                return;
            }
            await updateOrderStatus(orderId, 'verified', 'Result verified successfully.', orderId); // Pass orderId to notify doctor
            break;
        case 'reprocess-order':
            await updateOrderStatus(orderId, 'in-progress', 'Order sent for re-processing.');
            break;
    }
}

async function updateOrderStatus(orderId, newStatus, successMessage) {
    debug(`Updating order ${orderId} to ${newStatus}`);
    showLoading("Updating status...");

    try {
        const orderRef = doc(db, "labOrders", orderId);
        await updateDoc(orderRef, {
            status: newStatus,
            updatedAt: serverTimestamp()
        });

        await addDoc(collection(db, "auditLogs"), {
            tenantId: getTenantId(),
            userId: getCurrentUser()?.uid || "",
            action: `UPDATE_LAB_ORDER_STATUS`,
            module: "laboratory",
            recordId: orderId,
            details: { newStatus },
            createdAt: serverTimestamp()
        });

        showToast(successMessage, "success");
        await loadLabOrders();
    } catch (error) {
        debugError(`Error updating order ${orderId}:`, error);
        showToast("Failed to update order status.", "error");
    } finally {
        hideLoading();
    }
}

function getStatusBadge(status) {
    if (!status) return "secondary";
    const s = status.toLowerCase();
    if (s === 'verified') return 'success';
    if (s === 'completed') return 'primary'; // Completed but not yet verified
    if (s === 'ordered') return 'info';
    if (s === 'sample-collected' || s === 'in-progress') return 'warning';
    if (s === 'cancelled') return 'error';
    return 'secondary';
}

function formatDate(timestamp) {
    if (!timestamp) return "—";
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleDateString("en-GB", { day: '2-digit', month: 'short', year: 'numeric' });
}

function escapeHtml(text) {
    if (!text) return "";
    return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
}

/**
 * Opens a modal showing an order's tests and their statuses.
 * @param {string} orderId
 */
window.viewLabOrder = function(orderId) {
    const order = currentOrders.find(o => o.id === orderId);
    if (!order) {
        showToast("Order not found.", "error");
        return;
    }

    const tests = (order.tests && order.tests.length > 0) ? order.tests : [{ testName: order.testName, notes: order.notes, status: order.status }];
    const testsHtml = tests.map(t => {
        const tStatus = (t.status || order.status || "ordered").toLowerCase();
        return `
            <tr>
                <td>${escapeHtml(t.testName || "N/A")}</td>
                <td>${escapeHtml(t.notes || "—")}</td>
                <td><span class="badge badge-${getStatusBadge(tStatus)}">${escapeHtml(tStatus)}</span></td>
            </tr>
        `;
    }).join('');

    const modalHtml = `
        <div class="modal" style="max-width: 640px;">
            <div class="modal-header">
                <h3>Lab Order Details</h3>
                <button class="modal-close" data-modal-close>&times;</button>
            </div>
            <div class="modal-body">
                <div class="form-section" style="margin-bottom: 16px; padding-bottom: 16px; border-bottom: 1px solid #e5e7eb;">
                    <div class="form-grid form-grid-2">
                        <div><strong>Patient:</strong> ${escapeHtml(order.patientName || 'N/A')}</div>
                        <div><strong>Doctor:</strong> ${escapeHtml(order.doctorName || 'N/A')}</div>
                        <div><strong>Order Date:</strong> ${formatDate(order.createdAt)}</div>
                        <div><strong>Order Status:</strong> <span class="badge badge-${getStatusBadge(order.status)}">${escapeHtml(order.status || 'ordered')}</span></div>
                    </div>
                </div>
                <div class="form-section-title">Tests in this Request</div>
                <div class="table-container">
                    <table class="table table-sm">
                        <thead>
                            <tr><th>Test</th><th>Notes</th><th>Status</th></tr>
                        </thead>
                        <tbody>${testsHtml}</tbody>
                    </table>
                </div>
            </div>
            <div class="modal-footer">
                <button class="btn btn-secondary" data-modal-close>Close</button>
            </div>
        </div>
    `;

    showModal(modalHtml, "Lab Order Details");
};

/**
 * Shows a modal to enter lab results for an order.
 * @param {string} orderId 
 */
async function showProcessResultModal(orderId) {
    const order = currentOrders.find(o => o.id === orderId);
    if (!order) {
        showToast("Order not found.", "error");
        return;
    }

    const tests = (order.tests && order.tests.length > 0) ? order.tests : [{ testName: order.testName, status: order.status }];

    // Only show tests that still need a result; fall back to all tests if none
    // have been completed yet.
    const pendingTests = tests.filter(t => !["completed", "verified"].includes((t.status || order.status || "ordered").toLowerCase()));
    const testsToRender = pendingTests.length > 0 ? pendingTests : tests;

    const testRowsHtml = testsToRender.map((t, idx) => {
        const safeName = escapeHtml(t.testName || "Test");
        return `
            <div class="form-section" style="margin-bottom: 16px; padding-bottom: 16px; border-bottom: 1px solid #e5e7eb;">
                <h4 style="margin: 0 0 12px 0; color: #374151;">${idx + 1}. ${safeName}</h4>
                <div class="form-group">
                    <label class="form-label required" for="lab-result-value-${idx}">Result Value</label>
                    <input type="text" id="lab-result-value-${idx}" class="form-input" data-test="${safeName}" placeholder="Enter result for ${safeName}">
                </div>
                <div class="form-group">
                    <label class="form-label" for="lab-result-notes-${idx}">Notes / Interpretation</label>
                    <textarea id="lab-result-notes-${idx}" class="form-textarea" rows="2" placeholder="Additional notes..."></textarea>
                </div>
            </div>
        `;
    }).join('');

    const modalHtml = `
        <div class="modal" style="max-width: 700px;">
            <div class="modal-header">
                <h3>Enter Lab Results</h3>
                <button class="modal-close" data-modal-close>&times;</button>
            </div>
            <div class="modal-body">
                <div class="form-section" style="margin-bottom: 20px; padding-bottom: 20px; border-bottom: 1px solid #e5e7eb;">
                    <h4 style="margin-bottom: 15px; color: #374151;">Order Information</h4>
                    <div class="form-grid form-grid-2">
                        <div><strong>Patient:</strong> ${escapeHtml(order.patientName || 'N/A')}</div>
                        <div><strong>Doctor:</strong> ${escapeHtml(order.doctorName || 'N/A')}</div>
                        <div><strong>Order Date:</strong> ${formatDate(order.createdAt)}</div>
                        <div><strong>Pending Tests:</strong> <span class="badge badge-secondary">${testsToRender.length}</span></div>
                    </div>
                </div>
                ${testRowsHtml}
            </div>
            <div class="modal-footer">
                <button class="btn btn-secondary" data-modal-close>Cancel</button>
                <button class="btn btn-primary" onclick="submitLabResult('${orderId}')">Submit Results</button>
            </div>
        </div>
    `;

    showModal(modalHtml, "Enter Lab Results");
}

/**
 * Submits the lab result and creates a lab result record.
 * @param {string} orderId 
 */
window.submitLabResult = async function(orderId) {
    const order = currentOrders.find(o => o.id === orderId);
    if (!order) {
        showToast("Order not found.", "error");
        return;
    }

    const tests = (order.tests && order.tests.length > 0) ? order.tests : [{ testName: order.testName, status: order.status }];

    // Collect the result entered for each test that still needs one.
    const entries = [];
    tests.forEach((t, idx) => {
        const tStatus = (t.status || order.status || "ordered").toLowerCase();
        if (["completed", "verified"].includes(tStatus)) return; // skip done tests

        const valueInput = document.getElementById(`lab-result-value-${idx}`);
        const notesInput = document.getElementById(`lab-result-notes-${idx}`);
        const value = valueInput ? valueInput.value.trim() : "";
        const notes = notesInput ? notesInput.value.trim() : "";

        const testName = t.testName || order.testName || "Test";
        if (value) {
            entries.push({ testName, value, notes, index: idx });
        }
    });

    if (entries.length === 0) {
        showToast("Please enter at least one result value.", "error");
        return;
    }

    try {
        showLoading("Submitting lab results...");

        const tenantId = getTenantId();
        const currentUser = getCurrentUser();

        let lastResultId = null;

        // Create a lab result document for each entered test result.
        for (const entry of entries) {
            const resultRef = await addDoc(collection(db, "labResults"), {
                tenantId,
                orderId: orderId,
                patientId: order.patientId,
                patientName: order.patientName || "Unknown Patient",
                testName: entry.testName,
                result: entry.value,
                notes: entry.notes || null,
                status: "pending",
                createdAt: serverTimestamp(),
                createdBy: currentUser?.uid || ""
            });
            lastResultId = resultRef.id;

            // Log audit for this result.
            await addDoc(collection(db, "auditLogs"), {
                tenantId,
                userId: currentUser?.uid || "",
                action: "CREATE_LAB_RESULT",
                module: "labResults",
                recordId: resultRef.id,
                details: {
                    orderId: orderId,
                    patientName: order.patientName,
                    testName: entry.testName,
                    result: entry.value
                },
                createdAt: serverTimestamp()
            });
        }

        // Update the status of each completed test within the grouped order,
        // and mark the whole order completed when all tests have results.
        const completedNames = entries.map(e => e.testName);
        const updatedTests = tests.map(t => {
            if (completedNames.includes(t.testName || order.testName)) return { ...t, status: "completed" };
            return t;
        });
        const allDone = updatedTests.every(t => ["completed", "verified"].includes((t.status || "ordered").toLowerCase()));
        const orderUpdate = {
            updatedAt: serverTimestamp()
        };
        if (updatedTests.length > 1) {
            orderUpdate.tests = updatedTests;
        }
        if (allDone) {
            orderUpdate.status = "completed";
            orderUpdate.resultId = lastResultId;
        }
        await updateDoc(doc(db, "labOrders", orderId), orderUpdate);

        // Return the patient to the doctor's consultation queue once their lab
        // results are submitted, so the doctor can review and continue.
        if (order.visitId && allDone) {
            try {
                await updateDoc(doc(db, "opd", order.visitId), {
                    status: "WAITING_DOCTOR",
                    labsCompletedAt: serverTimestamp(),
                    updatedAt: serverTimestamp()
                });

                await addDoc(collection(db, "auditLogs"), {
                    tenantId,
                    userId: currentUser?.uid || "",
                    action: "RETURN_TO_DOCTOR_AFTER_LAB",
                    module: "laboratory",
                    recordId: order.visitId,
                    details: { resultId: lastResultId, orderId, resultCount: entries.length },
                    createdAt: serverTimestamp()
                });

                debug("Visit returned to doctor's queue:", order.visitId);
            } catch (visitError) {
                debugError("Error returning visit to doctor's queue:", visitError);
            }
        }

        // Notify the ordering doctor about the results.
        await createNotification({
            tenantId: tenantId,
            userId: order.doctorId, // Assuming doctorId is stored in the order
            title: "Lab Results Ready",
            message: `Results for ${entries.map(e => e.testName).join(", ")} for patient ${order.patientName} are ready.`,
            type: "lab",
            link: `lab-results.html?resultId=${lastResultId}`
        });

        hideLoading();
        closeModal();
        showToast(`${entries.length} lab result(s) submitted successfully!`, "success");
        await loadLabOrders();
    } catch (error) {
        debugError("Error submitting lab results:", error);
        hideLoading();
        showToast("Unable to submit lab results. Please try again.", "error");
    }
};
