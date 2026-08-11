/**
 * PRINCE ALEX DIGITAL HMS — Staff Module
 * 
 * Handles:
 * - Loading and displaying staff from Firestore
 * - Search and filter by role
 * - Adding new staff
 * - Editing staff
 * - Deleting staff
 * - Audit logging
 */

import { auth, db, collection, query, where, getDocs, orderBy, addDoc, updateDoc, deleteDoc, doc, setDoc, serverTimestamp, createUserWithEmailAndPassword } from "./firebase-config.js";
import { requireAuth } from "./auth-guard.js";
import { loadSidebar } from "./sidebar.js";
import { showToast, showLoading, hideLoading, showConfirm, showModal, closeModal } from "./notifications.js";
import { debug, debugError } from "./debug.js";
import { icon } from "./icons.js";
import { getTenantId, getCurrentUser, hasPermission, PERMISSIONS, ROLE_PERMISSIONS } from "./permissions.js";

document.addEventListener("DOMContentLoaded", async () => {
    debug("Staff page: Initializing...");
    showLoading("Loading staff...");
    try {
        const user = await requireAuth();
        if (!user) return;
        await loadSidebar();
        const pageTitleEl = document.getElementById("page-title");
        if (pageTitleEl) pageTitleEl.textContent = "Staff";
        await loadStaff();
        setupSearch();
        setupFilter();
        setupAddButton();
        hideLoading();
        debug("Staff page: Initialization complete.");
    } catch (error) {
        debugError("Staff page initialization error:", error);
        hideLoading();
        showToast("Unable to load staff page. Please try again.", "error");
    }
});

let currentStaff = [];
let currentFilters = { search: "", role: "" };

async function loadStaff() {
    debug("Loading staff...");
    const tenantId = getTenantId();
    if (!tenantId) return;
    try {
        const q = query(
            collection(db, "users"),
            where("tenantId", "==", tenantId),
            // Exclude super admins and hospital admins from the general staff list
            where("role", "not-in", ["SUPER_ADMIN", "HOSPITAL_ADMIN"]),
            orderBy("displayName")
        );
        const snapshot = await getDocs(q);
        currentStaff = [];
        snapshot.forEach((doc) => {
            currentStaff.push({ id: doc.id, ...doc.data() });
        });
        debug("Staff loaded:", currentStaff.length);
        renderStaff(currentStaff);
        updateStaffCount(currentStaff.length);
    } catch (error) {
        debugError("Error loading staff:", error);
        showToast("Unable to load staff. Please try again.", "error");
        renderEmptyState("Unable to load staff.");
    }
}

function renderStaff(staff) {
    const tbody = document.getElementById("staff-tbody");
    if (!tbody) return;
    if (staff.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7"><div class="table-empty"><div class="empty-icon">${icon('patients', '18', 'icon-svg')}</div><h3>No staff found</h3></div></td></tr>`;
        return;
    }
    tbody.innerHTML = staff.map((member) => {
        const status = member.status || "active";
        return `
            <tr>
                <td><strong>${escapeHtml(member.displayName || "")}</strong></td>
                <td>${escapeHtml(member.role || "")}</td>
                <td>${escapeHtml(member.department || "")}</td>
                <td>${escapeHtml(member.phone || "")}</td>
                <td>${escapeHtml(member.email || "")}</td>
                <td><span class="badge badge-${(member.accountStatus || "active") === "active" ? "success" : "error"}">${escapeHtml(member.accountStatus || "active")}</span></td>
                <td class="text-right">
                    <div class="table-actions">
                        <button class="btn btn-sm btn-outline" onclick="editStaff('${member.id}')"> ${icon('edit', '18', 'icon-svg')} Edit</button>
                        <button class="btn btn-sm btn-error" onclick="deleteStaff('${member.id}', '${escapeHtml(member.name || "")}')"> ${icon('trash', '18', 'icon-svg')} Delete</button>
                    </div>
                </td>
            </tr>
        `;
    }).join("");
}

