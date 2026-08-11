/**
 * PRINCE ALEX DIGITAL HMS — Invoices Module
 * 
 * Handles:
 * - Loading and displaying invoices from Firestore
 * - Search and filter by status
 * - Creating new invoices
 * - Invoice number generation
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
    debug("Invoices page: Initializing...");
    showLoading("Loading invoices...");
    try {
        const user = await requireAuth();
        if (!user) return;
        await loadSidebar();
        const pageTitleEl = document.getElementById("page-title");
        if (pageTitleEl) pageTitleEl.textContent = "Invoices";
        await loadInvoices();
        setupSearch();
        setupFilter();
        setupCreateButton();
        hideLoading();
        debug("Invoices page: Initialization complete.");
    } catch (error) {
        debugError("Invoices page initialization error:", error);
        hideLoading();
        showToast("Unable to load invoices page. Please try again.", "error");
    }
});

let currentInvoices = [];
let currentFilters = { search: "", status: "" };

async function loadInvoices() {
    debug("Loading invoices...");
    const tenantId = getTenantId();
    if (!tenantId) return;
    try {
        const q = query(
            collection(db, "invoices"),
            where("tenantId", "==", tenantId),
            orderBy("createdAt", "desc")
        );
        const snapshot = await getDocs(q);
        currentInvoices = [];
        snapshot.forEach((doc) => {
            currentInvoices.push({ id: doc.id, ...doc.data() });
        });
        debug("Invoices loaded:", currentInvoices.length);
        renderInvoices(currentInvoices);
        updateInvoiceCount(currentInvoices.length);
    } catch (error) {
        debugError("Error loading invoices:", error);
        showToast("Unable to load invoices. Please try again.", "error");
        renderEmptyState("Unable to load invoices.");
    }
}

function renderInvoices(invoices) {
    const tbody = document.getElementById("invoices-tbody");
    if (!tbody) return;
    if (invoices.length === 0) {
        tbody.innerHTML = `<tr><td colspan="8"><div class="table-empty"><div class="empty-icon">${icon('invoices', '18', 'icon-svg')}</div><h3>No invoices found</h3></div></td></tr>`;
        return;
    }
    tbody.innerHTML = invoices.map((inv) => {
        const total = parseFloat(inv.totalAmount) || 0;
        const paid = parseFloat(inv.amountPaid) || 0;
        const balance = total - paid;
        const status = inv.status || "unpaid";
        return `
            <tr>
                <td><strong>${escapeHtml(inv.invoiceNumber || "")}</strong></td>
                <td>${escapeHtml(inv.patientName || "")}</td>
                <td>${formatDate(inv.createdAt)}</td>
                <td>${formatCurrency(total)}</td>
                <td>${formatCurrency(paid)}</td>
                <td>${formatCurrency(balance)}</td>
                <td><span class="badge badge-${getStatusBadge(status)}">${escapeHtml(status)}</span></td>
                <td class="text-right">
                    <div class="table-actions">
                        <a href="payments.html" class="btn btn-sm btn-outline"> ${icon('payments', '18', 'icon-svg')} Pay</a>
                        <a href="patient-profile.html?id=${inv.patientId || ""}" class="btn btn-sm btn-outline"> ${icon('eye', '18', 'icon-svg')} Profile</a>
                        <button class="btn btn-sm btn-outline" onclick="window.showInvoiceDetail('${inv.id}')"> ${icon('file', '18', 'icon-svg')} View</button>
                    </div>
                </td>
            </tr>
        `;
    }).join("");
}

function renderEmptyState(message) {
    const tbody = document.getElementById("invoices-tbody");
    if (!tbody) return;
    tbody.innerHTML = `<tr><td colspan="8"><div class="table-empty"><div class="empty-icon">${icon('invoices', '18', 'icon-svg')}</div><h3>${escapeHtml(message)}</h3></div></td></tr>`;
}

function updateInvoiceCount(count) {
    const el = document.getElementById("invoice-count");
    if (el) el.textContent = `${count} invoice${count !== 1 ? "s" : ""}`;
}

function setupSearch() {
    const searchInput = document.getElementById("invoice-search");
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
    const filtered = currentInvoices.filter((inv) => {
        if (currentFilters.search) {
            const invoiceNumber = (inv.invoiceNumber || "").toLowerCase();
            const patientName = (inv.patientName || "").toLowerCase();
            if (!invoiceNumber.includes(currentFilters.search) && !patientName.includes(currentFilters.search)) return false;
        }
        if (currentFilters.status && inv.status !== currentFilters.status) return false;
        return true;
    });
    renderInvoices(filtered);
    updateInvoiceCount(filtered.length);
}

function setupCreateButton() {
    const createBtn = document.getElementById("create-invoice-btn");
    if (createBtn) {
        createBtn.addEventListener("click", () => {
            if (!hasPermission(PERMISSIONS.INVOICE_CREATE)) {
                showToast("You don't have permission to create invoices.", "error");
                return;
            }
            showCreateInvoiceModal();
        });
    }
}

function showCreateInvoiceModal() {
    const modalHtml = `
        <div class="modal" style="max-width: 600px;">
            <div class="modal-header"><h3>Create Invoice</h3><button class="modal-close" onclick="closeModal()">&times;</button></div>
            <div class="modal-body">
                <div class="form-group">
                    <label class="form-label required" for="inv-patient">Patient</label>
                    <input type="text" id="inv-patient" class="form-input" placeholder="Patient name">
                </div>
                <div class="form-group">
                    <label class="form-label required" for="inv-amount">Amount</label>
                    <input type="number" id="inv-amount" class="form-input" step="0.01" placeholder="0.00">
                </div>
                <div class="form-group">
                    <label class="form-label" for="inv-description">Description</label>
                    <textarea id="inv-description" class="form-textarea" placeholder="Invoice description"></textarea>
                </div>
                <div class="form-group">
                    <label class="form-label" for="inv-due-date">Due Date</label>
                    <input type="date" id="inv-due-date" class="form-input">
                </div>
            </div>
            <div class="modal-footer">
                <button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
                <button class="btn btn-primary" onclick="saveInvoice()">Create Invoice</button>
            </div>
        </div>
    `;
    showModal(modalHtml);
}

window.saveInvoice = async function() {
    debug("Saving invoice...");
    const tenantId = getTenantId();
    if (!tenantId) return;

    const patientName = document.getElementById("inv-patient")?.value.trim();
    const amount = document.getElementById("inv-amount")?.value;
    const description = document.getElementById("inv-description")?.value.trim();
    const dueDate = document.getElementById("inv-due-date")?.value;

    if (!patientName || !amount) {
        showToast("Please fill in all required fields.", "error");
        return;
    }

    try {
        showLoading("Creating invoice...");
        const invoiceNumber = await generateInvoiceNumber(tenantId);

        await addDoc(collection(db, "invoices"), {
            tenantId,
            invoiceNumber,
            patientName,
            patientId: null,
            totalAmount: parseFloat(amount),
            amountPaid: 0,
            description: description || null,
            dueDate: dueDate ? new Date(dueDate) : null,
            status: "unpaid",
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
            createdBy: getCurrentUser()?.uid || ""
        });

        await addDoc(collection(db, "auditLogs"), {
            tenantId,
            userId: getCurrentUser()?.uid || "",
            action: "CREATE_INVOICE",
            module: "invoices",
            details: { invoiceNumber, patientName, amount },
            createdAt: serverTimestamp()
        });

        hideLoading();
        showToast("Invoice created successfully!", "success");
        closeModal();
        await loadInvoices();
    } catch (error) {
        debugError("Error creating invoice:", error);
        hideLoading();
        showToast("Unable to create invoice. Please try again.", "error");
    }
};

async function generateInvoiceNumber(tenantId) {
    const year = new Date().getFullYear();
    try {
        const q = query(
            collection(db, "invoices"),
            where("tenantId", "==", tenantId)
        );
        const snapshot = await getDocs(q);
        const nextSequence = snapshot.size + 1;
        return `INV-${year}-${String(nextSequence).padStart(6, "0")}`;
    } catch (error) {
        debugError("Error generating invoice number:", error);
        return `INV-${year}-${Date.now().toString().slice(-6)}`;
    }
}

/**
 * Opens a modal showing an invoice's itemized line items and bill-to.
 * @param {string} invoiceId - The Firestore document ID of the invoice.
 */
