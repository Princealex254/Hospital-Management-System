/**
 * PRINCE ALEX DIGITAL HMS — Leave Management Module
 * 
 * Handles:
 * - Loading and displaying leave requests from Firestore
 * - Creating new leave requests
 * - Approving/rejecting leave requests
 * - Audit logging
 */

import { db, collection, query, where, getDocs, orderBy, addDoc, updateDoc, doc, serverTimestamp } from "./firebase-config.js";
import { requireAuth } from "./auth-guard.js";
import { loadSidebar } from "./sidebar.js";
import { showToast, showLoading, hideLoading, showModal } from "./notifications.js";
import { debug, debugError } from "./debug.js";
import { icon } from "./icons.js";
import { getTenantId, getCurrentUser, hasPermission, PERMISSIONS } from "./permissions.js";

document.addEventListener("DOMContentLoaded", async () => {
    debug("Leave page: Initializing...");
    showLoading("Loading leave requests...");
    try {
        const user = await requireAuth();
        if (!user) return;

        // Load role-based sidebar navigation
        await loadSidebar();
                const pageTitleEl = document.getElementById("page-title"); if (pageTitleEl) pageTitleEl.textContent = "Leave Management";
        await loadLeaveRequests();
        await loadStaffList();
        setupRequestButton();
        debug();
        debug("Leave page: Initialization complete.");
    } catch (error) {
        debugError("Leave page initialization error:", error);
        hideLoading();
        showToast("Unable to load leave page. Please try again.", "error");
        return;
    }
    hideLoading();
});

let currentRequests = [];
let staffList = [];

async function loadLeaveRequests() {
    debug("Loading leave requests...");
    const tenantId = getTenantId();
    if (!tenantId) return;
    try {
        const q = query(
            collection(db, "leaveRequests"),
            where("tenantId", "==", tenantId),
            orderBy("createdAt", "desc")
        );
        const snapshot = await getDocs(q);
        currentRequests = [];
        snapshot.forEach((doc) => {
            currentRequests.push({ id: doc.id, ...doc.data() });
        });
        debug("Leave requests loaded:", currentRequests.length);
        renderRequests(currentRequests);
        updateRequestCount(currentRequests.length);
    } catch (error) {
        debugError("Error loading leave requests:", error);
        showToast("Unable to load leave requests. Please try again.", "error");
        renderEmptyState("Unable to load leave requests.");
    }
}

async function loadStaffList() {
    debug("Loading staff for leave...");
    const tenantId = getTenantId();
    if (!tenantId) return;
    try {
        const q = query(
            collection(db, "staff"),
            where("tenantId", "==", tenantId),
            where("status", "==", "active"),
            orderBy("name")
        );
        const snapshot = await getDocs(q);
        staffList = [];
        snapshot.forEach((doc) => {
            staffList.push({ id: doc.id, ...doc.data() });
        });
        debug("Staff loaded for leave:", staffList.length);
    } catch (error) {
        debugError("Error loading staff for leave:", error);
    }
}

function renderRequests(requests) {
    const tbody = document.getElementById("leave-tbody");
    if (!tbody) return;
    if (requests.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7"><div class="table-empty"><div class="empty-icon">${icon('leave', '18', 'icon-svg')}</div><h3>No leave requests found</h3></div></td></tr>`;
        return;
    }
    tbody.innerHTML = requests.map((request) => {
        const status = request.status || "pending";
        const days = calculateDays(request.startDate, request.endDate);
        return `
            <tr>
                <td><strong>${escapeHtml(request.staffName || "")}</strong></td>
                <td>${escapeHtml(request.type || "")}</td>
                <td>${formatDate(request.startDate)}</td>
                <td>${formatDate(request.endDate)}</td>
                <td>${days}</td>
                <td><span class="badge badge-${getStatusBadge(status)}">${escapeHtml(status)}</span></td>
                <td class="text-right">
                    <div class="table-actions">
                        ${status === "pending"
                            ? `<button class="btn btn-sm btn-success" onclick="approveLeave('${request.id}')"> ${icon('check', '18', 'icon-svg')} Approve</button>
                               <button class="btn btn-sm btn-error" onclick="rejectLeave('${request.id}')"> ${icon('close', '18', 'icon-svg')} Reject</button>`
                            : ""
                        }
                    </div>
                </td>
            </tr>
        `;
    }).join("");
}

function renderEmptyState(message) {
    const tbody = document.getElementById("leave-tbody");
    if (!tbody) return;
    tbody.innerHTML = `<tr><td colspan="7"><div class="table-empty"><div class="empty-icon">${icon('leave', '18', 'icon-svg')}</div><h3>${escapeHtml(message)}</h3></div></td></tr>`;
}

function updateRequestCount(count) {
    const el = document.getElementById("leave-count");
    if (el) el.textContent = `${count} request${count !== 1 ? "s" : ""}`;
}

function setupRequestButton() {
    const requestBtn = document.getElementById("request-leave-btn");
    if (requestBtn) {
        requestBtn.addEventListener("click", () => {
            if (!hasPermission(PERMISSIONS.STAFF_UPDATE)) {
                showToast("You don't have permission to request leave.", "error");
                return;
            }
            showRequestLeaveModal();
        });
    }
}

