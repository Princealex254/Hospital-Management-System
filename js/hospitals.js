/**
 * PRINCE ALEX DIGITAL HMS — Hospitals Module
 *
 * Handles:
 * - Loading and displaying hospitals from Firestore
 * - Adding new hospitals
 * - Editing hospitals
 * - Managing hospital admin users
 * - Audit logging
 */

import { auth, db, collection, query, where, getDocs, orderBy, addDoc, updateDoc, deleteDoc, doc, setDoc, serverTimestamp, createUserWithEmailAndPassword } from "./firebase-config.js";
import { requireAuth } from "./auth-guard.js";
import { loadSidebar } from "./sidebar.js";
import { showToast, showLoading, hideLoading, showConfirm, showModal, closeModal } from "./notifications.js";
import { debug, debugError } from "./debug.js";
import { icon } from "./icons.js";
import { getTenantId, getCurrentUser, hasPermission, PERMISSIONS, ROLES } from "./permissions.js";

document.addEventListener("DOMContentLoaded", async () => {
    debug("Hospitals page: Initializing...");
    showLoading("Loading hospitals...");
    try {
        const user = await requireAuth();
        if (!user) return;

        // Load sidebar
        await loadSidebar();
        const pageTitleEl = document.getElementById("page-title"); if (pageTitleEl) pageTitleEl.textContent = "Hospitals";
        await loadHospitals();
        await loadHospitalAdmins();
        setupAddButton();
        hideLoading();
        debug("Hospitals page: Initialization complete.");
    } catch (error) {
        debugError("Hospitals page initialization error:", error);
        hideLoading();
        showToast("Unable to load hospitals page. Please try again.", "error");
    }
});

let currentHospitals = [];
let currentAdmins = [];

async function loadHospitals() {
    debug("Loading hospitals...");
    // Super admin should see all tenants/hospitals
    try {
        const q = query(
            collection(db, "tenants"),
            orderBy("name") // Order all tenants by name
        );
        const snapshot = await getDocs(q);
        currentHospitals = [];
        snapshot.forEach((doc) => {
            currentHospitals.push({ id: doc.id, ...doc.data() });
        });
        debug("Hospitals loaded:", currentHospitals.length);
        renderHospitals(currentHospitals);
        updateHospitalCount(currentHospitals.length);
    } catch (error) {
        debugError("Error loading hospitals:", error);
        showToast("Unable to load hospitals. Please try again.", "error");
        renderEmptyState("Unable to load hospitals.");
    }
}

function renderHospitals(hospitals) {
    const tbody = document.getElementById("hospitals-tbody");
    if (!tbody) return;
    if (hospitals.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6"><div class="table-empty"><div class="empty-icon">${icon('hospitals', '18', 'icon-svg')}</div><h3>No hospitals found</h3></div></td></tr>`;
        return;
    }
    tbody.innerHTML = hospitals.map((hospital) => {
        const status = hospital.status || "active";
        return `
            <tr>
                <td><strong>${escapeHtml(hospital.name || "")}</strong></td>
                <td>${escapeHtml(hospital.email || "")}</td>
                <td>${escapeHtml(hospital.phone || "")}</td>
                <td><span class="badge badge-${status === "active" ? "success" : "error"}">${escapeHtml(status)}</span></td>
                <td>${formatDate(hospital.createdAt)}</td>
                <td class="text-right">
                    <div class="table-actions">
                        <button class="btn btn-sm btn-outline" onclick="editHospital('${hospital.id}')"> ${icon('edit', '18', 'icon-svg')} Edit</button>
                        <button class="btn btn-sm btn-error" onclick="deleteHospital('${hospital.id}', '${escapeHtml(hospital.name || "")}')"> ${icon('trash', '18', 'icon-svg')} Delete</button>
                    </div>
                </td>
            </tr>
        `;
    }).join("");
}

function renderEmptyState(message) {
    const tbody = document.getElementById("hospitals-tbody");
    if (!tbody) return;
    tbody.innerHTML = `<tr><td colspan="6"><div class="table-empty"><div class="empty-icon">${icon('hospitals', '18', 'icon-svg')}</div><h3>${escapeHtml(message)}</h3></div></td></tr>`;
}

function updateHospitalCount(count) {
    const el = document.getElementById("hospital-count");
    if (el) el.textContent = `${count} hospital${count !== 1 ? "s" : ""}`;
}

