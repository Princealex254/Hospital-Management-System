// Prince Alex Hospital - Reports & Analytics Logic

let currentReportData = {};
let currentReportType = 'overview';
let currentReportPeriod = 'month';

document.addEventListener('DOMContentLoaded', function() {
    const currentUser = initPage();
    if (!currentUser) return;
    
    setupEventListeners();
    generateReport();
});

function setupEventListeners() {
    // Report period change
    const reportPeriod = document.getElementById('reportPeriod');
    if (reportPeriod) {
        reportPeriod.addEventListener('change', function() {
            const customRange = document.getElementById('customDateRange');
            if (this.value === 'custom') {
                customRange.style.display = 'block';
            } else {
                customRange.style.display = 'none';
            }
        });
    }
    
    // Set default end date to today
    const endDate = document.getElementById('endDate');
    if (endDate) {
        endDate.value = new Date().toISOString().split('T')[0];
    }
}

function generateReport() {
    const reportType = document.getElementById('reportType').value;
    const reportPeriod = document.getElementById('reportPeriod').value;
    
    currentReportType = reportType;
    currentReportPeriod = reportPeriod;
    
    // Get date range
    const dateRange = getDateRange(reportPeriod);
    
    // Load and filter data
    const hospitalData = getHospitalData();
    currentReportData = filterDataByDateRange(hospitalData, dateRange);
    
    // Generate report based on type
    switch (reportType) {
        case 'overview':
            generateOverviewReport();
            break;
        case 'patients':
            generatePatientReport();
            break;
        case 'revenue':
            generateRevenueReport();
            break;
        case 'lab':
            generateLabReport();
            break;
        case 'pharmacy':
            generatePharmacyReport();
            break;
        case 'appointments':
            generateAppointmentReport();
            break;
    }
    
    updateKPIs();
}

function getDateRange(period) {
    const today = new Date();
    const startDate = new Date();
    
    switch (period) {
        case 'today':
            startDate.setHours(0, 0, 0, 0);
            return { start: startDate, end: today };
        case 'week':
            startDate.setDate(today.getDate() - 7);
            return { start: startDate, end: today };
        case 'month':
            startDate.setMonth(today.getMonth() - 1);
            return { start: startDate, end: today };
        case 'quarter':
            startDate.setMonth(today.getMonth() - 3);
            return { start: startDate, end: today };
        case 'year':
            startDate.setFullYear(today.getFullYear() - 1);
            return { start: startDate, end: today };
        case 'custom':
            const customStart = document.getElementById('startDate').value;
            const customEnd = document.getElementById('endDate').value;
            return { 
                start: customStart ? new Date(customStart) : startDate, 
                end: customEnd ? new Date(customEnd) : today 
            };
        default:
            return { start: startDate, end: today };
    }
}

function filterDataByDateRange(hospitalData, dateRange) {
    const filteredData = {};
    
    // Filter each data type
    Object.keys(hospitalData).forEach(key => {
        if (Array.isArray(hospitalData[key])) {
            filteredData[key] = hospitalData[key].filter(item => {
                const itemDate = new Date(item.createdAt || item.date || item.appointmentDate || item.billDate);
                return itemDate >= dateRange.start && itemDate <= dateRange.end;
            });
        } else {
            filteredData[key] = hospitalData[key];
        }
    });
    
    return filteredData;
}