function renderEmptyState(message) {
    const tbody = document.getElementById("staff-tbody");
    if (!tbody) return;
    tbody.innerHTML = `<tr><td colspan="7"><div class="table-empty"><div class="empty-icon">${icon('patients', '18', 'icon-svg')}</div><h3>${escapeHtml(message)}</h3></div></td></tr>`;
}

function updateStaffCount(count) {
    const el = document.getElementById("staff-count");
    if (el) el.textContent = `${count} staff member${count !== 1 ? "s" : ""}`;
}

function setupSearch() {
    const searchInput = document.getElementById("staff-search");
    const searchBtn = document.getElementById("search-btn");
    if (searchInput) {
        searchInput.addEventListener("input", (e) => {
            currentFilters.search = e.target.value.toLowerCase();
            applyFilters();
        });
    }
    if (searchBtn) searchBtn.addEventListener("click", applyFilters);
}

function setupFilter() {
    const roleFilter = document.getElementById("filter-role");
    if (roleFilter) {
        roleFilter.addEventListener("change", (e) => {
            currentFilters.role = e.target.value;
            applyFilters();
        });
    }
}

function applyFilters() {
    debug("Applying filters:", currentFilters);
    const filtered = currentStaff.filter((member) => {
        if (currentFilters.search) {
            const name = (member.displayName || "").toLowerCase();
            const role = (member.role || "").toLowerCase();
            if (!name.includes(currentFilters.search) && !role.includes(currentFilters.search)) return false;
        }
        if (currentFilters.role && member.role !== currentFilters.role) return false;
        return true;
    });
    renderStaff(filtered);
    updateStaffCount(filtered.length);
}

function setupAddButton() {
    const addBtn = document.getElementById("add-staff-btn");
    if (addBtn) {
        addBtn.addEventListener("click", () => {
            if (!hasPermission(PERMISSIONS.STAFF_CREATE)) {
                showToast("You don't have permission to add staff.", "error");
                return;
            }
            showAddStaffModal();
        });
    }
}

function showAddStaffModal() {
    const modalHtml = `
        <div class="modal" style="max-width: 600px;">
            <div class="modal-header"><h3>Add Staff Member</h3><button class="modal-close" data-modal-close>&times;</button></div>
            <div class="modal-body">
                <div class="form-grid form-grid-2">
                    <div class="form-group"><label class="form-label required" for="staff-name">Name</label><input type="text" id="staff-name" class="form-input" placeholder="Full name"></div>
                    <div class="form-group"><label class="form-label" for="staff-phone">Phone</label><input type="tel" id="staff-phone" class="form-input" placeholder="+254 700 000 000"></div>
                    <div class="form-group"><label class="form-label required" for="staff-email">Email (for login)</label><input type="email" id="staff-email" class="form-input" placeholder="staff@hospital.com"></div>
                    <div class="form-group"><label class="form-label required" for="staff-role">Role</label>
                        <select id="staff-role" class="form-select">
                            <option value="DOCTOR">Doctor</option>
                            <option value="NURSE">Nurse</option>
                            <option value="PHARMACIST">Pharmacist</option>
                            <option value="LAB_TECHNICIAN">Lab Technician</option>
                            <option value="RECEPTIONIST">Receptionist</option>
                            <option value="ACCOUNTANT">Accountant</option>
                            <option value="CASHIER">Cashier</option>
                            <option value="INVENTORY_MANAGER">Inventory Manager</option>
                            <option value="HR_MANAGER">HR Manager</option>
                        </select>
                    </div>
                    <div class="form-group"><label class="form-label" for="staff-dept">Department</label><input type="text" id="staff-dept" class="form-input" placeholder="e.g. Cardiology"></div>
                    <div class="form-group"><label class="form-label required" for="staff-password">Password</label><input type="password" id="staff-password" class="form-input" placeholder="Min. 6 characters" minlength="6"></div>
                    <div class="form-group"><label class="form-label required" for="staff-password-confirm">Confirm Password</label><input type="password" id="staff-password-confirm" class="form-input" placeholder="Re-enter password" minlength="6"></div>
                </div>
            </div>
            <div class="modal-footer">
                <button class="btn btn-secondary" data-modal-close>Cancel</button>
                <button class="btn btn-primary" onclick="saveStaff()">Save Staff</button>
            </div>
        </div>
    `;
    showModal(modalHtml, "Add Staff Member");
}

