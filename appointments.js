// Prince Alex Hospital - Appointments Logic (Firebase Integrated)

import { 
    AppointmentService, 
    DoctorService, 
    AuthService, 
    showAlert 
} from './firebase-services.js';

let currentAppointments = [];
let currentDoctors = [];

document.addEventListener('DOMContentLoaded', async function() {
    try {
        const currentUser = await AuthService.getCurrentUser();
        if (!currentUser) {
            window.location.href = 'login.html';
            return;
        }
        
        // Check if user has access to appointments
        if (!['Admin', 'Reception', 'Doctor'].includes(currentUser.role)) {
            showAlert('Access denied. Insufficient privileges.', 'error');
            setTimeout(() => window.location.href = 'login.html', 2000);
            return;
        }
        
        await loadAppointmentData();
        setupEventListeners();
        setDefaultDate();
        updateUserInfo(currentUser);
        
    } catch (error) {
        console.error('Error initializing appointments:', error);
        showAlert('Error loading appointment data. Please refresh the page.', 'error');
    }
});

async function loadAppointmentData() {
    try {
        showAlert('Loading appointments...', 'info');
        
        // Load appointments and doctors from Firebase
        const [appointments, doctors] = await Promise.all([
            AppointmentService.getAllAppointments(),
            DoctorService.getAllDoctors()
        ]);
        
        currentAppointments = appointments;
        currentDoctors = doctors;
        
        populateDoctorDropdowns();
        displayAppointments();
        
        showAlert('Appointments loaded successfully', 'success');
        
    } catch (error) {
        console.error('Error loading appointment data:', error);
        showAlert('Error loading appointments. Please try again.', 'error');
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
    // Appointment form submission
    const appointmentForm = document.getElementById('appointmentForm');
    if (appointmentForm) {
        appointmentForm.addEventListener('submit', handleAppointmentSubmission);
    }
    
    // Search and filter
    const searchInput = document.getElementById('searchAppointments');
    const filterSelect = document.getElementById('filterAppointments');
    const dateFilter = document.getElementById('dateFilter');
    
    if (searchInput) {
        searchInput.addEventListener('input', handleAppointmentSearch);
    }
    
    if (filterSelect) {
        filterSelect.addEventListener('change', handleAppointmentSearch);
    }
    
    if (dateFilter) {
        dateFilter.addEventListener('change', handleAppointmentSearch);
    }
    
    // Modal close functionality
    const modal = document.getElementById('editAppointmentModal');
    const closeBtn = modal.querySelector('.close');
    
    if (closeBtn) {
        closeBtn.onclick = closeEditAppointmentModal;
    }
    
    modal.onclick = function(e) {
        if (e.target === modal) {
            closeEditAppointmentModal();
        }
    };
}

function setDefaultDate() {
    const appointmentDateInput = document.getElementById('appointmentDate');
    if (appointmentDateInput) {
        const today = new Date();
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);
        appointmentDateInput.value = tomorrow.toISOString().split('T')[0];
        appointmentDateInput.min = today.toISOString().split('T')[0];
    }
}

