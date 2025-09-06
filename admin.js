// Prince Alex Hospital - Admin Dashboard Logic

let currentStaff = [];
let currentDepartments = [];

document.addEventListener('DOMContentLoaded', function() {
    const currentUser = initPage();
    if (!currentUser) return;
    
    // Check if user is admin
    if (currentUser.department !== 'Admin') {
        showAlert('Access denied. Admin privileges required.', 'error');
        window.location.href = 'index.html';
        return;
    }
    
    loadAdminData();
    setupEventListeners();
    updateSystemStats();
});

function loadAdminData() {
    const hospitalData = getHospitalData();
    currentStaff = hospitalData.users || [];
    currentDepartments = hospitalData.departments || [];
    
    displayStaff();
    displayDepartments();
    loadSystemSettings();
}

function setupEventListeners() {
    // System settings form
    const settingsForm = document.getElementById('systemSettingsForm');
    if (settingsForm) {
        settingsForm.addEventListener('submit', handleSystemSettings);
    }
    
    // Staff search
    const searchStaff = document.getElementById('searchStaff');
    if (searchStaff) {
        searchStaff.addEventListener('input', handleStaffSearch);
    }
    
    // Department search
    const searchDepartments = document.getElementById('searchDepartments');
    if (searchDepartments) {
        searchDepartments.addEventListener('input', handleDepartmentSearch);
    }
    
    // Modal close functionality
    setupModalCloseHandlers();
}