function setupAddButton() {
    const addBtn = document.getElementById("add-hospital-btn");
    if (addBtn) {
        addBtn.addEventListener("click", () => {
            if (!hasPermission(PERMISSIONS.HOSPITAL_MANAGE)) {
                showToast("You don't have permission to add hospitals.", "error");
                return;
            }
            showAddHospitalModal();
        });
    }
}

async function loadHospitalAdmins() {
    debug("Loading hospital admins...");
     try {
        const q = query(
            collection(db, "users"),
            where("role", "==", ROLES.HOSPITAL_ADMIN), // Filter for hospital admins
            orderBy("displayName") // Order by the actual display name field
        );
        const snapshot = await getDocs(q);
        currentAdmins = [];
        snapshot.forEach((doc) => {
            currentAdmins.push({ id: doc.id, ...doc.data() });
        });
        debug("Hospital admins loaded:", currentAdmins.length);
        renderAdmins(currentAdmins);
        updateAdminCount(currentAdmins.length);
    } catch (error) {
        debugError("Error loading hospital admins:", error);
    }
}

function renderAdmins(admins) {
    const tbody = document.getElementById("admins-tbody");
    if (!tbody) return;
    if (admins.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5"><div class="table-empty"><div class="empty-icon">${icon('users', '18', 'icon-svg')}</div><h3>No hospital admins found</h3></div></td></tr>`;
        return;
    }
    tbody.innerHTML = admins.map((admin) => {
        const status = admin.accountStatus || "active";
        return `
            <tr>
                <td><strong>${escapeHtml(admin.displayName || "")}</strong></td>
                <td>${escapeHtml(admin.email || "")}</td>
                <td>${escapeHtml(admin.hospitalName || "")}</td>
                <td><span class="badge badge-${status === "active" ? "success" : "error"}">${escapeHtml(status)}</span></td>
                <td class="text-right">
                    <div class="table-actions">
                        <button class="btn btn-sm btn-outline" onclick="editAdmin('${admin.id}')">${icon('edit', '18')} Edit</button>
                        <button class="btn btn-sm btn-outline" onclick="resetAdminPassword('${admin.id}', '${escapeHtml(admin.displayName || "")}')">${icon('key', '18')} Reset</button>
                        <button class="btn btn-sm btn-error" onclick="deleteAdmin('${admin.id}', '${escapeHtml(admin.displayName || "")}')">${icon('trash', '18')} Delete</button>
                    </div>
                </td>
            </tr>
        `;
    }).join("");
}

function updateAdminCount(count) {
    const el = document.getElementById("admin-count");
    if (el) el.textContent = `${count} admin${count !== 1 ? "s" : ""}`;
}

function showAddHospitalModal() {
    const modalHtml = `
        <div class="modal" style="max-width: 700px;">
            <div class="modal-header"><h3>Add Hospital & Admin</h3><button class="modal-close" data-modal-close>&times;</button></div>
            <div class="modal-body">
                <div class="form-section" style="margin-bottom: 20px; padding-bottom: 20px; border-bottom: 1px solid #e5e7eb;">
                    <h4 style="margin-bottom: 15px; color: #374151;">Hospital Information</h4>
                    <div class="form-grid form-grid-2">
                        <div class="form-group"><label class="form-label required" for="hospital-name">Hospital Name</label><input type="text" id="hospital-name" class="form-input" placeholder="Hospital name"></div>
                        <div class="form-group"><label class="form-label required" for="hospital-email">Hospital Email</label><input type="email" id="hospital-email" class="form-input" placeholder="hospital@example.com"></div>
                        <div class="form-group"><label class="form-label" for="hospital-phone">Phone</label><input type="tel" id="hospital-phone" class="form-input" placeholder="+254 700 000 000"></div>
                        <div class="form-group"><label class="form-label" for="hospital-status">Status</label>
                            <select id="hospital-status" class="form-select">
                                <option value="active">Active</option>
                                <option value="inactive">Inactive</option>
                            </select>
                        </div>
                    </div>
                </div>
                <div class="form-section">
                    <h4 style="margin-bottom: 15px; color: #374151;">Hospital Admin User</h4>
                    <div class="form-grid form-grid-2">
                        <div class="form-group"><label class="form-label required" for="admin-name">Admin Full Name</label><input type="text" id="admin-name" class="form-input" placeholder="John Doe"></div>
                        <div class="form-group"><label class="form-label required" for="admin-email">Admin Email</label><input type="email" id="admin-email" class="form-input" placeholder="admin@hospital.com"></div>
                        <div class="form-group"><label class="form-label required" for="admin-password">Password</label><input type="password" id="admin-password" class="form-input" placeholder="Min. 6 characters" minlength="6"></div>
                        <div class="form-group"><label class="form-label required" for="admin-password-confirm">Confirm Password</label><input type="password" id="admin-password-confirm" class="form-input" placeholder="Re-enter password" minlength="6"></div>
                    </div>
                    <p class="text-muted" style="font-size: 0.875rem; margin-top: 10px;">This will create a Firebase Auth account and a user profile with Hospital Admin role.</p>
                </div>
            </div>
            <div class="modal-footer">
                <button class="btn btn-secondary" data-modal-close>Cancel</button>
                <button class="btn btn-primary" onclick="saveHospital()">Save Hospital & Create Admin</button>
            </div>
        </div>
    `;
    showModal(modalHtml, "Add Hospital");
}

