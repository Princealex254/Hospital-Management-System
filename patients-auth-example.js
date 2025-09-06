// Prince Alex Hospital - Patient Management with Firebase Auth Example

let currentPatients = [];
let currentDoctors = [];

// Initialize page with user context
function initPage(user) {
    console.log('Initializing patients page for user:', user);
    
    // Load data based on user permissions
    if (checkPermission('patients.read')) {
        loadPatients();
    }
    
    if (checkPermission('doctors.read')) {
        loadDoctors();
    }
    
    setupEventListeners();
}

async function loadPatients() {
    try {
        // In a real implementation, you would fetch from Firestore
        // For now, we'll use sample data
        currentPatients = [
            {
                id: '1',
                name: 'John Doe',
                age: 45,
                gender: 'Male',
                contact: '555-0123',
                address: '123 Main St',
                medicalHistory: 'Diabetes, Hypertension',
                assignedDoctor: 'doc1',
                status: 'active',
                createdAt: new Date().toISOString()
            },
            {
                id: '2',
                name: 'Jane Smith',
                age: 32,
                gender: 'Female',
                contact: '555-0124',
                address: '456 Oak Ave',
                medicalHistory: 'Asthma',
                assignedDoctor: 'doc2',
                status: 'active',
                createdAt: new Date().toISOString()
            }
        ];
        
        displayPatients(currentPatients);
    } catch (error) {
        console.error('Error loading patients:', error);
        showAlert('Error loading patients data', 'error');
    }
}

async function loadDoctors() {
    try {
        // In a real implementation, you would fetch from Firestore
        currentDoctors = [
            { id: 'doc1', name: 'Dr. Sarah Johnson', specialization: 'Cardiology' },
            { id: 'doc2', name: 'Dr. Michael Chen', specialization: 'Neurology' }
        ];
        
        populateDoctorDropdowns();
    } catch (error) {
        console.error('Error loading doctors:', error);
        showAlert('Error loading doctors data', 'error');
    }
}

function populateDoctorDropdowns() {
    const doctorSelects = ['assignedDoctor', 'editAssignedDoctor'];
    
    doctorSelects.forEach(selectId => {
        const select = document.getElementById(selectId);
        if (select) {
            // Clear existing options except the first one
            select.innerHTML = '<option value="">Select Doctor</option>';
            
            currentDoctors.forEach(doctor => {
                const option = document.createElement('option');
                option.value = doctor.id;
                option.textContent = `${doctor.name} - ${doctor.specialization}`;
                select.appendChild(option);
            });
        }
    });
}

function setupEventListeners() {
    // Patient form submission - requires patients.create permission
    const patientForm = document.getElementById('patientForm');
    if (patientForm) {
        patientForm.addEventListener('submit', function(e) {
            e.preventDefault();
            
            // Check permission before proceeding
            if (!requirePermission('patients.create', () => true)) {
                return;
            }
            
            handleAddPatient(e);
        });
    }
    
    // Search and filter
    const searchInput = document.getElementById('searchPatients');
    const filterSelect = document.getElementById('filterPatients');
    
    if (searchInput) {
        searchInput.addEventListener('input', handleSearch);
    }
    
    if (filterSelect) {
        filterSelect.addEventListener('change', handleSearch);
    }
    
    // Modal close functionality
    const modal = document.getElementById('editPatientModal');
    const closeBtn = modal.querySelector('.close');
    
    if (closeBtn) {
        closeBtn.onclick = closeEditModal;
    }
    
    modal.onclick = function(e) {
        if (e.target === modal) {
            closeEditModal();
        }
    };
}

function handleAddPatient(e) {
    const formData = new FormData(e.target);
    const patientData = {
        id: Date.now().toString(),
        name: formData.get('patientName'),
        age: parseInt(formData.get('patientAge')),
        gender: formData.get('patientGender'),
        contact: formData.get('patientContact'),
        address: formData.get('patientAddress'),
        medicalHistory: formData.get('medicalHistory'),
        assignedDoctor: formData.get('assignedDoctor'),
        status: 'active',
        createdAt: new Date().toISOString()
    };
    
    // Add patient to local data
    currentPatients.push(patientData);
    
    // Reset form
    e.target.reset();
    
    // Refresh display
    displayPatients(currentPatients);
    
    showAlert('Patient added successfully!', 'success');
}

function handleSearch() {
    const searchTerm = document.getElementById('searchPatients').value.toLowerCase();
    const filterValue = document.getElementById('filterPatients').value;
    
    let filteredPatients = currentPatients;
    
    // Apply search filter
    if (searchTerm) {
        filteredPatients = filteredPatients.filter(patient =>
            patient.name.toLowerCase().includes(searchTerm) ||
            patient.contact.includes(searchTerm) ||
            patient.id.includes(searchTerm)
        );
    }
    
    // Apply status filter
    if (filterValue === 'assigned') {
        filteredPatients = filteredPatients.filter(patient => patient.assignedDoctor);
    } else if (filterValue === 'unassigned') {
        filteredPatients = filteredPatients.filter(patient => !patient.assignedDoctor);
    }
    
    displayPatients(filteredPatients);
}

