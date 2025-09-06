// Prince Alex Hospital - Triage System Logic

let currentTriageRecords = [];

document.addEventListener('DOMContentLoaded', function() {
    const currentUser = initPage();
    if (!currentUser) return;
    
    loadTriageRecords();
    setupEventListeners();
    setDefaultArrivalTime();
});

function loadTriageRecords() {
    const hospitalData = getHospitalData();
    currentTriageRecords = hospitalData.triage || [];
    displayTriageQueue(currentTriageRecords);
}

function setupEventListeners() {
    // Triage form submission
    const triageForm = document.getElementById('triageForm');
    if (triageForm) {
        triageForm.addEventListener('submit', handleTriageSubmission);
    }
    
    // Search and filter
    const searchInput = document.getElementById('searchTriage');
    const filterSelect = document.getElementById('filterTriage');
    
    if (searchInput) {
        searchInput.addEventListener('input', handleTriageSearch);
    }
    
    if (filterSelect) {
        filterSelect.addEventListener('change', handleTriageSearch);
    }
}

function setDefaultArrivalTime() {
    const arrivalTimeInput = document.getElementById('arrivalTime');
    if (arrivalTimeInput) {
        const now = new Date();
        const localDateTime = new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
        arrivalTimeInput.value = localDateTime;
    }
}

function handleTriageSubmission(e) {
    e.preventDefault();
    
    const formData = new FormData(e.target);
    const triageData = {
        id: generateId(),
        patientName: formData.get('patientName'),
        age: parseInt(formData.get('patientAge')),
        gender: formData.get('patientGender'),
        arrivalTime: formData.get('arrivalTime'),
        modeOfArrival: formData.get('modeOfArrival'),
        chiefComplaint: formData.get('chiefComplaint'),
        vitalSigns: {
            temperature: formData.get('temperature') ? parseFloat(formData.get('temperature')) : null,
            bloodPressure: formData.get('bloodPressure'),
            heartRate: formData.get('heartRate') ? parseInt(formData.get('heartRate')) : null,
            oxygenSaturation: formData.get('oxygenSaturation') ? parseInt(formData.get('oxygenSaturation')) : null
        },
        urgencyLevel: formData.get('urgencyLevel'),
        triageNotes: formData.get('triageNotes'),
        status: 'pending',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
    };
    
    // Add triage record
    currentTriageRecords.push(triageData);
    saveTriageData();
    
    // Reset form
    e.target.reset();
    setDefaultArrivalTime();
    
    // Refresh display
    displayTriageQueue(currentTriageRecords);
    
    showAlert('Patient triaged successfully!', 'success');
}

function handleTriageSearch() {
    const searchTerm = document.getElementById('searchTriage').value.toLowerCase();
    const filterValue = document.getElementById('filterTriage').value;
    
    let filteredRecords = currentTriageRecords;
    
    // Apply search filter
    if (searchTerm) {
        filteredRecords = filteredRecords.filter(record =>
            record.patientName.toLowerCase().includes(searchTerm) ||
            record.chiefComplaint.toLowerCase().includes(searchTerm) ||
            record.id.includes(searchTerm)
        );
    }
    
    // Apply urgency filter
    if (filterValue) {
        filteredRecords = filteredRecords.filter(record => record.urgencyLevel === filterValue);
    }
    
    displayTriageQueue(filteredRecords);
}

function displayTriageQueue(records) {
    const container = document.getElementById('triageQueue');
    
    if (records.length === 0) {
        container.innerHTML = '<p>No patients in triage queue</p>';
        return;
    }
    
    // Sort by urgency level and arrival time
    const sortedRecords = records.sort((a, b) => {
        const urgencyOrder = { 'Critical': 1, 'Urgent': 2, 'Non-urgent': 3 };
        const urgencyDiff = urgencyOrder[a.urgencyLevel] - urgencyOrder[b.urgencyLevel];
        
        if (urgencyDiff !== 0) return urgencyDiff;
        
        return new Date(a.arrivalTime) - new Date(b.arrivalTime);
    });
    
    const table = createTable(
        ['ID', 'Patient', 'Age', 'Arrival Time', 'Chief Complaint', 'Urgency', 'Status', 'Actions'],
        sortedRecords.map(record => ({
            id: record.id,
            patient: record.patientName,
            age: record.age,
            arrivalTime: formatDate(record.arrivalTime),
            chiefComplaint: record.chiefComplaint,
            urgency: record.urgencyLevel,
            status: record.status,
            actions: ''
        })),
        [
            {
                label: 'View Details',
                type: 'primary',
                handler: (row) => viewTriageDetails(row.id)
            },
            {
                label: 'Assign Doctor',
                type: 'success',
                handler: (row) => assignDoctor(row.id)
            },
            {
                label: 'Complete',
                type: 'warning',
                handler: (row) => completeTriage(row.id)
            }
        ]
    );
    
    // Add urgency level styling
    const rows = table.querySelectorAll('tbody tr');
    rows.forEach((row, index) => {
        const record = sortedRecords[index];
        const urgencyCell = row.cells[5]; // Urgency column
        
        if (record.urgencyLevel === 'Critical') {
            urgencyCell.innerHTML = '<span class="status-badge status-critical">🚨 Critical</span>';
        } else if (record.urgencyLevel === 'Urgent') {
            urgencyCell.innerHTML = '<span class="status-badge status-urgent">⚠️ Urgent</span>';
        } else {
            urgencyCell.innerHTML = '<span class="status-badge status-normal">✅ Non-urgent</span>';
        }
        
        // Status badge
        const statusCell = row.cells[6];
        statusCell.innerHTML = `<span class="status-badge status-${record.status}">${record.status}</span>`;
    });
    
    container.innerHTML = '';
    container.appendChild(table);
}

