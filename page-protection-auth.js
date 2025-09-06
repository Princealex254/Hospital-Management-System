// Prince Alex Hospital - Page Protection with Firebase Auth

document.addEventListener('DOMContentLoaded', function() {
    // Wait for Firebase and Auth system to initialize
    const checkFirebase = setInterval(() => {
        if (window.firebaseDb && window.firebaseAuth && window.FirebaseAuth) {
            clearInterval(checkFirebase);
            initializePage();
        }
    }, 100);
});

function initializePage() {
    // Get current page name
    const currentPage = getCurrentPageName();
    
    // Initialize page with RBAC protection
    const user = window.FirebaseAuth.PageAccessControl.initializePage(currentPage);
    
    if (user) {
        // Add logout functionality
        addLogoutButton();
        
        // Initialize page-specific functionality
        if (typeof initPage === 'function') {
            initPage(user);
        }
        
        // Set up permission-based UI
        setupPermissionBasedUI(user);
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
                window.FirebaseAuth.AuthManager.logout();
            }
        };
        
        sidebar.appendChild(logoutBtn);
    }
}

function setupPermissionBasedUI(user) {
    // Hide/show elements based on permissions
    const elementsToHide = document.querySelectorAll('[data-permission]');
    elementsToHide.forEach(element => {
        const requiredPermission = element.getAttribute('data-permission');
        if (!window.FirebaseAuth.PermissionManager.hasPermission(user, requiredPermission)) {
            element.style.display = 'none';
        }
    });
    
    // Disable buttons based on permissions
    const buttonsToDisable = document.querySelectorAll('[data-permission-button]');
    buttonsToDisable.forEach(button => {
        const requiredPermission = button.getAttribute('data-permission-button');
        if (!window.FirebaseAuth.PermissionManager.hasPermission(user, requiredPermission)) {
            button.disabled = true;
            button.title = 'You do not have permission to perform this action';
        }
    });
    
    // Show role-specific content
    const roleElements = document.querySelectorAll('[data-role]');
    roleElements.forEach(element => {
        const allowedRoles = element.getAttribute('data-role').split(',');
        if (!allowedRoles.includes(user.role)) {
            element.style.display = 'none';
        }
    });
}

// Permission check helper function
function checkPermission(permission) {
    const user = window.FirebaseAuth.AuthManager.getCurrentUser();
    return window.FirebaseAuth.PermissionManager.hasPermission(user, permission);
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