window.saveHospital = async function() {
    debug("Saving hospital and creating admin...");
    // Hospital fields
    const hospitalName = document.getElementById("hospital-name")?.value.trim();
    const hospitalEmail = document.getElementById("hospital-email")?.value.trim();
    const hospitalPhone = document.getElementById("hospital-phone")?.value.trim();
    const hospitalStatus = document.getElementById("hospital-status")?.value;

    // Admin fields
    const adminName = document.getElementById("admin-name")?.value.trim();
    const adminEmail = document.getElementById("admin-email")?.value.trim();
    const adminPassword = document.getElementById("admin-password")?.value;
    const adminPasswordConfirm = document.getElementById("admin-password-confirm")?.value;

    // Validation
    if (!hospitalName || !hospitalEmail) {
        showToast("Please fill in all required hospital fields.", "error");
        return;
    }
    if (!adminName || !adminEmail || !adminPassword) {
        showToast("Please fill in all required admin fields.", "error");
        return;
    }
    if (adminPassword !== adminPasswordConfirm) {
        showToast("Passwords do not match.", "error");
        return;
    }
    if (adminPassword.length < 6) {
        showToast("Password must be at least 6 characters.", "error");
        return;
    }

    try {
        showLoading("Creating hospital and admin account...");

        // Step 1: Create the new Tenant (Hospital) document
        debug("Creating new tenant (hospital)...");
        const tenantRef = await addDoc(collection(db, "tenants"), {
            // This new tenant gets its own ID, which becomes the tenantId for its users
            name: hospitalName,
            email: hospitalEmail,
            phone: hospitalPhone || null,
            status: hospitalStatus || "active",
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
            createdBy: getCurrentUser()?.uid || ""
        });
        const newTenantId = tenantRef.id;
        debug("New Tenant (Hospital) created with ID:", newTenantId);

        // Step 2: Create Firebase Auth user for admin
        debug("Creating Firebase Auth user for admin...");
        let adminUid;
        try {
            const userCredential = await createUserWithEmailAndPassword(auth, adminEmail, adminPassword);
            adminUid = userCredential.user.uid;
            debug("Admin user created with UID:", adminUid);
        } catch (authError) {
            if (authError.code === "auth/email-already-in-use") {
                // Email already exists, check if it's a user in our system
                debug("Email already in use, checking if user exists...");
                const existingUserQuery = query(
                    collection(db, "users"),
                    where("email", "==", adminEmail)
                );
                const existingUserSnapshot = await getDocs(existingUserQuery);
                
                if (!existingUserSnapshot.empty) {
                    throw new Error(`A user with email "${adminEmail}" already exists in this hospital. Please use a different email or update the existing user.`);
                } else {
                    throw new Error(`Email "${adminEmail}" is already registered in Firebase. Please use a different email address.`);
                }
            }
            throw authError; // Re-throw other errors
        }

        // Step 3: Create user profile in Firestore, linking to the NEW tenantId
        debug("Creating user profile with new tenantId:", newTenantId);
        await setDoc(doc(db, "users", adminUid), {
            tenantId: newTenantId, // The new admin belongs to the new hospital's tenant
            uid: adminUid,
            email: adminEmail,
            displayName: adminName,
            role: ROLES.HOSPITAL_ADMIN,
            hospitalName: hospitalName,
            permissions: [
                PERMISSIONS.PATIENT_CREATE, PERMISSIONS.PATIENT_READ, PERMISSIONS.PATIENT_UPDATE, PERMISSIONS.PATIENT_DELETE,
                PERMISSIONS.APPOINTMENT_READ, PERMISSIONS.APPOINTMENT_CREATE, PERMISSIONS.APPOINTMENT_UPDATE, PERMISSIONS.APPOINTMENT_DELETE,
                PERMISSIONS.QUEUE_MANAGE,
                PERMISSIONS.ADMISSION_READ, PERMISSIONS.ADMISSION_CREATE, PERMISSIONS.ADMISSION_UPDATE,
                PERMISSIONS.WARD_MANAGE, PERMISSIONS.BED_MANAGE,
                PERMISSIONS.INVOICE_READ, PERMISSIONS.INVOICE_CREATE, PERMISSIONS.INVOICE_UPDATE, PERMISSIONS.INVOICE_DELETE,
                PERMISSIONS.PAYMENT_READ, PERMISSIONS.PAYMENT_CREATE,
                PERMISSIONS.INVENTORY_READ, PERMISSIONS.INVENTORY_CREATE, PERMISSIONS.INVENTORY_UPDATE, PERMISSIONS.INVENTORY_DELETE,
                PERMISSIONS.STOCK_MOVEMENT_CREATE,
                PERMISSIONS.SUPPLIER_READ, PERMISSIONS.SUPPLIER_CREATE, PERMISSIONS.SUPPLIER_UPDATE, PERMISSIONS.SUPPLIER_DELETE,
                PERMISSIONS.PURCHASE_ORDER_READ, PERMISSIONS.PURCHASE_ORDER_CREATE, PERMISSIONS.PURCHASE_ORDER_UPDATE,
                PERMISSIONS.STAFF_READ, PERMISSIONS.STAFF_CREATE, PERMISSIONS.STAFF_UPDATE, PERMISSIONS.STAFF_DELETE,
                PERMISSIONS.ATTENDANCE_MANAGE, PERMISSIONS.LEAVE_MANAGE,
                PERMISSIONS.USER_MANAGE,
                PERMISSIONS.REPORT_READ,
                PERMISSIONS.SETTINGS_UPDATE,
                PERMISSIONS.HOSPITAL_MANAGE,
                PERMISSIONS.AUDIT_READ
            ],
            accountStatus: "ACTIVE",
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
            createdBy: getCurrentUser()?.uid || ""
        });

        // Step 4: Create audit log
        await addDoc(collection(db, "auditLogs"), {
            tenantId: getCurrentUser()?.tenantId, // The action is logged under the super-admin's tenant
            userId: getCurrentUser()?.uid || "",
            action: "CREATE_HOSPITAL_WITH_ADMIN",
            module: "hospitals",
            recordId: newTenantId,
            details: {
                hospitalName,
                hospitalEmail,
                adminEmail,
                adminUid,
                newTenantId: newTenantId
            },
            createdAt: serverTimestamp()
        });

        hideLoading();
        showToast("Hospital and admin account created successfully!", "success");
        closeModal();
        await loadHospitals();
        await loadHospitalAdmins();
    } catch (error) {
        debugError("Error creating hospital and admin:", error);
        hideLoading();
        showToast("Unable to create hospital. Please try again. " + error.message, "error");
    }
};