window.showInvoiceDetail = async function(invoiceId) {
    debug("Showing invoice detail:", invoiceId);
    try {
        const snap = await getDoc(doc(db, "invoices", invoiceId));
        if (!snap.exists()) {
            showToast("Invoice not found.", "error");
            return;
        }
        const inv = { id: snap.id, ...snap.data() };
        const items = Array.isArray(inv.items) ? inv.items : [];
        const billTo = inv.billToName || inv.patientName || "—";
        const total = parseFloat(inv.totalAmount) || 0;
        const paid = parseFloat(inv.amountPaid) || 0;
        const balance = total - paid;

        let itemsHtml = '';
        if (items.length === 0) {
            itemsHtml = `<tr><td colspan="5" class="text-center p-3">No itemized line items for this invoice.</td></tr>`;
        } else {
            itemsHtml = items.map(item => {
                const qty = item.qty || item.quantity || 1;
                const unitPrice = parseFloat(item.unitPrice) || 0;
                const amount = qty * unitPrice;
                return `
                    <tr>
                        <td>${escapeHtml(item.description || "Item")}</td>
                        <td class="text-center">${qty}</td>
                        <td class="text-right">${formatCurrency(unitPrice)}</td>
                        <td class="text-right">${formatCurrency(amount)}</td>
                    </tr>
                `;
            }).join('');
        }

        const modalHtml = `
            <div class="modal" style="max-width: 640px;">
                <div class="modal-header">
                    <h3>Invoice ${escapeHtml(inv.invoiceNumber || "")}</h3>
                    <button class="modal-close" onclick="closeModal()">&times;</button>
                </div>
                <div class="modal-body">
                    <div class="form-section" style="margin-bottom: 16px; padding-bottom: 16px; border-bottom: 1px solid #e5e7eb;">
                        <div class="form-grid form-grid-2">
                            <div><strong>Patient:</strong> ${escapeHtml(inv.patientName || "—")}</div>
                            <div><strong>Bill To:</strong> ${escapeHtml(billTo)}</div>
                            <div><strong>Date:</strong> ${formatDate(inv.createdAt)}</div>
                            <div><strong>Status:</strong> <span class="badge badge-${getStatusBadge(inv.status)}">${escapeHtml(inv.status || "unpaid")}</span></div>
                        </div>
                    </div>
                    <div class="form-section-title">Billable Services</div>
                    <div class="table-container">
                        <table class="table table-sm">
                            <thead>
                                <tr>
                                    <th>Description</th>
                                    <th class="text-center">Qty</th>
                                    <th class="text-right">Unit Price</th>
                                    <th class="text-right">Amount</th>
                                </tr>
                            </thead>
                            <tbody>${itemsHtml}</tbody>
                        </table>
                    </div>
                    <div class="mt-3">
                        <div class="bill-summary-item"><span>Subtotal:</span> <span>${formatCurrency(total)}</span></div>
                        <div class="bill-summary-item"><span>Paid:</span> <span>${formatCurrency(paid)}</span></div>
                        <div class="bill-summary-item balance"><span>Balance Due:</span> <span>${formatCurrency(balance)}</span></div>
                    </div>
                </div>
                <div class="modal-footer">
                    <button class="btn btn-secondary" onclick="closeModal()">Close</button>
                </div>
            </div>
        `;
        showModal(modalHtml);
    } catch (error) {
        debugError("Error loading invoice detail:", error);
        showToast("Unable to load invoice detail.", "error");
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

function getStatusBadge(status) {
    if (!status) return "secondary";
    const s = status.toLowerCase();
    if (s.includes("paid")) return "success";
    if (s.includes("partial")) return "warning";
    if (s.includes("unpaid")) return "error";
    if (s.includes("cancelled")) return "secondary";
    return "secondary";
}

function escapeHtml(text) {
    if (!text) return "";
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
}

export { loadInvoices };
