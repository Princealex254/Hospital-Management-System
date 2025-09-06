// Prince Alex Hospital - Login Authentication Handler

import { 
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

import { 
  collection, 
  doc,
  query, 
  where, 
  getDocs,
  getDoc 
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// Wait for Firebase to initialize
let db, auth;

function waitForFirebase() {
  return new Promise((resolve) => {
    const checkFirebase = setInterval(() => {
      if (window.firebaseDb && window.firebaseAuth) {
        db = window.firebaseDb;
        auth = window.firebaseAuth;
        clearInterval(checkFirebase);
        resolve();
      }
    }, 100);
  });
}

// Role-based redirection mapping (exactly as specified)
const ROLE_REDIRECTS = {
  'Admin': 'admin.html',
  'Doctor': 'doctors.html',
  'Nurse': 'patients.html',
  'Pharmacy': 'pharmacy.html',
  'Lab': 'lab.html',
  'Reception': 'appointments.html',
  'Triage': 'triage.html',
  'Staff': 'index.html'
};

document.addEventListener('DOMContentLoaded', async function() {
  await waitForFirebase();
  initializeLogin();
});

function initializeLogin() {
  // Check if user is already logged in
  onAuthStateChanged(auth, (user) => {
    if (user) {
      // User is already logged in, check their role and redirect
      checkUserRoleAndRedirect(user);
    }
  });

  // Set up login form
  setupLoginForm();
  
  // Set up modal event listeners
  setupModalEventListeners();
}

function setupModalEventListeners() {
  // Modal close functionality
  const modal = document.getElementById('forgotPasswordModal');
  const closeBtn = modal.querySelector('.close');
  
  if (closeBtn) {
    closeBtn.onclick = closeForgotPasswordModal;
  }
  
  // Close modal when clicking outside
  modal.onclick = function(e) {
    if (e.target === modal) {
      closeForgotPasswordModal();
    }
  };
  
  // Handle Enter key in reset email field
  const resetEmailInput = document.getElementById('resetEmail');
  if (resetEmailInput) {
    resetEmailInput.addEventListener('keypress', function(e) {
      if (e.key === 'Enter') {
        e.preventDefault();
        sendPasswordResetEmail();
      }
    });
  }
}

function setupLoginForm() {
  const loginForm = document.getElementById('loginForm');
  const loginBtn = document.getElementById('loginBtn');
  const loadingSpinner = document.getElementById('loadingSpinner');
  const loginBtnText = document.getElementById('loginBtnText');

  loginForm.addEventListener('submit', async function(e) {
    e.preventDefault();
    
    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;
    const rememberMe = document.getElementById('rememberMe').checked;

    if (!email || !password) {
      showToast('Please fill in all fields', 'error');
      return;
    }

    try {
      // Show loading state
      setLoadingState(true);
      
      // Authenticate with Firebase
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;
      
      // Check user role in Firestore (exactly as specified)
      const roleRef = doc(db, 'roles', user.email);
      const roleSnap = await getDoc(roleRef);
      
      if (!roleSnap.exists()) {
        // User not found in roles collection
        await auth.signOut();
        showToast('You do not have access. Contact Admin.', 'error');
        setLoadingState(false);
        return;
      }
      
      const userRole = roleSnap.data();

      // Store user data in localStorage
      const userData = {
        uid: user.uid,
        email: user.email,
        displayName: user.displayName,
        role: userRole.role,
        department: userRole.department,
        rememberMe: rememberMe
      };
      
      localStorage.setItem('currentUser', JSON.stringify(userData));
      
      // Show success message
      showToast('Login successful! Redirecting...', 'success');
      
      // Redirect based on role (exactly as specified)
      setTimeout(() => {
        const role = userRole.role;
        if (role === "Admin") window.location.href = "/admin.html";
        else if (role === "Doctor") window.location.href = "/doctors.html";
        else if (role === "Nurse") window.location.href = "/patients.html";
        else if (role === "Pharmacy") window.location.href = "/pharmacy.html";
        else if (role === "Lab") window.location.href = "/lab.html";
        else if (role === "Reception") window.location.href = "/appointments.html";
        else if (role === "Triage") window.location.href = "/triage.html";
        else if (role === "Staff") window.location.href = "/index.html";
        else window.location.href = "/index.html"; // Default fallback
      }, 1000);
      
    } catch (error) {
      console.error('Login error:', error);
      setLoadingState(false);
      
      // Handle specific Firebase errors
      let errorMessage = 'Login failed. Please try again.';
      
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
        case 'auth/network-request-failed':
          errorMessage = 'Network error. Please check your connection.';
          break;
      }
      
      showToast(errorMessage, 'error');
    }
  });
}

async function getUserRoleFromFirestore(email) {
  try {
    // Use email as document ID for direct lookup (as specified)
    const roleRef = doc(db, 'roles', email);
    const roleSnap = await getDoc(roleRef);
    
    if (roleSnap.exists()) {
      return roleSnap.data();
    }
    
    return null;
  } catch (error) {
    console.error('Error fetching user role:', error);
    return null;
  }
}

async function checkUserRoleAndRedirect(user) {
  try {
    const userRole = await getUserRoleFromFirestore(user.email);
    
    if (userRole) {
      // User has role, redirect to appropriate dashboard
      redirectToRoleDashboard(userRole.role);
    } else {
      // User doesn't have role, sign them out
      await auth.signOut();
      localStorage.removeItem('currentUser');
    }
  } catch (error) {
    console.error('Error checking user role:', error);
  }
}

function redirectToRoleDashboard(role) {
  const redirectUrl = ROLE_REDIRECTS[role] || 'index.html';
  window.location.href = redirectUrl;
}

function setLoadingState(isLoading) {
  const loginBtn = document.getElementById('loginBtn');
  const loadingSpinner = document.getElementById('loadingSpinner');
  const loginBtnText = document.getElementById('loginBtnText');
  
  if (isLoading) {
    loginBtn.disabled = true;
    loadingSpinner.style.display = 'inline-block';
    loginBtnText.textContent = 'Logging in...';
  } else {
    loginBtn.disabled = false;
    loadingSpinner.style.display = 'none';
    loginBtnText.textContent = 'Login';
  }
}

function showForgotPassword() {
  // Pre-fill email if user has entered it
  const email = document.getElementById('email').value.trim();
  if (email) {
    document.getElementById('resetEmail').value = email;
  }
  
  // Show modal
  document.getElementById('forgotPasswordModal').style.display = 'block';
}

function closeForgotPasswordModal() {
  document.getElementById('forgotPasswordModal').style.display = 'none';
  // Clear form
  document.getElementById('forgotPasswordForm').reset();
}

async function sendPasswordResetEmail() {
  const email = document.getElementById('resetEmail').value.trim();
  
  if (!email) {
    showToast('Please enter your email address', 'error');
    return;
  }
  
  try {
    // Show loading state
    setResetLoadingState(true);
    
    await sendPasswordReset(email);
    
    // Close modal and show success
    closeForgotPasswordModal();
    showToast('Password reset email sent! Check your inbox and spam folder.', 'success');
    
  } catch (error) {
    console.error('Password reset error:', error);
    setResetLoadingState(false);
  }
}

async function sendPasswordReset(email) {
  try {
    await sendPasswordResetEmail(auth, email);
    return true;
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
      case 'auth/too-many-requests':
        errorMessage = 'Too many requests. Please try again later.';
        break;
    }
    
    showToast(errorMessage, 'error');
    throw error;
  }
}