window.editAdmin = async function(adminId) {
    debug("Editing admin:", adminId);
    if (!hasPermission(PERMISSIONS.USER_MANAGE)) {
        showToast("You don't have permission to edit users.", "error");
        return;
    }
    const admin = currentAdmins.find(a => a.id === adminId);
    if (!admin) return;

    const modalHtml = `
        <div class="modal" style="max-width: 500px;">
            <div class="modal-header"><h3>Edit Hospital Admin</h3><button class="modal-close" data-modal-close>&times;</button></div>
            <div class="modal-body">
                <div class="form-group">
                    <label class="form-label required" for="edit-admin-name">Full Name</label>
                    <input type="text" id="edit-admin-name" class="form-input" value="${escapeHtml(admin.displayName || "")}">
                </div>
                <div class="form-group">
                    <label class="form-label" for="edit-admin-email">Email</label>
                    <input type="email" id="edit-admin-email" class="form-input" value="${escapeHtml(admin.email || "")}" disabled>
                    <p class="form-help">Email cannot be changed after creation.</p>
                </div>
                <div class="form-group">
                    <label class="form-label" for="edit-admin-status">Account Status</label>
                    <select id="edit-admin-status" class="form-select">
                        <option value="active" ${admin.accountStatus === "active" ? "selected" : ""}>Active</option>
                        <option value="inactive" ${admin.accountStatus === "inactive" ? "selected" : ""}>Inactive</option>
                        <option value="suspended" ${admin.accountStatus === "suspended" ? "selected" : ""}>Suspended</option>
                    </select>
                </div>
            </div>
            <div class="modal-footer">
                <button class="btn btn-secondary" data-modal-close>Cancel</button>
                <button class="btn btn-primary" onclick="updateAdmin('${adminId}')">Update Admin</button>
            </div>
        </div>
    `;
    showModal(modalHtml, "Edit Hospital Admin");
};

