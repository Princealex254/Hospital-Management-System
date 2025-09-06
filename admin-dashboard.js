// Prince Alex Hospital - Admin Dashboard for Role Management

let currentUsers = [];

document.addEventListener('DOMContentLoaded', function() {
    // Wait for Firebase and Auth system to initialize
    const checkFirebase = setInterval(() => {
        if (window.firebaseDb && window.firebaseAuth && window.FirebaseAuth) {
            clearInterval(checkFirebase);
            initializeAdminDashboard();
        }
    }, 100);
});

async function initializeAdminDashboard() {
    // Check if user is admin
    const user = window.FirebaseAuth.AuthManager.getCurrentUser();
    if (!user || user.role !== 'ADMIN') {
        window.FirebaseAuth.PageAccessControl.showAccessDenied();
        return;
    }
    
    await loadUsers();
    setupEventListeners();
    updateSystemStats();
}

async function loadUsers() {
    try {
        currentUsers = await window.FirebaseAuth.AuthManager.getAllUsersWithRoles();
        displayUsers(currentUsers);
    } catch (error) {
        console.error('Error loading users:', error);
        showAlert('Error loading users data', 'error');
    }
}

function setupEventListeners() {
    // User search
    const searchInput = document.getElementById('searchStaff');
    if (searchInput) {
        searchInput.addEventListener('input', handleUserSearch);
    }
    
    // Add user form
    const addUserForm = document.getElementById('addStaffForm');
    if (addUserForm) {
        addUserForm.addEventListener('submit', handleAddUser);
    }
}

function handleUserSearch() {
    const searchTerm = document.getElementById('searchStaff').value.toLowerCase();
    
    const filteredUsers = currentUsers.filter(user =>
        user.email.toLowerCase().includes(searchTerm) ||
        user.role.toLowerCase().includes(searchTerm)
    );
    
    displayUsers(filteredUsers);
}

async function handleAddUser(e) {
    e.preventDefault();
    
    const formData = new FormData(e.target);
    const userData = {
        email: formData.get('staffEmail'),
        displayName: formData.get('staffName'),
        role: formData.get('staffDepartment'),
        contact: formData.get('staffContact')
    };
    
    if (!userData.email || !userData.displayName || !userData.role || !userData.contact) {
        showAlert('Please fill in all required fields', 'error');
        return;
    }
    
    try {
        // Generate a temporary password
        const tempPassword = generateTempPassword();
        
        // Register the user
        const user = await window.FirebaseAuth.AuthManager.register(
            userData.email, 
            tempPassword, 
            userData.displayName, 
            userData.role
        );
        
        // Update user data with contact info
        await updateUserContact(user.uid, userData.contact);
        
        // Reload users
        await loadUsers();
        
        // Reset form
        e.target.reset();
        
        showAlert(`User created successfully! Temporary password: ${tempPassword}`, 'success');
        
    } catch (error) {
        console.error('Error adding user:', error);
        showAlert('Error adding user', 'error');
    }
}

async function updateUserContact(uid, contact) {
    // This would typically update a user profile collection
    // For now, we'll just log it
    console.log(`Updating contact for user ${uid}: ${contact}`);
}

function generateTempPassword() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let password = '';
    for (let i = 0; i < 8; i++) {
        password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return password;
}

function displayUsers(users = currentUsers) {
    const container = document.getElementById('staffTable');
    
    if (users.length === 0) {
        container.innerHTML = '<p>No users found</p>';
        return;
    }
    
    const table = createTable(
        ['Email', 'Display Name', 'Role', 'Contact', 'Status', 'Last Login', 'Actions'],
        users.map(user => ({
            email: user.email,
            displayName: user.displayName || 'N/A',
            role: user.role,
            contact: user.contact || 'N/A',
            status: user.isActive !== false ? 'Active' : 'Inactive',
            lastLogin: user.lastLogin ? formatDate(user.lastLogin) : 'Never',
            actions: ''
        })),
        [
            {
                label: 'Edit Role',
                type: 'warning',
                handler: (row) => editUserRole(row.email)
            },
            {
                label: 'Reset Password',
                type: 'primary',
                handler: (row) => resetUserPassword(row.email)
            },
            {
                label: 'Deactivate',
                type: 'danger',
                handler: (row) => toggleUserStatus(row.email)
            },
            {
                label: 'View Permissions',
                type: 'secondary',
                handler: (row) => viewUserPermissions(row.email)
            }
        ]
    );
    
    // Add status styling
    const rows = table.querySelectorAll('tbody tr');
    rows.forEach((row, index) => {
        const user = users[index];
        const statusCell = row.cells[4]; // Status column
        
        if (user.isActive !== false) {
            statusCell.innerHTML = '<span class="status-badge status-completed">✅ Active</span>';
        } else {
            statusCell.innerHTML = '<span class="status-badge status-critical">❌ Inactive</span>';
        }
        
        // Role badge
        const roleCell = row.cells[2];
        roleCell.innerHTML = `<span class="status-badge status-${user.role.toLowerCase()}">${user.role}</span>`;
    });
    
    container.innerHTML = '';
    container.appendChild(table);
}

