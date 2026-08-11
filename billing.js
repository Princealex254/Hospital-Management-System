/**
 * PRINCE ALEX DIGITAL HMS — Billing & Checkout Module
 * 
 * Handles:
 * - Loading visits ready for billing
 * - Displaying itemized bills for a visit
 * - Recording payments
 * - Finalizing checkout
 */

import { db, collection, query, where, getDocs, orderBy, updateDoc, doc, serverTimestamp, addDoc, deleteDoc, getDoc, limit } from "./firebase-config.js";
import { requireAuth } from "./auth-guard.js";
import { loadSidebar } from "./sidebar.js";
import { showToast, showLoading, hideLoading, showConfirm, showModal, closeModal } from "./notifications.js";
import { debug, debugError } from "./debug.js";
import { getTenantId, getCurrentUser, hasPermission, PERMISSIONS } from "./permissions.js";

let currentVisits = [];
let selectedVisit = null;
let currentBillItems = []; // Explicit itemized list for the selected visit
let paymentPatients = [];  // Patients available in the Record Payment dropdown

document.addEventListener("DOMContentLoaded", async () => {
    debug("Billing page: Initializing...");
    showLoading("Loading Billing Queue...");

    try {
        const user = await requireAuth();
        if (!user) return;

        await loadSidebar();
        await loadBillingQueue();
        setupEventListeners();

        hideLoading();
        debug("Billing page: Initialization complete.");
    } catch (error) {
        debugError("Billing page initialization error:", error);
        hideLoading();
        showToast("Unable to load billing page.", "error");
    }
});

function setupEventListeners() {
    document.getElementById("refresh-btn")?.addEventListener("click", loadBillingQueue);
    document.getElementById("save-bill-btn")?.addEventListener("click", saveBill);
    document.getElementById("record-payment-btn")?.addEventListener("click", showRecordPaymentModalForVisit);
    document.getElementById("checkout-btn")?.addEventListener("click", completeCheckout);
document.getElementById("add-bill-item-btn")?.addEventListener("click", showAddBillItemModal);
    document.getElementById("print-invoice-btn")?.addEventListener("click", window.printInvoice);
}

/**
 * Loads the list of patients for the Record Payment patient dropdown.
 * Populates the shared paymentPatients array used to render the <select>.
 */
async function loadPaymentPatients() {
    const tenantId = getTenantId();
    if (!tenantId) return [];

    try {
        const q = query(
            collection(db, "patients"),
            where("tenantId", "==", tenantId),
            orderBy("name")
        );
        const snapshot = await getDocs(q);
        paymentPatients = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        debug("Payment patients loaded:", paymentPatients.length);
        return paymentPatients;
    } catch (error) {
        debugError("Error loading patients for payment modal:", error);
        return [];
    }
}

async function loadBillingQueue() {
    debug("Loading billing queue...");
    const tenantId = getTenantId();
    if (!tenantId) return;

    try {
        const q = query(
            collection(db, "opd"),
            where("tenantId", "==", tenantId),
            where("status", "in", ["BILLING_PENDING", "SERVICES_PENDING", "PAYMENT_PENDING", "READY_FOR_CHECKOUT"]),
            orderBy("createdAt", "asc")
        );
        const snapshot = await getDocs(q);
        currentVisits = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        
        renderBillingQueue(currentVisits);
        document.getElementById("visit-count").textContent = `${currentVisits.length} visits`;
    } catch (error) {
        debugError("Error loading billing queue:", error);
        showToast("Failed to load billing queue.", "error");
    }
}

function renderBillingQueue(visits) {
    const tbody = document.getElementById("billing-queue-tbody");
    if (!tbody) return;

    if (visits.length === 0) {
        tbody.innerHTML = `<tr><td colspan="4" class="text-center p-4">No visits are currently pending billing.</td></tr>`;
        return;
    }

    tbody.innerHTML = visits.map(visit => `
        <tr data-visit-id="${visit.id}">
            <td><strong>${escapeHtml(visit.patientName)}</strong></td>
            <td>${escapeHtml(visit.visitId)}</td>
            <td><span class="badge badge-warning">${escapeHtml(visit.status)}</span></td>
            <td class="text-right">
                <button class="btn btn-sm btn-primary" onclick="window.selectVisitForCheckout('${visit.id}')">Checkout</button>
            </td>
        </tr>
    `).join('');
}

