// Prince Alex Hospital - Page Protection with RBAC

document.addEventListener('DOMContentLoaded', function() {
    // Wait for Firebase and RBAC to initialize
    const checkFirebase = setInterval(() => {
        if (window.firebaseDb && window.firebaseAuth && window.RBAC) {
            clearInterval(checkFirebase);
            initializePage();
        }
    }, 100);
});

function initializePage() {
    // Get current page name
    const currentPage = getCurrentPageName();
    
    // Initialize page with RBAC protection
    const user = window.RBAC.PageAccessControl.initializePage(currentPage);
    
    if (user) {
        // Add logout functionality
        addLogoutButton();
        
        // Initialize page-specific functionality
        if (typeof initPage === 'function') {
            initPage(user);
        }
    }
}

function getCurrentPageName() {
    const path = window.location.pathname;
    const page = path.split('/').pop();
    return page || 'index.html';
}

function addLogoutButton() {
    const sidebar = document.querySelector('.sidebar');
    if (sidebar) {
        // Remove existing logout button if any
        const existingLogout = sidebar.querySelector('.logout-btn');
        if (existingLogout) {
            existingLogout.remove();
        }
        
        // Add new logout button
        const logoutBtn = document.createElement('button');
        logoutBtn.className = 'logout-btn';
        logoutBtn.textContent = 'Logout';
        logoutBtn.onclick = () => {
            if (confirm('Are you sure you want to logout?')) {
                window.RBAC.AuthManager.logout();
            }
        };
        
        sidebar.appendChild(logoutBtn);
    }
}

// Permission check helper function
function checkPermission(permission) {
    const user = window.RBAC.AuthManager.getCurrentUser();
    return window.RBAC.PermissionManager.hasPermission(user, permission);
}

// Action permission wrapper
function requirePermission(permission, callback) {
    if (checkPermission(permission)) {
        return callback();
    } else {
        showAlert('You do not have permission to perform this action', 'error');
        return false;
    }
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

// Make functions globally available
window.checkPermission = checkPermission;
window.requirePermission = requirePermission;
window.showAlert = showAlert;
