/**
 * PRINCE ALEX DIGITAL HMS — Receipts Module
 * 
 * Handles:
 * - Loading and displaying receipts from Firestore
 * - Search by receipt number or patient
 * - Print receipt functionality
 */

import { db, collection, query, where, getDocs, orderBy, doc, getDoc, limit } from "./firebase-config.js";
import { requireAuth } from "./auth-guard.js";
import { loadSidebar } from "./sidebar.js";
import { showToast, showLoading, hideLoading } from "./notifications.js";
import { debug, debugError } from "./debug.js";
import { getTenantId } from "./permissions.js";

document.addEventListener("DOMContentLoaded", async () => {
    debug("Receipts page: Initializing...");
    showLoading("Loading receipts...");
    try {
        const user = await requireAuth();
        if (!user) return;
        await loadSidebar();
        const pageTitleEl = document.getElementById("page-title");
        if (pageTitleEl) pageTitleEl.textContent = "Receipts";
        await loadReceipts();
        setupSearch();
        hideLoading();
        debug("Receipts page: Initialization complete.");
    } catch (error) {
        debugError("Receipts page initialization error:", error);
        hideLoading();
        showToast("Unable to load receipts page. Please try again.", "error");
    }
});

let currentReceipts = [];
let currentSearch = "";

async function loadReceipts() {
    debug("Loading receipts...");
    const tenantId = getTenantId();
    if (!tenantId) return;
    try {
        const q = query(
            collection(db, "payments"),
            where("tenantId", "==", tenantId),
            orderBy("paymentDate", "desc")
        );
        const snapshot = await getDocs(q);
        currentReceipts = [];
        snapshot.forEach((doc) => {
            currentReceipts.push({ id: doc.id, ...doc.data() });
        });
        debug("Receipts loaded:", currentReceipts.length);
        renderReceipts(currentReceipts);
        updateReceiptCount(currentReceipts.length);
    } catch (error) {
        debugError("Error loading receipts:", error);
        showToast("Unable to load receipts. Please try again.", "error");
        renderEmptyState("Unable to load receipts.");
    }
}

