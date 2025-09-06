// Prince Alex Hospital - Doctor's Workflow Logic (Firebase Integrated)

import { 
    PatientService, 
    AppointmentService, 
    LabService, 
    AuthService, 
    showAlert 
} from './firebase-services.js';

let currentPatients = [];
let currentTriageRecords = [];
let currentAppointments = [];
let currentConsultations = [];
let currentLabResults = [];
let selectedPatient = null;

document.addEventListener('DOMContentLoaded', async function() {
    try {
        const currentUser = await AuthService.getCurrentUser();
        if (!currentUser) {
            window.location.href = 'login.html';
            return;
        }
        
        // Check if user has access to doctor workflow
        if (!['Admin', 'Doctor'].includes(currentUser.role)) {
            showAlert('Access denied. Insufficient privileges.', 'error');
            setTimeout(() => window.location.href = 'login.html', 2000);
            return;
        }
        
        await loadData();
        setupEventListeners();
        updateUserInfo(currentUser);
        
    } catch (error) {
        console.error('Error initializing doctor workflow:', error);
        showAlert('Error loading doctor data. Please refresh the page.', 'error');
    }
});

async function loadData() {
    try {
        showAlert('Loading doctor data...', 'info');
        
        // Load data from Firebase
        const [patients, appointments, labResults] = await Promise.all([
            PatientService.getAllPatients(),
            AppointmentService.getAllAppointments(),
            LabService.getAllLabResults()
        ]);
        
        currentPatients = patients;
        currentAppointments = appointments;
        currentLabResults = labResults;
        
        // Initialize empty arrays for other data
        currentTriageRecords = [];
        currentConsultations = [];
        
        displayIncomingPatients();
        
        showAlert('Doctor data loaded successfully', 'success');
        
    } catch (error) {
        console.error('Error loading doctor data:', error);
        showAlert('Error loading doctor data. Please try again.', 'error');
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

function setupEventListeners() {
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
    setupModalCloseHandlers();
}

function setupModalCloseHandlers() {
    const modals = ['consultationModal', 'labRequestModal', 'prescriptionModal'];
    
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

function handleSearch() {
    const searchTerm = document.getElementById('searchPatients').value.toLowerCase();
    const filterValue = document.getElementById('filterPatients').value;
    
    displayIncomingPatients(searchTerm, filterValue);
}

function displayIncomingPatients(searchTerm = '', filterValue = '') {
    const container = document.getElementById('incomingPatients');
    
    // Combine different patient sources
    let allPatients = [];
    
    // Add triage patients
    currentTriageRecords.forEach(record => {
        if (record.status === 'assigned' || record.status === 'pending') {
            allPatients.push({
                id: record.id,
                name: record.patientName,
                age: record.age,
                gender: record.gender,
                source: 'triage',
                urgency: record.urgencyLevel,
                chiefComplaint: record.chiefComplaint,
                arrivalTime: record.arrivalTime,
                status: record.status,
                type: 'Triage Patient'
            });
        }
    });
    
    // Add scheduled appointments
    const today = new Date().toDateString();
    currentAppointments.forEach(appointment => {
        if (new Date(appointment.date).toDateString() === today) {
            allPatients.push({
                id: appointment.id,
                name: appointment.patientName,
                age: appointment.patientAge || 'N/A',
                gender: appointment.patientGender || 'N/A',
                source: 'appointment',
                urgency: 'Scheduled',
                chiefComplaint: appointment.reason || 'Scheduled visit',
                arrivalTime: appointment.time,
                status: appointment.status || 'scheduled',
                type: 'Scheduled Appointment'
            });
        }
    });
    
    // Add active consultations
    currentConsultations.forEach(consultation => {
        if (consultation.status === 'active') {
            allPatients.push({
                id: consultation.id,
                name: consultation.patientName,
                age: consultation.patientAge,
                gender: consultation.patientGender,
                source: 'consultation',
                urgency: 'Active',
                chiefComplaint: consultation.chiefComplaint,
                arrivalTime: consultation.createdAt,
                status: consultation.status,
                type: 'Active Consultation'
            });
        }
    });
    
    // Apply filters
    let filteredPatients = allPatients;
    
    if (searchTerm) {
        filteredPatients = filteredPatients.filter(patient =>
            patient.name.toLowerCase().includes(searchTerm) ||
            patient.chiefComplaint.toLowerCase().includes(searchTerm) ||
            patient.id.includes(searchTerm)
        );
    }
    
    if (filterValue) {
        filteredPatients = filteredPatients.filter(patient => patient.source === filterValue);
    }
    
    if (filteredPatients.length === 0) {
        container.innerHTML = '<p>No patients found</p>';
        return;
    }
    
    const table = createTable(
        ['Patient', 'Age', 'Type', 'Chief Complaint', 'Urgency', 'Status', 'Actions'],
        filteredPatients.map(patient => ({
            patient: patient.name,
            age: patient.age,
            type: patient.type,
            chiefComplaint: patient.chiefComplaint,
            urgency: patient.urgency,
            status: patient.status,
            actions: ''
        })),
        [
            {
                label: 'Start Consultation',
                type: 'primary',
                handler: (row) => startConsultation(row.patient)
            }
        ]
    );
    
    // Add urgency styling
    const rows = table.querySelectorAll('tbody tr');
    rows.forEach((row, index) => {
        const patient = filteredPatients[index];
        const urgencyCell = row.cells[4]; // Urgency column
        
        if (patient.urgency === 'Critical') {
            urgencyCell.innerHTML = '<span class="status-badge status-critical">🚨 Critical</span>';
        } else if (patient.urgency === 'Urgent') {
            urgencyCell.innerHTML = '<span class="status-badge status-urgent">⚠️ Urgent</span>';
        } else if (patient.urgency === 'Scheduled') {
            urgencyCell.innerHTML = '<span class="status-badge status-normal">📅 Scheduled</span>';
        } else {
            urgencyCell.innerHTML = '<span class="status-badge status-normal">✅ Active</span>';
        }
        
        // Status badge
        const statusCell = row.cells[5];
        statusCell.innerHTML = `<span class="status-badge status-${patient.status}">${patient.status}</span>`;
    });
    
    container.innerHTML = '';
    container.appendChild(table);
}

function startConsultation(patientName) {
    // Find patient data from all sources
    let patientData = null;
    
    // Check triage records
    patientData = currentTriageRecords.find(p => p.patientName === patientName);
    if (patientData) {
        patientData.source = 'triage';
        patientData.patientId = patientData.id;
    }
    
    // Check appointments
    if (!patientData) {
        patientData = currentAppointments.find(p => p.patientName === patientName);
        if (patientData) {
            patientData.source = 'appointment';
            patientData.patientId = patientData.id;
        }
    }
    
    // Check existing consultations
    if (!patientData) {
        patientData = currentConsultations.find(p => p.patientName === patientName);
        if (patientData) {
            patientData.source = 'consultation';
            patientData.patientId = patientData.id;
        }
    }
    
    if (!patientData) {
        showAlert('Patient data not found', 'error');
        return;
    }
    
    selectedPatient = patientData;
    openConsultationModal(patientData);
}

function openConsultationModal(patientData) {
    const modal = document.getElementById('consultationModal');
    const formContainer = document.getElementById('consultationForm');
    
    // Create consultation form
    formContainer.innerHTML = `
        <div class="patient-info" style="background: #f8f9fa; padding: 15px; border-radius: 8px; margin-bottom: 20px;">
            <h3>Patient Information</h3>
            <p><strong>Name:</strong> ${patientData.patientName}</p>
            <p><strong>Age:</strong> ${patientData.age}</p>
            <p><strong>Gender:</strong> ${patientData.gender}</p>
            <p><strong>Source:</strong> ${patientData.source}</p>
            ${patientData.chiefComplaint ? `<p><strong>Chief Complaint:</strong> ${patientData.chiefComplaint}</p>` : ''}
            ${patientData.vitalSigns ? `
                <h4>Vital Signs</h4>
                <p><strong>Temperature:</strong> ${patientData.vitalSigns.temperature || 'N/A'}°F</p>
                <p><strong>Blood Pressure:</strong> ${patientData.vitalSigns.bloodPressure || 'N/A'}</p>
                <p><strong>Heart Rate:</strong> ${patientData.vitalSigns.heartRate || 'N/A'} BPM</p>
                <p><strong>Oxygen Saturation:</strong> ${patientData.vitalSigns.oxygenSaturation || 'N/A'}%</p>
            ` : ''}
        </div>
        
        <form id="consultationFormData">
            <input type="hidden" id="consultationPatientId" value="${patientData.patientId}">
            <input type="hidden" id="consultationPatientName" value="${patientData.patientName}">
            
            <div class="form-group">
                <label for="symptoms">Symptoms & Observations:</label>
                <textarea id="symptoms" rows="4" placeholder="Describe patient symptoms, observations, and examination findings..."></textarea>
            </div>
            
            <div class="form-group">
                <label for="diagnosis">Diagnosis:</label>
                <textarea id="diagnosis" rows="3" placeholder="Primary diagnosis and any secondary conditions..."></textarea>
            </div>
            
            <div class="form-group">
                <label for="treatmentPlan">Treatment Plan:</label>
                <textarea id="treatmentPlan" rows="3" placeholder="Treatment recommendations and follow-up instructions..."></textarea>
            </div>
            
            <div class="form-group">
                <label for="nextSteps">Next Steps:</label>
                <select id="nextSteps" required>
                    <option value="">Select Next Step</option>
                    <option value="lab">Send to Lab for Tests</option>
                    <option value="pharmacy">Prescribe Medication</option>
                    <option value="referral">Refer to Another Doctor</option>
                    <option value="discharge">Discharge Patient</option>
                    <option value="admit">Admit to Hospital</option>
                </select>
            </div>
            
            <div class="form-group">
                <label for="consultationNotes">Additional Notes:</label>
                <textarea id="consultationNotes" rows="3" placeholder="Any additional notes or recommendations..."></textarea>
            </div>
        </form>
    `;
    
    modal.style.display = 'block';
}

function saveConsultation() {
    const patientId = document.getElementById('consultationPatientId').value;
    const patientName = document.getElementById('consultationPatientName').value;
    const symptoms = document.getElementById('symptoms').value;
    const diagnosis = document.getElementById('diagnosis').value;
    const treatmentPlan = document.getElementById('treatmentPlan').value;
    const nextSteps = document.getElementById('nextSteps').value;
    const consultationNotes = document.getElementById('consultationNotes').value;
    
    if (!nextSteps) {
        showAlert('Please select next steps', 'error');
        return;
    }
    
    // Create consultation record
    const consultation = {
        id: generateId(),
        patientId: patientId,
        patientName: patientName,
        patientAge: selectedPatient.age,
        patientGender: selectedPatient.gender,
        symptoms: symptoms,
        diagnosis: diagnosis,
        treatmentPlan: treatmentPlan,
        nextSteps: nextSteps,
        consultationNotes: consultationNotes,
        status: 'completed',
        doctorId: getCurrentUser().username,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
    };
    
    // Add to consultations
    currentConsultations.push(consultation);
    
    // Update patient status in triage if applicable
    if (selectedPatient.source === 'triage') {
        const triageRecord = currentTriageRecords.find(t => t.id === patientId);
        if (triageRecord) {
            triageRecord.status = 'consulted';
            triageRecord.consultationId = consultation.id;
        }
    }
    
    // Save data
    saveConsultationData();
    
    // Handle next steps
    handleNextSteps(nextSteps, patientId, patientName);
    
    // Close modal and refresh
    closeConsultationModal();
    displayIncomingPatients();
    loadPatientHistory();
    
    showAlert('Consultation saved successfully!', 'success');
}

function handleNextSteps(nextSteps, patientId, patientName) {
    switch (nextSteps) {
        case 'lab':
            openLabRequestModal(patientId, patientName);
            break;
        case 'pharmacy':
            openPrescriptionModal(patientId, patientName);
            break;
        case 'discharge':
            dischargePatient(patientId, patientName);
            break;
        case 'referral':
            showAlert('Patient referred to another doctor', 'success');
            break;
        case 'admit':
            showAlert('Patient admitted to hospital', 'success');
            break;
    }
}

function openLabRequestModal(patientId, patientName) {
    document.getElementById('labPatientId').value = patientId;
    document.getElementById('labRequestModal').style.display = 'block';
}

function openPrescriptionModal(patientId, patientName) {
    document.getElementById('prescriptionPatientId').value = patientId;
    document.getElementById('prescriptionModal').style.display = 'block';
}

function submitLabRequest() {
    const patientId = document.getElementById('labPatientId').value;
    const testType = document.getElementById('labTestType').value;
    const priority = document.getElementById('labPriority').value;
    const notes = document.getElementById('labNotes').value;
    
    if (!testType) {
        showAlert('Please select test type', 'error');
        return;
    }
    
    const labRequest = {
        id: generateId(),
        patientId: patientId,
        patientName: selectedPatient.patientName,
        testType: testType,
        priority: priority,
        notes: notes,
        status: 'pending',
        doctorId: getCurrentUser().username,
        createdAt: new Date().toISOString()
    };
    
    const hospitalData = getHospitalData();
    hospitalData.labRequests = hospitalData.labRequests || [];
    hospitalData.labRequests.push(labRequest);
    saveHospitalData(hospitalData);
    
    closeLabRequestModal();
    showAlert('Lab request submitted successfully!', 'success');
}

function submitPrescription() {
    const patientId = document.getElementById('prescriptionPatientId').value;
    const medicationName = document.getElementById('medicationName').value;
    const dosage = document.getElementById('dosage').value;
    const frequency = document.getElementById('frequency').value;
    const duration = document.getElementById('duration').value;
    const notes = document.getElementById('prescriptionNotes').value;
    
    if (!medicationName || !dosage || !frequency || !duration) {
        showAlert('Please fill in all required fields', 'error');
        return;
    }
    
    const prescription = {
        id: generateId(),
        patientId: patientId,
        patientName: selectedPatient.patientName,
        medicationName: medicationName,
        dosage: dosage,
        frequency: frequency,
        duration: duration,
        notes: notes,
        status: 'pending',
        doctorId: getCurrentUser().username,
        createdAt: new Date().toISOString()
    };
    
    const hospitalData = getHospitalData();
    hospitalData.prescriptions = hospitalData.prescriptions || [];
    hospitalData.prescriptions.push(prescription);
    saveHospitalData(hospitalData);
    
    closePrescriptionModal();
    showAlert('Prescription submitted successfully!', 'success');
}

function dischargePatient(patientId, patientName) {
    if (confirm(`Discharge ${patientName}?`)) {
        // Create billing record
        const billingRecord = {
            id: generateId(),
            patientId: patientId,
            patientName: patientName,
            services: [
                { name: 'Consultation', amount: 150 },
                { name: 'Examination', amount: 100 }
            ],
            totalAmount: 250,
            status: 'pending',
            createdAt: new Date().toISOString()
        };
        
        const hospitalData = getHospitalData();
        hospitalData.billing = hospitalData.billing || [];
        hospitalData.billing.push(billingRecord);
        saveHospitalData(hospitalData);
        
        showAlert('Patient discharged and billing record created', 'success');
    }
}

function loadPatientHistory() {
    const container = document.getElementById('patientHistory');
    
    if (currentConsultations.length === 0) {
        container.innerHTML = '<p>No consultation history available</p>';
        return;
    }
    
    const table = createTable(
        ['Patient', 'Date', 'Diagnosis', 'Next Steps', 'Doctor', 'Status'],
        currentConsultations.map(consultation => ({
            patient: consultation.patientName,
            date: formatDate(consultation.createdAt),
            diagnosis: consultation.diagnosis || 'N/A',
            nextSteps: consultation.nextSteps,
            doctor: consultation.doctorId,
            status: consultation.status
        })),
        [
            {
                label: 'View Details',
                type: 'primary',
                handler: (row) => viewConsultationDetails(row.patient, row.date)
            }
        ]
    );
    
    container.innerHTML = '';
    container.appendChild(table);
}

function viewConsultationDetails(patientName, date) {
    const consultation = currentConsultations.find(c => 
        c.patientName === patientName && formatDate(c.createdAt) === date
    );
    
    if (!consultation) return;
    
    const detailsHtml = `
        <div style="padding: 20px;">
            <h3>Consultation Details</h3>
            <p><strong>Patient:</strong> ${consultation.patientName}</p>
            <p><strong>Date:</strong> ${formatDate(consultation.createdAt)}</p>
            <p><strong>Doctor:</strong> ${consultation.doctorId}</p>
            
            <h4>Symptoms & Observations</h4>
            <p>${consultation.symptoms || 'N/A'}</p>
            
            <h4>Diagnosis</h4>
            <p>${consultation.diagnosis || 'N/A'}</p>
            
            <h4>Treatment Plan</h4>
            <p>${consultation.treatmentPlan || 'N/A'}</p>
            
            <h4>Next Steps</h4>
            <p>${consultation.nextSteps}</p>
            
            <h4>Additional Notes</h4>
            <p>${consultation.consultationNotes || 'N/A'}</p>
        </div>
    `;
    
    const modal = createModal('Consultation Details', detailsHtml, [
        { label: 'Close', type: 'secondary', handler: 'hideModal(this.closest(".modal"))' }
    ]);
    
    showModal(modal);
}

function closeConsultationModal() {
    document.getElementById('consultationModal').style.display = 'none';
}

function closeLabRequestModal() {
    document.getElementById('labRequestModal').style.display = 'none';
}

function closePrescriptionModal() {
    document.getElementById('prescriptionModal').style.display = 'none';
}

function closeModal(modalId) {
    document.getElementById(modalId).style.display = 'none';
}

function saveConsultationData() {
    const hospitalData = getHospitalData();
    hospitalData.consultations = currentConsultations;
    hospitalData.triage = currentTriageRecords;
    saveHospitalData(hospitalData);
}
