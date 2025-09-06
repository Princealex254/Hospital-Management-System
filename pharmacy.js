// Prince Alex Hospital - Pharmacy Logic

let currentPrescriptions = [];
let currentMedicines = [];

document.addEventListener('DOMContentLoaded', function() {
    const currentUser = initPage();
    if (!currentUser) return;
    
    loadPharmacyData();
    setupEventListeners();
    initializeSampleMedicines();
});

function loadPharmacyData() {
    const hospitalData = getHospitalData();
    currentPrescriptions = hospitalData.prescriptions || [];
    currentMedicines = hospitalData.medicines || [];
    
    displayPrescriptions();
    displayMedicines();
}

function setupEventListeners() {
    // Search and filter for prescriptions
    const searchPrescriptions = document.getElementById('searchPrescriptions');
    const filterPrescriptions = document.getElementById('filterPrescriptions');
    
    if (searchPrescriptions) {
        searchPrescriptions.addEventListener('input', handlePrescriptionSearch);
    }
    
    if (filterPrescriptions) {
        filterPrescriptions.addEventListener('change', handlePrescriptionSearch);
    }
    
    // Search and filter for medicines
    const searchMedicines = document.getElementById('searchMedicines');
    const filterMedicines = document.getElementById('filterMedicines');
    
    if (searchMedicines) {
        searchMedicines.addEventListener('input', handleMedicineSearch);
    }
    
    if (filterMedicines) {
        filterMedicines.addEventListener('change', handleMedicineSearch);
    }
    
    // Modal close functionality
    setupModalCloseHandlers();
}

function setupModalCloseHandlers() {
    const modals = ['dispenseModal', 'addMedicineModal'];
    
    modals.forEach(modalId => {
        const modal = document.getElementById(modalId);
        const closeBtn = modal.querySelector('.close');
        
        if (closeBtn) {
            closeBtn.onclick = () => closeModal(modalId);
        }
        
        modal.onclick = function(e) {
            if (e.target === modal) {
                closeModal(modalId);
            }
        };
    });
}

function handlePrescriptionSearch() {
    const searchTerm = document.getElementById('searchPrescriptions').value.toLowerCase();
    const filterValue = document.getElementById('filterPrescriptions').value;
    
    let filteredPrescriptions = currentPrescriptions;
    
    // Apply search filter
    if (searchTerm) {
        filteredPrescriptions = filteredPrescriptions.filter(prescription =>
            prescription.patientName.toLowerCase().includes(searchTerm) ||
            prescription.medicationName.toLowerCase().includes(searchTerm) ||
            prescription.id.includes(searchTerm)
        );
    }
    
    // Apply status filter
    if (filterValue) {
        filteredPrescriptions = filteredPrescriptions.filter(prescription => prescription.status === filterValue);
    }
    
    displayPrescriptions(filteredPrescriptions);
}

function handleMedicineSearch() {
    const searchTerm = document.getElementById('searchMedicines').value.toLowerCase();
    const filterValue = document.getElementById('filterMedicines').value;
    
    let filteredMedicines = currentMedicines;
    
    // Apply search filter
    if (searchTerm) {
        filteredMedicines = filteredMedicines.filter(medicine =>
            medicine.name.toLowerCase().includes(searchTerm) ||
            medicine.type.toLowerCase().includes(searchTerm) ||
            medicine.supplier.toLowerCase().includes(searchTerm)
        );
    }
    
    // Apply stock filter
    if (filterValue === 'low_stock') {
        filteredMedicines = filteredMedicines.filter(medicine => 
            medicine.quantity <= medicine.minStock && medicine.quantity > 0
        );
    } else if (filterValue === 'out_of_stock') {
        filteredMedicines = filteredMedicines.filter(medicine => medicine.quantity === 0);
    }
    
    displayMedicines(filteredMedicines);
}

