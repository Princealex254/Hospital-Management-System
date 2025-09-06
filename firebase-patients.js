// Prince Alex Hospital - Firebase Patient Management Logic

let currentPatients = [];
let currentDoctors = [];

document.addEventListener('DOMContentLoaded', function() {
    const currentUser = initPage();
    if (!currentUser) return;
    
    // Wait for Firebase to initialize
    const checkFirebase = setInterval(() => {
        if (window.FirebaseService && window.COLLECTIONS) {
            clearInterval(checkFirebase);
            loadPatients();
            loadDoctors();
            setupEventListeners();
        }
    }, 100);
});

async function loadPatients() {
    try {
        currentPatients = await window.FirebaseService.getAll(window.COLLECTIONS.PATIENTS);
        displayPatients(currentPatients);
    } catch (error) {
        console.error('Error loading patients:', error);
        showAlert('Error loading patients data', 'error');
    }
}

async function loadDoctors() {
    try {
        currentDoctors = await window.FirebaseService.getAll(window.COLLECTIONS.DOCTORS);
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
    // Patient form submission
    const patientForm = document.getElementById('patientForm');
    if (patientForm) {
        patientForm.addEventListener('submit', handleAddPatient);
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

async function handleAddPatient(e) {
    e.preventDefault();
    
    const formData = new FormData(e.target);
    const patientData = {
        name: formData.get('patientName'),
        age: parseInt(formData.get('patientAge')),
        gender: formData.get('patientGender'),
        contact: formData.get('patientContact'),
        address: formData.get('patientAddress'),
        medicalHistory: formData.get('medicalHistory'),
        assignedDoctor: formData.get('assignedDoctor'),
        status: 'active'
    };
    
    try {
        // Add patient to Firebase
        const newPatient = await window.FirebaseService.create(window.COLLECTIONS.PATIENTS, patientData);
        currentPatients.push(newPatient);
        
        // Reset form
        e.target.reset();
        
        // Refresh display
        displayPatients(currentPatients);
        
        showAlert('Patient added successfully!', 'success');
    } catch (error) {
        console.error('Error adding patient:', error);
        showAlert('Error adding patient', 'error');
    }
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
                handler: (row) => editPatient(row.id)
            },
            {
                label: 'Delete',
                type: 'danger',
                handler: (row) => deletePatient(row.id)
            }
        ]
    );
    
    container.innerHTML = '';
    container.appendChild(table);
}

function editPatient(patientId) {
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

async function updatePatient() {
    const patientId = document.getElementById('editPatientId').value;
    const patient = currentPatients.find(p => p.id === patientId);
    
    if (!patient) return;
    
    // Update patient data
    const updatedData = {
        name: document.getElementById('editPatientName').value,
        age: parseInt(document.getElementById('editPatientAge').value),
        gender: document.getElementById('editPatientGender').value,
        contact: document.getElementById('editPatientContact').value,
        address: document.getElementById('editPatientAddress').value,
        medicalHistory: document.getElementById('editMedicalHistory').value,
        assignedDoctor: document.getElementById('editAssignedDoctor').value
    };
    
    try {
        // Update patient in Firebase
        await window.FirebaseService.update(window.COLLECTIONS.PATIENTS, patientId, updatedData);
        
        // Update local data
        const index = currentPatients.findIndex(p => p.id === patientId);
        if (index !== -1) {
            currentPatients[index] = { ...currentPatients[index], ...updatedData };
        }
        
        // Close modal and refresh display
        closeEditModal();
        displayPatients(currentPatients);
        
        showAlert('Patient updated successfully!', 'success');
    } catch (error) {
        console.error('Error updating patient:', error);
        showAlert('Error updating patient', 'error');
    }
}

async function deletePatient(patientId) {
    if (!confirm('Are you sure you want to delete this patient? This action cannot be undone.')) {
        return;
    }
    
    try {
        // Delete patient from Firebase
        await window.FirebaseService.delete(window.COLLECTIONS.PATIENTS, patientId);
        
        // Update local data
        currentPatients = currentPatients.filter(p => p.id !== patientId);
        displayPatients(currentPatients);
        
        showAlert('Patient deleted successfully!', 'success');
    } catch (error) {
        console.error('Error deleting patient:', error);
        showAlert('Error deleting patient', 'error');
    }
}

function closeEditModal() {
    document.getElementById('editPatientModal').style.display = 'none';
}