window.updateAdmin = async function(adminId) {
    debug("Updating admin:", adminId);
    const displayName = document.getElementById("edit-admin-name").value.trim();
    const accountStatus = document.getElementById("edit-admin-status").value;

    if (!displayName) {
        showToast("Admin name cannot be empty.", "error");
        return;
    }

    try {
        showLoading("Updating admin...");
        await updateDoc(doc(db, "users", adminId), {
            displayName,
            accountStatus,
            updatedAt: serverTimestamp()
        });

        await addDoc(collection(db, "auditLogs"), {
            tenantId: getTenantId(),
            userId: getCurrentUser()?.uid || "",
            action: "UPDATE_USER",
            module: "users",
            recordId: adminId,
            details: { displayName, accountStatus },
            createdAt: serverTimestamp()
        });

        hideLoading();
        showToast("Admin user updated successfully!", "success");
        closeModal();
        await loadHospitalAdmins();
    } catch (error) {
        debugError("Error updating admin:", error);
        hideLoading();
        showToast("Unable to update admin. Please try again.", "error");
    }
};

window.deleteAdmin = async function(adminId, adminName) {
    debug("Deleting admin:", adminId, adminName);
    if (!hasPermission(PERMISSIONS.USER_MANAGE)) {
        showToast("You don't have permission to delete users.", "error");
        return;
    }

    const confirmed = await showConfirm(
        "Delete Admin User",
        `Are you sure you want to delete "${adminName}"? This will permanently remove their account and they will lose all access. This action cannot be undone.`,
        "Delete Admin",
        "Cancel"
    );
    if (!confirmed) return;

    showToast("This feature requires a backend function to safely delete a Firebase Auth user. For now, please suspend the user's account.", "warning", 8000);
    // In a real application, you would call a Cloud Function here to delete the user
    // from Firebase Auth and then delete their Firestore document.
    // e.g., `await deleteUserFunction({ uid: adminId });`
};

window.editHospital = async function(hospitalId) {
    debug("Edit hospital:", hospitalId);
    if (!hasPermission(PERMISSIONS.HOSPITAL_MANAGE)) {
        showToast("You don't have permission to edit hospitals.", "error");
        return;
    }
    const hospital = currentHospitals.find(h => h.id === hospitalId);
    if (!hospital) return;
    const modalHtml = `
        <div class="modal" style="max-width: 600px;">
            <div class="modal-header"><h3>Edit Hospital</h3><button class="modal-close" data-modal-close>&times;</button></div><div class="modal-body">
                <div class="form-grid form-grid-2">
                    <div class="form-group"><label class="form-label required" for="edit-hospital-name">Hospital Name</label><input type="text" id="edit-hospital-name" class="form-input" value="${escapeHtml(hospital.name || "")}"></div>
                    <div class="form-group"><label class="form-label required" for="edit-hospital-email">Email</label><input type="email" id="edit-hospital-email" class="form-input" value="${escapeHtml(hospital.email || "")}"></div>
                    <div class="form-group"><label class="form-label" for="edit-hospital-phone">Phone</label><input type="tel" id="edit-hospital-phone" class="form-input" value="${escapeHtml(hospital.phone || "")}"></div>
                    <div class="form-group"><label class="form-label" for="edit-hospital-status">Status</label>
                        <select id="edit-hospital-status" class="form-select">
                            <option value="active" ${hospital.status === "active" ? "selected" : ""}>Active</option>
                            <option value="inactive" ${hospital.status === "inactive" ? "selected" : ""}>Inactive</option>
                        </select>
                    </div>
                </div>
            </div>
            <div class="modal-footer">
                <button class="btn btn-secondary" data-modal-close>Cancel</button>
                <button class="btn btn-primary" onclick="updateHospital('${hospitalId}')">Update Hospital</button>
            </div>
        </div>
    `;
    showModal(modalHtml, "Edit Hospital");
};