window.selectVisitForCheckout = async function(visitId) {
    debug("Selecting visit for checkout:", visitId);
    selectedVisit = currentVisits.find(v => v.id === visitId);
    if (!selectedVisit) {
        showToast("Visit not found.", "error");
        return;
    }

    showLoading("Loading Bill...");

    // Show checkout container
    const checkoutContainer = document.getElementById("checkout-details-container");
    checkoutContainer.style.display = "block";

    // Populate patient info
    const patientInfoEl = document.getElementById("checkout-patient-info");
    patientInfoEl.innerHTML = `
        <h4>${escapeHtml(selectedVisit.patientName)}</h4>
        <p class="text-muted">Visit ID: ${escapeHtml(selectedVisit.visitId)}</p>
    `;

// Fetch and render billable items (itemized)
    const billableItemsQuery = query(
        collection(db, "billableItems"),
        where("tenantId", "==", getTenantId()),
        where("visitId", "==", visitId)
    );
    const itemsSnapshot = await getDocs(billableItemsQuery);
    currentBillItems = itemsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    // Check if this visit was an admission and add admission charges if not already present
    const admissionQuery = query(
        collection(db, "admissions"),
        where("tenantId", "==", getTenantId()),
        where("visitId", "==", visitId),
        limit(1)
    );
    const admissionSnap = await getDocs(admissionQuery);
    if (!admissionSnap.empty) {
        const admissionExists = currentBillItems.some(item => item.source === 'admission');
        if (!admissionExists) {
            const admissionItem = {
                id: `admission_${visitId}`,
                description: "Admission Charges (Ward, Bed, Nursing)",
                qty: 1,
                unitPrice: 0, // To be filled by billing staff
                source: "admission"
            };
            currentBillItems.unshift(admissionItem); // Add to the top of the bill
            debug("Added placeholder for admission charges.");
        }
    }

    // Populate Bill To
    const billToNameEl = document.getElementById("bill-to-name");
    if (billToNameEl) {
        billToNameEl.textContent = selectedVisit.billToName || selectedVisit.billTo || selectedVisit.patientName || "—";
    }

    renderBillItems();
    renderBillSummary();

    hideLoading();
}

/**
 * Renders the itemized bill items table (Description, Qty, Unit Price, Amount).
 */
function renderBillItems() {
    const billItemsTbody = document.getElementById("bill-items-tbody");
    if (!billItemsTbody) return;

    if (currentBillItems.length === 0) {
        billItemsTbody.innerHTML = `<tr><td colspan="5" class="text-center p-3">No billable items for this visit.</td></tr>`;
        return;
    }

    billItemsTbody.innerHTML = currentBillItems.map((item, i) => {
        const qty = item.qty || item.quantity || 1;
        const unitPrice = item.unitPrice || 0;
        const amount = qty * unitPrice;
        return `
            <tr>
                <td>${escapeHtml(item.description || "Item")}</td>
                <td class="text-center">${qty}</td>
                <td class="text-right">
                    <input type="number" class="form-input bill-unit-price" data-index="${i}" step="0.01" min="0"
                        value="${unitPrice}" style="width: 110px; text-align: right;" />
                </td>
                <td class="text-right bill-line-amount">${formatCurrency(amount)}</td>
                <td class="text-right">
                    ${item.source !== 'admission' ? `<button class="btn btn-sm btn-error" onclick="window.removeBillItem('${item.id}')">Remove</button>` : ''}
                </td>
            </tr>
        `;
    }).join('');

    // Recalculate amount + summary when a unit price changes.
    billItemsTbody.querySelectorAll('.bill-unit-price').forEach(input => {
        input.addEventListener('change', () => {
            const idx = parseInt(input.dataset.index, 10);
            if (currentBillItems[idx]) {
                currentBillItems[idx].unitPrice = parseFloat(input.value) || 0;
            }
            renderBillItems();
            renderBillSummary();
        });
    });
}

/**
 * Renders the bill summary (subtotal, discount, total, paid, balance).
 */