function displayPrescriptions(prescriptions = currentPrescriptions) {
    const container = document.getElementById('prescriptionsTable');
    
    if (prescriptions.length === 0) {
        container.innerHTML = '<p>No prescriptions found</p>';
        return;
    }
    
    const table = createTable(
        ['ID', 'Patient', 'Medication', 'Dosage', 'Frequency', 'Duration', 'Prescribed By', 'Date', 'Status', 'Actions'],
        prescriptions.map(prescription => ({
            id: prescription.id,
            patient: prescription.patientName,
            medication: prescription.medicationName,
            dosage: prescription.dosage,
            frequency: prescription.frequency,
            duration: prescription.duration,
            prescribedBy: prescription.doctorId,
            date: formatDate(prescription.createdAt),
            status: prescription.status,
            actions: ''
        })),
        [
            {
                label: 'Dispense',
                type: 'success',
                handler: (row) => dispensePrescriptionModal(row.id)
            },
            {
                label: 'View Details',
                type: 'primary',
                handler: (row) => viewPrescriptionDetails(row.id)
            }
        ]
    );
    
    // Add status styling
    const rows = table.querySelectorAll('tbody tr');
    rows.forEach((row, index) => {
        const prescription = prescriptions[index];
        const statusCell = row.cells[8]; // Status column
        
        if (prescription.status === 'pending') {
            statusCell.innerHTML = '<span class="status-badge status-pending">⏳ Pending</span>';
        } else if (prescription.status === 'dispensed') {
            statusCell.innerHTML = '<span class="status-badge status-completed">✅ Dispensed</span>';
        } else if (prescription.status === 'completed') {
            statusCell.innerHTML = '<span class="status-badge status-completed">✅ Completed</span>';
        } else {
            statusCell.innerHTML = `<span class="status-badge status-${prescription.status}">${prescription.status}</span>`;
        }
    });
    
    container.innerHTML = '';
    container.appendChild(table);
}

function displayMedicines(medicines = currentMedicines) {
    const container = document.getElementById('medicinesTable');
    
    if (medicines.length === 0) {
        container.innerHTML = '<p>No medicines in inventory</p>';
        return;
    }
    
    const table = createTable(
        ['Name', 'Type', 'Strength', 'Quantity', 'Min Stock', 'Price', 'Supplier', 'Status', 'Actions'],
        medicines.map(medicine => ({
            name: medicine.name,
            type: medicine.type,
            strength: medicine.strength,
            quantity: medicine.quantity,
            minStock: medicine.minStock,
            price: `$${medicine.price.toFixed(2)}`,
            supplier: medicine.supplier,
            status: medicine.quantity <= medicine.minStock ? 'Low Stock' : 'In Stock',
            actions: ''
        })),
        [
            {
                label: 'Update Stock',
                type: 'warning',
                handler: (row) => updateMedicineStock(row.name)
            },
            {
                label: 'Edit',
                type: 'primary',
                handler: (row) => editMedicine(row.name)
            }
        ]
    );
    
    // Add stock status styling
    const rows = table.querySelectorAll('tbody tr');
    rows.forEach((row, index) => {
        const medicine = medicines[index];
        const statusCell = row.cells[7]; // Status column
        
        if (medicine.quantity === 0) {
            statusCell.innerHTML = '<span class="status-badge status-critical">🚨 Out of Stock</span>';
        } else if (medicine.quantity <= medicine.minStock) {
            statusCell.innerHTML = '<span class="status-badge status-urgent">⚠️ Low Stock</span>';
        } else {
            statusCell.innerHTML = '<span class="status-badge status-normal">✅ In Stock</span>';
        }
    });
    
    container.innerHTML = '';
    container.appendChild(table);
}

function dispensePrescriptionModal(prescriptionId) {
    const prescription = currentPrescriptions.find(p => p.id === prescriptionId);
    if (!prescription) return;
    
    // Check if medicine is available
    const medicine = currentMedicines.find(m => 
        m.name.toLowerCase() === prescription.medicationName.toLowerCase()
    );
    
    if (!medicine) {
        showAlert('Medicine not found in inventory', 'error');
        return;
    }
    
    if (medicine.quantity === 0) {
        showAlert('Medicine is out of stock', 'error');
        return;
    }
    
    // Populate modal
    document.getElementById('dispensePrescriptionId').value = prescription.id;
    document.getElementById('dispensePatientId').value = prescription.patientId;
    document.getElementById('dispensePatientName').value = prescription.patientName;
    
    document.getElementById('modalPatientName').textContent = prescription.patientName;
    document.getElementById('modalMedication').textContent = prescription.medicationName;
    document.getElementById('modalDosage').textContent = prescription.dosage;
    document.getElementById('modalFrequency').textContent = prescription.frequency;
    document.getElementById('modalDuration').textContent = prescription.duration;
    document.getElementById('modalDoctor').textContent = prescription.doctorId;
    
    // Clear form
    document.getElementById('quantityDispensed').value = '';
    document.getElementById('batchNumber').value = '';
    document.getElementById('expiryDate').value = '';
    document.getElementById('dispenseNotes').value = '';
    
    // Show modal
    document.getElementById('dispenseModal').style.display = 'block';
}

