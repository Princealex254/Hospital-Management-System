/**
 * PRINCE ALEX DIGITAL HMS — Stock Movements Module
 * 
 * Handles:
 * - Loading and displaying stock movements from Firestore
 * - Search and filter by type
 * - Recording new stock movements (in, out, transfer, adjustment)
 * - Updating inventory stock quantities
 * - Audit logging
 */

import { db, collection, query, where, getDocs, orderBy, addDoc, updateDoc, doc, serverTimestamp, getDoc } from "./firebase-config.js";
import { requireAuth } from "./auth-guard.js";
import { loadSidebar } from "./sidebar.js";
import { showToast, showLoading, hideLoading, showModal } from "./notifications.js";
import { debug, debugError } from "./debug.js";
import { icon } from "./icons.js";
import { getTenantId, getCurrentUser, hasPermission, PERMISSIONS } from "./permissions.js";

document.addEventListener("DOMContentLoaded", async () => {
    debug("Stock movements page: Initializing...");
    showLoading("Loading stock movements...");
    try {
        const user = await requireAuth();
        if (!user) return;
        await loadSidebar();
                document.getElementById("page-title").textContent = "Stock Movements";
        await loadMovements();
        await loadInventoryItems();
        setupSearch();
        setupFilter();
        setupRecordButton();
        hideLoading();
        debug("Stock movements page: Initialization complete.");
    } catch (error) {
        debugError("Stock movements page initialization error:", error);
        hideLoading();
        showToast("Unable to load stock movements page. Please try again.", "error");
    }
});

let currentMovements = [];
let inventoryItems = [];
let currentFilters = { search: "", type: "" };

async function loadMovements() {
    debug("Loading stock movements...");
    const tenantId = getTenantId();
    if (!tenantId) return;
    try {
        const q = query(
            collection(db, "stockMovements"),
            where("tenantId", "==", tenantId),
            orderBy("createdAt", "desc")
        );
        const snapshot = await getDocs(q);
        currentMovements = [];
        snapshot.forEach((doc) => {
            currentMovements.push({ id: doc.id, ...doc.data() });
        });
        debug("Movements loaded:", currentMovements.length);
        renderMovements(currentMovements);
        updateMovementCount(currentMovements.length);
    } catch (error) {
        debugError("Error loading movements:", error);
        showToast("Unable to load stock movements. Please try again.", "error");
        renderEmptyState("Unable to load movements.");
    }
}

async function loadInventoryItems() {
    debug("Loading inventory items...");
    const tenantId = getTenantId();
    if (!tenantId) return;
    try {
        const q = query(
            collection(db, "inventory"),
            where("tenantId", "==", tenantId),
            orderBy("name")
        );
        const snapshot = await getDocs(q);
        inventoryItems = [];
        snapshot.forEach((doc) => {
            inventoryItems.push({ id: doc.id, ...doc.data() });
        });
        debug("Inventory items loaded:", inventoryItems.length);
    } catch (error) {
        debugError("Error loading inventory items:", error);
    }
}

function renderMovements(movements) {
    const tbody = document.getElementById("movements-tbody");
    if (!tbody) return;
    if (movements.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6"><div class="table-empty"><div class="empty-icon">${icon('inventory', '18', 'icon-svg')}</div><h3>No stock movements found</h3></div></td></tr>`;
        return;
    }
    tbody.innerHTML = movements.map((movement) => {
        const qty = parseInt(movement.quantity) || 0;
        const type = movement.type || "adjustment";
        const isPositive = type === "stock-in" || type === "adjustment";
        return `
            <tr>
                <td>${formatDate(movement.createdAt)}</td>
                <td>${escapeHtml(movement.itemName || "")}</td>
                <td><span class="badge badge-${type === "stock-in" ? "success" : type === "stock-out" ? "error" : "info"}">${escapeHtml(type)}</span></td>
                <td class="${isPositive ? "text-success" : "text-error"}">${isPositive ? "+" : "-"}${qty}</td>
                <td>${escapeHtml(movement.reference || "")}</td>
                <td>${escapeHtml(movement.notes || "")}</td>
            </tr>
        `;
    }).join("");
}

function renderEmptyState(message) {
    const tbody = document.getElementById("movements-tbody");
    if (!tbody) return;
    tbody.innerHTML = `<tr><td colspan="6"><div class="table-empty"><div class="empty-icon">${icon('inventory', '18', 'icon-svg')}</div><h3>${escapeHtml(message)}</h3></div></td></tr>`;
}

function updateMovementCount(count) {
    const el = document.getElementById("movement-count");
    if (el) el.textContent = `${count} movement${count !== 1 ? "s" : ""}`;
}

function setupSearch() {
    const searchInput = document.getElementById("movement-search");
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
    const typeFilter = document.getElementById("filter-type");
    if (typeFilter) {
        typeFilter.addEventListener("change", (e) => {
            currentFilters.type = e.target.value;
            applyFilters();
        });
    }
}