function setResetLoadingState(isLoading) {
  const resetBtn = document.getElementById('resetPasswordBtn');
  const resetLoadingSpinner = document.getElementById('resetLoadingSpinner');
  const resetBtnText = document.getElementById('resetBtnText');
  
  if (isLoading) {
    resetBtn.disabled = true;
    resetLoadingSpinner.style.display = 'inline-block';
    resetBtnText.textContent = 'Sending...';
  } else {
    resetBtn.disabled = false;
    resetLoadingSpinner.style.display = 'none';
    resetBtnText.textContent = 'Send Reset Email';
  }
}

function showToast(message, type = 'success') {
  // Remove existing toasts
  const existingToasts = document.querySelectorAll('.toast');
  existingToasts.forEach(toast => toast.remove());
  
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message;
  
  // Add close button
  const closeBtn = document.createElement('span');
  closeBtn.innerHTML = '&times;';
  closeBtn.style.cssText = 'float: right; font-size: 20px; font-weight: bold; cursor: pointer; margin-left: 15px;';
  closeBtn.onclick = () => toast.remove();
  toast.appendChild(closeBtn);
  
  document.body.appendChild(toast);
  
  // Show toast with animation
  setTimeout(() => {
    toast.classList.add('show');
  }, 100);
  
  // Hide toast after 5 seconds
  setTimeout(() => {
    if (toast.parentNode) {
      toast.classList.remove('show');
      setTimeout(() => {
        if (toast.parentNode) {
          toast.remove();
        }
      }, 300);
    }
  }, 5000);
}

// Handle network errors
window.addEventListener('online', () => {
  showToast('Connection restored', 'success');
});

window.addEventListener('offline', () => {
  showToast('Connection lost. Please check your internet.', 'error');
});

// Handle page visibility change (for session management)
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    // Page is hidden, could implement session timeout logic here
  } else {
    // Page is visible again, check if user is still authenticated
    if (auth.currentUser) {
      // User is still authenticated
    } else {
      // User session expired, redirect to login
      localStorage.removeItem('currentUser');
      window.location.href = 'login.html';
    }
  }
});
