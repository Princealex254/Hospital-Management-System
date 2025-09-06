// Prince Alex Hospital - Patient Management Logic (Firebase Integrated)

import { 
    PatientService, 
    DoctorService, 
    AuthService, 
    showAlert 
} from './firebase-services.js';

let currentPatients = [];
let currentDoctors = [];

document.addEventListener('DOMContentLoaded', async function() {
    try {
        const currentUser = await AuthService.getCurrentUser();
        if (!currentUser) {
            window.location.href = 'login.html';
            return;
        }
        
        // Check if user has access to patient management
        if (!['Admin', 'Nurse', 'Doctor', 'Reception'].includes(currentUser.role)) {
            showAlert('Access denied. Insufficient privileges.', 'error');
            setTimeout(() => window.location.href = 'login.html', 2000);
            return;
        }
        
        await loadPatients();
        await loadDoctors();
        setupEventListeners();
        updateUserInfo(currentUser);
        
    } catch (error) {
        console.error('Error initializing patient management:', error);
        showAlert('Error loading patient data. Please refresh the page.', 'error');
    }
});

async function loadPatients() {
    try {
        showAlert('Loading patients...', 'info');
        currentPatients = await PatientService.getAllPatients();
        displayPatients(currentPatients);
        showAlert('Patients loaded successfully', 'success');
    } catch (error) {
        console.error('Error loading patients:', error);
        showAlert('Error loading patients. Please try again.', 'error');
    }
}

async function loadDoctors() {
    try {
        currentDoctors = await DoctorService.getAllDoctors();
        populateDoctorDropdowns();
    } catch (error) {
        console.error('Error loading doctors:', error);
        showAlert('Error loading doctors. Please try again.', 'error');
    }
}

function updateUserInfo(user) {
    const welcomeElement = document.querySelector('.welcome-message');
    if (welcomeElement) {
        welcomeElement.textContent = `Welcome ${user.displayName || user.email}`;
    }
    
    const userInfoElement = document.querySelector('.user-info p');
    if (userInfoElement) {
        userInfoElement.textContent = user.role;
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
    
    try {
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
        
        // Validate required fields
        if (!patientData.name || !patientData.age || !patientData.gender) {
            showAlert('Please fill in all required fields.', 'error');
            return;
        }
        
        showAlert('Adding patient...', 'info');
        
        // Add patient to Firebase
        const patientId = await PatientService.addPatient(patientData);
        
        // Add to local array for immediate display
        currentPatients.unshift({ id: patientId, ...patientData });
        
        // Reset form
        e.target.reset();
        
        // Refresh display
        displayPatients(currentPatients);
        
        showAlert('Patient added successfully!', 'success');
        
    } catch (error) {
        console.error('Error adding patient:', error);
        showAlert('Error adding patient. Please try again.', 'error');
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

function updatePatient() {
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
    patient.updatedAt = new Date().toISOString();
    
    // Save data
    savePatientsData();
    
    // Close modal and refresh display
    closeEditModal();
    displayPatients(currentPatients);
    
    showAlert('Patient updated successfully!', 'success');
}

function deletePatient(patientId) {
    if (!confirm('Are you sure you want to delete this patient? This action cannot be undone.')) {
        return;
    }
    
    const patientIndex = currentPatients.findIndex(p => p.id === patientId);
    if (patientIndex === -1) return;
    
    currentPatients.splice(patientIndex, 1);
    savePatientsData();
    displayPatients(currentPatients);
    
    showAlert('Patient deleted successfully!', 'success');
}

function closeEditModal() {
    document.getElementById('editPatientModal').style.display = 'none';
}

function savePatientsData() {
    const hospitalData = getHospitalData();
    hospitalData.patients = currentPatients;
    saveHospitalData(hospitalData);
}

// Initialize sample doctors if none exist
function initializeSampleDoctors() {
    const hospitalData = getHospitalData();
    
    if (!hospitalData.doctors || hospitalData.doctors.length === 0) {
        hospitalData.doctors = [
            {
                id: generateId(),
                name: 'Dr. Sarah Johnson',
                specialization: 'Cardiology',
                department: 'Cardiology',
                contact: '555-0101',
                status: 'active',
                createdAt: new Date().toISOString()
            },
            {
                id: generateId(),
                name: 'Dr. Michael Chen',
                specialization: 'Neurology',
                department: 'Neurology',
                contact: '555-0102',
                status: 'active',
                createdAt: new Date().toISOString()
            },
            {
                id: generateId(),
                name: 'Dr. Emily Rodriguez',
                specialization: 'Pediatrics',
                department: 'Pediatrics',
                contact: '555-0103',
                status: 'active',
                createdAt: new Date().toISOString()
            },
            {
                id: generateId(),
                name: 'Dr. David Wilson',
                specialization: 'Emergency Medicine',
                department: 'Emergency',
                contact: '555-0104',
                status: 'active',
                createdAt: new Date().toISOString()
            }
        ];
        
        saveHospitalData(hospitalData);
    }
}

// Initialize sample data when page loads
document.addEventListener('DOMContentLoaded', function() {
    initializeSampleDoctors();
});
