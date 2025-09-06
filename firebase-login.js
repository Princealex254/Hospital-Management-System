// Prince Alex Hospital - Firebase Login with RBAC

document.addEventListener('DOMContentLoaded', function() {
    // Wait for Firebase and RBAC to initialize
    const checkFirebase = setInterval(() => {
        if (window.firebaseDb && window.firebaseAuth && window.RBAC) {
            clearInterval(checkFirebase);
            initializeLogin();
        }
    }, 100);
});

function initializeLogin() {
    const loginForm = document.getElementById('loginForm');
    
    if (loginForm) {
        loginForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            
            const username = document.getElementById('username').value.trim();
            const department = document.getElementById('department').value;
            
            if (!username || !department) {
                showAlert('Please fill in all fields', 'error');
                return;
            }
            
            try {
                // Show loading state
                const submitBtn = loginForm.querySelector('button[type="submit"]');
                const originalText = submitBtn.textContent;
                submitBtn.textContent = 'Logging in...';
                submitBtn.disabled = true;
                
                // Login with RBAC
                const user = await window.RBAC.AuthManager.login(username, department);
                
                // Redirect based on role
                window.RBAC.AuthManager.redirectBasedOnRole(user);
                
            } catch (error) {
                console.error('Login error:', error);
                showAlert('Login failed. Please try again.', 'error');
                
                // Reset button
                const submitBtn = loginForm.querySelector('button[type="submit"]');
                submitBtn.textContent = 'Login';
                submitBtn.disabled = false;
            }
        });
    }
}

// Show alert message
function showAlert(message, type = 'success') {
    const alertDiv = document.createElement('div');
    alertDiv.className = `alert alert-${type}`;
    alertDiv.textContent = message;
    
    const container = document.querySelector('.login-container') || document.body;
    container.insertBefore(alertDiv, container.firstChild);
    
    setTimeout(() => {
        alertDiv.remove();
    }, 5000);
}
