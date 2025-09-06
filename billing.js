// Prince Alex Hospital - Billing Logic

let currentBills = [];

document.addEventListener('DOMContentLoaded', function() {
    const currentUser = initPage();
    if (!currentUser) return;
    
    loadBillingData();
    setupEventListeners();
    setDefaultDates();
    updateStats();
});

function loadBillingData() {
    const hospitalData = getHospitalData();
    currentBills = hospitalData.billing || [];
    displayBills();
}

function setupEventListeners() {
    // Billing form submission
    const billingForm = document.getElementById('billingForm');
    if (billingForm) {
        billingForm.addEventListener('submit', handleBillingSubmission);
    }
    
    // Service amount changes
    document.addEventListener('input', function(e) {
        if (e.target.classList.contains('service-amount') || e.target.id === 'taxRate') {
            calculateTotal();
        }
    });
    
    // Search and filter
    const searchInput = document.getElementById('searchBills');
    const filterSelect = document.getElementById('filterBills');
    
    if (searchInput) {
        searchInput.addEventListener('input', handleBillSearch);
    }
    
    if (filterSelect) {
        filterSelect.addEventListener('change', handleBillSearch);
    }
    
    // Modal close functionality
    const modal = document.getElementById('paymentModal');
    const closeBtn = modal.querySelector('.close');
    
    if (closeBtn) {
        closeBtn.onclick = closePaymentModal;
    }
    
    modal.onclick = function(e) {
        if (e.target === modal) {
            closePaymentModal();
        }
    };
}

function setDefaultDates() {
    const billDateInput = document.getElementById('billDate');
    const dueDateInput = document.getElementById('dueDate');
    
    if (billDateInput) {
        billDateInput.value = new Date().toISOString().split('T')[0];
    }
    
    if (dueDateInput) {
        const dueDate = new Date();
        dueDate.setDate(dueDate.getDate() + 30); // 30 days from today
        dueDateInput.value = dueDate.toISOString().split('T')[0];
    }
}

function addService() {
    const container = document.getElementById('servicesContainer');
    const serviceItem = document.createElement('div');
    serviceItem.className = 'service-item';
    serviceItem.style.cssText = 'display: flex; gap: 10px; margin-bottom: 10px;';
    
    serviceItem.innerHTML = `
        <input type="text" placeholder="Service description" class="service-description" style="flex: 1;">
        <input type="number" placeholder="Amount" class="service-amount" min="0" step="0.01" style="width: 120px;">
        <button type="button" class="btn btn-danger btn-sm" onclick="removeService(this)">Remove</button>
    `;
    
    container.appendChild(serviceItem);
}

function removeService(button) {
    button.parentElement.remove();
    calculateTotal();
}

function calculateTotal() {
    const serviceAmounts = document.querySelectorAll('.service-amount');
    let subtotal = 0;
    
    serviceAmounts.forEach(input => {
        const amount = parseFloat(input.value) || 0;
        subtotal += amount;
    });
    
    const taxRate = parseFloat(document.getElementById('taxRate').value) || 0;
    const taxAmount = (subtotal * taxRate) / 100;
    const total = subtotal + taxAmount;
    
    document.getElementById('subtotal').value = subtotal.toFixed(2);
    document.getElementById('totalAmount').value = total.toFixed(2);
}

