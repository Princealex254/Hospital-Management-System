/**
 * PRINCE ALEX DIGITAL HMS — Wards Module
 * 
 * Handles:
 * - Loading and displaying wards from Firestore
 * - Adding new wards
 * - Editing ward details
 * - Deleting wards
 * - Audit logging
 */

import { db, collection, query, where, getDocs, orderBy, addDoc, updateDoc, deleteDoc, doc, serverTimestamp } from "./firebase-config.js";
import { requireAuth } from "./auth-guard.js";
import { loadSidebar } from "./sidebar.js";
import { showToast, showLoading, hideLoading, showConfirm, showModal, closeModal } from "./notifications.js";
import { debug, debugError } from "./debug.js";
import { icon } from "./icons.js";
import { getTenantId, getCurrentUser, hasPermission, PERMISSIONS } from "./permissions.js";

document.addEventListener("DOMContentLoaded", async () => {
    debug("Wards page: Initializing...");
    showLoading("Loading wards...");
    try {
        const user = await requireAuth();
        if (!user) return;
        await loadSidebar();
        const pageTitleEl = document.getElementById("page-title");
        if (pageTitleEl) pageTitleEl.textContent = "Wards";
        await loadWards();
        setupAddWard();
        hideLoading();
        debug("Wards page: Initialization complete.");
    } catch (error) {
        debugError("Wards page initialization error:", error);
        hideLoading();
        showToast("Unable to load wards page. Please try again.", "error");
    }
});

let currentWards = [];

async function loadWards() {
    debug("Loading wards...");
    const tenantId = getTenantId();
    if (!tenantId) return;
    try {
        const q = query(
            collection(db, "wards"),
            where("tenantId", "==", tenantId),
            orderBy("name")
        );
        const snapshot = await getDocs(q);
        currentWards = [];
        snapshot.forEach((doc) => {
            currentWards.push({ id: doc.id, ...doc.data() });
        });
        debug("Wards loaded:", currentWards.length);
        renderWards(currentWards);
    } catch (error) {
        debugError("Error loading wards:", error);
        showToast("Unable to load wards. Please try again.", "error");
        renderEmptyState("Unable to load wards.");
    }
}

function renderWards(wards) {
    const tbody = document.getElementById("wards-tbody");
    if (!tbody) return;
    if (wards.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6"><div class="table-empty"><div class="empty-icon">${icon('wards', '18', 'icon-svg')}</div><h3>No wards found</h3></div></td></tr>`;
        return;
    }
    tbody.innerHTML = wards.map((ward) => {
        const capacity = ward.capacity || 0;
        const occupied = ward.occupiedBeds || 0;
        const available = capacity - occupied;
        return `
            <tr>
                <td><strong>${escapeHtml(ward.name || "")}</strong></td>
                <td>${escapeHtml(ward.floor || "")}</td>
                <td>${capacity}</td>
                <td>${occupied}</td>
                <td>${available}</td>
                <td class="text-right">
                    <div class="table-actions">
                        <button class="btn btn-sm btn-outline" onclick="editWard('${ward.id}')"> ${icon('edit', '18', 'icon-svg')} Edit</button>
                        <button class="btn btn-sm btn-error" onclick="deleteWard('${ward.id}', '${escapeHtml(ward.name || "")}')"> ${icon('trash', '18', 'icon-svg')} Delete</button>
                    </div>
                </td>
            </tr>
        `;
    }).join("");
}

function renderEmptyState(message) {
    const tbody = document.getElementById("wards-tbody");
    if (!tbody) return;
    tbody.innerHTML = `<tr><td colspan="6"><div class="table-empty"><div class="empty-icon">${icon('wards', '18', 'icon-svg')}</div><h3>${escapeHtml(message)}</h3></div></td></tr>`;
}

function setupAddWard() {
    const addBtn = document.getElementById("add-ward-btn");
    if (addBtn) {
        addBtn.addEventListener("click", () => {
            if (!hasPermission(PERMISSIONS.WARD_MANAGE)) {
                showToast("You don't have permission to manage wards.", "error");
                return;
            }
            showAddWardModal();
        });
    }
}

function showAddWardModal() {
    const modalHtml = `
        <div class="modal" style="max-width: 600px;">
            <div class="modal-header"><h3>Add New Ward</h3><button class="modal-close" data-modal-close>&times;</button></div>
            <div class="modal-body">
                <div class="form-group">
                    <label class="form-label required" for="ward-name">Ward Name</label>
                    <input type="text" id="ward-name" class="form-input" placeholder="e.g. General Ward A">
                </div>
                <div class="form-group">
                    <label class="form-label" for="ward-floor">Floor</label>
                    <input type="text" id="ward-floor" class="form-input" placeholder="e.g. Ground Floor">
                </div>
                <div class="form-group">
                    <label class="form-label required" for="ward-capacity">Capacity</label>
                    <input type="number" id="ward-capacity" class="form-input" placeholder="Number of beds" min="1">
                </div>
                <div class="form-group">
                    <label class="form-label" for="ward-type">Ward Type</label>
                    <select id="ward-type" class="form-select">
                        <option value="general">General</option>
                        <option value="icu">ICU</option>
                        <option value="maternity">Maternity</option>
                        <option value="pediatric">Pediatric</option>
                        <option value="private">Private</option>
                    </select>
                </div>
            </div>
            <div class="modal-footer">
                <button class="btn btn-secondary" data-modal-close>Cancel</button>
                <button class="btn btn-primary" onclick="saveWard()">Save Ward</button>
            </div>
        </div>
    `;
    showModal(modalHtml, "Add New Ward");
}

