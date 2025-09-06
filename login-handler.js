// Prince Alex Hospital - Login Handler

document.addEventListener('DOMContentLoaded', function() {
    // Wait for Firebase and Auth system to initialize
    const checkFirebase = setInterval(() => {
        if (window.firebaseDb && window.firebaseAuth && window.FirebaseAuth) {
            clearInterval(checkFirebase);
            initializeLogin();
        }
    }, 100);
});

function initializeLogin() {
    // Check if user is already logged in
    const currentUser = window.FirebaseAuth.AuthManager.getCurrentUser();
    if (currentUser) {
        // Redirect to appropriate dashboard
        redirectToDashboard(currentUser);
        return;
    }
    
    // Set up form handlers
    setupLoginForm();
    setupRegisterForm();
    setupForgotPasswordForm();
    
    // Listen to auth state changes
    window.FirebaseAuth.AuthManager.onAuthStateChanged((user) => {
        if (user) {
            // User is signed in, fetch role and redirect
            fetchUserRoleAndRedirect(user);
        }
    });
}

function setupLoginForm() {
    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
        loginForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            
            const email = document.getElementById('email').value.trim();
            const password = document.getElementById('password').value;
            
            if (!email || !password) {
                showAlert('Please fill in all fields', 'error');
                return;
            }
            
            try {
                // Show loading state
                const submitBtn = loginForm.querySelector('button[type="submit"]');
                const originalText = submitBtn.textContent;
                submitBtn.textContent = 'Logging in...';
                submitBtn.disabled = true;
                
                // Login with Firebase Auth
                const userData = await window.FirebaseAuth.AuthManager.login(email, password);
                
                // Redirect to appropriate dashboard
                redirectToDashboard(userData);
                
            } catch (error) {
                console.error('Login error:', error);
                let errorMessage = 'Login failed. Please try again.';
                
                // Handle specific Firebase errors
                switch (error.code) {
                    case 'auth/user-not-found':
                        errorMessage = 'No account found with this email.';
                        break;
                    case 'auth/wrong-password':
                        errorMessage = 'Incorrect password.';
                        break;
                    case 'auth/invalid-email':
                        errorMessage = 'Invalid email address.';
                        break;
                    case 'auth/too-many-requests':
                        errorMessage = 'Too many failed attempts. Please try again later.';
                        break;
                    case 'auth/user-disabled':
                        errorMessage = 'This account has been disabled.';
                        break;
                }
                
                showAlert(errorMessage, 'error');
                
                // Reset button
                const submitBtn = loginForm.querySelector('button[type="submit"]');
                submitBtn.textContent = 'Login';
                submitBtn.disabled = false;
            }
        });
    }
}

function setupRegisterForm() {
    const registerForm = document.getElementById('registerForm');
    if (registerForm) {
        registerForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            
            const displayName = document.getElementById('regDisplayName').value.trim();
            const email = document.getElementById('regEmail').value.trim();
            const password = document.getElementById('regPassword').value;
            const confirmPassword = document.getElementById('regConfirmPassword').value;
            const role = document.getElementById('regRole').value;
            
            if (!displayName || !email || !password || !confirmPassword || !role) {
                showAlert('Please fill in all fields', 'error');
                return;
            }
            
            if (password !== confirmPassword) {
                showAlert('Passwords do not match', 'error');
                return;
            }
            
            if (password.length < 6) {
                showAlert('Password must be at least 6 characters long', 'error');
                return;
            }
            
            try {
                // Show loading state
                const submitBtn = registerForm.querySelector('button[type="submit"]');
                const originalText = submitBtn.textContent;
                submitBtn.textContent = 'Creating Account...';
                submitBtn.disabled = true;
                
                // Register with Firebase Auth
                const user = await window.FirebaseAuth.AuthManager.register(email, password, displayName, role);
                
                showAlert('Account created successfully! Please login.', 'success');
                showLoginForm();
                
            } catch (error) {
                console.error('Registration error:', error);
                let errorMessage = 'Registration failed. Please try again.';
                
                // Handle specific Firebase errors
                switch (error.code) {
                    case 'auth/email-already-in-use':
                        errorMessage = 'An account with this email already exists.';
                        break;
                    case 'auth/invalid-email':
                        errorMessage = 'Invalid email address.';
                        break;
                    case 'auth/weak-password':
                        errorMessage = 'Password is too weak.';
                        break;
                }
                
                showAlert(errorMessage, 'error');
                
                // Reset button
                const submitBtn = registerForm.querySelector('button[type="submit"]');
                submitBtn.textContent = 'Register';
                submitBtn.disabled = false;
            }
        });
    }
}

