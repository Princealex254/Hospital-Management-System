/**
 * PRINCE ALEX DIGITAL HMS — Suppliers Module
 * 
 * Handles:
 * - Loading and displaying suppliers from Firestore
 * - Adding new suppliers
 * - Editing suppliers
 * - Deleting suppliers
 * - Audit logging
 */

import { db, collection, query, where, getDocs, orderBy, addDoc, updateDoc, deleteDoc, doc, serverTimestamp } from "./firebase-config.js";
import { requireAuth } from "./auth-guard.js";
import { loadSidebar } from "./sidebar.js";
import { showToast, showLoading, hideLoading, showConfirm, showModal } from "./notifications.js";
import { debug, debugError } from "./debug.js";
import { icon } from "./icons.js";
import { getTenantId, getCurrentUser, hasPermission, PERMISSIONS } from "./permissions.js";

document.addEventListener("DOMContentLoaded", async () => {
    debug("Suppliers page: Initializing...");
    showLoading("Loading suppliers...");
    try {
        const user = await requireAuth();
        if (!user) return;
        await loadSidebar();
        const pageTitleEl = document.getElementById("page-title");
        if (pageTitleEl) pageTitleEl.textContent = "Suppliers";
        await loadSuppliers();
        setupAddButton();
        hideLoading();
        debug("Suppliers page: Initialization complete.");
    } catch (error) {
        debugError("Suppliers page initialization error:", error);
        hideLoading();
        showToast("Unable to load suppliers page. Please try again.", "error");
    }
});

let currentSuppliers = [];

async function loadSuppliers() {
    debug("Loading suppliers...");
    const tenantId = getTenantId();
    if (!tenantId) return;
    try {
        const q = query(
            collection(db, "suppliers"),
            where("tenantId", "==", tenantId),
            orderBy("name")
        );
        const snapshot = await getDocs(q);
        currentSuppliers = [];
        snapshot.forEach((doc) => {
            currentSuppliers.push({ id: doc.id, ...doc.data() });
        });
        debug("Suppliers loaded:", currentSuppliers.length);
        renderSuppliers(currentSuppliers);
        updateSupplierCount(currentSuppliers.length);
    } catch (error) {
        debugError("Error loading suppliers:", error);
        showToast("Unable to load suppliers. Please try again.", "error");
        renderEmptyState("Unable to load suppliers.");
    }
}

function renderSuppliers(suppliers) {
    const tbody = document.getElementById("suppliers-tbody");
    if (!tbody) return;
    if (suppliers.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6"><div class="table-empty"><div class="empty-icon">${icon('suppliers', '18', 'icon-svg')}</div><h3>No suppliers found</h3></div></td></tr>`;
        return;
    }
    tbody.innerHTML = suppliers.map((supplier) => {
        return `
            <tr>
                <td><strong>${escapeHtml(supplier.name || "")}</strong></td>
                <td>${escapeHtml(supplier.contactPerson || "")}</td>
                <td>${escapeHtml(supplier.phone || "")}</td>
                <td>${escapeHtml(supplier.email || "")}</td>
                <td>${escapeHtml(supplier.address || "")}</td>
                <td class="text-right">
                    <div class="table-actions">
                        <button class="btn btn-sm btn-outline" onclick="editSupplier('${supplier.id}')"> ${icon('edit', '18', 'icon-svg')} Edit</button>
                        <button class="btn btn-sm btn-error" onclick="deleteSupplier('${supplier.id}', '${escapeHtml(supplier.name || "")}')"> ${icon('trash', '18', 'icon-svg')} Delete</button>
                    </div>
                </td>
            </tr>
        `;
    }).join("");
}

function renderEmptyState(message) {
    const tbody = document.getElementById("suppliers-tbody");
    if (!tbody) return;
    tbody.innerHTML = `<tr><td colspan="6"><div class="table-empty"><div class="empty-icon">${icon('suppliers', '18', 'icon-svg')}</div><h3>${escapeHtml(message)}</h3></div></td></tr>`;
}

