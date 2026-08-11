/**
 * PRINCE ALEX DIGITAL HMS — Attendance Module
 * 
 * Handles:
 * - Loading and displaying attendance records from Firestore
 * - Filtering by date and status
 * - Recording new attendance
 * - Audit logging
 */

import { db, collection, query, where, getDocs, orderBy, addDoc, serverTimestamp } from "./firebase-config.js";
import { requireAuth } from "./auth-guard.js";
import { loadSidebar } from "./sidebar.js";
import { showToast, showLoading, hideLoading, showModal } from "./notifications.js";
import { debug, debugError } from "./debug.js";
import { icon } from "./icons.js";
import { getTenantId, getCurrentUser, hasPermission, PERMISSIONS } from "./permissions.js";

document.addEventListener("DOMContentLoaded", async () => {
    debug("Attendance page: Initializing...");
    showLoading("Loading attendance...");
    try {
        const user = await requireAuth();
        if (!user) return;

        // Load role-based sidebar navigation
        await loadSidebar();

        // Set page title (if header exists)
        const pageTitleEl = document.getElementById("page-title");
        if (pageTitleEl) pageTitleEl.textContent = "Attendance";

        // Set today's date (if date input exists)
        const dateInput = document.getElementById("attendance-date");
        if (dateInput) dateInput.value = new Date().toISOString().split("T")[0];
        await loadStaffList();
        await loadAttendance();
        setupFilters();
        setupMarkButton();
        hideLoading();
        debug("Attendance page: Initialization complete.");
    } catch (error) {
        debugError("Attendance page initialization error:", error);
        hideLoading();
        showToast("Unable to load attendance page. Please try again.", "error");
    }
});

let currentAttendance = [];
let staffList = [];
let currentFilters = { date: "", status: "" };

async function loadStaffList() {
    debug("Loading staff list...");
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
        debug("Staff loaded:", staffList.length);
    } catch (error) {
        debugError("Error loading staff:", error);
    }
}

async function loadAttendance() {
    debug("Loading attendance...");
    const tenantId = getTenantId();
    if (!tenantId) return;
    try {
        const q = query(
            collection(db, "attendance"),
            where("tenantId", "==", tenantId),
            orderBy("date", "desc")
        );
        const snapshot = await getDocs(q);
        currentAttendance = [];
        snapshot.forEach((doc) => {
            currentAttendance.push({ id: doc.id, ...doc.data() });
        });
        debug("Attendance loaded:", currentAttendance.length);
        renderAttendance(currentAttendance);
        updateAttendanceCount(currentAttendance.length);
    } catch (error) {
        debugError("Error loading attendance:", error);
        showToast("Unable to load attendance. Please try again.", "error");
        renderEmptyState("Unable to load attendance.");
    }
}

function renderAttendance(records) {
    const tbody = document.getElementById("attendance-tbody");
    if (!tbody) return;
    if (records.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6"><div class="table-empty"><div class="empty-icon">${icon('file', '18', 'icon-svg')}</div><h3>No attendance records found</h3></div></td></tr>`;
        return;
    }
    tbody.innerHTML = records.map((record) => {
        const status = record.status || "present";
        return `
            <tr>
                <td>${formatDate(record.date)}</td>
                <td><strong>${escapeHtml(record.staffName || "")}</strong></td>
                <td>${escapeHtml(record.role || "")}</td>
                <td>${record.checkInTime || "—"}</td>
                <td>${record.checkOutTime || "—"}</td>
                <td><span class="badge badge-${status === "present" ? "success" : "error"}">${escapeHtml(status)}</span></td>
            </tr>
        `;
    }).join("");
}

function renderEmptyState(message) {
    const tbody = document.getElementById("attendance-tbody");
    if (!tbody) return;
    tbody.innerHTML = `<tr><td colspan="6"><div class="table-empty"><div class="empty-icon">${icon('lab-orders', '18', 'icon-svg')}</div><h3>${escapeHtml(message)}</h3></div></td></tr>`;
}

function updateAttendanceCount(count) {
    const el = document.getElementById("attendance-count");
    if (el) el.textContent = `${count} record${count !== 1 ? "s" : ""}`;
}