window.updateHospital = async function(hospitalId) {
    debug("Updating hospital:", hospitalId);
    try {
        showLoading("Updating hospital...");
        await updateDoc(doc(db, "tenants", hospitalId), {
            name: document.getElementById("edit-hospital-name").value.trim(),
            email: document.getElementById("edit-hospital-email").value.trim(),
            phone: document.getElementById("edit-hospital-phone").value.trim() || null,
            status: document.getElementById("edit-hospital-status").value,
            updatedAt: serverTimestamp()
        });
        await addDoc(collection(db, "auditLogs"), {
            tenantId: getTenantId(),
            userId: getCurrentUser()?.uid || "",
            action: "UPDATE_HOSPITAL",
            module: "hospitals",
            recordId: hospitalId,
            createdAt: serverTimestamp()
        });
        hideLoading();
        showToast("Hospital updated successfully!", "success");
        closeModal();
        await loadHospitals();
    } catch (error) {
        debugError("Error updating hospital:", error);
        hideLoading();
        showToast("Unable to update hospital. Please try again.", "error");
    }
};

window.resetAdminPassword = async function(adminId, adminName) {
    debug("Reset admin password:", adminId, adminName);
    if (!hasPermission(PERMISSIONS.USER_MANAGE)) {
        showToast("You don't have permission to reset passwords.", "error");
        return;
    }

    const newPassword = prompt(`Enter new password for ${adminName}:`);
    if (!newPassword || newPassword.length < 6) {
        showToast("Password must be at least 6 characters.", "error");
        return;
    }

    try {
        showLoading("Resetting password...");
        // Note: In a production app, you would use Firebase Admin SDK or a Cloud Function
        // to reset the password. For now, we'll update the user document to flag for reset.
        await updateDoc(doc(db, "users", adminId), {
            passwordResetRequired: true,
            updatedAt: serverTimestamp()
        });

        await addDoc(collection(db, "auditLogs"), {
            tenantId: getTenantId(),
            userId: getCurrentUser()?.uid || "",
            action: "RESET_ADMIN_PASSWORD",
            module: "users",
            recordId: adminId,
            details: { adminName, adminEmail: currentAdmins.find(a => a.id === adminId)?.email },
            createdAt: serverTimestamp()
        });

        hideLoading();
        showToast(`Password reset initiated for ${adminName}. The user will be required to set a new password on next login.`, "success");
    } catch (error) {
        debugError("Error resetting password:", error);
        hideLoading();
        showToast("Unable to reset password. Please try again.", "error");
    }
};

window.deleteHospital = async function(hospitalId, hospitalName) {
    debug("Delete hospital:", hospitalId, hospitalName);
    if (!hasPermission(PERMISSIONS.HOSPITAL_MANAGE)) {
        showToast("You don't have permission to delete hospitals.", "error");
        return;
    }
    const confirmed = await showConfirm(
        "Delete Hospital",
        `Are you sure you want to delete "${hospitalName}"? This action cannot be undone.`,
        "Delete",
        "Cancel"
    );
    if (!confirmed) return;
    try {
        showLoading("Deleting hospital...");
        await deleteDoc(doc(db, "tenants", hospitalId));
        await addDoc(collection(db, "auditLogs"), {
            tenantId: getTenantId(),
            userId: getCurrentUser()?.uid || "",
            action: "DELETE_HOSPITAL",
            module: "hospitals",
            recordId: hospitalId,
            details: { hospitalName },
            createdAt: serverTimestamp()
        });
        hideLoading();
        showToast(`Hospital "${hospitalName}" has been deleted.`, "success");
        await loadHospitals();
    } catch (error) {
        debugError("Error deleting hospital:", error);
        hideLoading();
        showToast("Unable to delete hospital. Please try again.", "error");
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

export { loadHospitals };