function handleBillingSubmission(e) {
    e.preventDefault();
    
    const formData = new FormData(e.target);
    
    // Collect services
    const services = [];
    const serviceDescriptions = document.querySelectorAll('.service-description');
    const serviceAmounts = document.querySelectorAll('.service-amount');
    
    for (let i = 0; i < serviceDescriptions.length; i++) {
        const description = serviceDescriptions[i].value.trim();
        const amount = parseFloat(serviceAmounts[i].value) || 0;
        
        if (description && amount > 0) {
            services.push({
                name: description,
                amount: amount
            });
        }
    }
    
    if (services.length === 0) {
        showAlert('Please add at least one service', 'error');
        return;
    }
    
    const billData = {
        id: generateId(),
        patientName: formData.get('billPatientName'),
        patientId: formData.get('billPatientId') || '',
        billDate: formData.get('billDate'),
        dueDate: formData.get('dueDate'),
        billType: formData.get('billType'),
        services: services,
        subtotal: parseFloat(formData.get('subtotal')),
        taxRate: parseFloat(formData.get('taxRate')),
        taxAmount: parseFloat(formData.get('totalAmount')) - parseFloat(formData.get('subtotal')),
        totalAmount: parseFloat(formData.get('totalAmount')),
        paymentMethod: formData.get('paymentMethod'),
        status: 'pending',
        notes: formData.get('billNotes'),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
    };
    
    // Add bill
    currentBills.push(billData);
    saveBillingData();
    
    // Reset form
    e.target.reset();
    setDefaultDates();
    document.getElementById('servicesContainer').innerHTML = `
        <div class="service-item" style="display: flex; gap: 10px; margin-bottom: 10px;">
            <input type="text" placeholder="Service description" class="service-description" style="flex: 1;">
            <input type="number" placeholder="Amount" class="service-amount" min="0" step="0.01" style="width: 120px;">
            <button type="button" class="btn btn-danger btn-sm" onclick="removeService(this)">Remove</button>
        </div>
    `;
    
    // Refresh display and stats
    displayBills();
    updateStats();
    
    showAlert('Bill generated successfully!', 'success');
}

function handleBillSearch() {
    const searchTerm = document.getElementById('searchBills').value.toLowerCase();
    const filterValue = document.getElementById('filterBills').value;
    
    let filteredBills = currentBills;
    
    // Apply search filter
    if (searchTerm) {
        filteredBills = filteredBills.filter(bill =>
            bill.patientName.toLowerCase().includes(searchTerm) ||
            bill.id.includes(searchTerm) ||
            bill.billType.toLowerCase().includes(searchTerm)
        );
    }
    
    // Apply status filter
    if (filterValue) {
        if (filterValue === 'overdue') {
            const today = new Date();
            filteredBills = filteredBills.filter(bill => 
                bill.status === 'pending' && new Date(bill.dueDate) < today
            );
        } else {
            filteredBills = filteredBills.filter(bill => bill.status === filterValue);
        }
    }
    
    displayBills(filteredBills);
}

function displayBills(bills = currentBills) {
    const container = document.getElementById('billsTable');
    
    if (bills.length === 0) {
        container.innerHTML = '<p>No bills found</p>';
        return;
    }
    
    // Sort by date (newest first)
    const sortedBills = bills.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    
    const table = createTable(
        ['Bill ID', 'Patient', 'Date', 'Due Date', 'Type', 'Amount', 'Status', 'Actions'],
        sortedBills.map(bill => ({
            id: bill.id,
            patient: bill.patientName,
            date: new Date(bill.billDate).toLocaleDateString(),
            dueDate: new Date(bill.dueDate).toLocaleDateString(),
            type: bill.billType,
            amount: `$${bill.totalAmount.toFixed(2)}`,
            status: bill.status,
            actions: ''
        })),
        [
            {
                label: 'View Details',
                type: 'primary',
                handler: (row) => viewBillDetails(row.id)
            },
            {
                label: 'Process Payment',
                type: 'success',
                handler: (row) => processPaymentModal(row.id)
            },
            {
                label: 'Print Bill',
                type: 'secondary',
                handler: (row) => printBill(row.id)
            }
        ]
    );
    
    // Add status styling
    const rows = table.querySelectorAll('tbody tr');
    rows.forEach((row, index) => {
        const bill = sortedBills[index];
        const statusCell = row.cells[6]; // Status column
        
        if (bill.status === 'paid') {
            statusCell.innerHTML = '<span class="status-badge status-completed">✅ Paid</span>';
        } else if (bill.status === 'pending') {
            const today = new Date();
            const dueDate = new Date(bill.dueDate);
            
            if (dueDate < today) {
                statusCell.innerHTML = '<span class="status-badge status-critical">🚨 Overdue</span>';
            } else {
                statusCell.innerHTML = '<span class="status-badge status-pending">⏳ Pending</span>';
            }
        } else {
            statusCell.innerHTML = `<span class="status-badge status-${bill.status}">${bill.status}</span>`;
        }
    });
    
    container.innerHTML = '';
    container.appendChild(table);
}