function renderBillSummary() {
    const subtotal = currentBillItems.reduce((sum, item) => {
        const qty = item.qty || item.quantity || 1;
        return sum + (qty * (item.unitPrice || 0));
    }, 0);
    selectedVisit.billTotal = subtotal;
    const discount = selectedVisit.discount || 0;
    const total = subtotal - discount;
    const paid = selectedVisit.amountPaid || 0;
    const balance = total - paid;

    const billSummaryEl = document.getElementById("bill-summary");
    if (billSummaryEl) {
        billSummaryEl.innerHTML = `
            <div class="bill-summary-item"><span>Subtotal:</span> <span>${formatCurrency(subtotal)}</span></div>
            <div class="bill-summary-item"><span>Discount:</span> <span>-${formatCurrency(discount)}</span></div>
            <div class="bill-summary-item total"><span>Total:</span> <span>${formatCurrency(total)}</span></div>
            <div class="bill-summary-item"><span>Paid:</span> <span>${formatCurrency(paid)}</span></div>
            <div class="bill-summary-item balance"><span>Balance Due:</span> <span>${formatCurrency(balance)}</span></div>
        `;
    }

    const isInsurance = (selectedVisit.billTo || selectedVisit.paymentType || "patient").toLowerCase().includes("insurance");

    // Show/hide checkout button based on balance
    const checkoutBtn = document.getElementById("checkout-btn");
    if (checkoutBtn) {
        // Show for zero balance OR if it's an insurance bill (as payment is expected later)
        checkoutBtn.style.display = (balance <= 0 || isInsurance) ? 'inline-flex' : 'none';
    }
}

/**
 * Shows a modal to add a manual bill item (description, qty, unit price).
 */
function showAddBillItemModal() {
    if (!selectedVisit) {
        showToast("Please select a visit first.", "warning");
        return;
    }

    const modalHtml = `
        <div class="modal" style="max-width: 480px;">
            <div class="modal-header">
                <h3>Add Bill Item</h3>
                <button class="modal-close" data-modal-close>&times;</button>
            </div>
            <div class="modal-body">
                <div class="form-group">
                    <label class="form-label required" for="new-bill-desc">Description</label>
                    <input type="text" id="new-bill-desc" class="form-input" placeholder="e.g. Procedure, Medication, Supplies">
                </div>
                <div class="form-row">
                    <div class="form-group" style="flex: 1;">
                        <label class="form-label required" for="new-bill-qty">Qty</label>
                        <input type="number" id="new-bill-qty" class="form-input" min="1" value="1">
                    </div>
                    <div class="form-group" style="flex: 1;">
                        <label class="form-label required" for="new-bill-price">Unit Price</label>
                        <input type="number" id="new-bill-price" class="form-input" step="0.01" min="0" value="0">
                    </div>
                </div>
            </div>
            <div class="modal-footer">
                <button class="btn btn-secondary" data-modal-close>Cancel</button>
                <button class="btn btn-primary" onclick="window.submitAddBillItem()">Add Item</button>
            </div>
        </div>
    `;

    showModal(modalHtml, "Add Bill Item");
}

/**
 * Adds a manual bill item to the visit and re-renders the bill.
 */
window.submitAddBillItem = async function() {
    if (!selectedVisit) return;

    const description = document.getElementById("new-bill-desc")?.value.trim();
    const qty = parseInt(document.getElementById("new-bill-qty")?.value, 10) || 1;
    const unitPrice = parseFloat(document.getElementById("new-bill-price")?.value) || 0;

    if (!description) {
        showToast("Please enter a description.", "error");
        return;
    }

    showLoading("Adding item...");
    try {
        const visitRef = await addDoc(collection(db, "billableItems"), {
            tenantId: getTenantId(),
            patientId: selectedVisit.patientId,
            patientName: selectedVisit.patientName,
            visitId: selectedVisit.id,
            description,
            qty,
            unitPrice,
            amount: qty * unitPrice,
            source: "manual",
            createdAt: serverTimestamp(),
            createdBy: getCurrentUser()?.uid || ""
        });

        await addDoc(collection(db, "auditLogs"), {
            tenantId: getTenantId(),
            userId: getCurrentUser()?.uid || "",
            action: "ADD_MANUAL_BILL_ITEM",
            module: "billing",
            recordId: visitRef.id,
            details: { patientId: selectedVisit.patientId, description, qty, unitPrice },
            createdAt: serverTimestamp()
        });

        closeModal();
        showToast("Bill item added.", "success");
        await selectVisitForCheckout(selectedVisit.id);
    } catch (error) {
        debugError("Error adding bill item:", error);
        showToast("Failed to add bill item.", "error");
    } finally {
        hideLoading();
    }
};

/**
 * Removes a bill item from the visit and re-renders the bill.
 * @param {string} itemId
 */