function populateDoctorDropdowns() {
    const doctorSelects = ['selectedDoctor', 'editSelectedDoctor'];
    
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

function handleAppointmentSubmission(e) {
    e.preventDefault();
    
    const formData = new FormData(e.target);
    const appointmentData = {
        id: generateId(),
        patientName: formData.get('patientName'),
        patientAge: parseInt(formData.get('patientAge')),
        patientGender: formData.get('patientGender'),
        patientContact: formData.get('patientContact'),
        appointmentDate: formData.get('appointmentDate'),
        appointmentTime: formData.get('appointmentTime'),
        doctorId: formData.get('selectedDoctor'),
        doctorName: currentDoctors.find(d => d.id === formData.get('selectedDoctor'))?.name || 'Unknown',
        department: formData.get('department'),
        appointmentType: formData.get('appointmentType'),
        priority: formData.get('priority'),
        reason: formData.get('reason'),
        notes: formData.get('notes'),
        status: 'scheduled',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
    };
    
    // Check for conflicts
    const conflict = checkAppointmentConflict(appointmentData);
    if (conflict) {
        showAlert(conflict, 'error');
        return;
    }
    
    // Add appointment
    currentAppointments.push(appointmentData);
    saveAppointmentData();
    
    // Reset form
    e.target.reset();
    setDefaultDate();
    
    // Refresh display
    displayAppointments();
    
    showAlert('Appointment scheduled successfully!', 'success');
}

function checkAppointmentConflict(newAppointment) {
    const sameDateTime = currentAppointments.find(apt => 
        apt.appointmentDate === newAppointment.appointmentDate &&
        apt.appointmentTime === newAppointment.appointmentTime &&
        apt.doctorId === newAppointment.doctorId &&
        apt.status !== 'cancelled'
    );
    
    if (sameDateTime) {
        return `Doctor ${newAppointment.doctorName} already has an appointment at ${newAppointment.appointmentTime} on ${newAppointment.appointmentDate}`;
    }
    
    return null;
}

function handleAppointmentSearch() {
    const searchTerm = document.getElementById('searchAppointments').value.toLowerCase();
    const filterValue = document.getElementById('filterAppointments').value;
    const dateFilter = document.getElementById('dateFilter').value;
    
    let filteredAppointments = currentAppointments;
    
    // Apply search filter
    if (searchTerm) {
        filteredAppointments = filteredAppointments.filter(appointment =>
            appointment.patientName.toLowerCase().includes(searchTerm) ||
            appointment.doctorName.toLowerCase().includes(searchTerm) ||
            appointment.reason.toLowerCase().includes(searchTerm) ||
            appointment.id.includes(searchTerm)
        );
    }
    
    // Apply status filter
    if (filterValue) {
        const today = new Date().toDateString();
        
        switch (filterValue) {
            case 'today':
                filteredAppointments = filteredAppointments.filter(apt => 
                    new Date(apt.appointmentDate).toDateString() === today
                );
                break;
            case 'upcoming':
                filteredAppointments = filteredAppointments.filter(apt => 
                    new Date(apt.appointmentDate) >= new Date() && apt.status === 'scheduled'
                );
                break;
            case 'completed':
                filteredAppointments = filteredAppointments.filter(apt => apt.status === 'completed');
                break;
            case 'cancelled':
                filteredAppointments = filteredAppointments.filter(apt => apt.status === 'cancelled');
                break;
        }
    }
    
    // Apply date filter
    if (dateFilter) {
        filteredAppointments = filteredAppointments.filter(apt => 
            apt.appointmentDate === dateFilter
        );
    }
    
    displayAppointments(filteredAppointments);
}

function displayAppointments(appointments = currentAppointments) {
    const container = document.getElementById('appointmentsTable');
    
    if (appointments.length === 0) {
        container.innerHTML = '<p>No appointments found</p>';
        return;
    }
    
    // Sort by date and time
    const sortedAppointments = appointments.sort((a, b) => {
        const dateA = new Date(`${a.appointmentDate} ${a.appointmentTime}`);
        const dateB = new Date(`${b.appointmentDate} ${b.appointmentTime}`);
        return dateA - dateB;
    });
    
    const table = createTable(
        ['ID', 'Patient', 'Doctor', 'Date', 'Time', 'Department', 'Type', 'Status', 'Actions'],
        sortedAppointments.map(appointment => ({
            id: appointment.id,
            patient: appointment.patientName,
            doctor: appointment.doctorName,
            date: new Date(appointment.appointmentDate).toLocaleDateString(),
            time: new Date(`2000-01-01 ${appointment.appointmentTime}`).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}),
            department: appointment.department,
            type: appointment.appointmentType,
            status: appointment.status,
            actions: ''
        })),
        [
            {
                label: 'Edit',
                type: 'warning',
                handler: (row) => editAppointment(row.id)
            },
            {
                label: 'Cancel',
                type: 'danger',
                handler: (row) => cancelAppointment(row.id)
            },
            {
                label: 'Complete',
                type: 'success',
                handler: (row) => completeAppointment(row.id)
            }
        ]
    );
    
    // Add status styling
    const rows = table.querySelectorAll('tbody tr');
    rows.forEach((row, index) => {
        const appointment = sortedAppointments[index];
        const statusCell = row.cells[7]; // Status column
        
        switch (appointment.status) {
            case 'scheduled':
                statusCell.innerHTML = '<span class="status-badge status-pending">📅 Scheduled</span>';
                break;
            case 'confirmed':
                statusCell.innerHTML = '<span class="status-badge status-normal">✅ Confirmed</span>';
                break;
            case 'completed':
                statusCell.innerHTML = '<span class="status-badge status-completed">✅ Completed</span>';
                break;
            case 'cancelled':
                statusCell.innerHTML = '<span class="status-badge status-critical">❌ Cancelled</span>';
                break;
            case 'no-show':
                statusCell.innerHTML = '<span class="status-badge status-urgent">⚠️ No Show</span>';
                break;
            default:
                statusCell.innerHTML = `<span class="status-badge status-${appointment.status}">${appointment.status}</span>`;
        }
    });
    
    container.innerHTML = '';
    container.appendChild(table);
}

