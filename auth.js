// Prince Alex Hospital - Authentication System

// Initialize localStorage data structure
function initializeStorage() {
    if (!localStorage.getItem('hospitalData')) {
        const initialData = {
            users: [],
            patients: [],
            doctors: [],
            appointments: [],
            triage: [],
            labRequests: [],
            labResults: [],
            prescriptions: [],
            medicines: [],
            billing: [],
            consultations: []
        };
        localStorage.setItem('hospitalData', JSON.stringify(initialData));
    }
}

// Get current user from localStorage
function getCurrentUser() {
    return JSON.parse(localStorage.getItem('currentUser') || 'null');
}

// Set current user in localStorage
function setCurrentUser(user) {
    localStorage.setItem('currentUser', JSON.stringify(user));
}

// Clear current user session
function clearSession() {
    localStorage.removeItem('currentUser');
}

// Role-based redirect mapping
const roleRedirects = {
    'Admin': 'admin.html',
    'Doctor': 'doctors.html',
    'Nurse': 'patients.html',
    'Pharmacy': 'pharmacy.html',
    'Lab': 'lab.html',
    'Triage': 'triage.html',
    'Reception': 'appointments.html'
};

// Login form handler
document.addEventListener('DOMContentLoaded', function() {
    initializeStorage();
    
    const loginForm = document.getElementById('loginForm');
    
    if (loginForm) {
        loginForm.addEventListener('submit', function(e) {
            e.preventDefault();
            
            const username = document.getElementById('username').value.trim();
            const department = document.getElementById('department').value;
            
            if (!username || !department) {
                alert('Please fill in all fields');
                return;
            }
            
            // Create user object
            const user = {
                username: username,
                department: department,
                loginTime: new Date().toISOString()
            };
            
            // Store user session
            setCurrentUser(user);
            
            // Redirect based on role
            const redirectUrl = roleRedirects[department] || 'index.html';
            window.location.href = redirectUrl;
        });
    }
});

// Logout function
function logout() {
    if (confirm('Are you sure you want to logout?')) {
        clearSession();
        window.location.href = 'login.html';
    }
}

// Check authentication and redirect if not logged in
function checkAuth() {
    const currentUser = getCurrentUser();
    if (!currentUser) {
        window.location.href = 'login.html';
        return false;
    }
    return currentUser;
}

// Get hospital data from localStorage
function getHospitalData() {
    return JSON.parse(localStorage.getItem('hospitalData') || '{}');
}

// Save hospital data to localStorage
function saveHospitalData(data) {
    localStorage.setItem('hospitalData', JSON.stringify(data));
}

// Generate unique ID
function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

// Format date for display
function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
}

// Show alert message
function showAlert(message, type = 'success') {
    const alertDiv = document.createElement('div');
    alertDiv.className = `alert alert-${type}`;
    alertDiv.textContent = message;
    
    const container = document.querySelector('.main-content') || document.body;
    container.insertBefore(alertDiv, container.firstChild);
    
    setTimeout(() => {
        alertDiv.remove();
    }, 5000);
}

// Initialize page with authentication check
function initPage() {
    const currentUser = checkAuth();
    if (!currentUser) return;
    
    // Update welcome message
    const welcomeElement = document.querySelector('.welcome-message');
    if (welcomeElement) {
        welcomeElement.textContent = `Welcome ${currentUser.username} – Department: ${currentUser.department}`;
    }
    
    // Update sidebar user info
    const userInfoElement = document.querySelector('.user-info');
    if (userInfoElement) {
        userInfoElement.innerHTML = `
            <h3>${currentUser.username}</h3>
            <p>${currentUser.department}</p>
        `;
    }
    
    return currentUser;
}