function updateSupplierCount(count) {
    const el = document.getElementById("supplier-count");
    if (el) el.textContent = `${count} supplier${count !== 1 ? "s" : ""}`;
}

function setupAddButton() {
    const addBtn = document.getElementById("add-supplier-btn");
    if (addBtn) {
        addBtn.addEventListener("click", () => {
            if (!hasPermission(PERMISSIONS.SUPPLIER_CREATE)) {
                showToast("You don't have permission to add suppliers.", "error");
                return;
            }
            showAddSupplierModal();
        });
    }
}

function showAddSupplierModal() {
    const modalHtml = `
        <div class="modal" style="max-width: 600px;">
            <div class="modal-header"><h3>Add Supplier</h3><button class="modal-close" data-modal-close>&times;</button></div>
            <div class="modal-body">
                <div class="form-grid form-grid-2">
                    <div class="form-group"><label class="form-label required" for="sup-name">Name</label><input type="text" id="sup-name" class="form-input" placeholder="Supplier name"></div>
                    <div class="form-group"><label class="form-label" for="sup-contact">Contact Person</label><input type="text" id="sup-contact" class="form-input" placeholder="Contact person"></div>
                    <div class="form-group"><label class="form-label" for="sup-phone">Phone</label><input type="tel" id="sup-phone" class="form-input" placeholder="+254 700 000 000"></div>
                    <div class="form-group"><label class="form-label" for="sup-email">Email</label><input type="email" id="sup-email" class="form-input" placeholder="supplier@example.com"></div>
                    <div class="form-group"><label class="form-label" for="sup-address">Address</label><input type="text" id="sup-address" class="form-input" placeholder="Address"></div>
                </div>
            </div>
            <div class="modal-footer">
                <button class="btn btn-secondary" data-modal-close>Cancel</button>
                <button class="btn btn-primary" onclick="saveSupplier()">Save Supplier</button>
            </div>
        </div>
    `;
    showModal(modalHtml, "Add Supplier");
}

window.saveSupplier = async function() {
    debug("Saving supplier...");
    const tenantId = getTenantId();
    if (!tenantId) return;
    const name = document.getElementById("sup-name")?.value.trim();
    const contactPerson = document.getElementById("sup-contact")?.value.trim();
    const phone = document.getElementById("sup-phone")?.value.trim();
    const email = document.getElementById("sup-email")?.value.trim();
    const address = document.getElementById("sup-address")?.value.trim();
    if (!name) {
        showToast("Please enter a supplier name.", "error");
        return;
    }
    try {
        showLoading("Saving supplier...");
        await addDoc(collection(db, "suppliers"), {
            tenantId,
            name,
            contactPerson: contactPerson || null,
            phone: phone || null,
            email: email || null,
            address: address || null,
            status: "active",
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
            createdBy: getCurrentUser()?.uid || ""
        });
        await addDoc(collection(db, "auditLogs"), {
            tenantId,
            userId: getCurrentUser()?.uid || "",
            action: "CREATE_SUPPLIER",
            module: "suppliers",
            details: { name },
            createdAt: serverTimestamp()
        });
        hideLoading();
        showToast("Supplier added successfully!", "success");
        closeModal();
        await loadSuppliers();
    } catch (error) {
        debugError("Error saving supplier:", error);
        hideLoading();
        showToast("Unable to save supplier. Please try again.", "error");
    }
};