function dispensePrescription() {
    const prescriptionId = document.getElementById('dispensePrescriptionId').value;
    const quantityDispensed = parseInt(document.getElementById('quantityDispensed').value);
    const batchNumber = document.getElementById('batchNumber').value;
    const expiryDate = document.getElementById('expiryDate').value;
    const dispenseNotes = document.getElementById('dispenseNotes').value;
    
    if (!quantityDispensed || quantityDispensed <= 0) {
        showAlert('Please enter a valid quantity', 'error');
        return;
    }
    
    const prescription = currentPrescriptions.find(p => p.id === prescriptionId);
    if (!prescription) return;
    
    // Update prescription status
    prescription.status = 'dispensed';
    prescription.quantityDispensed = quantityDispensed;
    prescription.batchNumber = batchNumber;
    prescription.expiryDate = expiryDate;
    prescription.dispenseNotes = dispenseNotes;
    prescription.dispensedBy = getCurrentUser().username;
    prescription.dispensedAt = new Date().toISOString();
    prescription.updatedAt = new Date().toISOString();
    
    // Update medicine stock
    const medicine = currentMedicines.find(m => 
        m.name.toLowerCase() === prescription.medicationName.toLowerCase()
    );
    
    if (medicine) {
        medicine.quantity -= quantityDispensed;
        if (medicine.quantity < 0) medicine.quantity = 0;
    }
    
    // Save data
    savePharmacyData();
    
    // Close modal and refresh
    closeDispenseModal();
    displayPrescriptions();
    displayMedicines();
    
    showAlert('Prescription dispensed successfully!', 'success');
}

function viewPrescriptionDetails(prescriptionId) {
    const prescription = currentPrescriptions.find(p => p.id === prescriptionId);
    if (!prescription) return;
    
    const detailsHtml = `
        <div style="padding: 20px;">
            <h3>Prescription Details</h3>
            <p><strong>Patient:</strong> ${prescription.patientName}</p>
            <p><strong>Medication:</strong> ${prescription.medicationName}</p>
            <p><strong>Dosage:</strong> ${prescription.dosage}</p>
            <p><strong>Frequency:</strong> ${prescription.frequency}</p>
            <p><strong>Duration:</strong> ${prescription.duration}</p>
            <p><strong>Prescribed By:</strong> ${prescription.doctorId}</p>
            <p><strong>Date:</strong> ${formatDate(prescription.createdAt)}</p>
            <p><strong>Status:</strong> ${prescription.status}</p>
            
            ${prescription.notes ? `
                <h4>Notes</h4>
                <p>${prescription.notes}</p>
            ` : ''}
            
            ${prescription.dispensedAt ? `
                <h4>Dispense Information</h4>
                <p><strong>Dispensed By:</strong> ${prescription.dispensedBy}</p>
                <p><strong>Dispensed At:</strong> ${formatDate(prescription.dispensedAt)}</p>
                <p><strong>Quantity Dispensed:</strong> ${prescription.quantityDispensed}</p>
                ${prescription.batchNumber ? `<p><strong>Batch Number:</strong> ${prescription.batchNumber}</p>` : ''}
                ${prescription.dispenseNotes ? `<p><strong>Dispense Notes:</strong> ${prescription.dispenseNotes}</p>` : ''}
            ` : ''}
        </div>
    `;
    
    const modal = createModal('Prescription Details', detailsHtml, [
        { label: 'Close', type: 'secondary', handler: 'hideModal(this.closest(".modal"))' }
    ]);
    
    showModal(modal);
}

function openAddMedicineModal() {
    // Clear form
    document.getElementById('addMedicineForm').reset();
    
    // Show modal
    document.getElementById('addMedicineModal').style.display = 'block';
}

