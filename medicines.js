/**
 * PRINCE ALEX DIGITAL HMS — Medicines Module
 * 
 * Handles:
 * - Loading and displaying medicines from Firestore
 * - Search and filter by category
 * - Adding new medicines
 * - Editing medicine details
 * - Deleting medicines
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
    debug("Medicines page: Initializing...");
    showLoading("Loading medicines...");
    try {
        const user = await requireAuth();
        if (!user) return;
        await loadSidebar();
        const pageTitleEl = document.getElementById("page-title");
        if (pageTitleEl) pageTitleEl.textContent = "Medicines";
        await loadMedicines();
        await loadCategories();
        setupSearch();
        setupFilter();
        setupAddButton();
        hideLoading();
        debug("Medicines page: Initialization complete.");
    } catch (error) {
        debugError("Medicines page initialization error:", error);
        hideLoading();
        showToast("Unable to load medicines page. Please try again.", "error");
    }
});

let currentMedicines = [];
let currentFilters = { search: "", category: "" };

async function loadMedicines() {
    debug("Loading medicines...");
    const tenantId = getTenantId();
    if (!tenantId) return;
    try {
        const q = query(
            collection(db, "medicines"),
            where("tenantId", "==", tenantId),
            orderBy("name")
        );
        const snapshot = await getDocs(q);
        currentMedicines = [];
        snapshot.forEach((doc) => {
            currentMedicines.push({ id: doc.id, ...doc.data() });
        });
        debug("Medicines loaded:", currentMedicines.length);
        renderMedicines(currentMedicines);
        updateMedicineCount(currentMedicines.length);
    } catch (error) {
        debugError("Error loading medicines:", error);
        showToast("Unable to load medicines. Please try again.", "error");
        renderEmptyState("Unable to load medicines.");
    }
}

async function loadCategories() {
    debug("Loading categories...");
    const tenantId = getTenantId();
    if (!tenantId) return;
    try {
        const q = query(
            collection(db, "medicineCategories"),
            where("tenantId", "==", tenantId)
        );
        const snapshot = await getDocs(q);
        const select = document.getElementById("filter-category");
        if (!select) return;
        select.innerHTML = '<option value="">All Categories</option>';
        snapshot.forEach((doc) => {
            const cat = doc.data();
            const option = document.createElement("option");
            option.value = cat.name || "";
            option.textContent = cat.name || "Unknown";
            select.appendChild(option);
        });
    } catch (error) {
        debugError("Error loading categories:", error);
    }
}

function renderMedicines(medicines) {
    const tbody = document.getElementById("medicines-tbody");
    if (!tbody) return;
    if (medicines.length === 0) {
        tbody.innerHTML = `<tr><td colspan="9"><div class="table-empty"><div class="empty-icon">${icon('medicines', '18', 'icon-svg')}</div><h3>No medicines found</h3></div></td></tr>`;
        return;
    }
    tbody.innerHTML = medicines.map((med) => {
        const stock = med.stockQuantity || 0;
        const minStock = med.minStockLevel || 0;
        const isLowStock = stock <= minStock;
        const status = isLowStock ? "low-stock" : "in-stock";
        const isExpired = med.expiryDate && med.expiryDate.toDate && med.expiryDate.toDate() < new Date();
        return `
            <tr>
                <td><strong>${escapeHtml(med.name || "")}</strong></td>
                <td>${escapeHtml(med.category || "")}</td>
                <td>${stock}</td>
                <td>${minStock}</td>
                <td>${escapeHtml(med.unit || "")}</td>
                <td>${formatCurrency(med.price)}</td>
                <td>${formatDate(med.expiryDate)}</td>
                <td><span class="badge badge-${isLowStock ? "error" : "success"}">${isLowStock ? "Low Stock" : "In Stock"}</span></td>
                <td class="text-right">
                    <div class="table-actions">
                        <button class="btn btn-sm btn-outline" onclick="editMedicine('${med.id}')"> ${icon('edit', '18', 'icon-svg')} Edit</button>
                        <button class="btn btn-sm btn-error" onclick="deleteMedicine('${med.id}', '${escapeHtml(med.name || "")}')"> ${icon('trash', '18', 'icon-svg')} Delete</button>
                    </div>
                </td>
            </tr>
        `;
    }).join("");
}

function renderEmptyState(message) {
    const tbody = document.getElementById("medicines-tbody");
    if (!tbody) return;
    tbody.innerHTML = `<tr><td colspan="9"><div class="table-empty"><div class="empty-icon">${icon('medicines', '18', 'icon-svg')}</div><h3>${escapeHtml(message)}</h3></div></td></tr>`;
}

function updateMedicineCount(count) {
    const el = document.getElementById("medicine-count");
    if (el) el.textContent = `${count} medicine${count !== 1 ? "s" : ""}`;
}

function setupSearch() {
    const searchInput = document.getElementById("medicine-search");
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
    const filtered = currentMedicines.filter((med) => {
        if (currentFilters.search) {
            const name = (med.name || "").toLowerCase();
            const category = (med.category || "").toLowerCase();
            if (!name.includes(currentFilters.search) && !category.includes(currentFilters.search)) return false;
        }
        if (currentFilters.category && med.category !== currentFilters.category) return false;
        return true;
    });
    renderMedicines(filtered);
    updateMedicineCount(filtered.length);
}

function setupAddButton() {
    const addBtn = document.getElementById("add-medicine-btn");
    if (addBtn) {
        addBtn.addEventListener("click", () => {
            if (!hasPermission(PERMISSIONS.MEDICINE_CREATE)) {
                showToast("You don't have permission to add medicines.", "error");
                return;
            }
            showAddMedicineModal();
        });
    }
}

function showAddMedicineModal() {
    const modalHtml = `
        <div class="modal" style="max-width: 600px;">
            <div class="modal-header"><h3>Add New Medicine</h3><button class="modal-close" onclick="closeModal()">&times;</button></div>
            <div class="modal-body">
                <div class="form-grid form-grid-2">
                    <div class="form-group"><label class="form-label required" for="med-name">Name</label><input type="text" id="med-name" class="form-input" placeholder="Medicine name"></div>
                    <div class="form-group"><label class="form-label" for="med-category">Category</label><input type="text" id="med-category" class="form-input" placeholder="e.g. Antibiotic"></div>
                    <div class="form-group"><label class="form-label" for="med-stock">Stock Quantity</label><input type="number" id="med-stock" class="form-input" placeholder="0" min="0"></div>
                    <div class="form-group"><label class="form-label" for="med-min-stock">Min Stock Level</label><input type="number" id="med-min-stock" class="form-input" placeholder="0" min="0"></div>
                    <div class="form-group"><label class="form-label" for="med-unit">Unit</label><input type="text" id="med-unit" class="form-input" placeholder="e.g. tablet, bottle"></div>
                    <div class="form-group"><label class="form-label" for="med-price">Price</label><input type="number" id="med-price" class="form-input" step="0.01" placeholder="0.00"></div>
                    <div class="form-group"><label class="form-label" for="med-batch">Batch Number</label><input type="text" id="med-batch" class="form-input" placeholder="Batch #"></div>
                    <div class="form-group"><label class="form-label" for="med-expiry">Expiry Date</label><input type="date" id="med-expiry" class="form-input"></div>
                </div>
            </div>
            <div class="modal-footer">
                <button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
                <button class="btn btn-primary" onclick="saveMedicine()">Save Medicine</button>
            </div>
        </div>
    `;
    showModal(modalHtml);
}

window.saveMedicine = async function() {
    debug("Saving medicine...");
    const tenantId = getTenantId();
    if (!tenantId) return;
    const name = document.getElementById("med-name")?.value.trim();
    const category = document.getElementById("med-category")?.value.trim();
    const stock = document.getElementById("med-stock")?.value;
    const minStock = document.getElementById("med-min-stock")?.value;
    const unit = document.getElementById("med-unit")?.value.trim();
    const price = document.getElementById("med-price")?.value;
    const batch = document.getElementById("med-batch")?.value.trim();
    const expiry = document.getElementById("med-expiry")?.value;
    if (!name) {
        showToast("Please enter a medicine name.", "error");
        return;
    }
    try {
        showLoading("Saving medicine...");
        await addDoc(collection(db, "medicines"), {
            tenantId,
            name,
            category: category || null,
            stockQuantity: stock ? parseInt(stock) : 0,
            minStockLevel: minStock ? parseInt(minStock) : 0,
            unit: unit || null,
            price: price ? parseFloat(price) : null,
            batchNumber: batch || null,
            expiryDate: expiry ? new Date(expiry) : null,
            status: "active",
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
            createdBy: getCurrentUser()?.uid || ""
        });
        await addDoc(collection(db, "auditLogs"), {
            tenantId,
            userId: getCurrentUser()?.uid || "",
            action: "CREATE_MEDICINE",
            module: "medicines",
            details: { name, category },
            createdAt: serverTimestamp()
        });
        hideLoading();
        showToast("Medicine added successfully!", "success");
        closeModal();
        await loadMedicines();
    } catch (error) {
        debugError("Error saving medicine:", error);
        hideLoading();
        showToast("Unable to save medicine. Please try again.", "error");
    }
};

window.editMedicine = async function(medicineId) {
    debug("Edit medicine:", medicineId);
    if (!hasPermission(PERMISSIONS.MEDICINE_UPDATE)) {
        showToast("You don't have permission to edit medicines.", "error");
        return;
    }
    const med = currentMedicines.find(m => m.id === medicineId);
    if (!med) return;
    const modalHtml = `
        <div class="modal" style="max-width: 600px;">
            <div class="modal-header"><h3>Edit Medicine</h3><button class="modal-close" onclick="closeModal()">&times;</button></div>
            <div class="modal-body">
                <div class="form-grid form-grid-2">
                    <div class="form-group"><label class="form-label" for="edit-med-name">Name</label><input type="text" id="edit-med-name" class="form-input" value="${escapeHtml(med.name || "")}"></div>
                    <div class="form-group"><label class="form-label" for="edit-med-category">Category</label><input type="text" id="edit-med-category" class="form-input" value="${escapeHtml(med.category || "")}"></div>
                    <div class="form-group"><label class="form-label" for="edit-med-stock">Stock Quantity</label><input type="number" id="edit-med-stock" class="form-input" value="${med.stockQuantity || 0}" min="0"></div>
                    <div class="form-group"><label class="form-label" for="edit-med-min-stock">Min Stock Level</label><input type="number" id="edit-med-min-stock" class="form-input" value="${med.minStockLevel || 0}" min="0"></div>
                    <div class="form-group"><label class="form-label" for="edit-med-unit">Unit</label><input type="text" id="edit-med-unit" class="form-input" value="${escapeHtml(med.unit || "")}"></div>
                    <div class="form-group"><label class="form-label" for="edit-med-price">Price</label><input type="number" id="edit-med-price" class="form-input" step="0.01" value="${med.price || 0}"></div>
                    <div class="form-group"><label class="form-label" for="edit-med-batch">Batch Number</label><input type="text" id="edit-med-batch" class="form-input" value="${escapeHtml(med.batchNumber || "")}"></div>
                    <div class="form-group"><label class="form-label" for="edit-med-expiry">Expiry Date</label><input type="date" id="edit-med-expiry" class="form-input" value="${med.expiryDate && med.expiryDate.toDate ? med.expiryDate.toDate().toISOString().split('T')[0] : ''}"></div>
                </div>
            </div>
            <div class="modal-footer">
                <button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
                <button class="btn btn-primary" onclick="updateMedicine('${medicineId}')">Update Medicine</button>
            </div>
        </div>
    `;
    showModal(modalHtml);
};

window.updateMedicine = async function(medicineId) {
    debug("Updating medicine:", medicineId);
    try {
        showLoading("Updating medicine...");
        await updateDoc(doc(db, "medicines", medicineId), {
            name: document.getElementById("edit-med-name").value.trim(),
            category: document.getElementById("edit-med-category").value.trim() || null,
            stockQuantity: parseInt(document.getElementById("edit-med-stock").value) || 0,
            minStockLevel: parseInt(document.getElementById("edit-med-min-stock").value) || 0,
            unit: document.getElementById("edit-med-unit").value.trim() || null,
            price: parseFloat(document.getElementById("edit-med-price").value) || null,
            batchNumber: document.getElementById("edit-med-batch").value.trim() || null,
            expiryDate: document.getElementById("edit-med-expiry").value ? new Date(document.getElementById("edit-med-expiry").value) : null,
            updatedAt: serverTimestamp()
        });
        await addDoc(collection(db, "auditLogs"), {
            tenantId: getTenantId(),
            userId: getCurrentUser()?.uid || "",
            action: "UPDATE_MEDICINE",
            module: "medicines",
            recordId: medicineId,
            createdAt: serverTimestamp()
        });
        hideLoading();
        showToast("Medicine updated successfully!", "success");
        closeModal();
        await loadMedicines();
    } catch (error) {
        debugError("Error updating medicine:", error);
        hideLoading();
        showToast("Unable to update medicine. Please try again.", "error");
    }
};

window.deleteMedicine = async function(medicineId, medicineName) {
    debug("Delete medicine:", medicineId, medicineName);
    if (!hasPermission(PERMISSIONS.MEDICINE_DELETE)) {
        showToast("You don't have permission to delete medicines.", "error");
        return;
    }
    const confirmed = await showConfirm(
        "Delete Medicine",
        `Are you sure you want to delete "${medicineName}"? This action cannot be undone.`,
        "Delete",
        "Cancel"
    );
    if (!confirmed) return;
    try {
        showLoading("Deleting medicine...");
        await deleteDoc(doc(db, "medicines", medicineId));
        await addDoc(collection(db, "auditLogs"), {
            tenantId: getTenantId(),
            userId: getCurrentUser()?.uid || "",
            action: "DELETE_MEDICINE",
            module: "medicines",
            recordId: medicineId,
            details: { medicineName },
            createdAt: serverTimestamp()
        });
        hideLoading();
        showToast(`Medicine "${medicineName}" has been deleted.`, "success");
        await loadMedicines();
    } catch (error) {
        debugError("Error deleting medicine:", error);
        hideLoading();
        showToast("Unable to delete medicine. Please try again.", "error");
    }
};

function formatCurrency(amount) {
    if (!amount) return "KSh 0";
    return new Intl.NumberFormat("en-KE", { style: "currency", currency: "KES" }).format(parseFloat(amount));
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

export { loadMedicines };
