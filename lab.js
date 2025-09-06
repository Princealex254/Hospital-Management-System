// Prince Alex Hospital - Laboratory Logic

let currentLabRequests = [];
let currentLabResults = [];

document.addEventListener('DOMContentLoaded', function() {
    const currentUser = initPage();
    if (!currentUser) return;
    
    loadLabData();
    setupEventListeners();
});

function loadLabData() {
    const hospitalData = getHospitalData();
    currentLabRequests = hospitalData.labRequests || [];
    currentLabResults = hospitalData.labResults || [];
    
    displayLabRequests();
    displayLabResults();
}

function setupEventListeners() {
    // Search and filter for requests
    const searchRequests = document.getElementById('searchRequests');
    const filterRequests = document.getElementById('filterRequests');
    
    if (searchRequests) {
        searchRequests.addEventListener('input', handleRequestSearch);
    }
    
    if (filterRequests) {
        filterRequests.addEventListener('change', handleRequestSearch);
    }
    
    // Search and filter for results
    const searchResults = document.getElementById('searchResults');
    const filterResults = document.getElementById('filterResults');
    
    if (searchResults) {
        searchResults.addEventListener('input', handleResultSearch);
    }
    
    if (filterResults) {
        filterResults.addEventListener('change', handleResultSearch);
    }
    
    // Modal close functionality
    const modal = document.getElementById('labResultModal');
    const closeBtn = modal.querySelector('.close');
    
    if (closeBtn) {
        closeBtn.onclick = closeLabResultModal;
    }
    
    modal.onclick = function(e) {
        if (e.target === modal) {
            closeLabResultModal();
        }
    };
}

function handleRequestSearch() {
    const searchTerm = document.getElementById('searchRequests').value.toLowerCase();
    const filterValue = document.getElementById('filterRequests').value;
    
    let filteredRequests = currentLabRequests;
    
    // Apply search filter
    if (searchTerm) {
        filteredRequests = filteredRequests.filter(request =>
            request.patientName.toLowerCase().includes(searchTerm) ||
            request.testType.toLowerCase().includes(searchTerm) ||
            request.id.includes(searchTerm)
        );
    }
    
    // Apply priority filter
    if (filterValue) {
        filteredRequests = filteredRequests.filter(request => request.priority === filterValue);
    }
    
    displayLabRequests(filteredRequests);
}

function handleResultSearch() {
    const searchTerm = document.getElementById('searchResults').value.toLowerCase();
    const filterValue = document.getElementById('filterResults').value;
    
    let filteredResults = currentLabResults;
    
    // Apply search filter
    if (searchTerm) {
        filteredResults = filteredResults.filter(result =>
            result.patientName.toLowerCase().includes(searchTerm) ||
            result.testType.toLowerCase().includes(searchTerm) ||
            result.id.includes(searchTerm)
        );
    }
    
    // Apply status filter
    if (filterValue) {
        filteredResults = filteredResults.filter(result => result.status === filterValue);
    }
    
    displayLabResults(filteredResults);
}

function displayLabRequests(requests = currentLabRequests) {
    const container = document.getElementById('labRequestsTable');
    
    if (requests.length === 0) {
        container.innerHTML = '<p>No pending lab requests</p>';
        return;
    }
    
    const table = createTable(
        ['ID', 'Patient', 'Test Type', 'Priority', 'Requested By', 'Date', 'Status', 'Actions'],
        requests.map(request => ({
            id: request.id,
            patient: request.patientName,
            testType: request.testType,
            priority: request.priority,
            requestedBy: request.doctorId,
            date: formatDate(request.createdAt),
            status: request.status,
            actions: ''
        })),
        [
            {
                label: 'Process Test',
                type: 'primary',
                handler: (row) => processLabTest(row.id)
            }
        ]
    );
    
    // Add priority styling
    const rows = table.querySelectorAll('tbody tr');
    rows.forEach((row, index) => {
        const request = requests[index];
        const priorityCell = row.cells[3]; // Priority column
        
        if (request.priority === 'Critical') {
            priorityCell.innerHTML = '<span class="status-badge status-critical">🚨 Critical</span>';
        } else if (request.priority === 'Urgent') {
            priorityCell.innerHTML = '<span class="status-badge status-urgent">⚠️ Urgent</span>';
        } else {
            priorityCell.innerHTML = '<span class="status-badge status-normal">📋 Routine</span>';
        }
        
        // Status badge
        const statusCell = row.cells[6];
        statusCell.innerHTML = `<span class="status-badge status-${request.status}">${request.status}</span>`;
    });
    
    container.innerHTML = '';
    container.appendChild(table);
}

function displayLabResults(results = currentLabResults) {
    const container = document.getElementById('labResultsTable');
    
    if (results.length === 0) {
        container.innerHTML = '<p>No lab results available</p>';
        return;
    }
    
    const table = createTable(
        ['ID', 'Patient', 'Test Type', 'Interpretation', 'Completed By', 'Date', 'Status', 'Actions'],
        results.map(result => ({
            id: result.id,
            patient: result.patientName,
            testType: result.testType,
            interpretation: result.interpretation,
            completedBy: result.technicianId,
            date: formatDate(result.completedAt),
            status: result.status,
            actions: ''
        })),
        [
            {
                label: 'View Details',
                type: 'primary',
                handler: (row) => viewLabResultDetails(row.id)
            },
            {
                label: 'Send to Doctor',
                type: 'success',
                handler: (row) => sendResultToDoctor(row.id)
            }
        ]
    );
    
    // Add interpretation styling
    const rows = table.querySelectorAll('tbody tr');
    rows.forEach((row, index) => {
        const result = results[index];
        const interpretationCell = row.cells[3]; // Interpretation column
        
        if (result.interpretation === 'Normal') {
            interpretationCell.innerHTML = '<span class="status-badge status-normal">✅ Normal</span>';
        } else if (result.interpretation === 'Critical') {
            interpretationCell.innerHTML = '<span class="status-badge status-critical">🚨 Critical</span>';
        } else if (result.interpretation.includes('Abnormal')) {
            interpretationCell.innerHTML = '<span class="status-badge status-urgent">⚠️ Abnormal</span>';
        } else {
            interpretationCell.innerHTML = `<span class="status-badge status-pending">${result.interpretation}</span>`;
        }
        
        // Status badge
        const statusCell = row.cells[6];
        statusCell.innerHTML = `<span class="status-badge status-${result.status}">${result.status}</span>`;
    });
    
    container.innerHTML = '';
    container.appendChild(table);
}