window.saveStaff = async function() {
    debug("Saving staff...");
    const tenantId = getTenantId();
    if (!tenantId) return;

    const name = document.getElementById("staff-name")?.value.trim();
    const role = document.getElementById("staff-role")?.value;
    const department = document.getElementById("staff-dept")?.value.trim();
    const phone = document.getElementById("staff-phone")?.value.trim();
    const email = document.getElementById("staff-email")?.value.trim();
    const password = document.getElementById("staff-password")?.value;
    const passwordConfirm = document.getElementById("staff-password-confirm")?.value;

    if (!name || !role || !email || !password) {
        showToast("Please fill in all required fields.", "error");
        return;
    }
    if (password !== passwordConfirm) {
        showToast("Passwords do not match.", "error");
        return;
    }
    if (password.length < 6) {
        showToast("Password must be at least 6 characters.", "error");
        return;
    }

    try {
        showLoading("Saving staff...");

        // Step 1: Create Firebase Auth user
        let staffUid;
        try {
            const userCredential = await createUserWithEmailAndPassword(auth, email, password);
            staffUid = userCredential.user.uid;
            debug("Staff auth user created with UID:", staffUid);
        } catch (authError) {
            if (authError.code === "auth/email-already-in-use") {
                throw new Error(`A user with email "${email}" already exists. Please use a different email.`);
            }
            throw authError; // Re-throw other auth errors
        }

        // Step 2: Create user profile in Firestore
        const permissions = ROLE_PERMISSIONS[role] || [];
        await setDoc(doc(db, "users", staffUid), {
            tenantId,
            uid: staffUid,
            email,
            displayName: name,
            role,
            permissions,
            department: department || null,
            phone: phone || null,
            accountStatus: "active",
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
            createdBy: getCurrentUser()?.uid || ""
        });
        debug("Staff user profile created in Firestore.");

        // Step 3: Create audit log
        await addDoc(collection(db, "auditLogs"), {
            tenantId,
            userId: getCurrentUser()?.uid || "",
            action: "CREATE_STAFF",
            module: "users",
            recordId: staffUid,
            details: { staffName: name, role, email },
            createdAt: serverTimestamp()
        });

        hideLoading();
        showToast("Staff member added successfully!", "success");
        closeModal();
        await loadStaff();

    } catch (error) {
        debugError("Error saving staff:", error);
        hideLoading();
        showToast("Unable to save staff. Please try again.", "error");
    }
};