window.removeBillItem = async function(itemId) {
    if (!itemId) return;

    // Prevent removal of the auto-added admission item
    if (itemId.startsWith('admission_')) {
        showToast("Admission charges cannot be removed from this view. Set price to 0 if not applicable.", "warning", 6000);
        return;
    }
    const confirmed = await showConfirm("Remove Bill Item", "Are you sure you want to remove this bill item?", "Remove", "Cancel");
    if (!confirmed) return;

    showLoading("Removing item...");
    try {
        const { deleteDoc } = await import("./firebase-config.js");
        await deleteDoc(doc(db, "billableItems", itemId));

        await addDoc(collection(db, "auditLogs"), {
            tenantId: getTenantId(),
            userId: getCurrentUser()?.uid || "",
            action: "REMOVE_BILL_ITEM",
            module: "billing",
            recordId: itemId,
            details: { patientId: selectedVisit.patientId },
            createdAt: serverTimestamp()
        });

        showToast("Bill item removed.", "success");
        await selectVisitForCheckout(selectedVisit.id);
    } catch (error) {
        debugError("Error removing bill item:", error);
        showToast("Failed to remove bill item.", "error");
    } finally {
        hideLoading();
    }
};

/**
 * Saves the current state of the bill (items and totals) to the invoice record.
 */
async function saveBill() {
    if (!selectedVisit) {
        showToast("Please select a visit first.", "warning");
        return;
    }

    showLoading("Saving bill...");
    try {
        // This function creates/updates the invoice with the latest items and totals
        const invoiceInfo = await ensureInvoiceForVisit(selectedVisit);

        // Calculate the latest total from the current bill items
        const subtotal = currentBillItems.reduce((sum, item) => sum + ((item.qty || 1) * (item.unitPrice || 0)), 0);

        // Update the invoice document with the new total
        await updateDoc(doc(db, "invoices", invoiceInfo.id), {
            totalAmount: subtotal,
            updatedAt: serverTimestamp()
        });

        // Also update the OPD visit document with the latest total for quick access
        await updateDoc(doc(db, "opd", selectedVisit.id), {
            billTotal: subtotal,
            updatedAt: serverTimestamp()
        });

        // Also update the local selectedVisit object to prevent stale data issues
        selectedVisit.billTotal = subtotal;

        showToast("Bill saved successfully!", "success");
    } catch (error) {
        debugError("Error saving bill:", error);
        showToast("Failed to save bill.", "error");
    } finally {
        hideLoading();
    }
}

/**
 * Ensures an invoice exists for the given visit, creating one if needed.
 * Returns the invoice record (id, invoiceNumber, amountPaid, totalAmount, subtotal).
 */
async function ensureInvoiceForVisit(visit) {
    const tenantId = getTenantId();
    const currentUser = getCurrentUser();

    // Look for an existing invoice for this visit.
    const existingQuery = query(
        collection(db, "invoices"),
        where("tenantId", "==", tenantId),
        where("visitId", "==", visit.id)
    );
    const existingSnap = await getDocs(existingQuery);

    if (!existingSnap.empty) {
        const docSnap = existingSnap.docs[0];
        const data = docSnap.data();
        return {
            id: docSnap.id,
            invoiceNumber: data.invoiceNumber,
            amountPaid: parseFloat(data.amountPaid) || 0,
            totalAmount: parseFloat(data.totalAmount) || 0,
            subtotal: parseFloat(data.subtotal) || 0
        };
    }

// No invoice yet — create one from the visit's bill.
    const subtotal = (visit.billTotal != null) ? visit.billTotal : 0;
    const discount = visit.discount || 0;
    const total = subtotal - discount;
    const invoiceNumber = await generateInvoiceNumber(tenantId);

    // Build the itemized line items from the current bill items.
    const items = currentBillItems.map(item => {
        const qty = item.qty || item.quantity || 1;
        const unitPrice = item.unitPrice || 0;
        return {
            description: item.description || "Item",
            qty,
            unitPrice,
            amount: qty * unitPrice
        };
    });

    const invoiceRef = await addDoc(collection(db, "invoices"), {
        tenantId,
        invoiceNumber,
        patientId: visit.patientId,
        patientName: visit.patientName,
        visitId: visit.id,
        billTo: visit.billTo || visit.paymentType || "patient",
        billToName: visit.billToName || visit.patientName || visit.patientName,
        items: items,
        subtotal: subtotal,
        discount: discount,
        totalAmount: total,
        amountPaid: 0,
        status: "unpaid",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        createdBy: currentUser?.uid || ""
    });

    await addDoc(collection(db, "auditLogs"), {
        tenantId,
        userId: currentUser?.uid || "",
        action: "CREATE_INVOICE",
        module: "billing",
        recordId: invoiceRef.id,
        details: { invoiceNumber, patientId: visit.patientId, total },
        createdAt: serverTimestamp()
    });

    return {
        id: invoiceRef.id,
        invoiceNumber,
        amountPaid: 0,
        totalAmount: total,
        subtotal
    };
}

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