function generateOverviewReport() {
    const container = document.getElementById('reportResults');
    
    const stats = {
        totalPatients: currentReportData.patients?.length || 0,
        totalAppointments: currentReportData.appointments?.length || 0,
        totalBills: currentReportData.billing?.length || 0,
        totalRevenue: currentReportData.billing?.reduce((sum, bill) => 
            bill.status === 'paid' ? sum + bill.totalAmount : sum, 0) || 0,
        completedConsultations: currentReportData.consultations?.filter(c => c.status === 'completed').length || 0,
        labTestsCompleted: currentReportData.labResults?.filter(l => l.status === 'completed').length || 0,
        prescriptionsDispensed: currentReportData.prescriptions?.filter(p => p.status === 'dispensed').length || 0
    };
    
    container.innerHTML = `
        <h3>Hospital Overview Report</h3>
        <div class="stats-grid">
            <div class="stat-card">
                <div class="stat-number">${stats.totalPatients}</div>
                <div class="stat-label">New Patients</div>
            </div>
            <div class="stat-card">
                <div class="stat-number">${stats.totalAppointments}</div>
                <div class="stat-label">Appointments</div>
            </div>
            <div class="stat-card">
                <div class="stat-number">${stats.completedConsultations}</div>
                <div class="stat-label">Consultations</div>
            </div>
            <div class="stat-card">
                <div class="stat-number">${stats.labTestsCompleted}</div>
                <div class="stat-label">Lab Tests</div>
            </div>
            <div class="stat-card">
                <div class="stat-number">${stats.prescriptionsDispensed}</div>
                <div class="stat-label">Prescriptions</div>
            </div>
            <div class="stat-card">
                <div class="stat-number">$${stats.totalRevenue.toLocaleString()}</div>
                <div class="stat-label">Revenue</div>
            </div>
        </div>
        
        <h4>Recent Activity Summary</h4>
        <p>This report covers the period from ${getDateRange(currentReportPeriod).start.toLocaleDateString()} to ${getDateRange(currentReportPeriod).end.toLocaleDateString()}.</p>
    `;
}