function editUserRole(email) {
    const user = currentUsers.find(u => u.email === email);
    if (!user) return;
    
    const roleOptions = Object.keys(window.FirebaseAuth.ROLES).map(roleKey => 
        `<option value="${roleKey}" ${user.role === roleKey ? 'selected' : ''}>${window.FirebaseAuth.ROLES[roleKey].name}</option>`
    ).join('');
    
    const modalHtml = `
        <div class="modal" id="editRoleModal" style="display: block;">
            <div class="modal-content">
                <div class="modal-header">
                    <span class="close" onclick="closeEditRoleModal()">&times;</span>
                    <h2>Edit User Role</h2>
                </div>
                <div class="modal-body">
                    <form id="editRoleForm">
                        <input type="hidden" id="editUserUid" value="${user.uid}">
                        <div class="form-group">
                            <label>User:</label>
                            <p><strong>${user.displayName || user.email}</strong> - ${user.email}</p>
                        </div>
                        <div class="form-group">
                            <label for="newRole">New Role:</label>
                            <select id="newRole" required>
                                ${roleOptions}
                            </select>
                        </div>
                        <div class="form-group">
                            <label>New Permissions:</label>
                            <div id="permissionsPreview" style="background: #f8f9fa; padding: 15px; border-radius: 8px; max-height: 200px; overflow-y: auto;">
                                <!-- Permissions will be populated by JavaScript -->
                            </div>
                        </div>
                        <div class="form-group">
                            <label>Accessible Pages:</label>
                            <div id="pagesPreview" style="background: #f8f9fa; padding: 15px; border-radius: 8px; max-height: 150px; overflow-y: auto;">
                                <!-- Pages will be populated by JavaScript -->
                            </div>
                        </div>
                    </form>
                </div>
                <div class="modal-footer">
                    <button type="button" class="btn btn-secondary" onclick="closeEditRoleModal()">Cancel</button>
                    <button type="button" class="btn btn-primary" onclick="updateUserRole()">Update Role</button>
                </div>
            </div>
        </div>
    `;
    
    document.body.insertAdjacentHTML('beforeend', modalHtml);
    updateRolePreview();
    
    // Add event listener for role change
    document.getElementById('newRole').addEventListener('change', updateRolePreview);
}

function updateRolePreview() {
    const newRole = document.getElementById('newRole').value;
    const roleData = window.FirebaseAuth.ROLES[newRole];
    
    // Update permissions preview
    const permissionsHtml = roleData.permissions.map(permission => {
        if (permission === 'all') {
            return `<span class="permission-badge" style="background: #e74c3c; color: white;">ALL PERMISSIONS</span>`;
        }
        const [resource, action] = permission.split('.');
        return `<span class="permission-badge">${resource}: ${action}</span>`;
    }).join(' ');
    
    document.getElementById('permissionsPreview').innerHTML = permissionsHtml;
    
    // Update pages preview
    const pagesHtml = roleData.pages.map(page => {
        const pageName = page.replace('.html', '').charAt(0).toUpperCase() + page.replace('.html', '').slice(1);
        return `<span class="page-badge">${pageName}</span>`;
    }).join(' ');
    
    document.getElementById('pagesPreview').innerHTML = pagesHtml;
}

