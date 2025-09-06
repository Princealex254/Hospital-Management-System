// Prince Alex Hospital - Admin RBAC Management

let currentUsers = [];

document.addEventListener('DOMContentLoaded', function() {
    // Wait for Firebase and RBAC to initialize
    const checkFirebase = setInterval(() => {
        if (window.firebaseDb && window.firebaseAuth && window.RBAC) {
            clearInterval(checkFirebase);
            initializeAdmin();
        }
    }, 100);
});

async function initializeAdmin() {
    // Check if user is admin
    const user = window.RBAC.AuthManager.getCurrentUser();
    if (!user || user.role !== 'ADMIN') {
        window.RBAC.PageAccessControl.showAccessDenied();
        return;
    }
    
    await loadUsers();
    setupEventListeners();
    updateSystemStats();
}

async function loadUsers() {
    try {
        currentUsers = await window.RBAC.UserManager.getAllUsers();
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
        user.username.toLowerCase().includes(searchTerm) ||
        user.department.toLowerCase().includes(searchTerm) ||
        user.role.toLowerCase().includes(searchTerm)
    );
    
    displayUsers(filteredUsers);
}

async function handleAddUser(e) {
    e.preventDefault();
    
    const formData = new FormData(e.target);
    const userData = {
        username: formData.get('staffName'),
        email: formData.get('staffEmail'),
        department: formData.get('staffDepartment'),
        role: formData.get('staffRole'),
        contact: formData.get('staffContact'),
        status: formData.get('staffStatus')
    };
    
    if (!userData.username || !userData.department || !userData.contact) {
        showAlert('Please fill in all required fields', 'error');
        return;
    }
    
    try {
        const newUser = await window.RBAC.UserManager.createUser(userData);
        currentUsers.push(newUser);
        
        // Reset form
        e.target.reset();
        
        // Refresh display
        displayUsers(currentUsers);
        
        showAlert('User added successfully!', 'success');
    } catch (error) {
        console.error('Error adding user:', error);
        showAlert('Error adding user', 'error');
    }
}

function displayUsers(users = currentUsers) {
    const container = document.getElementById('staffTable');
    
    if (users.length === 0) {
        container.innerHTML = '<p>No users found</p>';
        return;
    }
    
    const table = createTable(
        ['Username', 'Email', 'Department', 'Role', 'Contact', 'Status', 'Last Login', 'Actions'],
        users.map(user => ({
            username: user.username,
            email: user.email || 'N/A',
            department: user.department,
            role: user.role,
            contact: user.contact,
            status: user.isActive ? 'Active' : 'Inactive',
            lastLogin: user.lastLogin ? formatDate(user.lastLogin) : 'Never',
            actions: ''
        })),
        [
            {
                label: 'Edit Role',
                type: 'warning',
                handler: (row) => editUserRole(row.username)
            },
            {
                label: 'Deactivate',
                type: 'danger',
                handler: (row) => toggleUserStatus(row.username)
            },
            {
                label: 'View Permissions',
                type: 'primary',
                handler: (row) => viewUserPermissions(row.username)
            }
        ]
    );
    
    // Add status styling
    const rows = table.querySelectorAll('tbody tr');
    rows.forEach((row, index) => {
        const user = users[index];
        const statusCell = row.cells[5]; // Status column
        
        if (user.isActive) {
            statusCell.innerHTML = '<span class="status-badge status-completed">✅ Active</span>';
        } else {
            statusCell.innerHTML = '<span class="status-badge status-critical">❌ Inactive</span>';
        }
        
        // Role badge
        const roleCell = row.cells[3];
        roleCell.innerHTML = `<span class="status-badge status-${user.role.toLowerCase()}">${user.role}</span>`;
    });
    
    container.innerHTML = '';
    container.appendChild(table);
}

function editUserRole(username) {
    const user = currentUsers.find(u => u.username === username);
    if (!user) return;
    
    const roleOptions = Object.keys(window.RBAC.ROLES).map(roleKey => 
        `<option value="${roleKey}" ${user.role === roleKey ? 'selected' : ''}>${window.RBAC.ROLES[roleKey].name}</option>`
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
                        <input type="hidden" id="editUserId" value="${user.id}">
                        <div class="form-group">
                            <label>User:</label>
                            <p><strong>${user.username}</strong> - ${user.department}</p>
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
    updatePermissionsPreview();
    
    // Add event listener for role change
    document.getElementById('newRole').addEventListener('change', updatePermissionsPreview);
}

function updatePermissionsPreview() {
    const newRole = document.getElementById('newRole').value;
    const permissions = window.RBAC.ROLES[newRole].permissions;
    
    const permissionsHtml = permissions.map(permission => {
        const [resource, action] = permission.split('.');
        return `<span class="permission-badge">${resource}: ${action}</span>`;
    }).join(' ');
    
    document.getElementById('permissionsPreview').innerHTML = permissionsHtml;
}

async function updateUserRole() {
    const userId = document.getElementById('editUserId').value;
    const newRole = document.getElementById('newRole').value;
    
    try {
        await window.RBAC.UserManager.updateUserRole(userId, newRole);
        
        // Update local data
        const userIndex = currentUsers.findIndex(u => u.id === userId);
        if (userIndex !== -1) {
            currentUsers[userIndex].role = newRole;
            currentUsers[userIndex].permissions = window.RBAC.ROLES[newRole].permissions;
        }
        
        closeEditRoleModal();
        displayUsers(currentUsers);
        
        showAlert('User role updated successfully!', 'success');
    } catch (error) {
        console.error('Error updating user role:', error);
        showAlert('Error updating user role', 'error');
    }
}

function viewUserPermissions(username) {
    const user = currentUsers.find(u => u.username === username);
    if (!user) return;
    
    const permissions = user.permissions || [];
    const permissionsHtml = permissions.map(permission => {
        const [resource, action] = permission.split('.');
        return `<li><strong>${resource}:</strong> ${action}</li>`;
    }).join('');
    
    const modalHtml = `
        <div class="modal" id="permissionsModal" style="display: block;">
            <div class="modal-content">
                <div class="modal-header">
                    <span class="close" onclick="closePermissionsModal()">&times;</span>
                    <h2>User Permissions</h2>
                </div>
                <div class="modal-body">
                    <h3>${user.username} (${user.role})</h3>
                    <p><strong>Department:</strong> ${user.department}</p>
                    <h4>Permissions:</h4>
                    <ul>
                        ${permissionsHtml}
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

async function toggleUserStatus(username) {
    const user = currentUsers.find(u => u.username === username);
    if (!user) return;
    
    const action = user.isActive ? 'deactivate' : 'activate';
    
    if (!confirm(`Are you sure you want to ${action} this user?`)) {
        return;
    }
    
    try {
        await window.RBAC.UserManager.deactivateUser(user.id);
        
        // Update local data
        user.isActive = !user.isActive;
        
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
        activeUsers: currentUsers.filter(u => u.isActive).length,
        adminUsers: currentUsers.filter(u => u.role === 'ADMIN').length,
        doctorUsers: currentUsers.filter(u => u.role === 'DOCTOR').length,
        nurseUsers: currentUsers.filter(u => u.role === 'NURSE').length,
        otherUsers: currentUsers.filter(u => !['ADMIN', 'DOCTOR', 'NURSE'].includes(u.role)).length
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
            <div class="stat-number">${stats.nurseUsers}</div>
            <div class="stat-label">Nurses</div>
        </div>
        <div class="stat-card">
            <div class="stat-number">${stats.otherUsers}</div>
            <div class="stat-label">Other Staff</div>
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