function generatePatientReport() {
    const container = document.getElementById('reportResults');
    const patients = currentReportData.patients || [];
    
    const ageGroups = {
        '0-18': patients.filter(p => p.age <= 18).length,
        '19-35': patients.filter(p => p.age >= 19 && p.age <= 35).length,
        '36-55': patients.filter(p => p.age >= 36 && p.age <= 55).length,
        '56-70': patients.filter(p => p.age >= 56 && p.age <= 70).length,
        '70+': patients.filter(p => p.age > 70).length
    };
    
    const genderDistribution = {
        'Male': patients.filter(p => p.gender === 'Male').length,
        'Female': patients.filter(p => p.gender === 'Female').length,
        'Other': patients.filter(p => p.gender === 'Other').length
    };
    
    container.innerHTML = `
        <h3>Patient Statistics Report</h3>
        
        <h4>Age Distribution</h4>
        <table class="table">
            <thead>
                <tr><th>Age Group</th><th>Count</th><th>Percentage</th></tr>
            </thead>
            <tbody>
                ${Object.entries(ageGroups).map(([group, count]) => `
                    <tr>
                        <td>${group}</td>
                        <td>${count}</td>
                        <td>${patients.length > 0 ? ((count / patients.length) * 100).toFixed(1) : 0}%</td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
        
        <h4>Gender Distribution</h4>
        <table class="table">
            <thead>
                <tr><th>Gender</th><th>Count</th><th>Percentage</th></tr>
            </thead>
            <tbody>
                ${Object.entries(genderDistribution).map(([gender, count]) => `
                    <tr>
                        <td>${gender}</td>
                        <td>${count}</td>
                        <td>${patients.length > 0 ? ((count / patients.length) * 100).toFixed(1) : 0}%</td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
        
        <h4>Patient Demographics</h4>
        <p><strong>Total Patients:</strong> ${patients.length}</p>
        <p><strong>Average Age:</strong> ${patients.length > 0 ? (patients.reduce((sum, p) => sum + p.age, 0) / patients.length).toFixed(1) : 0} years</p>
    `;
}

function generateRevenueReport() {
    const container = document.getElementById('reportResults');
    const bills = currentReportData.billing || [];
    
    const paidBills = bills.filter(b => b.status === 'paid');
    const pendingBills = bills.filter(b => b.status === 'pending');
    
    const revenueByType = {};
    bills.forEach(bill => {
        if (!revenueByType[bill.billType]) {
            revenueByType[bill.billType] = 0;
        }
        revenueByType[bill.billType] += bill.totalAmount;
    });
    
    const totalRevenue = bills.reduce((sum, bill) => sum + bill.totalAmount, 0);
    const paidRevenue = paidBills.reduce((sum, bill) => sum + bill.totalAmount, 0);
    const pendingRevenue = pendingBills.reduce((sum, bill) => sum + bill.totalAmount, 0);
    
    container.innerHTML = `
        <h3>Revenue Analysis Report</h3>
        
        <div class="stats-grid">
            <div class="stat-card">
                <div class="stat-number">$${totalRevenue.toLocaleString()}</div>
                <div class="stat-label">Total Revenue</div>
            </div>
            <div class="stat-card">
                <div class="stat-number">$${paidRevenue.toLocaleString()}</div>
                <div class="stat-label">Paid Revenue</div>
            </div>
            <div class="stat-card">
                <div class="stat-number">$${pendingRevenue.toLocaleString()}</div>
                <div class="stat-label">Pending Revenue</div>
            </div>
            <div class="stat-card">
                <div class="stat-number">${bills.length}</div>
                <div class="stat-label">Total Bills</div>
            </div>
        </div>
        
        <h4>Revenue by Bill Type</h4>
        <table class="table">
            <thead>
                <tr><th>Bill Type</th><th>Amount</th><th>Percentage</th></tr>
            </thead>
            <tbody>
                ${Object.entries(revenueByType).map(([type, amount]) => `
                    <tr>
                        <td>${type}</td>
                        <td>$${amount.toLocaleString()}</td>
                        <td>${totalRevenue > 0 ? ((amount / totalRevenue) * 100).toFixed(1) : 0}%</td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
        
        <h4>Payment Status</h4>
        <p><strong>Paid Bills:</strong> ${paidBills.length} (${bills.length > 0 ? ((paidBills.length / bills.length) * 100).toFixed(1) : 0}%)</p>
        <p><strong>Pending Bills:</strong> ${pendingBills.length} (${bills.length > 0 ? ((pendingBills.length / bills.length) * 100).toFixed(1) : 0}%)</p>
    `;
}

function generateLabReport() {
    const container = document.getElementById('reportResults');
    const labRequests = currentReportData.labRequests || [];
    const labResults = currentReportData.labResults || [];
    
    const testsByType = {};
    labRequests.forEach(request => {
        if (!testsByType[request.testType]) {
            testsByType[request.testType] = { requested: 0, completed: 0 };
        }
        testsByType[request.testType].requested++;
    });
    
    labResults.forEach(result => {
        if (!testsByType[result.testType]) {
            testsByType[result.testType] = { requested: 0, completed: 0 };
        }
        testsByType[result.testType].completed++;
    });
    
    const priorityDistribution = {
        'Critical': labRequests.filter(r => r.priority === 'Critical').length,
        'Urgent': labRequests.filter(r => r.priority === 'Urgent').length,
        'Routine': labRequests.filter(r => r.priority === 'Routine').length
    };
    
    container.innerHTML = `
        <h3>Laboratory Report</h3>
        
        <div class="stats-grid">
            <div class="stat-card">
                <div class="stat-number">${labRequests.length}</div>
                <div class="stat-label">Lab Requests</div>
            </div>
            <div class="stat-card">
                <div class="stat-number">${labResults.length}</div>
                <div class="stat-label">Completed Tests</div>
            </div>
            <div class="stat-card">
                <div class="stat-number">${labRequests.length > 0 ? ((labResults.length / labRequests.length) * 100).toFixed(1) : 0}%</div>
                <div class="stat-label">Completion Rate</div>
            </div>
        </div>
        
        <h4>Tests by Type</h4>
        <table class="table">
            <thead>
                <tr><th>Test Type</th><th>Requested</th><th>Completed</th><th>Completion Rate</th></tr>
            </thead>
            <tbody>
                ${Object.entries(testsByType).map(([type, data]) => `
                    <tr>
                        <td>${type}</td>
                        <td>${data.requested}</td>
                        <td>${data.completed}</td>
                        <td>${data.requested > 0 ? ((data.completed / data.requested) * 100).toFixed(1) : 0}%</td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
        
        <h4>Priority Distribution</h4>
        <table class="table">
            <thead>
                <tr><th>Priority</th><th>Count</th><th>Percentage</th></tr>
            </thead>
            <tbody>
                ${Object.entries(priorityDistribution).map(([priority, count]) => `
                    <tr>
                        <td>${priority}</td>
                        <td>${count}</td>
                        <td>${labRequests.length > 0 ? ((count / labRequests.length) * 100).toFixed(1) : 0}%</td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    `;
}

function generatePharmacyReport() {
    const container = document.getElementById('reportResults');
    const prescriptions = currentReportData.prescriptions || [];
    const medicines = currentReportData.medicines || [];
    
    const prescriptionsByStatus = {
        'Pending': prescriptions.filter(p => p.status === 'pending').length,
        'Dispensed': prescriptions.filter(p => p.status === 'dispensed').length,
        'Completed': prescriptions.filter(p => p.status === 'completed').length
    };
    
    const medicineUsage = {};
    prescriptions.forEach(prescription => {
        if (!medicineUsage[prescription.medicationName]) {
            medicineUsage[prescription.medicationName] = 0;
        }
        medicineUsage[prescription.medicationName]++;
    });
    
    const lowStockMedicines = medicines.filter(m => m.quantity <= m.minStock);
    const outOfStockMedicines = medicines.filter(m => m.quantity === 0);
    
    container.innerHTML = `
        <h3>Pharmacy Report</h3>
        
        <div class="stats-grid">
            <div class="stat-card">
                <div class="stat-number">${prescriptions.length}</div>
                <div class="stat-label">Total Prescriptions</div>
            </div>
            <div class="stat-card">
                <div class="stat-number">${prescriptionsByStatus.Dispensed}</div>
                <div class="stat-label">Dispensed</div>
            </div>
            <div class="stat-card">
                <div class="stat-number">${lowStockMedicines.length}</div>
                <div class="stat-label">Low Stock Items</div>
            </div>
            <div class="stat-card">
                <div class="stat-number">${outOfStockMedicines.length}</div>
                <div class="stat-label">Out of Stock</div>
            </div>
        </div>
        
        <h4>Prescription Status</h4>
        <table class="table">
            <thead>
                <tr><th>Status</th><th>Count</th><th>Percentage</th></tr>
            </thead>
            <tbody>
                ${Object.entries(prescriptionsByStatus).map(([status, count]) => `
                    <tr>
                        <td>${status}</td>
                        <td>${count}</td>
                        <td>${prescriptions.length > 0 ? ((count / prescriptions.length) * 100).toFixed(1) : 0}%</td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
        
        <h4>Most Prescribed Medicines</h4>
        <table class="table">
            <thead>
                <tr><th>Medicine</th><th>Prescriptions</th></tr>
            </thead>
            <tbody>
                ${Object.entries(medicineUsage)
                    .sort(([,a], [,b]) => b - a)
                    .slice(0, 10)
                    .map(([medicine, count]) => `
                        <tr>
                            <td>${medicine}</td>
                            <td>${count}</td>
                        </tr>
                    `).join('')}
            </tbody>
        </table>
        
        ${lowStockMedicines.length > 0 ? `
            <h4>Low Stock Alert</h4>
            <div class="alert alert-warning">
                <strong>Warning:</strong> ${lowStockMedicines.length} medicines are running low on stock.
                <ul>
                    ${lowStockMedicines.map(medicine => `<li>${medicine.name} - ${medicine.quantity} remaining</li>`).join('')}
                </ul>
            </div>
        ` : ''}
    `;
}

function generateAppointmentReport() {
    const container = document.getElementById('reportResults');
    const appointments = currentReportData.appointments || [];
    
    const appointmentsByStatus = {
        'Scheduled': appointments.filter(a => a.status === 'scheduled').length,
        'Confirmed': appointments.filter(a => a.status === 'confirmed').length,
        'Completed': appointments.filter(a => a.status === 'completed').length,
        'Cancelled': appointments.filter(a => a.status === 'cancelled').length,
        'No Show': appointments.filter(a => a.status === 'no-show').length
    };
    
    const appointmentsByType = {};
    appointments.forEach(appointment => {
        if (!appointmentsByType[appointment.appointmentType]) {
            appointmentsByType[appointment.appointmentType] = 0;
        }
        appointmentsByType[appointment.appointmentType]++;
    });
    
    const appointmentsByDepartment = {};
    appointments.forEach(appointment => {
        if (!appointmentsByDepartment[appointment.department]) {
            appointmentsByDepartment[appointment.department] = 0;
        }
        appointmentsByDepartment[appointment.department]++;
    });
    
    container.innerHTML = `
        <h3>Appointment Report</h3>
        
        <div class="stats-grid">
            <div class="stat-card">
                <div class="stat-number">${appointments.length}</div>
                <div class="stat-label">Total Appointments</div>
            </div>
            <div class="stat-card">
                <div class="stat-number">${appointmentsByStatus.Completed}</div>
                <div class="stat-label">Completed</div>
            </div>
            <div class="stat-card">
                <div class="stat-number">${appointmentsByStatus.Cancelled}</div>
                <div class="stat-label">Cancelled</div>
            </div>
            <div class="stat-card">
                <div class="stat-number">${appointmentsByStatus['No Show']}</div>
                <div class="stat-label">No Shows</div>
            </div>
        </div>
        
        <h4>Appointments by Status</h4>
        <table class="table">
            <thead>
                <tr><th>Status</th><th>Count</th><th>Percentage</th></tr>
            </thead>
            <tbody>
                ${Object.entries(appointmentsByStatus).map(([status, count]) => `
                    <tr>
                        <td>${status}</td>
                        <td>${count}</td>
                        <td>${appointments.length > 0 ? ((count / appointments.length) * 100).toFixed(1) : 0}%</td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
        
        <h4>Appointments by Type</h4>
        <table class="table">
            <thead>
                <tr><th>Type</th><th>Count</th><th>Percentage</th></tr>
            </thead>
            <tbody>
                ${Object.entries(appointmentsByType).map(([type, count]) => `
                    <tr>
                        <td>${type}</td>
                        <td>${count}</td>
                        <td>${appointments.length > 0 ? ((count / appointments.length) * 100).toFixed(1) : 0}%</td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
        
        <h4>Appointments by Department</h4>
        <table class="table">
            <thead>
                <tr><th>Department</th><th>Count</th><th>Percentage</th></tr>
            </thead>
            <tbody>
                ${Object.entries(appointmentsByDepartment).map(([department, count]) => `
                    <tr>
                        <td>${department}</td>
                        <td>${count}</td>
                        <td>${appointments.length > 0 ? ((count / appointments.length) * 100).toFixed(1) : 0}%</td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    `;
}

function updateKPIs() {
    const container = document.getElementById('kpiGrid');
    
    const kpis = {
        'Patient Satisfaction': '95%',
        'Average Wait Time': '15 min',
        'Bed Occupancy': '78%',
        'Revenue Growth': '+12%',
        'Staff Efficiency': '92%',
        'Emergency Response': '8 min'
    };
    
    container.innerHTML = Object.entries(kpis).map(([label, value]) => `
        <div class="stat-card">
            <div class="stat-number">${value}</div>
            <div class="stat-label">${label}</div>
        </div>
    `).join('');
}

function exportReport() {
    const reportData = {
        reportType: currentReportType,
        reportPeriod: currentReportPeriod,
        generatedAt: new Date().toISOString(),
        data: currentReportData
    };
    
    const filename = `hospital_report_${currentReportType}_${currentReportPeriod}_${new Date().toISOString().split('T')[0]}.json`;
    exportToJSON(reportData, filename);
    
    showAlert('Report exported successfully!', 'success');
}