function viewBillDetails(billId) {
    const bill = currentBills.find(b => b.id === billId);
    if (!bill) return;
    
    const servicesHtml = bill.services.map(service => 
        `<tr><td>${service.name}</td><td>$${service.amount.toFixed(2)}</td></tr>`
    ).join('');
    
    const detailsHtml = `
        <div style="padding: 20px;">
            <h3>Bill Details</h3>
            <p><strong>Bill ID:</strong> ${bill.id}</p>
            <p><strong>Patient:</strong> ${bill.patientName}</p>
            ${bill.patientId ? `<p><strong>Patient ID:</strong> ${bill.patientId}</p>` : ''}
            <p><strong>Bill Date:</strong> ${new Date(bill.billDate).toLocaleDateString()}</p>
            <p><strong>Due Date:</strong> ${new Date(bill.dueDate).toLocaleDateString()}</p>
            <p><strong>Bill Type:</strong> ${bill.billType}</p>
            
            <h4>Services</h4>
            <table class="table">
                <thead>
                    <tr><th>Service</th><th>Amount</th></tr>
                </thead>
                <tbody>
                    ${servicesHtml}
                </tbody>
            </table>
            
            <div style="margin-top: 20px;">
                <p><strong>Subtotal:</strong> $${bill.subtotal.toFixed(2)}</p>
                <p><strong>Tax (${bill.taxRate}%):</strong> $${bill.taxAmount.toFixed(2)}</p>
                <p><strong>Total Amount:</strong> $${bill.totalAmount.toFixed(2)}</p>
                <p><strong>Status:</strong> ${bill.status}</p>
                ${bill.notes ? `<p><strong>Notes:</strong> ${bill.notes}</p>` : ''}
            </div>
        </div>
    `;
    
    const modal = createModal('Bill Details', detailsHtml, [
        { label: 'Close', type: 'secondary', handler: 'hideModal(this.closest(".modal"))' }
    ]);
    
    showModal(modal);
}

function processPaymentModal(billId) {
    const bill = currentBills.find(b => b.id === billId);
    if (!bill) return;
    
    // Populate modal
    document.getElementById('paymentBillId').value = bill.id;
    document.getElementById('modalPatientName').textContent = bill.patientName;
    document.getElementById('modalBillId').textContent = bill.id;
    document.getElementById('modalTotalAmount').textContent = `$${bill.totalAmount.toFixed(2)}`;
    document.getElementById('modalDueDate').textContent = new Date(bill.dueDate).toLocaleDateString();
    
    // Set payment amount to remaining balance
    const remainingBalance = bill.totalAmount - (bill.paidAmount || 0);
    document.getElementById('paymentAmount').value = remainingBalance.toFixed(2);
    document.getElementById('paymentAmount').max = remainingBalance;
    
    // Clear form
    document.getElementById('paymentMethodSelect').value = '';
    document.getElementById('paymentReference').value = '';
    document.getElementById('paymentNotes').value = '';
    
    // Show modal
    document.getElementById('paymentModal').style.display = 'block';
}

function processPayment() {
    const billId = document.getElementById('paymentBillId').value;
    const paymentAmount = parseFloat(document.getElementById('paymentAmount').value);
    const paymentMethod = document.getElementById('paymentMethodSelect').value;
    const paymentReference = document.getElementById('paymentReference').value;
    const paymentNotes = document.getElementById('paymentNotes').value;
    
    if (!paymentAmount || paymentAmount <= 0) {
        showAlert('Please enter a valid payment amount', 'error');
        return;
    }
    
    if (!paymentMethod) {
        showAlert('Please select a payment method', 'error');
        return;
    }
    
    const bill = currentBills.find(b => b.id === billId);
    if (!bill) return;
    
    // Create payment record
    const payment = {
        id: generateId(),
        amount: paymentAmount,
        method: paymentMethod,
        reference: paymentReference,
        notes: paymentNotes,
        processedBy: getCurrentUser().username,
        processedAt: new Date().toISOString()
    };
    
    // Update bill
    bill.payments = bill.payments || [];
    bill.payments.push(payment);
    bill.paidAmount = (bill.paidAmount || 0) + paymentAmount;
    
    if (bill.paidAmount >= bill.totalAmount) {
        bill.status = 'paid';
        bill.paidAt = new Date().toISOString();
    }
    
    bill.updatedAt = new Date().toISOString();
    
    // Save data
    saveBillingData();
    
    // Close modal and refresh
    closePaymentModal();
    displayBills();
    updateStats();
    
    showAlert('Payment processed successfully!', 'success');
}