function setupForgotPasswordForm() {
    const forgotPasswordForm = document.getElementById('forgotPasswordForm');
    if (forgotPasswordForm) {
        forgotPasswordForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            
            const email = document.getElementById('resetEmail').value.trim();
            
            if (!email) {
                showAlert('Please enter your email address', 'error');
                return;
            }
            
            try {
                // Show loading state
                const submitBtn = forgotPasswordForm.querySelector('button[type="submit"]');
                const originalText = submitBtn.textContent;
                submitBtn.textContent = 'Sending...';
                submitBtn.disabled = true;
                
                // Send password reset email
                await sendPasswordResetEmail(email);
                
                showAlert('Password reset email sent! Check your inbox.', 'success');
                showLoginForm();
                
            } catch (error) {
                console.error('Password reset error:', error);
                let errorMessage = 'Failed to send reset email. Please try again.';
                
                switch (error.code) {
                    case 'auth/user-not-found':
                        errorMessage = 'No account found with this email.';
                        break;
                    case 'auth/invalid-email':
                        errorMessage = 'Invalid email address.';
                        break;
                }
                
                showAlert(errorMessage, 'error');
                
                // Reset button
                const submitBtn = forgotPasswordForm.querySelector('button[type="submit"]');
                submitBtn.textContent = 'Send Reset Email';
                submitBtn.disabled = false;
            }
        });
    }
}

async function sendPasswordResetEmail(email) {
    const { sendPasswordResetEmail } = await import("https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js");
    return sendPasswordResetEmail(window.firebaseAuth, email);
}

async function fetchUserRoleAndRedirect(user) {
    try {
        const userRole = await window.FirebaseAuth.AuthManager.getUserRole(user.uid);
        
        const userData = {
            uid: user.uid,
            email: user.email,
            displayName: user.displayName,
            role: userRole.role,
            permissions: window.FirebaseAuth.ROLES[userRole.role].permissions,
            accessiblePages: window.FirebaseAuth.ROLES[userRole.role].pages
        };
        
        localStorage.setItem('currentUser', JSON.stringify(userData));
        redirectToDashboard(userData);
        
    } catch (error) {
        console.error('Error fetching user role:', error);
        showAlert('Error loading user data. Please try again.', 'error');
    }
}

function redirectToDashboard(userData) {
    const accessiblePages = userData.accessiblePages;
    
    // Redirect to first accessible page (usually dashboard)
    const defaultPage = accessiblePages[0] || 'index.html';
    window.location.href = defaultPage;
}

function showLoginForm() {
    document.getElementById('loginFormContainer').style.display = 'block';
    document.getElementById('registerFormContainer').style.display = 'none';
    document.getElementById('forgotPasswordContainer').style.display = 'none';
}

function showRegisterForm() {
    document.getElementById('loginFormContainer').style.display = 'none';
    document.getElementById('registerFormContainer').style.display = 'block';
    document.getElementById('forgotPasswordContainer').style.display = 'none';
}

function showForgotPassword() {
    document.getElementById('loginFormContainer').style.display = 'none';
    document.getElementById('registerFormContainer').style.display = 'none';
    document.getElementById('forgotPasswordContainer').style.display = 'block';
}

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
