// Prince Alex Hospital - Dashboard Logic (Firebase Integrated)

import { 
    DashboardService, 
    AuthService, 
    showAlert 
} from './firebase-services.js';

document.addEventListener('DOMContentLoaded', async function() {
    try {
        const currentUser = await AuthService.getCurrentUser();
        if (!currentUser) {
            window.location.href = 'login.html';
            return;
        }
        
        await loadDashboardData();
        updateUserInfo(currentUser);
        
    } catch (error) {
        console.error('Error initializing dashboard:', error);
        showAlert('Error loading dashboard data. Please refresh the page.', 'error');
    }
});

async function loadDashboardData() {
    try {
        showAlert('Loading dashboard data...', 'info');
        
        // Get dashboard statistics from Firebase
        const stats = await DashboardService.getDashboardStats();
        displayStats(stats);
        
        // Load recent activities
        const activities = await DashboardService.getRecentActivities();
        displayRecentActivities(activities);
        
        // Load today's schedule (placeholder for now)
        const schedule = getTodaySchedule();
        displayTodaySchedule(schedule);
        
        showAlert('Dashboard loaded successfully', 'success');
        
    } catch (error) {
        console.error('Error loading dashboard data:', error);
        showAlert('Error loading dashboard data. Please try again.', 'error');
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

function calculateStats(data) {
    const today = new Date().toDateString();
    
    return {
        totalPatients: data.patients.length,
        totalDoctors: data.doctors.length,
        todayAppointments: data.appointments.filter(apt => 
            new Date(apt.date).toDateString() === today
        ).length,
        pendingTriage: data.triage.filter(t => t.status === 'pending').length,
        pendingLabRequests: data.labRequests.filter(lr => lr.status === 'pending').length,
        pendingPrescriptions: data.prescriptions.filter(p => p.status === 'pending').length,
        totalRevenue: data.billing.reduce((sum, bill) => sum + (bill.amount || 0), 0)
    };
}

function displayStats(stats) {
    const statsGrid = document.getElementById('statsGrid');
    statsGrid.innerHTML = '';
    
    const statCards = [
        { number: stats.totalPatients, label: 'Total Patients', icon: '👥' },
        { number: stats.totalDoctors, label: 'Active Doctors', icon: '👨‍⚕️' },
        { number: stats.todayAppointments, label: 'Today\'s Appointments', icon: '📅' },
        { number: stats.pendingTriage, label: 'Pending Triage', icon: '🚨' },
        { number: stats.pendingLabRequests, label: 'Lab Requests', icon: '🧪' },
        { number: stats.pendingPrescriptions, label: 'Prescriptions', icon: '💊' },
        { number: `$${stats.totalRevenue.toLocaleString()}`, label: 'Total Revenue', icon: '💰' }
    ];
    
    statCards.forEach(stat => {
        const card = createStatsCard(stat.number, stat.label, stat.icon);
        statsGrid.appendChild(card);
    });
}

function getRecentActivities(data) {
    const activities = [];
    
    // Recent patients
    data.patients.slice(-5).forEach(patient => {
        activities.push({
            type: 'patient',
            message: `New patient registered: ${patient.name}`,
            time: patient.createdAt || new Date().toISOString(),
            icon: '👥'
        });
    });
    
    // Recent appointments
    data.appointments.slice(-5).forEach(appointment => {
        activities.push({
            type: 'appointment',
            message: `Appointment scheduled: ${appointment.patientName} with Dr. ${appointment.doctorName}`,
            time: appointment.createdAt || new Date().toISOString(),
            icon: '📅'
        });
    });
    
    // Recent triage
    data.triage.slice(-5).forEach(triage => {
        activities.push({
            type: 'triage',
            message: `Patient triaged: ${triage.patientName} - ${triage.urgencyLevel}`,
            time: triage.createdAt || new Date().toISOString(),
            icon: '🚨'
        });
    });
    
    // Sort by time and take most recent
    return activities
        .sort((a, b) => new Date(b.time) - new Date(a.time))
        .slice(0, 10);
}

function displayRecentActivities(activities) {
    const container = document.getElementById('recentActivities');
    
    if (activities.length === 0) {
        container.innerHTML = '<p>No recent activities</p>';
        return;
    }
    
    const activitiesList = document.createElement('div');
    activitiesList.className = 'activities-list';
    
    activities.forEach(activity => {
        const activityItem = document.createElement('div');
        activityItem.className = 'activity-item';
        activityItem.style.cssText = `
            display: flex;
            align-items: center;
            padding: 10px 0;
            border-bottom: 1px solid #e1e8ed;
        `;
        
        activityItem.innerHTML = `
            <span style="font-size: 1.5em; margin-right: 15px;">${activity.icon}</span>
            <div style="flex: 1;">
                <div style="font-weight: 600; color: #2c3e50;">${activity.message}</div>
                <div style="font-size: 0.9em; color: #7f8c8d;">${formatDate(activity.time)}</div>
            </div>
        `;
        
        activitiesList.appendChild(activityItem);
    });
    
    container.innerHTML = '';
    container.appendChild(activitiesList);
}

function getTodaySchedule(data) {
    const today = new Date().toDateString();
    
    return data.appointments.filter(appointment => 
        new Date(appointment.date).toDateString() === today
    ).sort((a, b) => new Date(a.time) - new Date(b.time));
}

function displayTodaySchedule(schedule) {
    const container = document.getElementById('todaySchedule');
    
    if (schedule.length === 0) {
        container.innerHTML = '<p>No appointments scheduled for today</p>';
        return;
    }
    
    const scheduleTable = document.createElement('table');
    scheduleTable.className = 'table';
    
    const thead = document.createElement('thead');
    thead.innerHTML = `
        <tr>
            <th>Time</th>
            <th>Patient</th>
            <th>Doctor</th>
            <th>Department</th>
            <th>Status</th>
        </tr>
    `;
    scheduleTable.appendChild(thead);
    
    const tbody = document.createElement('tbody');
    schedule.forEach(appointment => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${new Date(appointment.time).toLocaleTimeString()}</td>
            <td>${appointment.patientName}</td>
            <td>${appointment.doctorName}</td>
            <td>${appointment.department}</td>
            <td><span class="status-badge status-${appointment.status || 'pending'}">${appointment.status || 'Pending'}</span></td>
        `;
        tbody.appendChild(row);
    });
    
    scheduleTable.appendChild(tbody);
    container.innerHTML = '';
    container.appendChild(scheduleTable);
}