function processLabTest(requestId) {
    const request = currentLabRequests.find(r => r.id === requestId);
    if (!request) return;
    
    // Populate modal with request data
    document.getElementById('resultRequestId').value = request.id;
    document.getElementById('resultPatientId').value = request.patientId;
    document.getElementById('resultPatientName').value = request.patientName;
    document.getElementById('resultTestType').value = request.testType;
    
    document.getElementById('modalPatientName').textContent = request.patientName;
    document.getElementById('modalTestType').textContent = request.testType;
    document.getElementById('modalPriority').textContent = request.priority;
    document.getElementById('modalDoctor').textContent = request.doctorId;
    
    // Clear form
    document.getElementById('testResults').value = '';
    document.getElementById('normalRange').value = '';
    document.getElementById('interpretation').value = '';
    document.getElementById('recommendations').value = '';
    document.getElementById('technicianNotes').value = '';
    
    // Show modal
    document.getElementById('labResultModal').style.display = 'block';
}

function submitLabResult() {
    const requestId = document.getElementById('resultRequestId').value;
    const patientId = document.getElementById('resultPatientId').value;
    const patientName = document.getElementById('resultPatientName').value;
    const testType = document.getElementById('resultTestType').value;
    const testResults = document.getElementById('testResults').value;
    const normalRange = document.getElementById('normalRange').value;
    const interpretation = document.getElementById('interpretation').value;
    const recommendations = document.getElementById('recommendations').value;
    const technicianNotes = document.getElementById('technicianNotes').value;
    
    if (!testResults || !interpretation) {
        showAlert('Please fill in test results and interpretation', 'error');
        return;
    }
    
    // Create lab result
    const labResult = {
        id: generateId(),
        requestId: requestId,
        patientId: patientId,
        patientName: patientName,
        testType: testType,
        testResults: testResults,
        normalRange: normalRange,
        interpretation: interpretation,
        recommendations: recommendations,
        technicianNotes: technicianNotes,
        status: 'completed',
        technicianId: getCurrentUser().username,
        completedAt: new Date().toISOString(),
        createdAt: new Date().toISOString()
    };
    
    // Add to results
    currentLabResults.push(labResult);
    
    // Update request status
    const request = currentLabRequests.find(r => r.id === requestId);
    if (request) {
        request.status = 'completed';
        request.resultId = labResult.id;
    }
    
    // Save data
    saveLabData();
    
    // Close modal and refresh
    closeLabResultModal();
    displayLabRequests();
    displayLabResults();
    
    showAlert('Lab result submitted successfully!', 'success');
}

function viewLabResultDetails(resultId) {
    const result = currentLabResults.find(r => r.id === resultId);
    if (!result) return;
    
    const detailsHtml = `
        <div style="padding: 20px;">
            <h3>Lab Test Details</h3>
            <p><strong>Patient:</strong> ${result.patientName}</p>
            <p><strong>Test Type:</strong> ${result.testType}</p>
            <p><strong>Completed By:</strong> ${result.technicianId}</p>
            <p><strong>Date:</strong> ${formatDate(result.completedAt)}</p>
            
            <h4>Test Results</h4>
            <div style="background: #f8f9fa; padding: 15px; border-radius: 8px; margin: 10px 0;">
                ${result.testResults}
            </div>
            
            ${result.normalRange ? `<p><strong>Normal Range:</strong> ${result.normalRange}</p>` : ''}
            
            <h4>Interpretation</h4>
            <p><strong>Result:</strong> ${result.interpretation}</p>
            
            ${result.recommendations ? `
                <h4>Recommendations</h4>
                <p>${result.recommendations}</p>
            ` : ''}
            
            ${result.technicianNotes ? `
                <h4>Technician Notes</h4>
                <p>${result.technicianNotes}</p>
            ` : ''}
        </div>
    `;
    
    const modal = createModal('Lab Result Details', detailsHtml, [
        { label: 'Close', type: 'secondary', handler: 'hideModal(this.closest(".modal"))' }
    ]);
    
    showModal(modal);
}

function sendResultToDoctor(resultId) {
    const result = currentLabResults.find(r => r.id === resultId);
    if (!result) return;
    
    // Update status to indicate sent to doctor
    result.status = 'sent_to_doctor';
    result.sentToDoctorAt = new Date().toISOString();
    
    saveLabData();
    displayLabResults();
    
    showAlert('Lab result sent to doctor successfully!', 'success');
}

function closeLabResultModal() {
    document.getElementById('labResultModal').style.display = 'none';
}

function saveLabData() {
    const hospitalData = getHospitalData();
    hospitalData.labRequests = currentLabRequests;
    hospitalData.labResults = currentLabResults;
    saveHospitalData(hospitalData);
}
