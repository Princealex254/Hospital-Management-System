/**
 * PRINCE ALEX DIGITAL HMS — Payments Module
 *
 * Handles:
 * - Loading and displaying payments from Firestore
 * - Search and filter by method
 * - Recording new payments
 * - Updating invoice status
 * - M-Pesa transaction references
 * - Audit logging
 */

import { db, collection, query, where, getDocs, orderBy, addDoc, updateDoc, doc, serverTimestamp, getDoc } from "./firebase-config.js";
import { requireAuth } from "./auth-guard.js";
import { loadSidebar } from "./sidebar.js";
import { showToast, showLoading, hideLoading, showModal, closeModal } from "./notifications.js";
import { debug, debugError } from "./debug.js";
import { icon } from "./icons.js";
import { getTenantId, getCurrentUser, hasPermission, PERMISSIONS } from "./permissions.js";

document.addEventListener("DOMContentLoaded", async () => {
    debug("Payments page: Initializing...");
    showLoading("Loading payments...");
    try {
        const user = await requireAuth();
        if (!user) return;

        // Load role-based sidebar navigation
        await loadSidebar();
                const pageTitleEl = document.getElementById("page-title"); if (pageTitleEl) pageTitleEl.textContent = "Payments";
        await loadPayments();
        setupSearch();
        setupFilter();
        setupRecordButton();
        hideLoading();
        debug("Payments page: Initialization complete.");
    } catch (error) {
        debugError("Payments page initialization error:", error);
        hideLoading();
        showToast("Unable to load payments page. Please try again.", "error");
    }
});

let currentPayments = [];
let currentFilters = { search: "", method: "" };
let paymentPatients = [];  // Patients available in the Record Payment dropdown

async function loadPayments() {
    debug("Loading payments...");
    const tenantId = getTenantId();
    if (!tenantId) return;
    try {
        const q = query(
            collection(db, "payments"),
            where("tenantId", "==", tenantId),
            orderBy("paymentDate", "desc")
        );
        const snapshot = await getDocs(q);
        currentPayments = [];
        snapshot.forEach((doc) => {
            currentPayments.push({ id: doc.id, ...doc.data() });
        });
        debug("Payments loaded:", currentPayments.length);
        renderPayments(currentPayments);
        updatePaymentCount(currentPayments.length);
    } catch (error) {
        debugError("Error loading payments:", error);
        showToast("Unable to load payments. Please try again.", "error");
        renderEmptyState("Unable to load payments.");
    }
}

function renderPayments(payments) {
    const tbody = document.getElementById("payments-tbody");
    if (!tbody) return;
    if (payments.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7"><div class="table-empty"><div class="empty-icon">${icon('payments', '18', 'icon-svg')}</div><h3>No payments found</h3></div></td></tr>`;
        return;
    }
    tbody.innerHTML = payments.map((payment) => {
        return `
            <tr>
                <td>${formatDate(payment.paymentDate)}</td>
                <td>${escapeHtml(payment.patientName || "")}</td>
                <td>${escapeHtml(payment.invoiceNumber || "")}</td>
                <td>${formatCurrency(payment.amount)}</td>
                <td>${escapeHtml(payment.method || "")}</td>
                <td>${escapeHtml(payment.reference || "")}</td>
                <td class="text-right">
                    <div class="table-actions">
                        <a href="receipts.html" class="btn btn-sm btn-outline">📄 Receipt</a>
                    </div>
                </td>
            </tr>
        `;
    }).join("");
}

function renderEmptyState(message) {
    const tbody = document.getElementById("payments-tbody");
    if (!tbody) return;
    tbody.innerHTML = `<tr><td colspan="7"><div class="table-empty"><div class="empty-icon">${icon('payments', '18', 'icon-svg')}</div><h3>${escapeHtml(message)}</h3></div></td></tr>`;
}

function updatePaymentCount(count) {
    const el = document.getElementById("payment-count");
    if (el) el.textContent = `${count} payment${count !== 1 ? "s" : ""}`;
}

function setupSearch() {
    const searchInput = document.getElementById("payment-search");
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
    const methodFilter = document.getElementById("filter-method");
    if (methodFilter) {
        methodFilter.addEventListener("change", (e) => {
            currentFilters.method = e.target.value;
            applyFilters();
        });
    }
}