function printBill(billId) {
    const bill = currentBills.find(b => b.id === billId);
    if (!bill) return;
    
    // Create print-friendly content
    const printContent = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="text-align: center; border-bottom: 2px solid #333; padding-bottom: 20px; margin-bottom: 20px;">
                <h1>Prince Alex Hospital</h1>
                <h2>Hospital Management System</h2>
                <p>Medical Bill</p>
            </div>
            
            <div style="margin-bottom: 20px;">
                <p><strong>Bill ID:</strong> ${bill.id}</p>
                <p><strong>Patient:</strong> ${bill.patientName}</p>
                ${bill.patientId ? `<p><strong>Patient ID:</strong> ${bill.patientId}</p>` : ''}
                <p><strong>Bill Date:</strong> ${new Date(bill.billDate).toLocaleDateString()}</p>
                <p><strong>Due Date:</strong> ${new Date(bill.dueDate).toLocaleDateString()}</p>
            </div>
            
            <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
                <thead>
                    <tr style="background: #f5f5f5;">
                        <th style="border: 1px solid #ddd; padding: 10px; text-align: left;">Service</th>
                        <th style="border: 1px solid #ddd; padding: 10px; text-align: right;">Amount</th>
                    </tr>
                </thead>
                <tbody>
                    ${bill.services.map(service => `
                        <tr>
                            <td style="border: 1px solid #ddd; padding: 10px;">${service.name}</td>
                            <td style="border: 1px solid #ddd; padding: 10px; text-align: right;">$${service.amount.toFixed(2)}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
            
            <div style="text-align: right; margin-top: 20px;">
                <p><strong>Subtotal:</strong> $${bill.subtotal.toFixed(2)}</p>
                <p><strong>Tax (${bill.taxRate}%):</strong> $${bill.taxAmount.toFixed(2)}</p>
                <p style="font-size: 18px; font-weight: bold; border-top: 2px solid #333; padding-top: 10px;">
                    <strong>Total Amount:</strong> $${bill.totalAmount.toFixed(2)}
                </p>
            </div>
            
            <div style="margin-top: 30px; text-align: center; font-size: 12px; color: #666;">
                <p>Thank you for choosing Prince Alex Hospital</p>
                <p>Generated on: ${new Date().toLocaleString()}</p>
            </div>
        </div>
    `;
    
    // Open print window
    const printWindow = window.open('', '_blank');
    printWindow.document.write(printContent);
    printWindow.document.close();
    printWindow.print();
}

function closePaymentModal() {
    document.getElementById('paymentModal').style.display = 'none';
}

function updateStats() {
    const totalRevenue = currentBills
        .filter(bill => bill.status === 'paid')
        .reduce((sum, bill) => sum + bill.totalAmount, 0);
    
    const pendingBills = currentBills.filter(bill => bill.status === 'pending').length;
    const paidBills = currentBills.filter(bill => bill.status === 'paid').length;
    
    const today = new Date();
    const overdueBills = currentBills.filter(bill => 
        bill.status === 'pending' && new Date(bill.dueDate) < today
    ).length;
    
    document.getElementById('totalRevenue').textContent = `$${totalRevenue.toLocaleString()}`;
    document.getElementById('pendingBills').textContent = pendingBills;
    document.getElementById('paidBills').textContent = paidBills;
    document.getElementById('overdueBills').textContent = overdueBills;
}

function saveBillingData() {
    const hospitalData = getHospitalData();
    hospitalData.billing = currentBills;
    saveHospitalData(hospitalData);
}