function displayPatients(patients) {
    const container = document.getElementById('patientsTable');
    
    if (patients.length === 0) {
        container.innerHTML = '<p>No patients found</p>';
        return;
    }
    
    const table = createTable(
        ['ID', 'Name', 'Age', 'Gender', 'Contact', 'Assigned Doctor', 'Status', 'Created'],
        patients.map(patient => ({
            id: patient.id,
            name: patient.name,
            age: patient.age,
            gender: patient.gender,
            contact: patient.contact,
            assignedDoctor: patient.assignedDoctor ? 
                currentDoctors.find(d => d.id === patient.assignedDoctor)?.name || 'Unknown' : 
                'Unassigned',
            status: patient.status,
            created: formatDate(patient.createdAt)
        })),
        [
            {
                label: 'Edit',
                type: 'warning',
                handler: (row) => editPatient(row.id),
                permission: 'patients.update'
            },
            {
                label: 'Delete',
                type: 'danger',
                handler: (row) => deletePatient(row.id),
                permission: 'patients.delete'
            }
        ]
    );
    
    container.innerHTML = '';
    container.appendChild(table);
}

function editPatient(patientId) {
    // Check permission
    if (!requirePermission('patients.update', () => true)) {
        return;
    }
    
    const patient = currentPatients.find(p => p.id === patientId);
    if (!patient) return;
    
    // Populate edit form
    document.getElementById('editPatientId').value = patient.id;
    document.getElementById('editPatientName').value = patient.name;
    document.getElementById('editPatientAge').value = patient.age;
    document.getElementById('editPatientGender').value = patient.gender;
    document.getElementById('editPatientContact').value = patient.contact;
    document.getElementById('editPatientAddress').value = patient.address;
    document.getElementById('editMedicalHistory').value = patient.medicalHistory || '';
    document.getElementById('editAssignedDoctor').value = patient.assignedDoctor || '';
    
    // Show modal
    document.getElementById('editPatientModal').style.display = 'block';
}

function updatePatient() {
    // Check permission
    if (!requirePermission('patients.update', () => true)) {
        return;
    }
    
    const patientId = document.getElementById('editPatientId').value;
    const patient = currentPatients.find(p => p.id === patientId);
    
    if (!patient) return;
    
    // Update patient data
    patient.name = document.getElementById('editPatientName').value;
    patient.age = parseInt(document.getElementById('editPatientAge').value);
    patient.gender = document.getElementById('editPatientGender').value;
    patient.contact = document.getElementById('editPatientContact').value;
    patient.address = document.getElementById('editPatientAddress').value;
    patient.medicalHistory = document.getElementById('editMedicalHistory').value;
    patient.assignedDoctor = document.getElementById('editAssignedDoctor').value;
    
    // Close modal and refresh display
    closeEditModal();
    displayPatients(currentPatients);
    
    showAlert('Patient updated successfully!', 'success');
}

function deletePatient(patientId) {
    // Check permission
    if (!requirePermission('patients.delete', () => true)) {
        return;
    }
    
    if (!confirm('Are you sure you want to delete this patient? This action cannot be undone.')) {
        return;
    }
    
    const patientIndex = currentPatients.findIndex(p => p.id === patientId);
    if (patientIndex === -1) return;
    
    currentPatients.splice(patientIndex, 1);
    displayPatients(currentPatients);
    
    showAlert('Patient deleted successfully!', 'success');
}

function closeEditModal() {
    document.getElementById('editPatientModal').style.display = 'none';
}

// Format date for display
function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
}

// Create table helper function
function createTable(headers, data, actions = []) {
    const table = document.createElement('table');
    table.className = 'table';
    
    // Create header
    const thead = document.createElement('thead');
    const headerRow = document.createElement('tr');
    headers.forEach(header => {
        const th = document.createElement('th');
        th.textContent = header;
        headerRow.appendChild(th);
    });
    if (actions.length > 0) {
        const th = document.createElement('th');
        th.textContent = 'Actions';
        headerRow.appendChild(th);
    }
    thead.appendChild(headerRow);
    table.appendChild(thead);
    
    // Create body
    const tbody = document.createElement('tbody');
    data.forEach(row => {
        const tr = document.createElement('tr');
        Object.values(row).forEach(value => {
            const td = document.createElement('td');
            td.textContent = value;
            tr.appendChild(td);
        });
        
        // Add action buttons
        if (actions.length > 0) {
            const td = document.createElement('td');
            actions.forEach(action => {
                const button = document.createElement('button');
                button.className = `btn btn-${action.type} btn-sm`;
                button.textContent = action.label;
                
                // Check permission for each action
                if (action.permission && !checkPermission(action.permission)) {
                    button.disabled = true;
                    button.title = 'You do not have permission to perform this action';
                } else {
                    button.onclick = () => action.handler(row);
                }
                
                td.appendChild(button);
            });
            tr.appendChild(td);
        }
        
        tbody.appendChild(tr);
    });
    table.appendChild(tbody);
    
    return table;
}