async function completeCheckout() {
    if (!selectedVisit) return;

    const confirmed = await showConfirm("Complete Checkout", "Are you sure you want to complete this visit? The patient will be removed from all active queues.", "Complete", "Cancel");
    if (!confirmed) return;

    showLoading("Completing checkout...");
    try {
        // Ensure an invoice exists and mark it as paid on checkout if the balance is settled.
        const invoiceInfo = await ensureInvoiceForVisit(selectedVisit);
        const subtotal = (selectedVisit.billTotal != null) ? selectedVisit.billTotal : invoiceInfo.subtotal;
        const discount = selectedVisit.discount || 0;
        const total = subtotal - discount;
        const paid = selectedVisit.amountPaid || invoiceInfo.amountPaid || 0;

        if (paid >= total) {
            await updateDoc(doc(db, "invoices", invoiceInfo.id), {
                status: "paid",
                paidAt: serverTimestamp(),
                updatedAt: serverTimestamp()
            });
        }

        await updateDoc(doc(db, "opd", selectedVisit.id), {
            status: "COMPLETED",
            checkoutTime: serverTimestamp(),
            updatedAt: serverTimestamp()
        });

        await addDoc(collection(db, "auditLogs"), {
            tenantId: getTenantId(),
            userId: getCurrentUser()?.uid || "",
            action: "COMPLETE_CHECKOUT",
            module: "billing",
            recordId: selectedVisit.id,
            details: { patientId: selectedVisit.patientId, invoiceNumber: invoiceInfo.invoiceNumber },
            createdAt: serverTimestamp()
        });

        showToast("Visit completed successfully!", "success");
        document.getElementById("checkout-details-container").style.display = "none";
        selectedVisit = null;
        await loadBillingQueue();

    } catch (error) {
        debugError("Error completing checkout:", error);
        showToast("Failed to complete checkout.", "error");
    } finally {
        hideLoading();
    }
}

/**
 * Shows a modal to record a payment for the currently selected visit.
 * This is an overlay on the billing page.
 */
async function showRecordPaymentModalForVisit() {
    if (!selectedVisit) {
        showToast("Please select a visit first.", "warning");
        return;
    }

    // Ensure an invoice exists to get its details.
    const invoiceInfo = await ensureInvoiceForVisit(selectedVisit);
    const balance = (selectedVisit.billTotal || invoiceInfo.totalAmount) - (selectedVisit.amountPaid || invoiceInfo.amountPaid);

    const modalHtml = `
        <div class="modal" style="max-width: 520px;">
            <div class="modal-header">
                <h3>Record Payment</h3>
                <button class="modal-close" data-modal-close>&times;</button>
            </div>
            <div class="modal-body">
                <div class="form-group">
                    <label class="form-label">Patient</label>
                    <input type="text" class="form-input" value="${escapeHtml(selectedVisit.patientName)}" disabled>
                </div>
                <div class="form-group">
                    <label class="form-label">Invoice</label>
                    <input type="text" class="form-input" value="${escapeHtml(invoiceInfo.invoiceNumber)} — Balance: ${formatCurrency(balance)}" disabled>
                </div>
                <div class="form-group">
                    <label class="form-label required" for="pay-amount">Amount</label>
                    <input type="number" id="pay-amount" class="form-input" step="0.01" min="0.01" value="${balance > 0 ? balance.toFixed(2) : ''}" placeholder="0.00" required>
                </div>
                <div class="form-group">
                    <label class="form-label required" for="pay-method">Payment Method</label>
                    <select id="pay-method" class="form-select">
                        <option value="cash">Cash</option>
                        <option value="mpesa">M-Pesa</option>
                        <option value="card">Card</option>
                        <option value="insurance">Insurance</option>
                    </select>
                </div>
                <div class="form-group">
                    <label class="form-label" for="pay-reference">Reference (M-Pesa Code, etc.)</label>
                    <input type="text" id="pay-reference" class="form-input" placeholder="e.g. QWE123456">
                </div>
            </div>
            <div class="modal-footer">
                <button class="btn btn-secondary" data-modal-close>Cancel</button>
                <button class="btn btn-primary" onclick="window.savePaymentForVisit()">Record Payment</button>
            </div>
        </div>
    `;
    showModal(modalHtml, "Record Payment");
}

