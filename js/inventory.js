/**
 * PRINCE ALEX DIGITAL HMS — Inventory Module
 * 
 * Handles:
 * - Loading and displaying inventory items from Firestore
 * - Search and filter by category
 * - Adding new inventory items
 * - Editing inventory items
 * - Deleting inventory items
 * - Low stock alerts
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
    debug("Inventory page: Initializing...");
    showLoading("Loading inventory...");
    try {
        const user = await requireAuth();
        if (!user) return;
        await loadSidebar();
        const pageTitleEl = document.getElementById("page-title");
        if (pageTitleEl) pageTitleEl.textContent = "Inventory";
        await loadInventory();
        setupSearch();
        setupFilter();
        setupAddButton();
        hideLoading();
        debug("Inventory page: Initialization complete.");
    } catch (error) {
        debugError("Inventory page initialization error:", error);
        hideLoading();
        showToast("Unable to load inventory page. Please try again.", "error");
    }
});

let currentItems = [];
let currentFilters = { search: "", category: "" };

async function loadInventory() {
    debug("Loading inventory...");
    const tenantId = getTenantId();
    if (!tenantId) return;
    try {
        const q = query(
            collection(db, "inventory"),
            where("tenantId", "==", tenantId),
            orderBy("name")
        );
        const snapshot = await getDocs(q);
        currentItems = [];
        snapshot.forEach((doc) => {
            currentItems.push({ id: doc.id, ...doc.data() });
        });
        debug("Inventory loaded:", currentItems.length);
        renderInventory(currentItems);
        updateInventoryCount(currentItems.length);
    } catch (error) {
        debugError("Error loading inventory:", error);
        showToast("Unable to load inventory. Please try again.", "error");
        renderEmptyState("Unable to load inventory.");
    }
}

function renderInventory(items) {
    const tbody = document.getElementById("inventory-tbody");
    if (!tbody) return;
    if (items.length === 0) {
        tbody.innerHTML = `<tr><td colspan="8"><div class="table-empty"><div class="empty-icon">${icon('inventory', '18', 'icon-svg')}</div><h3>No inventory items found</h3></div></td></tr>`;
        return;
    }
    tbody.innerHTML = items.map((item) => {
        const stock = item.stockQuantity || 0;
        const minStock = item.minStockLevel || 0;
        const isLowStock = stock <= minStock;
        return `
            <tr>
                <td><strong>${escapeHtml(item.name || "")}</strong></td>
                <td>${escapeHtml(item.category || "")}</td>
                <td>${stock}</td>
                <td>${minStock}</td>
                <td>${escapeHtml(item.unit || "")}</td>
                <td>${formatDate(item.expiryDate)}</td>
                <td><span class="badge badge-${isLowStock ? "error" : "success"}">${isLowStock ? "Low Stock" : "In Stock"}</span></td>
                <td class="text-right">
                    <div class="table-actions">
                        <button class="btn btn-sm btn-outline" onclick="editInventoryItem('${item.id}')"> ${icon('edit', '18', 'icon-svg')} Edit</button>
                        <button class="btn btn-sm btn-error" onclick="deleteInventoryItem('${item.id}', '${escapeHtml(item.name || "")}')"> ${icon('trash', '18', 'icon-svg')} Delete</button>
                    </div>
                </td>
            </tr>
        `;
    }).join("");
}

function renderEmptyState(message) {
    const tbody = document.getElementById("inventory-tbody");
    if (!tbody) return;
    tbody.innerHTML = `<tr><td colspan="8"><div class="table-empty"><div class="empty-icon">${icon('inventory', '18', 'icon-svg')}</div><h3>${escapeHtml(message)}</h3></div></td></tr>`;
}

function updateInventoryCount(count) {
    const el = document.getElementById("inventory-count");
    if (el) el.textContent = `${count} item${count !== 1 ? "s" : ""}`;
}

function setupSearch() {
    const searchInput = document.getElementById("inventory-search");
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
    const categoryFilter = document.getElementById("filter-category");
    if (categoryFilter) {
        categoryFilter.addEventListener("change", (e) => {
            currentFilters.category = e.target.value;
            applyFilters();
        });
    }
}

function applyFilters() {
    debug("Applying filters:", currentFilters);
    const filtered = currentItems.filter((item) => {
        if (currentFilters.search) {
            const name = (item.name || "").toLowerCase();
            const category = (item.category || "").toLowerCase();
            if (!name.includes(currentFilters.search) && !category.includes(currentFilters.search)) return false;
        }
        if (currentFilters.category && item.category !== currentFilters.category) return false;
        return true;
    });
    renderInventory(filtered);
    updateInventoryCount(filtered.length);
}

function setupAddButton() {
    const addBtn = document.getElementById("add-item-btn");
    if (addBtn) {
        addBtn.addEventListener("click", () => {
            if (!hasPermission(PERMISSIONS.INVENTORY_CREATE)) {
                showToast("You don't have permission to add inventory items.", "error");
                return;
            }
            showAddItemModal();
        });
    }
}

function showAddItemModal() {
    const modalHtml = `
        <div class="modal" style="max-width: 600px;">
            <div class="modal-header"><h3>Add Inventory Item</h3><button class="modal-close" data-modal-close>&times;</button></div>
            <div class="modal-body">
                <div class="form-grid form-grid-2">
                    <div class="form-group"><label class="form-label required" for="inv-name">Name</label><input type="text" id="inv-name" class="form-input" placeholder="Item name"></div>
                    <div class="form-group"><label class="form-label" for="inv-category">Category</label><input type="text" id="inv-category" class="form-input" placeholder="e.g. Medical Supplies"></div>
                    <div class="form-group"><label class="form-label" for="inv-stock">Stock Quantity</label><input type="number" id="inv-stock" class="form-input" placeholder="0" min="0"></div>
                    <div class="form-group"><label class="form-label" for="inv-min-stock">Min Stock Level</label><input type="number" id="inv-min-stock" class="form-input" placeholder="0" min="0"></div>
                    <div class="form-group"><label class="form-label" for="inv-unit">Unit</label><input type="text" id="inv-unit" class="form-input" placeholder="e.g. box, pack"></div>
                    <div class="form-group"><label class="form-label" for="inv-expiry">Expiry Date</label><input type="date" id="inv-expiry" class="form-input"></div>
                </div>
            </div>
            <div class="modal-footer">
                <button class="btn btn-secondary" data-modal-close>Cancel</button>
                <button class="btn btn-primary" onclick="saveInventoryItem()">Save Item</button>
            </div>
        </div>
    `;
    showModal(modalHtml, "Add Inventory Item");
}

window.saveInventoryItem = async function() {
    debug("Saving inventory item...");
    const tenantId = getTenantId();
    if (!tenantId) return;
    const name = document.getElementById("inv-name")?.value.trim();
    const category = document.getElementById("inv-category")?.value.trim();
    const stock = document.getElementById("inv-stock")?.value;
    const minStock = document.getElementById("inv-min-stock")?.value;
    const unit = document.getElementById("inv-unit")?.value.trim();
    const expiry = document.getElementById("inv-expiry")?.value;
    if (!name) {
        showToast("Please enter an item name.", "error");
        return;
    }
    try {
        showLoading("Saving item...");
        await addDoc(collection(db, "inventory"), {
            tenantId,
            name,
            category: category || null,
            stockQuantity: stock ? parseInt(stock) : 0,
            minStockLevel: minStock ? parseInt(minStock) : 0,
            unit: unit || null,
            expiryDate: expiry ? new Date(expiry) : null,
            status: "active",
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
            createdBy: getCurrentUser()?.uid || ""
        });
        await addDoc(collection(db, "auditLogs"), {
            tenantId,
            userId: getCurrentUser()?.uid || "",
            action: "CREATE_INVENTORY_ITEM",
            module: "inventory",
            details: { name, category },
            createdAt: serverTimestamp()
        });
        hideLoading();
        showToast("Inventory item added successfully!", "success");
        closeModal();
        await loadInventory();
    } catch (error) {
        debugError("Error saving inventory item:", error);
        hideLoading();
        showToast("Unable to save item. Please try again.", "error");
    }
};

window.editInventoryItem = async function(itemId) {
    debug("Edit inventory item:", itemId);
    if (!hasPermission(PERMISSIONS.INVENTORY_UPDATE)) {
        showToast("You don't have permission to edit inventory items.", "error");
        return;
    }
    const item = currentItems.find(i => i.id === itemId);
    if (!item) return;
    const modalHtml = `
        <div class="modal" style="max-width: 600px;">
            <div class="modal-header"><h3>Edit Inventory Item</h3><button class="modal-close" data-modal-close>&times;</button></div>
            <div class="modal-body">
                <div class="form-grid form-grid-2">
                    <div class="form-group"><label class="form-label" for="edit-inv-name">Name</label><input type="text" id="edit-inv-name" class="form-input" value="${escapeHtml(item.name || "")}"></div>
                    <div class="form-group"><label class="form-label" for="edit-inv-category">Category</label><input type="text" id="edit-inv-category" class="form-input" value="${escapeHtml(item.category || "")}"></div>
                    <div class="form-group"><label class="form-label" for="edit-inv-stock">Stock Quantity</label><input type="number" id="edit-inv-stock" class="form-input" value="${item.stockQuantity || 0}" min="0"></div>
                    <div class="form-group"><label class="form-label" for="edit-inv-min-stock">Min Stock Level</label><input type="number" id="edit-inv-min-stock" class="form-input" value="${item.minStockLevel || 0}" min="0"></div>
                    <div class="form-group"><label class="form-label" for="edit-inv-unit">Unit</label><input type="text" id="edit-inv-unit" class="form-input" value="${escapeHtml(item.unit || "")}"></div>
                    <div class="form-group"><label class="form-label" for="edit-inv-expiry">Expiry Date</label><input type="date" id="edit-inv-expiry" class="form-input" value="${item.expiryDate?.toDate ? item.expiryDate.toDate().toISOString().split('T')[0] : ''}"></div>
                </div>
            </div>
            <div class="modal-footer">
                <button class="btn btn-secondary" data-modal-close>Cancel</button>
                <button class="btn btn-primary" onclick="updateInventoryItem('${itemId}')">Update Item</button>
            </div>
        </div>
    `;
    showModal(modalHtml, "Edit Inventory Item");
};

window.updateInventoryItem = async function(itemId) {
    debug("Updating inventory item:", itemId);
    try {
        showLoading("Updating item...");
        await updateDoc(doc(db, "inventory", itemId), {
            name: document.getElementById("edit-inv-name").value.trim(),
            category: document.getElementById("edit-inv-category").value.trim() || null,
            stockQuantity: parseInt(document.getElementById("edit-inv-stock").value) || 0,
            minStockLevel: parseInt(document.getElementById("edit-inv-min-stock").value) || 0,
            unit: document.getElementById("edit-inv-unit").value.trim() || null,
            expiryDate: document.getElementById("edit-inv-expiry").value ? new Date(document.getElementById("edit-inv-expiry").value) : null,
            updatedAt: serverTimestamp()
        });
        await addDoc(collection(db, "auditLogs"), {
            tenantId: getTenantId(),
            userId: getCurrentUser()?.uid || "",
            action: "UPDATE_INVENTORY_ITEM",
            module: "inventory",
            recordId: itemId,
            createdAt: serverTimestamp()
        });
        hideLoading();
        showToast("Inventory item updated successfully!", "success");
        closeModal();
        await loadInventory();
    } catch (error) {
        debugError("Error updating inventory item:", error);
        hideLoading();
        showToast("Unable to update item. Please try again.", "error");
    }
};

window.deleteInventoryItem = async function(itemId, itemName) {
    debug("Delete inventory item:", itemId, itemName);
    if (!hasPermission(PERMISSIONS.INVENTORY_DELETE)) {
        showToast("You don't have permission to delete inventory items.", "error");
        return;
    }
    const confirmed = await showConfirm(
        "Delete Item",
        `Are you sure you want to delete "${itemName}"? This action cannot be undone.`,
        "Delete",
        "Cancel"
    );
    if (!confirmed) return;
    try {
        showLoading("Deleting item...");
        await deleteDoc(doc(db, "inventory", itemId));
        await addDoc(collection(db, "auditLogs"), {
            tenantId: getTenantId(),
            userId: getCurrentUser()?.uid || "",
            action: "DELETE_INVENTORY_ITEM",
            module: "inventory",
            recordId: itemId,
            details: { itemName },
            createdAt: serverTimestamp()
        });
        hideLoading();
        showToast(`Item "${itemName}" has been deleted.`, "success");
        await loadInventory();
    } catch (error) {
        debugError("Error deleting inventory item:", error);
        hideLoading();
        showToast("Unable to delete item. Please try again.", "error");
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

export { loadInventory };