window.saveWard = async function() {
    debug("Saving ward...");
    const tenantId = getTenantId();
    if (!tenantId) return;

    const name = document.getElementById("ward-name")?.value.trim();
    const floor = document.getElementById("ward-floor")?.value.trim();
    const capacity = document.getElementById("ward-capacity")?.value;
    const type = document.getElementById("ward-type")?.value;

    if (!name || !capacity) {
        showToast("Please fill in all required fields.", "error");
        return;
    }

    try {
        showLoading("Saving ward...");
        await addDoc(collection(db, "wards"), {
            tenantId,
            name,
            floor: floor || null,
            capacity: parseInt(capacity),
            type: type || "general",
            occupiedBeds: 0,
            status: "active",
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
            createdBy: getCurrentUser()?.uid || ""
        });

        await addDoc(collection(db, "auditLogs"), {
            tenantId,
            userId: getCurrentUser()?.uid || "",
            action: "CREATE_WARD",
            module: "wards",
            details: { name, capacity, type },
            createdAt: serverTimestamp()
        });

        hideLoading();
        showToast("Ward created successfully!", "success");
        closeModal();
        await loadWards();
    } catch (error) {
        debugError("Error saving ward:", error);
        hideLoading();
        showToast("Unable to save ward. Please try again.", "error");
    }
};

window.editWard = async function(wardId) {
    debug("Edit ward:", wardId);
    if (!hasPermission(PERMISSIONS.WARD_MANAGE)) {
        showToast("You don't have permission to manage wards.", "error");
        return;
    }
    const ward = currentWards.find(w => w.id === wardId);
    if (!ward) return;

    const modalHtml = `
        <div class="modal" style="max-width: 600px;">
            <div class="modal-header"><h3>Edit Ward</h3><button class="modal-close" data-modal-close>&times;</button></div>
            <div class="modal-body">
                <div class="form-group">
                    <label class="form-label" for="edit-ward-name">Ward Name</label>
                    <input type="text" id="edit-ward-name" class="form-input" value="${escapeHtml(ward.name || "")}">
                </div>
                <div class="form-group">
                    <label class="form-label" for="edit-ward-floor">Floor</label>
                    <input type="text" id="edit-ward-floor" class="form-input" value="${escapeHtml(ward.floor || "")}">
                </div>
                <div class="form-group">
                    <label class="form-label" for="edit-ward-capacity">Capacity</label>
                    <input type="number" id="edit-ward-capacity" class="form-input" value="${ward.capacity || 0}" min="1">
                </div>
                <div class="form-group">
                    <label class="form-label" for="edit-ward-type">Ward Type</label>
                    <select id="edit-ward-type" class="form-select">
                        <option value="general" ${ward.type === "general" ? "selected" : ""}>General</option>
                        <option value="icu" ${ward.type === "icu" ? "selected" : ""}>ICU</option>
                        <option value="maternity" ${ward.type === "maternity" ? "selected" : ""}>Maternity</option>
                        <option value="pediatric" ${ward.type === "pediatric" ? "selected" : ""}>Pediatric</option>
                        <option value="private" ${ward.type === "private" ? "selected" : ""}>Private</option>
                    </select>
                </div>
            </div>
            <div class="modal-footer">
                <button class="btn btn-secondary" data-modal-close>Cancel</button>
                <button class="btn btn-primary" onclick="updateWard('${wardId}')">Update Ward</button>
            </div>
        </div>
    `;
    showModal(modalHtml, "Edit Ward");
};

window.updateWard = async function(wardId) {
    debug("Updating ward:", wardId);
    try {
        showLoading("Updating ward...");
        await updateDoc(doc(db, "wards", wardId), {
            name: document.getElementById("edit-ward-name").value.trim(),
            floor: document.getElementById("edit-ward-floor").value.trim() || null,
            capacity: parseInt(document.getElementById("edit-ward-capacity").value),
            type: document.getElementById("edit-ward-type").value,
            updatedAt: serverTimestamp()
        });

        await addDoc(collection(db, "auditLogs"), {
            tenantId: getTenantId(),
            userId: getCurrentUser()?.uid || "",
            action: "UPDATE_WARD",
            module: "wards",
            recordId: wardId,
            createdAt: serverTimestamp()
        });

        hideLoading();
        showToast("Ward updated successfully!", "success");
        closeModal();
        await loadWards();
    } catch (error) {
        debugError("Error updating ward:", error);
        hideLoading();
        showToast("Unable to update ward. Please try again.", "error");
    }
};

window.deleteWard = async function(wardId, wardName) {
    debug("Delete ward:", wardId, wardName);
    if (!hasPermission(PERMISSIONS.WARD_MANAGE)) {
        showToast("You don't have permission to manage wards.", "error");
        return;
    }
    const confirmed = await showConfirm(
        "Delete Ward",
        `Are you sure you want to delete "${wardName}"? This action cannot be undone.`,
        "Delete",
        "Cancel"
    );
    if (!confirmed) return;
    try {
        showLoading("Deleting ward...");
        await deleteDoc(doc(db, "wards", wardId));
        await addDoc(collection(db, "auditLogs"), {
            tenantId: getTenantId(),
            userId: getCurrentUser()?.uid || "",
            action: "DELETE_WARD",
            module: "wards",
            recordId: wardId,
            details: { wardName },
            createdAt: serverTimestamp()
        });
        hideLoading();
        showToast(`Ward "${wardName}" has been deleted.`, "success");
        await loadWards();
    } catch (error) {
        debugError("Error deleting ward:", error);
        hideLoading();
        showToast("Unable to delete ward. Please try again.", "error");
    }
};

function escapeHtml(text) {
    if (!text) return "";
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
}

export { loadWards };