window.editSupplier = async function(supplierId) {
    debug("Edit supplier:", supplierId);
    if (!hasPermission(PERMISSIONS.SUPPLIER_UPDATE)) {
        showToast("You don't have permission to edit suppliers.", "error");
        return;
    }
    const supplier = currentSuppliers.find(s => s.id === supplierId);
    if (!supplier) return;
    const modalHtml = `
        <div class="modal" style="max-width: 600px;">
            <div class="modal-header"><h3>Edit Supplier</h3><button class="modal-close" data-modal-close>&times;</button></div>
            <div class="modal-body">
                <div class="form-grid form-grid-2">
                    <div class="form-group"><label class="form-label" for="edit-sup-name">Name</label><input type="text" id="edit-sup-name" class="form-input" value="${escapeHtml(supplier.name || "")}"></div>
                    <div class="form-group"><label class="form-label" for="edit-sup-contact">Contact Person</label><input type="text" id="edit-sup-contact" class="form-input" value="${escapeHtml(supplier.contactPerson || "")}"></div>
                    <div class="form-group"><label class="form-label" for="edit-sup-phone">Phone</label><input type="tel" id="edit-sup-phone" class="form-input" value="${escapeHtml(supplier.phone || "")}"></div>
                    <div class="form-group"><label class="form-label" for="edit-sup-email">Email</label><input type="email" id="edit-sup-email" class="form-input" value="${escapeHtml(supplier.email || "")}"></div>
                    <div class="form-group"><label class="form-label" for="edit-sup-address">Address</label><input type="text" id="edit-sup-address" class="form-input" value="${escapeHtml(supplier.address || "")}"></div>
                </div>
            </div>
            <div class="modal-footer">
                <button class="btn btn-secondary" data-modal-close>Cancel</button>
                <button class="btn btn-primary" onclick="updateSupplier('${supplierId}')">Update Supplier</button>
            </div>
        </div>
    `;
    showModal(modalHtml, "Edit Supplier");
};

window.updateSupplier = async function(supplierId) {
    debug("Updating supplier:", supplierId);
    try {
        showLoading("Updating supplier...");
        await updateDoc(doc(db, "suppliers", supplierId), {
            name: document.getElementById("edit-sup-name").value.trim(),
            contactPerson: document.getElementById("edit-sup-contact").value.trim() || null,
            phone: document.getElementById("edit-sup-phone").value.trim() || null,
            email: document.getElementById("edit-sup-email").value.trim() || null,
            address: document.getElementById("edit-sup-address").value.trim() || null,
            updatedAt: serverTimestamp()
        });
        await addDoc(collection(db, "auditLogs"), {
            tenantId: getTenantId(),
            userId: getCurrentUser()?.uid || "",
            action: "UPDATE_SUPPLIER",
            module: "suppliers",
            recordId: supplierId,
            createdAt: serverTimestamp()
        });
        hideLoading();
        showToast("Supplier updated successfully!", "success");
        closeModal();
        await loadSuppliers();
    } catch (error) {
        debugError("Error updating supplier:", error);
        hideLoading();
        showToast("Unable to update supplier. Please try again.", "error");
    }
};

window.deleteSupplier = async function(supplierId, supplierName) {
    debug("Delete supplier:", supplierId, supplierName);
    if (!hasPermission(PERMISSIONS.SUPPLIER_DELETE)) {
        showToast("You don't have permission to delete suppliers.", "error");
        return;
    }
    const confirmed = await showConfirm(
        "Delete Supplier",
        `Are you sure you want to delete "${supplierName}"? This action cannot be undone.`,
        "Delete",
        "Cancel"
    );
    if (!confirmed) return;
    try {
        showLoading("Deleting supplier...");
        await deleteDoc(doc(db, "suppliers", supplierId));
        await addDoc(collection(db, "auditLogs"), {
            tenantId: getTenantId(),
            userId: getCurrentUser()?.uid || "",
            action: "DELETE_SUPPLIER",
            module: "suppliers",
            recordId: supplierId,
            details: { supplierName },
            createdAt: serverTimestamp()
        });
        hideLoading();
        showToast(`Supplier "${supplierName}" has been deleted.`, "success");
        await loadSuppliers();
    } catch (error) {
        debugError("Error deleting supplier:", error);
        hideLoading();
        showToast("Unable to delete supplier. Please try again.", "error");
    }
};

function escapeHtml(text) {
    if (!text) return "";
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
}

export { loadSuppliers };