/**
 * Saves the payment from the modal on the billing page.
 */
window.savePaymentForVisit = async function() {
    if (!selectedVisit) return;

    const amount = document.getElementById("pay-amount")?.value;
    const method = document.getElementById("pay-method")?.value;
    const reference = document.getElementById("pay-reference")?.value.trim();

    if (!amount || !method || parseFloat(amount) <= 0) {
        showToast("Please enter a valid amount and select a method.", "error");
        return;
    }

    showLoading("Recording payment...");
    try {
        const tenantId = getTenantId();
        const currentUser = getCurrentUser();
        const invoiceInfo = await ensureInvoiceForVisit(selectedVisit);

        // 1. Create payment record
        const paymentRef = await addDoc(collection(db, "payments"), {
            tenantId,
            patientId: selectedVisit.patientId,
            patientName: selectedVisit.patientName,
            visitId: selectedVisit.id,
            invoiceNumber: invoiceInfo.invoiceNumber,
            amount: parseFloat(amount),
            method,
            reference: reference || null,
            paymentDate: serverTimestamp(),
            createdAt: serverTimestamp(),
            createdBy: currentUser?.uid || ""
        });

        // 2. Update invoice
        const newPaid = (invoiceInfo.amountPaid || 0) + parseFloat(amount);
        const total = (selectedVisit.billTotal != null) ? selectedVisit.billTotal : invoiceInfo.totalAmount;
        const newStatus = newPaid >= total ? "paid" : "partial";

        await updateDoc(doc(db, "invoices", invoiceInfo.id), {
            amountPaid: newPaid,
            status: newStatus,
            updatedAt: serverTimestamp()
        });

        // 3. Update the OPD visit document with the new total paid amount
        await updateDoc(doc(db, "opd", selectedVisit.id), {
            amountPaid: newPaid,
            updatedAt: serverTimestamp()
        });

        // 4. Update the local state
        selectedVisit.amountPaid = newPaid;

        // 5. Log audit
        await addDoc(collection(db, "auditLogs"), {
            tenantId,
            userId: currentUser?.uid || "",
            action: "CREATE_PAYMENT",
            module: "billing",
            recordId: paymentRef.id,
            details: { patientName: selectedVisit.patientName, invoiceNumber: invoiceInfo.invoiceNumber, amount, method },
            createdAt: serverTimestamp()
        });

        closeModal();
        showToast("Payment recorded successfully!", "success");

        // 6. Re-render the bill summary to show the new balance and checkout button
        renderBillSummary();

    } catch (error) {
        debugError("Error recording payment from billing page:", error);
        showToast("Failed to record payment.", "error");
    } finally {
        hideLoading();
    }
};

/**
 * Opens a print-friendly invoice window for the selected visit.
 * Uses the itemized bill items, bill-to, and totals. Call this after a
 * payment is recorded so the paid amount/method are reflected.
 */