function viewTriageDetails(recordId) {
    const record = currentTriageRecords.find(r => r.id === recordId);
    if (!record) return;
    
    const detailsHtml = `
        <div style="padding: 20px;">
            <h3>Patient Details</h3>
            <p><strong>Name:</strong> ${record.patientName}</p>
            <p><strong>Age:</strong> ${record.age}</p>
            <p><strong>Gender:</strong> ${record.gender}</p>
            <p><strong>Arrival Time:</strong> ${formatDate(record.arrivalTime)}</p>
            <p><strong>Mode of Arrival:</strong> ${record.modeOfArrival}</p>
            <p><strong>Chief Complaint:</strong> ${record.chiefComplaint}</p>
            
            <h3>Vital Signs</h3>
            <p><strong>Temperature:</strong> ${record.vitalSigns.temperature ? record.vitalSigns.temperature + '°F' : 'Not recorded'}</p>
            <p><strong>Blood Pressure:</strong> ${record.vitalSigns.bloodPressure || 'Not recorded'}</p>
            <p><strong>Heart Rate:</strong> ${record.vitalSigns.heartRate ? record.vitalSigns.heartRate + ' BPM' : 'Not recorded'}</p>
            <p><strong>Oxygen Saturation:</strong> ${record.vitalSigns.oxygenSaturation ? record.vitalSigns.oxygenSaturation + '%' : 'Not recorded'}</p>
            
            <h3>Assessment</h3>
            <p><strong>Urgency Level:</strong> ${record.urgencyLevel}</p>
            <p><strong>Triage Notes:</strong> ${record.triageNotes || 'None'}</p>
            <p><strong>Status:</strong> ${record.status}</p>
        </div>
    `;
    
    const modal = createModal('Triage Details', detailsHtml, [
        { label: 'Close', type: 'secondary', handler: 'hideModal(this.closest(".modal"))' }
    ]);
    
    showModal(modal);
}

function assignDoctor(recordId) {
    const record = currentTriageRecords.find(r => r.id === recordId);
    if (!record) return;
    
    const hospitalData = getHospitalData();
    const doctors = hospitalData.doctors || [];
    
    if (doctors.length === 0) {
        showAlert('No doctors available for assignment', 'error');
        return;
    }
    
    const doctorOptions = doctors.map(doctor => 
        `<option value="${doctor.id}">${doctor.name} - ${doctor.specialization}</option>`
    ).join('');
    
    const assignFormHtml = `
        <form id="assignDoctorForm">
            <div class="form-group">
                <label for="selectedDoctor">Select Doctor:</label>
                <select id="selectedDoctor" required>
                    <option value="">Select Doctor</option>
                    ${doctorOptions}
                </select>
            </div>
            <div class="form-group">
                <label for="assignmentNotes">Assignment Notes:</label>
                <textarea id="assignmentNotes" rows="3" placeholder="Additional notes for the doctor..."></textarea>
            </div>
        </form>
    `;
    
    const modal = createModal('Assign Doctor', assignFormHtml, [
        { label: 'Cancel', type: 'secondary', handler: 'hideModal(this.closest(".modal"))' },
        { label: 'Assign', type: 'primary', handler: `assignDoctorToPatient('${recordId}')` }
    ]);
    
    showModal(modal);
}

function assignDoctorToPatient(recordId) {
    const selectedDoctorId = document.getElementById('selectedDoctor').value;
    const assignmentNotes = document.getElementById('assignmentNotes').value;
    
    if (!selectedDoctorId) {
        showAlert('Please select a doctor', 'error');
        return;
    }
    
    const record = currentTriageRecords.find(r => r.id === recordId);
    if (!record) return;
    
    // Update record
    record.assignedDoctor = selectedDoctorId;
    record.assignmentNotes = assignmentNotes;
    record.status = 'assigned';
    record.updatedAt = new Date().toISOString();
    
    // Save data
    saveTriageData();
    
    // Refresh display
    displayTriageQueue(currentTriageRecords);
    
    // Close modal
    const modal = document.querySelector('.modal');
    if (modal) {
        hideModal(modal);
    }
    
    showAlert('Doctor assigned successfully!', 'success');
}

function completeTriage(recordId) {
    if (!confirm('Mark this triage as completed?')) {
        return;
    }
    
    const record = currentTriageRecords.find(r => r.id === recordId);
    if (!record) return;
    
    record.status = 'completed';
    record.completedAt = new Date().toISOString();
    record.updatedAt = new Date().toISOString();
    
    saveTriageData();
    displayTriageQueue(currentTriageRecords);
    
    showAlert('Triage completed successfully!', 'success');
}

function saveTriageData() {
    const hospitalData = getHospitalData();
    hospitalData.triage = currentTriageRecords;
    saveHospitalData(hospitalData);
}