function applyFilters() {
    debug("Applying filters:", currentFilters);
    const filtered = currentPayments.filter((payment) => {
        if (currentFilters.search) {
            const patientName = (payment.patientName || "").toLowerCase();
            const reference = (payment.reference || "").toLowerCase();
            if (!patientName.includes(currentFilters.search) && !reference.includes(currentFilters.search)) return false;
        }
        if (currentFilters.method && payment.method !== currentFilters.method) return false;
        return true;
    });
    renderPayments(filtered);
    updatePaymentCount(filtered.length);
}

function setupRecordButton() {
    const recordBtn = document.getElementById("record-payment-btn");
    if (recordBtn) {
        recordBtn.addEventListener("click", () => {
            if (!hasPermission(PERMISSIONS.PAYMENT_CREATE)) {
                showToast("You don't have permission to record payments.", "error");
                return;
            }
            showRecordPaymentModal();
        });
    }
}

async function showRecordPaymentModal() {
    // Load the patient list for the dropdown (only if not already loaded).
    if (paymentPatients.length === 0) {
        await loadPaymentPatients();
    }

    const modalHtml = `
        <div class="modal" style="max-width: 520px;">
            <div class="modal-header">
                <h3>Record Payment</h3>
                <button class="modal-close" data-modal-close>&times;</button>
            </div>
            <div class="modal-body">
                <div class="form-group" id="payment-patient-select-container">
                    <label class="form-label required" for="pay-patient-search">Patient</label>
                    <div class="select-container">
                        <div class="select-control"><span class="select-value placeholder">Select Patient</span></div>
                        <div class="select-options"><input type="text" class="select-search" id="pay-patient-search" placeholder="Search patient..."><div class="options-list"></div></div>
                    </div>
                    <input type="hidden" id="pay-patient-id">
                </div>
                <div class="form-group">
                    <label class="form-label required" for="pay-invoice">Invoice</label>
                    <select id="pay-invoice" class="form-select" disabled>
                        <option value="">Select a patient to see invoices</option>
                    </select>
                </div>
                <div class="form-group">
                    <label class="form-label required" for="pay-amount">Amount</label>
                    <input type="number" id="pay-amount" class="form-input" step="0.01" min="0.01" placeholder="0.00" required>
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
                    <label class="form-label" for="pay-reference">Reference (M-Pesa Code)</label>
                    <input type="text" id="pay-reference" class="form-input" placeholder="e.g. QWE123456">
                </div>
            </div>
            <div class="modal-footer">
                <button class="btn btn-secondary" data-modal-close>Cancel</button>
                <button class="btn btn-primary" onclick="savePayment()">Record Payment</button>
            </div>
        </div>
    `;
    showModal(modalHtml, "Record Payment");

    // --- Setup for the new searchable patient dropdown ---
    const patientSelectContainer = document.getElementById("payment-patient-select-container");
    const selectControl = patientSelectContainer.querySelector(".select-control");
    const selectValue = patientSelectContainer.querySelector(".select-value");
    const searchInput = patientSelectContainer.querySelector(".select-search");
    const optionsList = patientSelectContainer.querySelector(".options-list");
    const patientIdInput = document.getElementById("pay-patient-id");

    const renderPatientOptions = (patients) => {
        optionsList.innerHTML = "";
        if (patients.length === 0) {
            optionsList.innerHTML = `<div class="select-option-empty">No patients found</div>`;
            return;
        }
        patients.forEach(p => {
            const option = document.createElement("div");
            option.className = "select-option";
            option.dataset.id = p.id;
            option.innerHTML = `
                <div style="font-weight: 600;">${escapeHtml(p.name)}</div>
                <div style="font-size: 11px; color: var(--color-gray-500);">${escapeHtml(p.patientId || p.id)}</div>
            `;
            option.addEventListener("click", () => {
                patientIdInput.value = p.id;
                selectValue.textContent = p.name;
                selectValue.classList.remove("placeholder");
                patientSelectContainer.querySelector(".select-container").classList.remove("open");
                patientIdInput.dispatchEvent(new Event('change'));
            });
            optionsList.appendChild(option);
        });
    };

    selectControl.addEventListener("click", () => {
        const container = patientSelectContainer.querySelector(".select-container");
        container.classList.toggle("open");
        if (container.classList.contains("open")) {
            searchInput.focus();
            renderPatientOptions(paymentPatients);
        }
    });

    searchInput.addEventListener("input", () => {
        const query = searchInput.value.toLowerCase();
        const filtered = paymentPatients.filter(p =>
            (p.name || "").toLowerCase().includes(query) ||
            (p.patientId || "").toLowerCase().includes(query)
        );
        renderPatientOptions(filtered);
    });

    patientIdInput.addEventListener("change", async (e) => {
        const patientId = e.target.value;
        const invoiceSelect = document.getElementById("pay-invoice");
        const amountInput = document.getElementById("pay-amount");
        if (!invoiceSelect) return;

        if (!patientId) {
            invoiceSelect.innerHTML = '<option value="">Select a patient to see invoices</option>';
            invoiceSelect.disabled = true;
            amountInput.value = "";
            return;
        }

        showLoading("Loading invoices...");
        const q = query(
            collection(db, "invoices"),
            where("tenantId", "==", getTenantId()),
            where("patientId", "==", patientId),
            where("status", "in", ["unpaid", "partial"])
        );
        const snapshot = await getDocs(q);
        hideLoading();

        if (snapshot.empty) {
            invoiceSelect.innerHTML = '<option value="">No outstanding invoices found</option>';
            invoiceSelect.disabled = true;
            amountInput.value = "";
        } else {
            invoiceSelect.innerHTML = '<option value="">Select an invoice</option>';
            snapshot.forEach(doc => {
                const inv = doc.data();
                const balance = (inv.totalAmount || 0) - (inv.amountPaid || 0);
                const option = document.createElement("option");
                option.value = doc.id;
                option.textContent = `${inv.invoiceNumber} — Balance: ${formatCurrency(balance)}`;
                option.dataset.balance = balance;
                invoiceSelect.appendChild(option);
            });
            invoiceSelect.disabled = false;
            invoiceSelect.addEventListener("change", (e) => {
                const selectedOption = e.target.options[e.target.selectedIndex];
                amountInput.value = parseFloat(selectedOption.dataset.balance || 0).toFixed(2);
            });
        }
    });
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
            where("tenantId", "==", tenantId), // Corrected from staff
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

window.savePayment = async function() {
    debug("Saving payment...");
    const tenantId = getTenantId();
    if (!tenantId) return;

    // Read the selected patient from the dropdown (value = patient doc id).
    const patientId = document.getElementById("pay-patient-id")?.value;
    const selectedPatient = paymentPatients.find(p => p.id === patientId);
    const patientName = selectedPatient?.name || "";

    const invoiceId = document.getElementById("pay-invoice")?.value;
    const amount = document.getElementById("pay-amount")?.value;
    const method = document.getElementById("pay-method")?.value;
    const reference = document.getElementById("pay-reference")?.value.trim();

    if (!patientId || !invoiceId || !amount || !method) {
        showToast("Please fill in all required fields.", "error");
        return;
    }

    try {
        showLoading("Recording payment...");

        // Get invoice details
        const invoiceDoc = await getDoc(doc(db, "invoices", invoiceId));
        if (!invoiceDoc.exists()) {
            throw new Error("Selected invoice not found.");
        }
        const invoiceData = invoiceDoc.data();

        // Create payment record
        const paymentRef = await addDoc(collection(db, "payments"), {
            tenantId,
            patientName,
            visitId: invoiceData.visitId || null, // Add the visitId to the payment record
            invoiceNumber: invoiceData.invoiceNumber,
            amount: parseFloat(amount),
            method,
            reference: reference || null,
            paymentDate: serverTimestamp(),
            createdAt: serverTimestamp(),
            createdBy: getCurrentUser()?.uid || ""
        });

        // Update invoice if found
        const newPaid = (parseFloat(invoiceData.amountPaid) || 0) + parseFloat(amount);
        const total = parseFloat(invoiceData.totalAmount) || 0;
        const newStatus = newPaid >= total ? "paid" : "partial";
        await updateDoc(doc(db, "invoices", invoiceId), {
            amountPaid: newPaid,
            status: newStatus,
            updatedAt: serverTimestamp()
        });

        // Also update the OPD visit document with the new paid amount
        if (invoiceData.visitId) {
            await updateDoc(doc(db, "opd", invoiceData.visitId), {
                amountPaid: newPaid,
                updatedAt: serverTimestamp()
            });
        }

        // Log audit
        await addDoc(collection(db, "auditLogs"), {
            tenantId,
            userId: getCurrentUser()?.uid || "",
            action: "CREATE_PAYMENT",
            module: "payments",
            recordId: paymentRef.id,
            details: { patientName, invoiceNumber: invoiceData.invoiceNumber, amount, method },
            createdAt: serverTimestamp()
        });

        hideLoading();
        showToast("Payment recorded successfully!", "success");
        closeModal();
        await loadPayments();
    } catch (error) {
        debugError("Error recording payment:", error);
        hideLoading();
        showToast("Unable to record payment. Please try again.", "error");
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

export { loadPayments };