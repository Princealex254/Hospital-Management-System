/**
 * PRINCE ALEX DIGITAL HMS — Purchase Orders Module
 * 
 * Handles:
 * - Loading and displaying purchase orders from Firestore
 * - Search and filter by status
 * - Creating new purchase orders
 * - Status updates (draft, ordered, received, cancelled)
 * - PO number generation
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
    debug("Purchase orders page: Initializing...");
    showLoading("Loading purchase orders...");
    try {
        const user = await requireAuth();
        if (!user) return;
        await loadSidebar();
        const pageTitleEl = document.getElementById("page-title");
        if (pageTitleEl) pageTitleEl.textContent = "Purchase Orders";
        await loadPurchaseOrders();
        await loadSuppliers();
        setupSearch();
        setupFilter();
        setupCreateButton();
        hideLoading();
        debug("Purchase orders page: Initialization complete.");
    } catch (error) {
        debugError("Purchase orders page initialization error:", error);
        hideLoading();
        showToast("Unable to load purchase orders page. Please try again.", "error");
    }
});

let currentPOs = [];
let suppliers = [];
let currentFilters = { search: "", status: "" };

async function loadPurchaseOrders() {
    debug("Loading purchase orders...");
    const tenantId = getTenantId();
    if (!tenantId) return;
    try {
        const q = query(
            collection(db, "purchaseOrders"),
            where("tenantId", "==", tenantId),
            orderBy("createdAt", "desc")
        );
        const snapshot = await getDocs(q);
        currentPOs = [];
        snapshot.forEach((doc) => {
            currentPOs.push({ id: doc.id, ...doc.data() });
        });
        debug("Purchase orders loaded:", currentPOs.length);
        renderPOs(currentPOs);
        updatePOCount(currentPOs.length);
    } catch (error) {
        debugError("Error loading purchase orders:", error);
        showToast("Unable to load purchase orders. Please try again.", "error");
        renderEmptyState("Unable to load purchase orders.");
    }
}

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
        suppliers = [];
        snapshot.forEach((doc) => {
            suppliers.push({ id: doc.id, ...doc.data() });
        });
        debug("Suppliers loaded:", suppliers.length);
    } catch (error) {
        debugError("Error loading suppliers:", error);
    }
}

function renderPOs(pos) {
    const tbody = document.getElementById("po-tbody");
    if (!tbody) return;
    if (pos.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7"><div class="table-empty"><div class="empty-icon">${icon('lab-orders', '18', 'icon-svg')}</div><h3>No purchase orders found</h3></div></td></tr>`;
        return;
    }
    tbody.innerHTML = pos.map((po) => {
        const status = po.status || "draft";
        const total = parseFloat(po.totalAmount) || 0;
        const itemCount = po.items ? po.items.length : 0;
        return `
            <tr>
                <td><strong>${escapeHtml(po.poNumber || "")}</strong></td>
                <td>${escapeHtml(po.supplierName || "")}</td>
                <td>${formatDate(po.createdAt)}</td>
                <td>${itemCount}</td>
                <td>${formatCurrency(total)}</td>
                <td><span class="badge badge-${getStatusBadge(status)}">${escapeHtml(status)}</span></td>
                <td class="text-right">
                    <div class="table-actions">
                        ${status !== "received" && status !== "cancelled"
                            ? `<select class="form-select form-select-sm" onchange="updatePOStatus('${po.id}', this.value)" style="width: 120px;">
                                <option value="">Change Status</option>
                                <option value="ordered">Ordered</option>
                                <option value="received">Received</option>
                                <option value="cancelled">Cancelled</option>
                            </select>`
                            : ""
                        }
                    </div>
                </td>
            </tr>
        `;
    }).join("");
}

function renderEmptyState(message) {
    const tbody = document.getElementById("po-tbody");
    if (!tbody) return;
    tbody.innerHTML = `<tr><td colspan="7"><div class="table-empty"><div class="empty-icon">${icon('lab-orders', '18', 'icon-svg')}</div><h3>${escapeHtml(message)}</h3></div></td></tr>`;
}

function updatePOCount(count) {
    const el = document.getElementById("po-count");
    if (el) el.textContent = `${count} order${count !== 1 ? "s" : ""}`;
}

function setupSearch() {
    const searchInput = document.getElementById("po-search");
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
    const statusFilter = document.getElementById("filter-status");
    if (statusFilter) {
        statusFilter.addEventListener("change", (e) => {
            currentFilters.status = e.target.value;
            applyFilters();
        });
    }
}

function applyFilters() {
    debug("Applying filters:", currentFilters);
    const filtered = currentPOs.filter((po) => {
        if (currentFilters.search) {
            const poNumber = (po.poNumber || "").toLowerCase();
            const supplierName = (po.supplierName || "").toLowerCase();
            if (!poNumber.includes(currentFilters.search) && !supplierName.includes(currentFilters.search)) return false;
        }
        if (currentFilters.status && po.status !== currentFilters.status) return false;
        return true;
    });
    renderPOs(filtered);
    updatePOCount(filtered.length);
}

function setupCreateButton() {
    const createBtn = document.getElementById("create-po-btn");
    if (createBtn) {
        createBtn.addEventListener("click", () => {
            if (!hasPermission(PERMISSIONS.PURCHASE_ORDER_CREATE)) {
                showToast("You don't have permission to create purchase orders.", "error");
                return;
            }
            showCreatePOModal();
        });
    }
}

function showCreatePOModal() {
    const supplierOptions = suppliers.map(s => `<option value="${s.id}" data-name="${escapeHtml(s.name || "")}">${escapeHtml(s.name || "")}</option>`).join("");
    const modalHtml = `
        <div class="modal" style="max-width: 600px;">
            <div class="modal-header"><h3>Create Purchase Order</h3><button class="modal-close" onclick="closeModal()">&times;</button></div>
            <div class="modal-body">
                <div class="form-group">
                    <label class="form-label required" for="po-supplier">Supplier</label>
                    <select id="po-supplier" class="form-select">
                        <option value="">Select Supplier</option>
                        ${supplierOptions}
                    </select>
                </div>
                <div class="form-group">
                    <label class="form-label required" for="po-total">Total Amount</label>
                    <input type="number" id="po-total" class="form-input" step="0.01" placeholder="0.00">
                </div>
                <div class="form-group">
                    <label class="form-label" for="po-notes">Notes</label>
                    <textarea id="po-notes" class="form-textarea" placeholder="PO notes..."></textarea>
                </div>
            </div>
            <div class="modal-footer">
                <button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
                <button class="btn btn-primary" onclick="createPO()">Create PO</button>
            </div>
        </div>
    `;
    showModal(modalHtml);
}

window.createPO = async function() {
    debug("Creating purchase order...");
    const tenantId = getTenantId();
    if (!tenantId) return;

    const supplierId = document.getElementById("po-supplier")?.value;
    const total = document.getElementById("po-total")?.value;
    const notes = document.getElementById("po-notes")?.value.trim();

    if (!supplierId || !total) {
        showToast("Please fill in all required fields.", "error");
        return;
    }

    try {
        showLoading("Creating purchase order...");
        const supplier = suppliers.find(s => s.id === supplierId);
        const poNumber = await generatePONumber(tenantId);

        await addDoc(collection(db, "purchaseOrders"), {
            tenantId,
            poNumber,
            supplierId,
            supplierName: supplier?.name || "",
            totalAmount: parseFloat(total),
            notes: notes || null,
            status: "draft",
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
            createdBy: getCurrentUser()?.uid || ""
        });

        await addDoc(collection(db, "auditLogs"), {
            tenantId,
            userId: getCurrentUser()?.uid || "",
            action: "CREATE_PURCHASE_ORDER",
            module: "purchaseOrders",
            details: { poNumber, supplierName: supplier?.name, total },
            createdAt: serverTimestamp()
        });

        hideLoading();
        showToast("Purchase order created successfully!", "success");
        closeModal();
        await loadPurchaseOrders();
    } catch (error) {
        debugError("Error creating purchase order:", error);
        hideLoading();
        showToast("Unable to create purchase order. Please try again.", "error");
    }
};

async function generatePONumber(tenantId) {
    const year = new Date().getFullYear();
    try {
        const q = query(
            collection(db, "purchaseOrders"),
            where("tenantId", "==", tenantId)
        );
        const snapshot = await getDocs(q);
        const nextSequence = snapshot.size + 1;
        return `PO-${year}-${String(nextSequence).padStart(6, "0")}`;
    } catch (error) {
        debugError("Error generating PO number:", error);
        return `PO-${year}-${Date.now().toString().slice(-6)}`;
    }
}

window.updatePOStatus = async function(poId, newStatus) {
    debug("Updating PO status:", poId, newStatus);
    if (!hasPermission(PERMISSIONS.PURCHASE_ORDER_UPDATE)) {
        showToast("You don't have permission to update purchase orders.", "error");
        return;
    }
    try {
        showLoading("Updating purchase order...");
        await updateDoc(doc(db, "purchaseOrders", poId), {
            status: newStatus,
            updatedAt: serverTimestamp()
        });
        await addDoc(collection(db, "auditLogs"), {
            tenantId: getTenantId(),
            userId: getCurrentUser()?.uid || "",
            action: "UPDATE_PURCHASE_ORDER",
            module: "purchaseOrders",
            recordId: poId,
            details: { newStatus },
            createdAt: serverTimestamp()
        });
        hideLoading();
        showToast("Purchase order status updated.", "success");
        await loadPurchaseOrders();
    } catch (error) {
        debugError("Error updating PO status:", error);
        hideLoading();
        showToast("Unable to update purchase order. Please try again.", "error");
    }
};

function getStatusBadge(status) {
    if (!status) return "secondary";
    const s = status.toLowerCase();
    if (s.includes("received")) return "success";
    if (s.includes("ordered")) return "info";
    if (s.includes("draft")) return "warning";
    if (s.includes("cancelled")) return "error";
    return "secondary";
}

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

export { loadPurchaseOrders };