function editAppointment(appointmentId) {
    const appointment = currentAppointments.find(a => a.id === appointmentId);
    if (!appointment) return;
    
    // Populate edit form
    document.getElementById('editAppointmentId').value = appointment.id;
    document.getElementById('editPatientName').value = appointment.patientName;
    document.getElementById('editAppointmentDate').value = appointment.appointmentDate;
    document.getElementById('editAppointmentTime').value = appointment.appointmentTime;
    document.getElementById('editSelectedDoctor').value = appointment.doctorId;
    document.getElementById('editDepartment').value = appointment.department;
    document.getElementById('editStatus').value = appointment.status;
    document.getElementById('editReason').value = appointment.reason;
    document.getElementById('editNotes').value = appointment.notes || '';
    
    // Show modal
    document.getElementById('editAppointmentModal').style.display = 'block';
}

function updateAppointment() {
    const appointmentId = document.getElementById('editAppointmentId').value;
    const appointment = currentAppointments.find(a => a.id === appointmentId);
    
    if (!appointment) return;
    
    // Update appointment data
    appointment.patientName = document.getElementById('editPatientName').value;
    appointment.appointmentDate = document.getElementById('editAppointmentDate').value;
    appointment.appointmentTime = document.getElementById('editAppointmentTime').value;
    appointment.doctorId = document.getElementById('editSelectedDoctor').value;
    appointment.doctorName = currentDoctors.find(d => d.id === appointment.doctorId)?.name || 'Unknown';
    appointment.department = document.getElementById('editDepartment').value;
    appointment.status = document.getElementById('editStatus').value;
    appointment.reason = document.getElementById('editReason').value;
    appointment.notes = document.getElementById('editNotes').value;
    appointment.updatedAt = new Date().toISOString();
    
    // Check for conflicts if date/time/doctor changed
    const conflict = checkAppointmentConflict(appointment);
    if (conflict) {
        showAlert(conflict, 'error');
        return;
    }
    
    // Save data
    saveAppointmentData();
    
    // Close modal and refresh display
    closeEditAppointmentModal();
    displayAppointments();
    
    showAlert('Appointment updated successfully!', 'success');
}

function cancelAppointment(appointmentId) {
    if (!confirm('Are you sure you want to cancel this appointment?')) {
        return;
    }
    
    const appointment = currentAppointments.find(a => a.id === appointmentId);
    if (!appointment) return;
    
    appointment.status = 'cancelled';
    appointment.updatedAt = new Date().toISOString();
    
    saveAppointmentData();
    displayAppointments();
    
    showAlert('Appointment cancelled successfully!', 'success');
}

function completeAppointment(appointmentId) {
    if (!confirm('Mark this appointment as completed?')) {
        return;
    }
    
    const appointment = currentAppointments.find(a => a.id === appointmentId);
    if (!appointment) return;
    
    appointment.status = 'completed';
    appointment.completedAt = new Date().toISOString();
    appointment.updatedAt = new Date().toISOString();
    
    saveAppointmentData();
    displayAppointments();
    
    showAlert('Appointment marked as completed!', 'success');
}

function closeEditAppointmentModal() {
    document.getElementById('editAppointmentModal').style.display = 'none';
}

function saveAppointmentData() {
    const hospitalData = getHospitalData();
    hospitalData.appointments = currentAppointments;
    saveHospitalData(hospitalData);
}