function setupModalCloseHandlers() {
    const modals = ['addStaffModal', 'addDepartmentModal'];
    
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

function updateSystemStats() {
    const hospitalData = getHospitalData();
    
    const stats = {
        totalPatients: hospitalData.patients?.length || 0,
        totalStaff: currentStaff.length,
        totalDepartments: currentDepartments.length,
        totalAppointments: hospitalData.appointments?.length || 0,
        totalRevenue: hospitalData.billing?.reduce((sum, bill) => 
            bill.status === 'paid' ? sum + bill.totalAmount : sum, 0) || 0,
        systemUptime: '99.9%',
        activeUsers: currentStaff.filter(s => s.status === 'active').length
    };
    
    const container = document.getElementById('systemStats');
    container.innerHTML = `
        <div class="stat-card">
            <div class="stat-number">${stats.totalPatients}</div>
            <div class="stat-label">Total Patients</div>
        </div>
        <div class="stat-card">
            <div class="stat-number">${stats.totalStaff}</div>
            <div class="stat-label">Staff Members</div>
        </div>
        <div class="stat-card">
            <div class="stat-number">${stats.totalDepartments}</div>
            <div class="stat-label">Departments</div>
        </div>
        <div class="stat-card">
            <div class="stat-number">${stats.totalAppointments}</div>
            <div class="stat-label">Appointments</div>
        </div>
        <div class="stat-card">
            <div class="stat-number">$${stats.totalRevenue.toLocaleString()}</div>
            <div class="stat-label">Total Revenue</div>
        </div>
        <div class="stat-card">
            <div class="stat-number">${stats.systemUptime}</div>
            <div class="stat-label">System Uptime</div>
        </div>
    `;
}

function displayStaff(staff = currentStaff) {
    const container = document.getElementById('staffTable');
    
    if (staff.length === 0) {
        container.innerHTML = '<p>No staff members found</p>';
        return;
    }
    
    const table = createTable(
        ['Name', 'Email', 'Department', 'Role', 'Contact', 'Status', 'Actions'],
        staff.map(member => ({
            name: member.name,
            email: member.email,
            department: member.department,
            role: member.role || 'N/A',
            contact: member.contact,
            status: member.status,
            actions: ''
        })),
        [
            {
                label: 'Edit',
                type: 'warning',
                handler: (row) => editStaffMember(row.email)
            },
            {
                label: 'Deactivate',
                type: 'danger',
                handler: (row) => toggleStaffStatus(row.email)
            }
        ]
    );
    
    // Add status styling
    const rows = table.querySelectorAll('tbody tr');
    rows.forEach((row, index) => {
        const member = staff[index];
        const statusCell = row.cells[5]; // Status column
        
        if (member.status === 'active') {
            statusCell.innerHTML = '<span class="status-badge status-completed">✅ Active</span>';
        } else {
            statusCell.innerHTML = '<span class="status-badge status-critical">❌ Inactive</span>';
        }
    });
    
    container.innerHTML = '';
    container.appendChild(table);
}

function displayDepartments(departments = currentDepartments) {
    const container = document.getElementById('departmentsTable');
    
    if (departments.length === 0) {
        container.innerHTML = '<p>No departments found</p>';
        return;
    }
    
    const table = createTable(
        ['Name', 'Head', 'Location', 'Status', 'Actions'],
        departments.map(dept => ({
            name: dept.name,
            head: dept.head || 'N/A',
            location: dept.location || 'N/A',
            status: dept.status,
            actions: ''
        })),
        [
            {
                label: 'Edit',
                type: 'warning',
                handler: (row) => editDepartment(row.name)
            },
            {
                label: 'Deactivate',
                type: 'danger',
                handler: (row) => toggleDepartmentStatus(row.name)
            }
        ]
    );
    
    // Add status styling
    const rows = table.querySelectorAll('tbody tr');
    rows.forEach((row, index) => {
        const dept = departments[index];
        const statusCell = row.cells[3]; // Status column
        
        if (dept.status === 'active') {
            statusCell.innerHTML = '<span class="status-badge status-completed">✅ Active</span>';
        } else {
            statusCell.innerHTML = '<span class="status-badge status-critical">❌ Inactive</span>';
        }
    });
    
    container.innerHTML = '';
    container.appendChild(table);
}

function handleStaffSearch() {
    const searchTerm = document.getElementById('searchStaff').value.toLowerCase();
    
    const filteredStaff = currentStaff.filter(member =>
        member.name.toLowerCase().includes(searchTerm) ||
        member.email.toLowerCase().includes(searchTerm) ||
        member.department.toLowerCase().includes(searchTerm) ||
        (member.role && member.role.toLowerCase().includes(searchTerm))
    );
    
    displayStaff(filteredStaff);
}

function handleDepartmentSearch() {
    const searchTerm = document.getElementById('searchDepartments').value.toLowerCase();
    
    const filteredDepartments = currentDepartments.filter(dept =>
        dept.name.toLowerCase().includes(searchTerm) ||
        (dept.head && dept.head.toLowerCase().includes(searchTerm)) ||
        (dept.location && dept.location.toLowerCase().includes(searchTerm))
    );
    
    displayDepartments(filteredDepartments);
}

function openAddStaffModal() {
    // Clear form
    document.getElementById('addStaffForm').reset();
    
    // Show modal
    document.getElementById('addStaffModal').style.display = 'block';
}

function addStaffMember() {
    const name = document.getElementById('staffName').value;
    const email = document.getElementById('staffEmail').value;
    const department = document.getElementById('staffDepartment').value;
    const role = document.getElementById('staffRole').value;
    const contact = document.getElementById('staffContact').value;
    const status = document.getElementById('staffStatus').value;
    
    if (!name || !email || !department || !contact) {
        showAlert('Please fill in all required fields', 'error');
        return;
    }
    
    // Check if email already exists
    const existingStaff = currentStaff.find(s => s.email === email);
    if (existingStaff) {
        showAlert('Staff member with this email already exists', 'error');
        return;
    }
    
    const staffMember = {
        id: generateId(),
        name: name,
        email: email,
        department: department,
        role: role,
        contact: contact,
        status: status,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
    };
    
    currentStaff.push(staffMember);
    saveAdminData();
    
    closeAddStaffModal();
    displayStaff();
    updateSystemStats();
    
    showAlert('Staff member added successfully!', 'success');
}

function openAddDepartmentModal() {
    // Clear form
    document.getElementById('addDepartmentForm').reset();
    
    // Show modal
    document.getElementById('addDepartmentModal').style.display = 'block';
}

function addDepartment() {
    const name = document.getElementById('departmentName').value;
    const head = document.getElementById('departmentHead').value;
    const description = document.getElementById('departmentDescription').value;
    const location = document.getElementById('departmentLocation').value;
    const status = document.getElementById('departmentStatus').value;
    
    if (!name) {
        showAlert('Please enter department name', 'error');
        return;
    }
    
    // Check if department already exists
    const existingDept = currentDepartments.find(d => d.name.toLowerCase() === name.toLowerCase());
    if (existingDept) {
        showAlert('Department with this name already exists', 'error');
        return;
    }
    
    const department = {
        id: generateId(),
        name: name,
        head: head,
        description: description,
        location: location,
        status: status,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
    };
    
    currentDepartments.push(department);
    saveAdminData();
    
    closeAddDepartmentModal();
    displayDepartments();
    updateSystemStats();
    
    showAlert('Department added successfully!', 'success');
}

function editStaffMember(email) {
    const member = currentStaff.find(s => s.email === email);
    if (!member) return;
    
    // Populate form with existing data
    document.getElementById('staffName').value = member.name;
    document.getElementById('staffEmail').value = member.email;
    document.getElementById('staffDepartment').value = member.department;
    document.getElementById('staffRole').value = member.role || '';
    document.getElementById('staffContact').value = member.contact;
    document.getElementById('staffStatus').value = member.status;
    
    // Show modal
    document.getElementById('addStaffModal').style.display = 'block';
}

function editDepartment(name) {
    const dept = currentDepartments.find(d => d.name === name);
    if (!dept) return;
    
    // Populate form with existing data
    document.getElementById('departmentName').value = dept.name;
    document.getElementById('departmentHead').value = dept.head || '';
    document.getElementById('departmentDescription').value = dept.description || '';
    document.getElementById('departmentLocation').value = dept.location || '';
    document.getElementById('departmentStatus').value = dept.status;
    
    // Show modal
    document.getElementById('addDepartmentModal').style.display = 'block';
}

function toggleStaffStatus(email) {
    const member = currentStaff.find(s => s.email === email);
    if (!member) return;
    
    const newStatus = member.status === 'active' ? 'inactive' : 'active';
    const action = newStatus === 'active' ? 'activate' : 'deactivate';
    
    if (confirm(`Are you sure you want to ${action} this staff member?`)) {
        member.status = newStatus;
        member.updatedAt = new Date().toISOString();
        
        saveAdminData();
        displayStaff();
        updateSystemStats();
        
        showAlert(`Staff member ${action}d successfully!`, 'success');
    }
}

function toggleDepartmentStatus(name) {
    const dept = currentDepartments.find(d => d.name === name);
    if (!dept) return;
    
    const newStatus = dept.status === 'active' ? 'inactive' : 'active';
    const action = newStatus === 'active' ? 'activate' : 'deactivate';
    
    if (confirm(`Are you sure you want to ${action} this department?`)) {
        dept.status = newStatus;
        dept.updatedAt = new Date().toISOString();
        
        saveAdminData();
        displayDepartments();
        updateSystemStats();
        
        showAlert(`Department ${action}d successfully!`, 'success');
    }
}

function handleSystemSettings(e) {
    e.preventDefault();
    
    const settings = {
        hospitalName: document.getElementById('hospitalName').value,
        systemTheme: document.getElementById('systemTheme').value,
        backupFrequency: document.getElementById('backupFrequency').value,
        sessionTimeout: parseInt(document.getElementById('sessionTimeout').value),
        enableNotifications: document.getElementById('enableNotifications').checked,
        enableAuditLog: document.getElementById('enableAuditLog').checked
    };
    
    // Save settings to localStorage
    localStorage.setItem('systemSettings', JSON.stringify(settings));
    
    showAlert('System settings saved successfully!', 'success');
}

function loadSystemSettings() {
    const settings = JSON.parse(localStorage.getItem('systemSettings') || '{}');
    
    if (settings.hospitalName) {
        document.getElementById('hospitalName').value = settings.hospitalName;
    }
    if (settings.systemTheme) {
        document.getElementById('systemTheme').value = settings.systemTheme;
    }
    if (settings.backupFrequency) {
        document.getElementById('backupFrequency').value = settings.backupFrequency;
    }
    if (settings.sessionTimeout) {
        document.getElementById('sessionTimeout').value = settings.sessionTimeout;
    }
    if (settings.enableNotifications !== undefined) {
        document.getElementById('enableNotifications').checked = settings.enableNotifications;
    }
    if (settings.enableAuditLog !== undefined) {
        document.getElementById('enableAuditLog').checked = settings.enableAuditLog;
    }
}

function exportAllData() {
    const hospitalData = getHospitalData();
    const filename = `hospital_data_export_${new Date().toISOString().split('T')[0]}.json`;
    exportToJSON(hospitalData, filename);
    
    showAlert('All data exported successfully!', 'success');
}

function createBackup() {
    const hospitalData = getHospitalData();
    const backup = {
        timestamp: new Date().toISOString(),
        data: hospitalData,
        version: '1.0'
    };
    
    const filename = `hospital_backup_${new Date().toISOString().split('T')[0]}.json`;
    exportToJSON(backup, filename);
    
    showAlert('Backup created successfully!', 'success');
}

function clearOldData() {
    if (!confirm('Are you sure you want to clear old data? This action cannot be undone.')) {
        return;
    }
    
    const hospitalData = getHospitalData();
    const cutoffDate = new Date();
    cutoffDate.setFullYear(cutoffDate.getFullYear() - 2); // 2 years ago
    
    // Clear old completed consultations
    if (hospitalData.consultations) {
        hospitalData.consultations = hospitalData.consultations.filter(c => 
            new Date(c.createdAt) > cutoffDate || c.status !== 'completed'
        );
    }
    
    // Clear old completed lab results
    if (hospitalData.labResults) {
        hospitalData.labResults = hospitalData.labResults.filter(l => 
            new Date(l.completedAt) > cutoffDate
        );
    }
    
    // Clear old completed appointments
    if (hospitalData.appointments) {
        hospitalData.appointments = hospitalData.appointments.filter(a => 
            new Date(a.createdAt) > cutoffDate || a.status !== 'completed'
        );
    }
    
    saveHospitalData(hospitalData);
    
    showAlert('Old data cleared successfully!', 'success');
}

function resetSystem() {
    if (!confirm('Are you sure you want to reset the entire system? This will delete ALL data and cannot be undone.')) {
        return;
    }
    
    if (!confirm('This is your final warning. All data will be permanently deleted. Are you absolutely sure?')) {
        return;
    }
    
    // Clear all data
    localStorage.removeItem('hospitalData');
    localStorage.removeItem('currentUser');
    localStorage.removeItem('systemSettings');
    
    showAlert('System reset successfully. Redirecting to login...', 'success');
    
    setTimeout(() => {
        window.location.href = 'login.html';
    }, 2000);
}

function closeAddStaffModal() {
    document.getElementById('addStaffModal').style.display = 'none';
}

function closeAddDepartmentModal() {
    document.getElementById('addDepartmentModal').style.display = 'none';
}

function closeModal(modalId) {
    document.getElementById(modalId).style.display = 'none';
}

function saveAdminData() {
    const hospitalData = getHospitalData();
    hospitalData.users = currentStaff;
    hospitalData.departments = currentDepartments;
    saveHospitalData(hospitalData);
}