function renderReceipts(receipts) {
    const tbody = document.getElementById("receipts-tbody");
    if (!tbody) return;
    if (receipts.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7"><div class="table-empty"><div class="empty-icon"><svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1z"/><line x1="8" y1="7" x2="16" y2="7"/><line x1="8" y1="11" x2="16" y2="11"/><line x1="8" y1="15" x2="16" y2="15"/></svg></div><h3>No receipts found</h3></div></td></tr>`;
        return;
    }
    tbody.innerHTML = receipts.map((receipt) => {
        const receiptNumber = receipt.receiptNumber || `RCPT-${receipt.id.slice(0, 8).toUpperCase()}`;
        return `
            <tr>
                <td><strong>${escapeHtml(receiptNumber)}</strong></td>
                <td>${escapeHtml(receipt.patientName || "")}</td>
                <td>${formatDate(receipt.paymentDate)}</td>
                <td>${formatCurrency(receipt.amount)}</td>
                <td>${escapeHtml(receipt.method || "")}</td>
                <td>${escapeHtml(receipt.reference || "")}</td>
                <td class="text-right">
                    <div class="table-actions">
                        <button class="btn btn-sm btn-outline" onclick="printReceipt('${receipt.id}')"><svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg> Print</button>
                    </div>
                </td>
            </tr>
        `;
    }).join("");
}

function renderEmptyState(message) {
    const tbody = document.getElementById("receipts-tbody");
    if (!tbody) return;
    tbody.innerHTML = `<tr><td colspan="7"><div class="table-empty"><div class="empty-icon"><svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1z"/><line x1="8" y1="7" x2="16" y2="7"/><line x1="8" y1="11" x2="16" y2="11"/><line x1="8" y1="15" x2="16" y2="15"/></svg></div><h3>${escapeHtml(message)}</h3></div></td></tr>`;
}

function updateReceiptCount(count) {
    const el = document.getElementById("receipt-count");
    if (el) el.textContent = `${count} receipt${count !== 1 ? "s" : ""}`;
}

function setupSearch() {
    const searchInput = document.getElementById("receipt-search");
    const searchBtn = document.getElementById("search-btn");
    if (searchInput) {
        searchInput.addEventListener("input", (e) => {
            currentSearch = e.target.value.toLowerCase();
            applyFilters();
        });
    }
    if (searchBtn) searchBtn.addEventListener("click", applyFilters);
}

function applyFilters() {
    debug("Applying search:", currentSearch);
    const filtered = currentReceipts.filter((receipt) => {
        if (currentSearch) {
            const patientName = (receipt.patientName || "").toLowerCase();
            const reference = (receipt.reference || "").toLowerCase();
            if (!patientName.includes(currentSearch) && !reference.includes(currentSearch)) return false;
        }
        return true;
    });
    renderReceipts(filtered);
    updateReceiptCount(filtered.length);
}

/**
 * Prints a receipt. If the payment is linked to an invoice (via visitId),
 * it fetches the invoice and includes its itemized line items.
 * @param {string} receiptId - The payment document ID.
 */
window.printReceipt = async function(receiptId) {
    debug("Printing receipt:", receiptId);
    const receipt = currentReceipts.find(r => r.id === receiptId);
    if (!receipt) return;

    const tenantId = getTenantId();
    const receiptNumber = receipt.receiptNumber || `RCPT-${receiptId.slice(0, 8).toUpperCase()}`;

    // Fetch the linked invoice to include itemized line items.
    let invoiceItems = [];
    let invoiceTotal = 0;
    let invoicePaid = 0;
    let invoiceBalance = 0;
    try {
        if (receipt.visitId && tenantId) {
            const invQuery = query(
                collection(db, "invoices"),
                where("tenantId", "==", tenantId),
                where("visitId", "==", receipt.visitId),
                limit(1)
            );
            const invSnap = await getDocs(invQuery);
            if (!invSnap.empty) {
                const inv = invSnap.docs[0].data();
                invoiceItems = Array.isArray(inv.items) ? inv.items : [];
                invoiceTotal = parseFloat(inv.totalAmount) || 0;
                invoicePaid = parseFloat(inv.amountPaid) || 0;
                invoiceBalance = invoiceTotal - invoicePaid;
            }
        }
    } catch (error) {
        debugError("Error fetching invoice for receipt:", error);
    }

    // Load the hospital's name and contact details for the receipt header.
    const hospital = await loadHospitalInfo(tenantId);

    const printWindow = window.open("", "_blank", "width=440,height=700");
    if (!printWindow) {
        showToast("Please allow pop-ups to print receipts.", "error");
        return;
    }

    // Build the itemized line items table (if any).
    const itemsHtml = invoiceItems.length === 0
        ? `<tr><td colspan="4" style="text-align:center; padding:6px;">No itemized line items.</td></tr>`
        : invoiceItems.map(item => {
            const qty = item.qty || item.quantity || 1;
            const unitPrice = item.unitPrice || 0;
            const amount = qty * unitPrice;
            return `
                <tr>
                    <td style="padding:4px 6px; border-bottom:1px solid #eee;">${escapeHtml(item.description || "Item")}</td>
                    <td style="padding:4px 6px; border-bottom:1px solid #eee; text-align:center;">${qty}</td>
                    <td style="padding:4px 6px; border-bottom:1px solid #eee; text-align:right;">${formatCurrency(unitPrice)}</td>
                    <td style="padding:4px 6px; border-bottom:1px solid #eee; text-align:right;">${formatCurrency(amount)}</td>
                </tr>
            `;
        }).join('');

    printWindow.document.write(`
        <html>
        <head>
            <title>Receipt ${receiptNumber}</title>
            <style>
                body { font-family: Arial, sans-serif; padding: 20px; }
                .header { text-align: center; border-bottom: 2px solid #000; padding-bottom: 10px; margin-bottom: 20px; }
                .header h1 { margin: 0; font-size: 20px; }
                .header p { margin: 5px 0; font-size: 12px; }
                .receipt-details { margin-bottom: 20px; }
                .receipt-details p { margin: 5px 0; font-size: 14px; }
                .amount { font-size: 24px; font-weight: bold; text-align: center; margin: 20px 0; }
                table { width: 100%; border-collapse: collapse; margin: 12px 0; }
                th { text-align: left; padding: 6px; border-bottom: 2px solid #000; font-size: 12px; text-transform: uppercase; }
                td { padding: 6px; font-size: 13px; }
                .totals { margin-top: 8px; font-size: 13px; }
                .totals .row { display: flex; justify-content: space-between; padding: 2px 0; }
                .totals .row.balance { font-weight: bold; }
                .footer { text-align: center; border-top: 1px solid #ccc; padding-top: 10px; margin-top: 20px; font-size: 12px; }
            </style>
        </head>
        <body>
<div class="header">
                <h1>${escapeHtml(hospital.name)}</h1>
                ${hospital.tagline ? `<p>${escapeHtml(hospital.tagline)}</p>` : ""}
                ${hospital.phone ? `<p>Phone: ${escapeHtml(hospital.phone)}</p>` : ""}
                ${hospital.email ? `<p>Email: ${escapeHtml(hospital.email)}</p>` : ""}
                ${hospital.address ? `<p>${escapeHtml(hospital.address)}</p>` : ""}
                <p>Official Payment Receipt</p>
            </div>
            <div class="receipt-details">
                <p><strong>Receipt #:</strong> ${receiptNumber}</p>
                <p><strong>Patient:</strong> ${escapeHtml(receipt.patientName || "")}</p>
                <p><strong>Invoice:</strong> ${escapeHtml(receipt.invoiceNumber || "")}</p>
                <p><strong>Date:</strong> ${formatDate(receipt.paymentDate)}</p>
                <p><strong>Method:</strong> ${escapeHtml(receipt.method || "")}</p>
                <p><strong>Reference:</strong> ${escapeHtml(receipt.reference || "")}</p>
            </div>
            <div class="amount">${formatCurrency(receipt.amount)}</div>
            <table>
                <thead>
                    <tr>
                        <th>Description</th>
                        <th style="text-align:center;">Qty</th>
                        <th style="text-align:right;">Price</th>
                        <th style="text-align:right;">Amount</th>
                    </tr>
                </thead>
                <tbody>${itemsHtml}</tbody>
            </table>
            <div class="totals">
                <div class="row"><span>Invoice Total:</span><span>${formatCurrency(invoiceTotal)}</span></div>
                <div class="row"><span>Amount Paid:</span><span>${formatCurrency(invoicePaid)}</span></div>
                <div class="row balance"><span>Balance Due:</span><span>${formatCurrency(invoiceBalance)}</span></div>
            </div>
<div class="footer">
                <p>Thank you for choosing ${escapeHtml(hospital.name)}</p>
                <p>This is a computer-generated receipt.</p>
            </div>
            <script>
                window.onload = function() { window.print(); };
            <\/script>
        </body>
        </html>
    `);
printWindow.document.close();
};

/**
 * Loads the hospital's name and contact details from the tenant's settings
 * (falling back to the tenants collection if settings aren't configured).
 * @param {string} tenantId
 * @returns {Promise<{name: string, tagline: string, phone: string, email: string, address: string}>}
 */
async function loadHospitalInfo(tenantId) {
    const fallback = { name: "Hospital", tagline: "", phone: "", email: "", address: "" };

    if (!tenantId) {
        return fallback;
    }

    // 1. Prefer the tenant's settings document (contains hospitalName, phone, email, address).
    try {
        const settingsQuery = query(
            collection(db, "settings"),
            where("tenantId", "==", tenantId),
            limit(1)
        );
        const settingsSnap = await getDocs(settingsQuery);
        if (!settingsSnap.empty) {
            const s = settingsSnap.docs[0].data();
            return {
                name: s.hospitalName || fallback.name,
                tagline: s.tagline || "",
                phone: s.phone || "",
                email: s.email || "",
                address: s.address || ""
            };
        }
    } catch (error) {
        debugError("Error loading hospital settings for receipt:", error);
    }

    // 2. Fall back to the tenants collection (name, email, phone).
    try {
        const tenantDoc = await getDoc(doc(db, "tenants", tenantId));
        if (tenantDoc.exists()) {
            const t = tenantDoc.data();
            return {
                name: t.name || fallback.name,
                tagline: t.tagline || "",
                phone: t.phone || "",
                email: t.email || "",
                address: t.address || ""
            };
        }
    } catch (error) {
        debugError("Error loading tenant info for receipt:", error);
    }

    return fallback;
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

export { loadReceipts };