function setupFilters() {
    const dateInput = document.getElementById("attendance-date");
    const statusFilter = document.getElementById("filter-status");
    if (dateInput) {
        dateInput.addEventListener("change", (e) => {
            currentFilters.date = e.target.value;
            applyFilters();
        });
    }
    if (statusFilter) {
        statusFilter.addEventListener("change", (e) => {
            currentFilters.status = e.target.value;
            applyFilters();
        });
    }
}

function applyFilters() {
    debug("Applying filters:", currentFilters);
    const filtered = currentAttendance.filter((record) => {
        if (currentFilters.date) {
            const recordDate = record.date && record.date.toDate ? record.date.toDate().toISOString().split("T")[0] : "";
            if (recordDate !== currentFilters.date) return false;
        }
        if (currentFilters.status && record.status !== currentFilters.status) return false;
        return true;
    });
    renderAttendance(filtered);
    updateAttendanceCount(filtered.length);
}

function setupMarkButton() {
    const markBtn = document.getElementById("mark-attendance-btn");
    if (markBtn) {
        markBtn.addEventListener("click", () => {
            if (!hasPermission(PERMISSIONS.STAFF_UPDATE)) {
                showToast("You don't have permission to record attendance.", "error");
                return;
            }
            showMarkAttendanceModal();
        });
    }
}

function showMarkAttendanceModal() {
    const staffOptions = staffList.map(s => `<option value="${s.id}" data-name="${escapeHtml(s.name || "")}" data-role="${escapeHtml(s.role || "")}">${escapeHtml(s.name || "")}</option>`).join("");
    const modalHtml = `
        <div class="modal" style="max-width: 600px;">
            <div class="modal-header"><h3>Record Attendance</h3><button class="modal-close" onclick="closeModal()">&times;</button></div>
            <div class="modal-body">
                <div class="form-group">
                    <label class="form-label required" for="att-staff">Staff Member</label>
                    <select id="att-staff" class="form-select">
                        <option value="">Select Staff</option>
                        ${staffOptions}
                    </select>
                </div>
                <div class="form-grid form-grid-2">
                    <div class="form-group">
                        <label class="form-label" for="att-check-in">Check-in Time</label>
                        <input type="time" id="att-check-in" class="form-input" value="08:00">
                    </div>
                    <div class="form-group">
                        <label class="form-label" for="att-check-out">Check-out Time</label>
                        <input type="time" id="att-check-out" class="form-input" value="17:00">
                    </div>
                </div>
                <div class="form-group">
                    <label class="form-label required" for="att-status">Status</label>
                    <select id="att-status" class="form-select">
                        <option value="present">Present</option>
                        <option value="absent">Absent</option>
                    </select>
                </div>
            </div>
            <div class="modal-footer">
                <button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
                <button class="btn btn-primary" onclick="saveAttendance()">Record Attendance</button>
            </div>
        </div>
    `;
    showModal(modalHtml);
}

window.saveAttendance = async function() {
    debug("Saving attendance...");
    const tenantId = getTenantId();
    if (!tenantId) return;

    const staffId = document.getElementById("att-staff")?.value;
    const checkIn = document.getElementById("att-check-in")?.value;
    const checkOut = document.getElementById("att-check-out")?.value;
    const status = document.getElementById("att-status")?.value;
    const date = document.getElementById("attendance-date")?.value;

    if (!staffId || !status || !date) {
        showToast("Please fill in all required fields.", "error");
        return;
    }

    try {
        showLoading("Recording attendance...");
        const staffMember = staffList.find(s => s.id === staffId);
        const staffName = staffMember?.name || "";
        const role = staffMember?.role || "";

        await addDoc(collection(db, "attendance"), {
            tenantId,
            staffId,
            staffName,
            role,
            date: new Date(date),
            checkInTime: checkIn || null,
            checkOutTime: checkOut || null,
            status,
            createdAt: serverTimestamp(),
            createdBy: getCurrentUser()?.uid || ""
        });

        await addDoc(collection(db, "auditLogs"), {
            tenantId,
            userId: getCurrentUser()?.uid || "",
            action: "RECORD_ATTENDANCE",
            module: "attendance",
            details: { staffName, date, status },
            createdAt: serverTimestamp()
        });

        hideLoading();
        showToast("Attendance recorded successfully!", "success");
        closeModal();
        await loadAttendance();
    } catch (error) {
        debugError("Error recording attendance:", error);
        hideLoading();
        showToast("Unable to record attendance. Please try again.", "error");
    }
};

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

export { loadAttendance };
