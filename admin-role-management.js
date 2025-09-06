// Prince Alex Hospital - Admin Role Management

import { 
  signInWithEmailAndPassword,
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

import { 
  collection, 
  doc, 
  setDoc, 
  getDocs, 
  query, 
  where, 
  orderBy,
  deleteDoc,
  updateDoc,
  serverTimestamp,
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

// Role-based redirection mapping
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

let currentRoles = [];

document.addEventListener('DOMContentLoaded', async function() {
  await waitForFirebase();
  
  // Set up authentication state listener
  onAuthStateChanged(auth, async (user) => {
    if (user) {
      // User is signed in, check if they are admin
      await checkAdminAccess(user);
    } else {
      // User is signed out, show login overlay
      showLoginOverlay();
    }
  });
  
  // Set up login form
  setupAdminLoginForm();
});

async function checkAdminAccess(user) {
  try {
    // Check user role in Firestore
    const roleRef = doc(db, 'roles', user.email);
    const roleSnap = await getDoc(roleRef);
    
    if (roleSnap.exists()) {
      const userRole = roleSnap.data();
      
      if (userRole.role === 'Admin' && userRole.status === 'active') {
        // User is admin, hide login overlay and show dashboard
        hideLoginOverlay();
        
        // Store user data
        const userData = {
          uid: user.uid,
          email: user.email,
          displayName: user.displayName,
          role: userRole.role,
          department: userRole.department,
          status: userRole.status
        };
        
        localStorage.setItem('currentUser', JSON.stringify(userData));
        
        // Initialize admin dashboard
        await loadRoles();
        setupEventListeners();
        updateSystemStats();
        updateUserInfo(userData);
        
      } else {
        // User is not admin
        showAlert('Access denied. Admin privileges required.', 'error');
        await auth.signOut();
        showLoginOverlay();
      }
    } else {
      // User not found in roles collection
      showAlert('You do not have access. Contact Admin.', 'error');
      await auth.signOut();
      showLoginOverlay();
    }
  } catch (error) {
    console.error('Error checking admin access:', error);
    showAlert('Error verifying admin access. Please try again.', 'error');
    await auth.signOut();
    showLoginOverlay();
  }
}

async function loadRoles() {
  try {
    const rolesRef = collection(db, 'roles');
    const q = query(rolesRef, orderBy('createdAt', 'desc'));
    const querySnapshot = await getDocs(q);
    
    currentRoles = querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    
    displayRoles(currentRoles);
  } catch (error) {
    console.error('Error loading roles:', error);
    showAlert('Error loading roles data', 'error');
  }
}

function setupAdminLoginForm() {
  const loginForm = document.getElementById('adminLoginForm');
  if (loginForm) {
    loginForm.addEventListener('submit', async function(e) {
      e.preventDefault();
      
      const email = document.getElementById('adminEmail').value.trim();
      const password = document.getElementById('adminPassword').value;
      
      if (!email || !password) {
        showAlert('Please fill in all fields', 'error');
        return;
      }
      
      try {
        // Show loading state
        setAdminLoginLoadingState(true);
        
        // Authenticate with Firebase
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;
        
        // Check admin access (this will be handled by the auth state listener)
        showAlert('Login successful! Verifying admin access...', 'success');
        
      } catch (error) {
        console.error('Admin login error:', error);
        setAdminLoginLoadingState(false);
        
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
        }
        
        showAlert(errorMessage, 'error');
      }
    });
  }
}

function setupEventListeners() {
  // Search functionality
  const searchInput = document.getElementById('searchStaff');
  if (searchInput) {
    searchInput.addEventListener('input', handleSearch);
  }
  
  // Modal close functionality
  const modal = document.getElementById('assignRoleModal');
  const closeBtn = modal.querySelector('.close');
  
  if (closeBtn) {
    closeBtn.onclick = closeAssignRoleModal;
  }
  
  modal.onclick = function(e) {
    if (e.target === modal) {
      closeAssignRoleModal();
    }
  };
  
  // Logout functionality
  const logoutBtn = document.querySelector('.logout-btn');
  if (logoutBtn) {
    logoutBtn.onclick = async function() {
      if (confirm('Are you sure you want to logout?')) {
        await auth.signOut();
        localStorage.removeItem('currentUser');
        showLoginOverlay();
      }
    };
  }
}

function handleSearch() {
  const searchTerm = document.getElementById('searchStaff').value.toLowerCase();
  
  const filteredRoles = currentRoles.filter(role =>
    role.email.toLowerCase().includes(searchTerm) ||
    role.role.toLowerCase().includes(searchTerm) ||
    (role.department && role.department.toLowerCase().includes(searchTerm))
  );
  
  displayRoles(filteredRoles);
}

function displayRoles(roles = currentRoles) {
  const container = document.getElementById('staffTable');
  
  if (roles.length === 0) {
    container.innerHTML = '<p>No roles found</p>';
    return;
  }
  
  const table = createTable(
    ['Email', 'Role', 'Department', 'Status', 'Created At', 'Actions'],
    roles.map(role => ({
      email: role.email,
      role: role.role,
      department: role.department || 'N/A',
      status: role.status || 'active',
      createdAt: role.createdAt ? formatDate(role.createdAt) : 'N/A',
      actions: ''
    })),
    [
      {
        label: 'Edit Role',
        type: 'warning',
        handler: (row) => editRole(row.email)
      },
      {
        label: 'Delete Role',
        type: 'danger',
        handler: (row) => deleteRole(row.email)
      }
    ]
  );
  
  // Add status styling
  const rows = table.querySelectorAll('tbody tr');
  rows.forEach((row, index) => {
    const role = roles[index];
    const statusCell = row.cells[3]; // Status column
    
    if (role.status === 'active') {
      statusCell.innerHTML = '<span class="status-badge status-completed">✅ Active</span>';
    } else {
      statusCell.innerHTML = '<span class="status-badge status-critical">❌ Inactive</span>';
    }
    
    // Role badge
    const roleCell = row.cells[1];
    roleCell.innerHTML = `<span class="status-badge status-${role.role.toLowerCase()}">${role.role}</span>`;
  });
  
  container.innerHTML = '';
  container.appendChild(table);
}

async function assignRole() {
  const email = document.getElementById('userEmail').value.trim();
  const role = document.getElementById('userRole').value;
  const department = document.getElementById('userDepartment').value;
  const status = document.getElementById('userStatus').value;
  
  if (!email || !role) {
    showAlert('Please fill in email and role fields', 'error');
    return;
  }
  
  try {
    // Use email as document ID for simplicity
    const roleRef = doc(db, 'roles', email);
    
    const roleData = {
      email: email,
      role: role,
      department: department || null,
      status: status,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      assignedBy: auth.currentUser?.uid || 'admin'
    };
    
    await setDoc(roleRef, roleData);
    
    // Reload roles
    await loadRoles();
    
    // Close modal and reset form
    closeAssignRoleModal();
    
    showAlert(`Role assigned successfully! User will be redirected to ${ROLE_REDIRECTS[role]} after login.`, 'success');
    
  } catch (error) {
    console.error('Error assigning role:', error);
    showAlert('Error assigning role: ' + error.message, 'error');
  }
}

function editRole(email) {
  const role = currentRoles.find(r => r.email === email);
  if (!role) return;
  
  // Populate form with existing data
  document.getElementById('userEmail').value = role.email;
  document.getElementById('userRole').value = role.role;
  document.getElementById('userDepartment').value = role.department || '';
  document.getElementById('userStatus').value = role.status || 'active';
  
  // Show modal
  document.getElementById('assignRoleModal').style.display = 'block';
}

async function deleteRole(email) {
  if (!confirm(`Are you sure you want to delete the role for ${email}? This will prevent the user from logging in.`)) {
    return;
  }
  
  try {
    const roleRef = doc(db, 'roles', email);
    await deleteDoc(roleRef);
    
    // Reload roles
    await loadRoles();
    
    showAlert('Role deleted successfully!', 'success');
  } catch (error) {
    console.error('Error deleting role:', error);
    showAlert('Error deleting role: ' + error.message, 'error');
  }
}

function openAssignRoleModal() {
  // Reset form
  document.getElementById('assignRoleForm').reset();
  document.getElementById('assignRoleModal').style.display = 'block';
}

function closeAssignRoleModal() {
  document.getElementById('assignRoleModal').style.display = 'none';
}

function updateSystemStats() {
  const container = document.getElementById('systemStats');
  
  const stats = {
    totalUsers: currentRoles.length,
    activeUsers: currentRoles.filter(r => r.status === 'active').length,
    adminUsers: currentRoles.filter(r => r.role === 'Admin').length,
    doctorUsers: currentRoles.filter(r => r.role === 'Doctor').length,
    staffUsers: currentRoles.filter(r => ['Nurse', 'Lab', 'Reception', 'Triage', 'Staff'].includes(r.role)).length
  };
  
  container.innerHTML = `
    <div class="stat-card">
      <div class="stat-number">${stats.totalUsers}</div>
      <div class="stat-label">Total Users</div>
    </div>
    <div class="stat-card">
      <div class="stat-number">${stats.activeUsers}</div>
      <div class="stat-label">Active Users</div>
    </div>
    <div class="stat-card">
      <div class="stat-number">${stats.adminUsers}</div>
      <div class="stat-label">Admins</div>
    </div>
    <div class="stat-card">
      <div class="stat-number">${stats.doctorUsers}</div>
      <div class="stat-label">Doctors</div>
    </div>
    <div class="stat-card">
      <div class="stat-number">${stats.staffUsers}</div>
      <div class="stat-label">Staff Members</div>
    </div>
  `;
}

// Format date for display
function formatDate(dateString) {
  if (!dateString) return 'N/A';
  
  const date = dateString.toDate ? dateString.toDate() : new Date(dateString);
  return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
}

// Create table helper function
function createTable(headers, data, actions = []) {
  const table = document.createElement('table');
  table.className = 'table';
  
  // Create header
  const thead = document.createElement('thead');
  const headerRow = document.createElement('tr');
  headers.forEach(header => {
    const th = document.createElement('th');
    th.textContent = header;
    headerRow.appendChild(th);
  });
  if (actions.length > 0) {
    const th = document.createElement('th');
    th.textContent = 'Actions';
    headerRow.appendChild(th);
  }
  thead.appendChild(headerRow);
  table.appendChild(thead);
  
  // Create body
  const tbody = document.createElement('tbody');
  data.forEach(row => {
    const tr = document.createElement('tr');
    Object.values(row).forEach(value => {
      const td = document.createElement('td');
      td.textContent = value;
      tr.appendChild(td);
    });
    
    // Add action buttons
    if (actions.length > 0) {
      const td = document.createElement('td');
      actions.forEach(action => {
        const button = document.createElement('button');
        button.className = `btn btn-${action.type} btn-sm`;
        button.textContent = action.label;
        button.onclick = () => action.handler(row);
        td.appendChild(button);
      });
      tr.appendChild(td);
    }
    
    tbody.appendChild(tr);
  });
  table.appendChild(tbody);
  
  return table;
}

function showLoginOverlay() {
  document.getElementById('loginOverlay').style.display = 'flex';
  document.querySelector('.app-container').style.display = 'none';
}

function hideLoginOverlay() {
  document.getElementById('loginOverlay').style.display = 'none';
  document.querySelector('.app-container').style.display = 'flex';
}

function setAdminLoginLoadingState(isLoading) {
  const loginBtn = document.getElementById('adminLoginBtn');
  const loadingSpinner = document.getElementById('adminLoadingSpinner');
  const loginBtnText = document.getElementById('adminLoginBtnText');
  
  if (isLoading) {
    loginBtn.disabled = true;
    loadingSpinner.style.display = 'inline-block';
    loginBtnText.textContent = 'Logging in...';
  } else {
    loginBtn.disabled = false;
    loadingSpinner.style.display = 'none';
    loginBtnText.textContent = 'Login as Admin';
  }
}

function updateUserInfo(userData) {
  const welcomeElement = document.querySelector('.welcome-message');
  if (welcomeElement) {
    welcomeElement.textContent = `Welcome ${userData.displayName || userData.email}`;
  }
  
  const userInfoElement = document.querySelector('.user-info p');
  if (userInfoElement) {
    userInfoElement.textContent = userData.role;
  }
}

function showAlert(message, type = 'success') {
  // Remove existing alerts
  const existingAlerts = document.querySelectorAll('.alert');
  existingAlerts.forEach(alert => alert.remove());
  
  const alertDiv = document.createElement('div');
  alertDiv.className = `alert alert-${type}`;
  alertDiv.textContent = message;
  
  // Add close button
  const closeBtn = document.createElement('span');
  closeBtn.innerHTML = '&times;';
  closeBtn.style.cssText = 'float: right; font-size: 20px; font-weight: bold; cursor: pointer; margin-left: 15px;';
  closeBtn.onclick = () => alertDiv.remove();
  alertDiv.appendChild(closeBtn);
  
  document.body.appendChild(alertDiv);
  
  // Auto-remove after 5 seconds
  setTimeout(() => {
    if (alertDiv.parentNode) {
      alertDiv.remove();
    }
  }, 5000);
}

// Export functions for global access
window.AdminRoleManagement = {
  assignRole,
  editRole,
  deleteRole,
  openAssignRoleModal,
  closeAssignRoleModal,
  ROLE_REDIRECTS
};