window.editStaff = async function(staffId) {
    debug("Edit staff:", staffId);
    if (!hasPermission(PERMISSIONS.STAFF_UPDATE)) {
        showToast("You don't have permission to edit staff.", "error");
        return;
    }
    const member = currentStaff.find(s => s.id === staffId);
    if (!member) return;
    const modalHtml = `
        <div style="max-width: 600px;">
            <div class="modal-header"><h3>Edit Staff Member</h3><button class="modal-close" data-modal-close>&times;</button></div><div class="modal-body">
                <div class="form-grid form-grid-2">
                    <div class="form-group"><label class="form-label" for="edit-staff-name">Name</label><input type="text" id="edit-staff-name" class="form-input" value="${escapeHtml(member.name || "")}"></div>
                    <div class="form-group"><label class="form-label" for="edit-staff-role">Role</label>
                        <select id="edit-staff-role" class="form-select">
                            <option value="DOCTOR" ${member.role === "DOCTOR" ? "selected" : ""}>Doctor</option>
                            <option value="NURSE" ${member.role === "NURSE" ? "selected" : ""}>Nurse</option>
                            <option value="PHARMACIST" ${member.role === "PHARMACIST" ? "selected" : ""}>Pharmacist</option>
                            <option value="LAB_TECHNICIAN" ${member.role === "LAB_TECHNICIAN" ? "selected" : ""}>Lab Technician</option>
                            <option value="RECEPTIONIST" ${member.role === "RECEPTIONIST" ? "selected" : ""}>Receptionist</option>
                        </select>
                    </div>
                    <div class="form-group"><label class="form-label" for="edit-staff-dept">Department</label><input type="text" id="edit-staff-dept" class="form-input" value="${escapeHtml(member.department || "")}"></div>
                    <div class="form-group"><label class="form-label" for="edit-staff-phone">Phone</label><input type="tel" id="edit-staff-phone" class="form-input" value="${escapeHtml(member.phone || "")}"></div>
                    <div class="form-group"><label class="form-label" for="edit-staff-email">Email</label><input type="email" id="edit-staff-email" class="form-input" value="${escapeHtml(member.email || "")}"></div>
                    <div class="form-group"><label class="form-label" for="edit-staff-status">Status</label>
                        <select id="edit-staff-status" class="form-select">
                            <option value="active" ${member.status === "active" ? "selected" : ""}>Active</option>
                            <option value="inactive" ${member.status === "inactive" ? "selected" : ""}>Inactive</option>
                        </select>
                    </div>
                </div>
            </div>
            <div class="modal-footer">
                <button class="btn btn-secondary" data-modal-close>Cancel</button>
                <button class="btn btn-primary" onclick="updateStaff('${staffId}')">Update Staff</button>
            </div>
        </div>
    `;
    showModal(modalHtml, "Edit Staff Member");
};

window.updateStaff = async function(staffId) {
    debug("Updating staff:", staffId);
    try {
        showLoading("Updating staff...");
        await updateDoc(doc(db, "users", staffId), {
            name: document.getElementById("edit-staff-name").value.trim(),
            role: document.getElementById("edit-staff-role").value,
            department: document.getElementById("edit-staff-dept").value.trim() || null,
            phone: document.getElementById("edit-staff-phone").value.trim() || null,
            email: document.getElementById("edit-staff-email").value.trim() || null,
            status: document.getElementById("edit-staff-status").value,
            updatedAt: serverTimestamp()
        });
        await addDoc(collection(db, "auditLogs"), {
            tenantId: getTenantId(),
            userId: getCurrentUser()?.uid || "",
            action: "UPDATE_STAFF",
            module: "users",
            recordId: staffId,
            createdAt: serverTimestamp()
        });
        hideLoading();
        showToast("Staff member updated successfully!", "success");
        closeModal();
        await loadStaff();
    } catch (error) {
        debugError("Error updating staff:", error);
        hideLoading();
        showToast("Unable to update staff. Please try again.", "error");
    }
};

window.deleteStaff = async function(staffId, staffName) {
    debug("Delete staff:", staffId, staffName);
    if (!hasPermission(PERMISSIONS.STAFF_DELETE)) {
        showToast("You don't have permission to delete staff.", "error");
        return;
    }
    const confirmed = await showConfirm(
        "Delete Staff",
        `Are you sure you want to delete "${staffName}"? This action cannot be undone.`,
        "Delete",
        "Cancel"
    );
    if (!confirmed) return;
    try {
        showLoading("Deleting staff...");
        await deleteDoc(doc(db, "users", staffId));
        await addDoc(collection(db, "auditLogs"), {
            tenantId: getTenantId(),
            userId: getCurrentUser()?.uid || "",
            action: "DELETE_STAFF",
            module: "users",
            recordId: staffId,
            details: { staffName },
            createdAt: serverTimestamp()
        });
        hideLoading();
        showToast(`Staff member "${staffName}" has been deleted.`, "success");
        await loadStaff();
    } catch (error) {
        debugError("Error deleting staff:", error);
        hideLoading();
        showToast("Unable to delete staff. Please try again.", "error");
    }
};

function escapeHtml(text) {
    if (!text) return "";
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
}

export { loadStaff };