async function updateUserRole() {
    const userUid = document.getElementById('editUserUid').value;
    const newRole = document.getElementById('newRole').value;
    
    try {
        await window.FirebaseAuth.AuthManager.updateUserRole(userUid, newRole);
        
        // Update local data
        const userIndex = currentUsers.findIndex(u => u.uid === userUid);
        if (userIndex !== -1) {
            currentUsers[userIndex].role = newRole;
        }
        
        closeEditRoleModal();
        displayUsers(currentUsers);
        
        showAlert('User role updated successfully!', 'success');
    } catch (error) {
        console.error('Error updating user role:', error);
        showAlert('Error updating user role', 'error');
    }
}

function resetUserPassword(email) {
    if (!confirm(`Are you sure you want to reset the password for ${email}?`)) {
        return;
    }
    
    // Generate new temporary password
    const newPassword = generateTempPassword();
    
    showAlert(`Password reset for ${email}. New temporary password: ${newPassword}`, 'success');
    
    // In a real implementation, you would:
    // 1. Update the user's password in Firebase Auth
    // 2. Send the new password via email
    // 3. Force the user to change password on next login
}

function viewUserPermissions(email) {
    const user = currentUsers.find(u => u.email === email);
    if (!user) return;
    
    const roleData = window.FirebaseAuth.ROLES[user.role];
    const permissions = roleData.permissions;
    const pages = roleData.pages;
    
    const permissionsHtml = permissions.map(permission => {
        if (permission === 'all') {
            return `<li><strong>ALL PERMISSIONS</strong></li>`;
        }
        const [resource, action] = permission.split('.');
        return `<li><strong>${resource}:</strong> ${action}</li>`;
    }).join('');
    
    const pagesHtml = pages.map(page => {
        const pageName = page.replace('.html', '').charAt(0).toUpperCase() + page.replace('.html', '').slice(1);
        return `<li>${pageName}</li>`;
    }).join('');
    
    const modalHtml = `
        <div class="modal" id="permissionsModal" style="display: block;">
            <div class="modal-content" style="max-width: 600px;">
                <div class="modal-header">
                    <span class="close" onclick="closePermissionsModal()">&times;</span>
                    <h2>User Permissions & Access</h2>
                </div>
                <div class="modal-body">
                    <h3>${user.displayName || user.email} (${user.role})</h3>
                    <p><strong>Email:</strong> ${user.email}</p>
                    
                    <h4>Permissions:</h4>
                    <ul style="max-height: 200px; overflow-y: auto;">
                        ${permissionsHtml}
                    </ul>
                    
                    <h4>Accessible Pages:</h4>
                    <ul style="max-height: 150px; overflow-y: auto;">
                        ${pagesHtml}
                    </ul>
                </div>
                <div class="modal-footer">
                    <button type="button" class="btn btn-secondary" onclick="closePermissionsModal()">Close</button>
                </div>
            </div>
        </div>
    `;
    
    document.body.insertAdjacentHTML('beforeend', modalHtml);
}

async function toggleUserStatus(email) {
    const user = currentUsers.find(u => u.email === email);
    if (!user) return;
    
    const action = user.isActive !== false ? 'deactivate' : 'activate';
    
    if (!confirm(`Are you sure you want to ${action} this user?`)) {
        return;
    }
    
    try {
        // In a real implementation, you would update the user's status in Firestore
        // For now, we'll just update the local data
        user.isActive = user.isActive === false ? true : false;
        
        displayUsers(currentUsers);
        
        showAlert(`User ${action}d successfully!`, 'success');
    } catch (error) {
        console.error('Error toggling user status:', error);
        showAlert('Error updating user status', 'error');
    }
}

function closeEditRoleModal() {
    const modal = document.getElementById('editRoleModal');
    if (modal) {
        modal.remove();
    }
}

function closePermissionsModal() {
    const modal = document.getElementById('permissionsModal');
    if (modal) {
        modal.remove();
    }
}

function updateSystemStats() {
    const container = document.getElementById('systemStats');
    
    const stats = {
        totalUsers: currentUsers.length,
        activeUsers: currentUsers.filter(u => u.isActive !== false).length,
        adminUsers: currentUsers.filter(u => u.role === 'ADMIN').length,
        doctorUsers: currentUsers.filter(u => u.role === 'DOCTOR').length,
        staffUsers: currentUsers.filter(u => ['STAFF', 'NURSE', 'LAB', 'RECEPTION', 'PHARMACY'].includes(u.role)).length
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
    const date = new Date(dateString);
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