window.printInvoice = async function() {
    if (!selectedVisit) {
        showToast("Please select a visit first.", "warning");
        return;
    }

    showLoading("Preparing invoice...");
    try {
        // Ensure an invoice exists so we can print its number/items.
        const invoiceInfo = await ensureInvoiceForVisit(selectedVisit);

        // Detect whether this bill is being handled under insurance. This must be defined first.
        const billToType = (selectedVisit.billTo || selectedVisit.paymentType || "patient").toString().toLowerCase();
        const isInsurance = billToType.includes("insurance") || selectedVisit.isInsurance === true;

        // For insurance invoices, fetch the primary diagnosis for the visit.
        let primaryDiagnosis = "Not specified";

        const subtotal = (selectedVisit.billTotal != null) ? selectedVisit.billTotal : invoiceInfo.subtotal;
        const discount = selectedVisit.discount || 0;
        const total = subtotal - discount;
        const paid = selectedVisit.amountPaid || invoiceInfo.amountPaid || 0;
        const balance = total - paid;

        const billTo = selectedVisit.billToName || (isInsurance ? (selectedVisit.insuranceCompany || "Insurance Company") : null) || selectedVisit.patientName || "—";

        // Capture current user's name for the "Checked By" field.
        const currentUserName = getCurrentUser()?.displayName || getCurrentUser()?.name || "________";
        const hospitalName = getCurrentUser()?.hospitalName || "PRINCE ALEX DIGITAL HMS";

        const now = new Date();
        const dateStr = now.toLocaleDateString("en-GB", { weekday: "short", year: "numeric", month: "short", day: "numeric" });
        const timeStr = now.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });

        const itemsHtml = currentBillItems.length === 0
            ? `<tr><td colspan="5" style="text-align:center; padding:8px;">No billable items.</td></tr>`
            : currentBillItems.map(item => {
                const qty = item.qty || item.quantity || 1;
                const unitPrice = item.unitPrice || 0;
                const amount = qty * unitPrice;
                return `
                    <tr>
                        <td style="padding:6px 8px; border-bottom:1px solid #eee;">${escapeHtml(item.description || "Item")}</td>
                        <td style="padding:6px 8px; border-bottom:1px solid #eee; text-align:center;">${qty}</td>
                        <td style="padding:6px 8px; border-bottom:1px solid #eee; text-align:right;">${formatCurrency(unitPrice)}</td>
                        <td style="padding:6px 8px; border-bottom:1px solid #eee; text-align:right;">${formatCurrency(amount)}</td>
                    </tr>
                `;
            }).join('');

        // Insurance-specific copy notice.
        const copyNotice = isInsurance ? `
            <div class="copy-notice">
                <strong>ORIGINAL — Insurance Company (for payment)</strong>
                <span>&nbsp;&nbsp;•&nbsp;&nbsp;</span>
                <strong>COPY — Patient (retain for records)</strong>
            </div>
        ` : "";

        // Signature / verification section (shown for every invoice, but
        // emphasized for insurance claims).
        const signatureArea = `
            <div class="signatures">
                <div class="sig-col">
                    <div class="sig-title">Patient / Authorized Signatory</div>
                    <div class="sig-line"></div>
                    <div class="sig-meta">
                        <span>Date: <strong>${dateStr}</strong></span>
                        <span>Time: <strong>${timeStr}</strong></span>
                    </div>
                </div>
                <div class="sig-col">
                    <div class="sig-title">Checked By (Hospital Staff)</div>
                    <div class="sig-line">${escapeHtml(currentUserName)}</div>
                    <div class="sig-meta">
                        <span>Date: <strong>${dateStr}</strong></span>
                        <span>Time: <strong>${timeStr}</strong></span>
                    </div>
                </div>
            </div>
        `;

        const printWindow = window.open("", "_blank", "width=800,height=900");
        if (!printWindow) {
            showToast("Please allow pop-ups to print invoices.", "error");
            return;
        }

        printWindow.document.write(`
            <html>
            <head>
                <title>Invoice ${escapeHtml(invoiceInfo.invoiceNumber || "")}</title>
                <style>
                    body { font-family: Arial, sans-serif; color: #111; margin: 0; padding: 30px; }
                    .header { text-align: center; border-bottom: 3px solid #111; padding-bottom: 12px; margin-bottom: 24px; }
                    .header h1 { margin: 0; font-size: 24px; letter-spacing: 1px; }
                    .header p { margin: 4px 0; font-size: 12px; color: #555; }
                    .header .inv-title { font-size: 16px; font-weight: bold; letter-spacing: 2px; margin-top: 6px; }
                    .meta { display: flex; justify-content: space-between; margin-bottom: 24px; font-size: 14px; }
                    .meta p { margin: 4px 0; }
                    .meta .left { }
                    .meta .right { text-align: right; }
                    .bill-to { margin-bottom: 24px; font-size: 14px; }
                    .bill-to h3 { margin: 0 0 6px; font-size: 14px; text-transform: uppercase; color: #555; }
                    .copy-notice { border: 2px solid #111; padding: 10px 14px; margin-bottom: 24px; font-size: 13px; text-align: center; background: #f7f7f7; }
                    table { width: 100%; border-collapse: collapse; margin-bottom: 24px; }
                    th { text-align: left; padding: 8px; border-bottom: 2px solid #111; font-size: 13px; text-transform: uppercase; }
                    td { padding: 8px; border-bottom: 1px solid #ddd; font-size: 14px; }
                    .totals { margin-left: auto; width: 320px; font-size: 14px; }
                    .totals .row { display: flex; justify-content: space-between; padding: 4px 0; }
                    .totals .row.total { font-size: 18px; font-weight: bold; border-top: 2px solid #111; margin-top: 6px; padding-top: 8px; }
                    .totals .row.balance { font-weight: bold; color: #b00020; }
                    .signatures { display: flex; gap: 40px; margin-top: 40px; padding-top: 24px; border-top: 1px solid #ccc; }
                    .sig-col { flex: 1; }
                    .sig-title { font-size: 12px; text-transform: uppercase; color: #555; margin-bottom: 32px; font-weight: bold; }
                    .sig-line { border-bottom: 1px solid #111; height: 36px; font-size: 14px; }
                    .sig-meta { display: flex; justify-content: space-between; margin-top: 8px; font-size: 12px; color: #555; }
                    .footer { text-align: center; border-top: 1px solid #ccc; padding-top: 12px; margin-top: 24px; font-size: 12px; color: #555; }
                    @media print { body { padding: 0; } }
                </style>
            </head>
            <body>
                <div class="header">
                    <h1>${escapeHtml(hospitalName)}</h1>
                    <p>${isInsurance ? "Insurance Claim Invoice" : "Official Invoice"}</p>
                </div>
                ${copyNotice}
                <div class="meta">
                    <div class="left">
                        <p><strong>Invoice #:</strong> ${escapeHtml(invoiceInfo.invoiceNumber || "—")}</p>
                        <p><strong>Patient:</strong> ${escapeHtml(selectedVisit.patientName || "—")}</p>
                        <p><strong>Visit ID:</strong> ${escapeHtml(selectedVisit.visitId || "—")}</p>
                        ${isInsurance && selectedVisit.insuranceNumber ? `<p><strong>Member #:</strong> ${escapeHtml(selectedVisit.insuranceNumber)}</p>` : ""}
                        ${isInsurance ? `<p><strong>Attending Doctor:</strong> ${escapeHtml(selectedVisit.doctorName || "—")}</p>` : ""}
                        ${isInsurance ? `<p><strong>Primary Diagnosis:</strong> ${escapeHtml(primaryDiagnosis)}</p>` : ""}
                        <p><strong>Date:</strong> ${dateStr}</p>
                    </div>
                    <div class="right">
                        <p><strong>Bill To:</strong> ${escapeHtml(billTo)}</p>
                        <p><strong>Status:</strong> ${escapeHtml(invoiceInfo.amountPaid >= total ? "Paid" : "Pending")}</p>
                    </div>
                </div>
                <div class="bill-to">
                    <h3>${isInsurance ? "Insurance Company / Payer" : "Bill To"}</h3>
                    <p>${escapeHtml(billTo)}</p>
                </div>
                <table>
                    <thead>
                        <tr>
                            <th>Description</th>
                            <th style="text-align:center;">Qty</th>
                            <th style="text-align:right;">Unit Price</th>
                            <th style="text-align:right;">Amount</th>
                        </tr>
                    </thead>
                    <tbody>${itemsHtml}</tbody>
                </table>
                <div class="totals">
                    <div class="row"><span>Subtotal:</span><span>${formatCurrency(subtotal)}</span></div>
                    <div class="row"><span>Discount:</span><span>-${formatCurrency(discount)}</span></div>
                    <div class="row total"><span>Total:</span><span>${formatCurrency(total)}</span></div>
                    <div class="row"><span>Paid:</span><span>${formatCurrency(paid)}</span></div>
                    <div class="row balance"><span>Balance Due:</span><span>${formatCurrency(balance)}</span></div>
                </div>
                ${signatureArea}
                <div class="footer">
                    <p>Thank you for choosing ${escapeHtml(hospitalName)}</p>
                    <p>This is a computer-generated invoice.</p>
                </div>
                <script>
                    window.onload = function() { setTimeout(function(){ window.print(); }, 300); };
                <\/script>
            </body>
            </html>
        `);
        printWindow.document.close();
    } catch (error) {
        debugError("Error printing invoice:", error);
        showToast("Failed to prepare invoice for printing.", "error");
    } finally {
        hideLoading();
    }
};

function formatCurrency(amount) {
    if (typeof amount !== 'number') amount = 0;
    return new Intl.NumberFormat("en-KE", { style: "currency", currency: "KES" }).format(amount);
}

function escapeHtml(text) {
    if (!text) return "";
    return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
}