function addMedicine() {
    const name = document.getElementById('medicineName').value;
    const type = document.getElementById('medicineType').value;
    const strength = document.getElementById('medicineStrength').value;
    const quantity = parseInt(document.getElementById('medicineQuantity').value);
    const minStock = parseInt(document.getElementById('medicineMinStock').value);
    const price = parseFloat(document.getElementById('medicinePrice').value);
    const supplier = document.getElementById('medicineSupplier').value;
    
    if (!name || !type || !quantity || !minStock || !price) {
        showAlert('Please fill in all required fields', 'error');
        return;
    }
    
    // Check if medicine already exists
    const existingMedicine = currentMedicines.find(m => 
        m.name.toLowerCase() === name.toLowerCase()
    );
    
    if (existingMedicine) {
        showAlert('Medicine already exists in inventory', 'error');
        return;
    }
    
    const medicine = {
        id: generateId(),
        name: name,
        type: type,
        strength: strength,
        quantity: quantity,
        minStock: minStock,
        price: price,
        supplier: supplier,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
    };
    
    currentMedicines.push(medicine);
    savePharmacyData();
    
    closeAddMedicineModal();
    displayMedicines();
    
    showAlert('Medicine added to inventory successfully!', 'success');
}

function updateMedicineStock(medicineName) {
    const newQuantity = prompt(`Enter new quantity for ${medicineName}:`);
    
    if (newQuantity === null || newQuantity === '') return;
    
    const quantity = parseInt(newQuantity);
    if (isNaN(quantity) || quantity < 0) {
        showAlert('Please enter a valid quantity', 'error');
        return;
    }
    
    const medicine = currentMedicines.find(m => m.name === medicineName);
    if (medicine) {
        medicine.quantity = quantity;
        medicine.updatedAt = new Date().toISOString();
        
        savePharmacyData();
        displayMedicines();
        
        showAlert('Medicine stock updated successfully!', 'success');
    }
}

function editMedicine(medicineName) {
    const medicine = currentMedicines.find(m => m.name === medicineName);
    if (!medicine) return;
    
    // Populate form with existing data
    document.getElementById('medicineName').value = medicine.name;
    document.getElementById('medicineType').value = medicine.type;
    document.getElementById('medicineStrength').value = medicine.strength;
    document.getElementById('medicineQuantity').value = medicine.quantity;
    document.getElementById('medicineMinStock').value = medicine.minStock;
    document.getElementById('medicinePrice').value = medicine.price;
    document.getElementById('medicineSupplier').value = medicine.supplier;
    
    // Show modal
    document.getElementById('addMedicineModal').style.display = 'block';
}

function closeDispenseModal() {
    document.getElementById('dispenseModal').style.display = 'none';
}

function closeAddMedicineModal() {
    document.getElementById('addMedicineModal').style.display = 'none';
}

function closeModal(modalId) {
    document.getElementById(modalId).style.display = 'none';
}

function savePharmacyData() {
    const hospitalData = getHospitalData();
    hospitalData.prescriptions = currentPrescriptions;
    hospitalData.medicines = currentMedicines;
    saveHospitalData(hospitalData);
}

function initializeSampleMedicines() {
    const hospitalData = getHospitalData();
    
    if (!hospitalData.medicines || hospitalData.medicines.length === 0) {
        hospitalData.medicines = [
            {
                id: generateId(),
                name: 'Paracetamol',
                type: 'Tablet',
                strength: '500mg',
                quantity: 1000,
                minStock: 100,
                price: 0.50,
                supplier: 'MedSupply Inc',
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            },
            {
                id: generateId(),
                name: 'Amoxicillin',
                type: 'Capsule',
                strength: '250mg',
                quantity: 500,
                minStock: 50,
                price: 2.00,
                supplier: 'PharmaCorp',
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            },
            {
                id: generateId(),
                name: 'Ibuprofen',
                type: 'Tablet',
                strength: '400mg',
                quantity: 25,
                minStock: 50,
                price: 1.50,
                supplier: 'MedSupply Inc',
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            },
            {
                id: generateId(),
                name: 'Cough Syrup',
                type: 'Syrup',
                strength: '100ml',
                quantity: 200,
                minStock: 30,
                price: 5.00,
                supplier: 'HealthPlus',
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            }
        ];
        
        saveHospitalData(hospitalData);
    }
}