function applyFilters() {
    debug("Applying filters:", currentFilters);
    const filtered = currentMovements.filter((movement) => {
        if (currentFilters.search) {
            const itemName = (movement.itemName || "").toLowerCase();
            const reference = (movement.reference || "").toLowerCase();
            if (!itemName.includes(currentFilters.search) && !reference.includes(currentFilters.search)) return false;
        }
        if (currentFilters.type && movement.type !== currentFilters.type) return false;
        return true;
    });
    renderMovements(filtered);
    updateMovementCount(filtered.length);
}

function setupRecordButton() {
    const recordBtn = document.getElementById("record-movement-btn");
    if (recordBtn) {
        recordBtn.addEventListener("click", () => {
            if (!hasPermission(PERMISSIONS.INVENTORY_UPDATE)) {
                showToast("You don't have permission to record stock movements.", "error");
                return;
            }
            showRecordMovementModal();
        });
    }
}

function showRecordMovementModal() {
    const options = inventoryItems.map(item => `<option value="${item.id}" data-name="${escapeHtml(item.name || "")}">${escapeHtml(item.name || "")}</option>`).join("");
    const modalHtml = `
        <div class="modal" style="max-width: 600px;">
            <div class="modal-header"><h3>Record Stock Movement</h3><button class="modal-close" onclick="closeModal()">&times;</button></div>
            <div class="modal-body">
                <div class="form-group">
                    <label class="form-label required" for="mv-item">Inventory Item</label>
                    <select id="mv-item" class="form-select">
                        <option value="">Select Item</option>
                        ${options}
                    </select>
                </div>
                <div class="form-grid form-grid-2">
                    <div class="form-group">
                        <label class="form-label required" for="mv-type">Movement Type</label>
                        <select id="mv-type" class="form-select">
                            <option value="stock-in">Stock In</option>
                            <option value="stock-out">Stock Out</option>
                            <option value="transfer">Transfer</option>
                            <option value="adjustment">Adjustment</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label class="form-label required" for="mv-quantity">Quantity</label>
                        <input type="number" id="mv-quantity" class="form-input" min="1" placeholder="0">
                    </div>
                </div>
                <div class="form-group">
                    <label class="form-label" for="mv-reference">Reference</label>
                    <input type="text" id="mv-reference" class="form-input" placeholder="e.g. PO-001, Batch #">
                </div>
                <div class="form-group">
                    <label class="form-label" for="mv-notes">Notes</label>
                    <textarea id="mv-notes" class="form-textarea" placeholder="Additional notes..."></textarea>
                </div>
            </div>
            <div class="modal-footer">
                <button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
                <button class="btn btn-primary" onclick="saveMovement()">Record Movement</button>
            </div>
        </div>
    `;
    showModal(modalHtml);
}

window.saveMovement = async function() {
    debug("Saving movement...");
    const tenantId = getTenantId();
    if (!tenantId) return;

    const itemId = document.getElementById("mv-item")?.value;
    const type = document.getElementById("mv-type")?.value;
    const quantity = document.getElementById("mv-quantity")?.value;
    const reference = document.getElementById("mv-reference")?.value.trim();
    const notes = document.getElementById("mv-notes")?.value.trim();

    if (!itemId || !type || !quantity) {
        showToast("Please fill in all required fields.", "error");
        return;
    }

    try {
        showLoading("Recording movement...");

        const item = inventoryItems.find(i => i.id === itemId);
        const itemName = item?.name || "";
        const currentStock = item?.stockQuantity || 0;
        const qty = parseInt(quantity);
        const newStock = type === "stock-in" || type === "adjustment"
            ? currentStock + qty
            : Math.max(0, currentStock - qty);

        // Create movement record
        const movementRef = await addDoc(collection(db, "stockMovements"), {
            tenantId,
            itemId,
            itemName,
            type,
            quantity: qty,
            reference: reference || null,
            notes: notes || null,
            newStock,
            createdAt: serverTimestamp(),
            createdBy: getCurrentUser()?.uid || ""
        });

        // Update inventory stock
        await updateDoc(doc(db, "inventory", itemId), {
            stockQuantity: newStock,
            updatedAt: serverTimestamp()
        });

        // Log audit
        await addDoc(collection(db, "auditLogs"), {
            tenantId,
            userId: getCurrentUser()?.uid || "",
            action: "RECORD_STOCK_MOVEMENT",
            module: "stockMovements",
            recordId: movementRef.id,
            details: { itemName, type, quantity, newStock },
            createdAt: serverTimestamp()
        });

        hideLoading();
        showToast("Stock movement recorded successfully!", "success");
        closeModal();
        await loadMovements();
    } catch (error) {
        debugError("Error recording movement:", error);
        hideLoading();
        showToast("Unable to record movement. Please try again.", "error");
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

export { loadMovements };