function showRequestLeaveModal() {
    const staffOptions = staffList.map(s => `<option value="${s.id}" data-name="${escapeHtml(s.name || "")}">${escapeHtml(s.name || "")}</option>`).join("");
    const modalHtml = `
        <div class="modal" style="max-width: 600px;">
            <div class="modal-header"><h3>Request Leave</h3><button class="modal-close" onclick="closeModal()">&times;</button></div>
            <div class="modal-body">
                <div class="form-group">
                    <label class="form-label required" for="leave-staff">Staff Member</label>
                    <select id="leave-staff" class="form-select">
                        <option value="">Select Staff</option>
                        ${staffOptions}
                    </select>
                </div>
                <div class="form-group">
                    <label class="form-label required" for="leave-type">Leave Type</label>
                    <select id="leave-type" class="form-select">
                        <option value="annual">Annual</option>
                        <option value="sick">Sick</option>
                        <option value="maternity">Maternity</option>
                        <option value="paternity">Paternity</option>
                        <option value="unpaid">Unpaid</option>
                    </select>
                </div>
                <div class="form-grid form-grid-2">
                    <div class="form-group">
                        <label class="form-label required" for="leave-start">Start Date</label>
                        <input type="date" id="leave-start" class="form-input">
                    </div>
                    <div class="form-group">
                        <label class="form-label required" for="leave-end">End Date</label>
                        <input type="date" id="leave-end" class="form-input">
                    </div>
                </div>
                <div class="form-group">
                    <label class="form-label" for="leave-reason">Reason</label>
                    <textarea id="leave-reason" class="form-textarea" placeholder="Reason for leave..."></textarea>
                </div>
            </div>
            <div class="modal-footer">
                <button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
                <button class="btn btn-primary" onclick="saveLeaveRequest()">Submit Request</button>
            </div>
        </div>
    `;
    showModal(modalHtml);
}

window.saveLeaveRequest = async function() {
    debug("Saving leave request...");
    const tenantId = getTenantId();
    if (!tenantId) return;

    const staffId = document.getElementById("leave-staff")?.value;
    const type = document.getElementById("leave-type")?.value;
    const startDate = document.getElementById("leave-start")?.value;
    const endDate = document.getElementById("leave-end")?.value;
    const reason = document.getElementById("leave-reason")?.value.trim();

    if (!staffId || !type || !startDate || !endDate) {
        showToast("Please fill in all required fields.", "error");
        return;
    }

    try {
        showLoading("Submitting leave request...");
        const staffMember = staffList.find(s => s.id === staffId);
        const staffName = staffMember?.name || "";

        await addDoc(collection(db, "leaveRequests"), {
            tenantId,
            staffId,
            staffName,
            type,
            startDate: new Date(startDate),
            endDate: new Date(endDate),
            reason: reason || null,
            status: "pending",
            createdAt: serverTimestamp(),
            createdBy: getCurrentUser()?.uid || ""
        });

        await addDoc(collection(db, "auditLogs"), {
            tenantId,
            userId: getCurrentUser()?.uid || "",
            action: "CREATE_LEAVE_REQUEST",
            module: "leave",
            details: { staffName, type, startDate, endDate },
            createdAt: serverTimestamp()
        });

        hideLoading();
        showToast("Leave request submitted successfully!", "success");
        closeModal();
        await loadLeaveRequests();
    } catch (error) {
        debugError("Error saving leave request:", error);
        hideLoading();
        showToast("Unable to submit leave request. Please try again.", "error");
    }
};

window.approveLeave = async function(requestId) {
    debug("Approving leave request:", requestId);
    try {
        showLoading("Approving leave...");
        await updateDoc(doc(db, "leaveRequests", requestId), {
            status: "approved",
            approvedBy: getCurrentUser()?.uid || "",
            updatedAt: serverTimestamp()
        });
        await addDoc(collection(db, "auditLogs"), {
            tenantId: getTenantId(),
            userId: getCurrentUser()?.uid || "",
            action: "APPROVE_LEAVE",
            module: "leave",
            recordId: requestId,
            createdAt: serverTimestamp()
        });
        hideLoading();
        showToast("Leave request approved!", "success");
        await loadLeaveRequests();
    } catch (error) {
        debugError("Error approving leave:", error);
        hideLoading();
        showToast("Unable to approve leave. Please try again.", "error");
    }
};

window.rejectLeave = async function(requestId) {
    debug("Rejecting leave request:", requestId);
    try {
        showLoading("Rejecting leave...");
        await updateDoc(doc(db, "leaveRequests", requestId), {
            status: "rejected",
            rejectedBy: getCurrentUser()?.uid || "",
            updatedAt: serverTimestamp()
        });
        await addDoc(collection(db, "auditLogs"), {
            tenantId: getTenantId(),
            userId: getCurrentUser()?.uid || "",
            action: "REJECT_LEAVE",
            module: "leave",
            recordId: requestId,
            createdAt: serverTimestamp()
        });
        hideLoading();
        showToast("Leave request rejected.", "success");
        await loadLeaveRequests();
    } catch (error) {
        debugError("Error rejecting leave:", error);
        hideLoading();
        showToast("Unable to reject leave. Please try again.", "error");
    }
};

function calculateDays(startDate, endDate) {
    if (!startDate || !endDate) return 0;
    const start = startDate.toDate ? startDate.toDate() : new Date(startDate);
    const end = endDate.toDate ? endDate.toDate() : new Date(endDate);
    const diffTime = Math.abs(end - start);
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
}

function getStatusBadge(status) {
    if (!status) return "secondary";
    const s = status.toLowerCase();
    if (s.includes("approved")) return "success";
    if (s.includes("pending")) return "warning";
    if (s.includes("rejected")) return "error";
    return "secondary";
}

function formatDate(date) {
    if (!date) return "—";
    if (date.toDate) date = date.toDate();
    if (date instanceof Date) {
        return date.toLocaleDateString("en-GB", { year: "numeric", month: "short", day: "numeric" });
    }
    return String(date);
}

function escapeHtml(text) {
    if (!text) return "";
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
}

export { loadLeaveRequests };