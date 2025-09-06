// Prince Alex Hospital - Shared Components and Utilities

// Navigation menu configuration
const navigationMenu = [
    { id: 'index', title: 'Dashboard', icon: '📊', url: 'index.html', roles: ['all'] },
    { id: 'patients', title: 'Patients', icon: '👥', url: 'patients.html', roles: ['Nurse', 'Doctor', 'Admin'] },
    { id: 'triage', title: 'Triage', icon: '🚨', url: 'triage.html', roles: ['Triage', 'Nurse', 'Admin'] },
    { id: 'doctors', title: 'Doctors', icon: '👨‍⚕️', url: 'doctors.html', roles: ['Doctor', 'Admin'] },
    { id: 'lab', title: 'Laboratory', icon: '🧪', url: 'lab.html', roles: ['Lab', 'Doctor', 'Admin'] },
    { id: 'pharmacy', title: 'Pharmacy', icon: '💊', url: 'pharmacy.html', roles: ['Pharmacy', 'Doctor', 'Admin'] },
    { id: 'appointments', title: 'Appointments', icon: '📅', url: 'appointments.html', roles: ['Reception', 'Admin'] },
    { id: 'billing', title: 'Billing', icon: '💰', url: 'billing.html', roles: ['Reception', 'Admin'] },
    { id: 'reports', title: 'Reports', icon: '📈', url: 'reports.html', roles: ['Admin'] },
    { id: 'admin', title: 'Admin', icon: '⚙️', url: 'admin.html', roles: ['Admin'] }
];

// Create sidebar navigation
function createSidebar() {
    const currentUser = getCurrentUser();
    if (!currentUser) return;
    
    const sidebar = document.querySelector('.sidebar');
    if (!sidebar) return;
    
    // Create navigation menu
    const navMenu = document.createElement('ul');
    navMenu.className = 'nav-menu';
    
    navigationMenu.forEach(item => {
        if (item.roles.includes('all') || item.roles.includes(currentUser.department)) {
            const navItem = document.createElement('li');
            navItem.className = 'nav-item';
            
            const navLink = document.createElement('a');
            navLink.href = item.url;
            navLink.className = 'nav-link';
            navLink.innerHTML = `
                <span class="nav-icon">${item.icon}</span>
                ${item.title}
            `;
            
            // Highlight current page
            if (window.location.pathname.includes(item.url)) {
                navLink.classList.add('active');
            }
            
            navItem.appendChild(navLink);
            navMenu.appendChild(navItem);
        }
    });
    
    sidebar.appendChild(navMenu);
}

// Create page header
function createPageHeader(title, subtitle = '') {
    const header = document.createElement('div');
    header.className = 'content-header';
    header.innerHTML = `
        <h1>${title}</h1>
        <p>${subtitle}</p>
    `;
    return header;
}

// Create stats card
function createStatsCard(number, label, icon = '') {
    const card = document.createElement('div');
    card.className = 'stat-card';
    card.innerHTML = `
        <div class="stat-number">${icon} ${number}</div>
        <div class="stat-label">${label}</div>
    `;
    return card;
}

// Create data table
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

// Create modal
function createModal(title, content, actions = []) {
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.innerHTML = `
        <div class="modal-content">
            <div class="modal-header">
                <span class="close">&times;</span>
                <h2>${title}</h2>
            </div>
            <div class="modal-body">
                ${content}
            </div>
            <div class="modal-footer">
                ${actions.map(action => 
                    `<button class="btn btn-${action.type}" onclick="${action.handler}">${action.label}</button>`
                ).join(' ')}
            </div>
        </div>
    `;
    
    // Add close functionality
    const closeBtn = modal.querySelector('.close');
    closeBtn.onclick = () => modal.style.display = 'none';
    
    modal.onclick = (e) => {
        if (e.target === modal) {
            modal.style.display = 'none';
        }
    };
    
    return modal;
}

// Show modal
function showModal(modal) {
    modal.style.display = 'block';
    document.body.appendChild(modal);
}

// Hide modal
function hideModal(modal) {
    modal.style.display = 'none';
    if (modal.parentNode) {
        modal.parentNode.removeChild(modal);
    }
}

// Create form
function createForm(fields, submitHandler) {
    const form = document.createElement('form');
    form.className = 'form';
    
    fields.forEach(field => {
        const formGroup = document.createElement('div');
        formGroup.className = 'form-group';
        
        const label = document.createElement('label');
        label.textContent = field.label;
        label.setAttribute('for', field.name);
        
        let input;
        if (field.type === 'textarea') {
            input = document.createElement('textarea');
            input.rows = field.rows || 3;
        } else if (field.type === 'select') {
            input = document.createElement('select');
            field.options.forEach(option => {
                const optionElement = document.createElement('option');
                optionElement.value = option.value;
                optionElement.textContent = option.text;
                input.appendChild(optionElement);
            });
        } else {
            input = document.createElement('input');
            input.type = field.type || 'text';
        }
        
        input.id = field.name;
        input.name = field.name;
        input.required = field.required || false;
        input.value = field.value || '';
        
        if (field.placeholder) {
            input.placeholder = field.placeholder;
        }
        
        formGroup.appendChild(label);
        formGroup.appendChild(input);
        form.appendChild(formGroup);
    });
    
    const submitBtn = document.createElement('button');
    submitBtn.type = 'submit';
    submitBtn.className = 'btn btn-primary';
    submitBtn.textContent = 'Submit';
    form.appendChild(submitBtn);
    
    form.addEventListener('submit', submitHandler);
    
    return form;
}

// Search and filter functionality
function createSearchFilter(searchHandler, filterOptions = []) {
    const container = document.createElement('div');
    container.className = 'search-container';
    
    const searchInput = document.createElement('input');
    searchInput.type = 'text';
    searchInput.className = 'form-control search-input';
    searchInput.placeholder = 'Search...';
    searchInput.addEventListener('input', searchHandler);
    
    container.appendChild(searchInput);
    
    if (filterOptions.length > 0) {
        const filterSelect = document.createElement('select');
        filterSelect.className = 'form-control filter-select';
        
        const defaultOption = document.createElement('option');
        defaultOption.value = '';
        defaultOption.textContent = 'All';
        filterSelect.appendChild(defaultOption);
        
        filterOptions.forEach(option => {
            const optionElement = document.createElement('option');
            optionElement.value = option.value;
            optionElement.textContent = option.text;
            filterSelect.appendChild(optionElement);
        });
        
        filterSelect.addEventListener('change', searchHandler);
        container.appendChild(filterSelect);
    }
    
    return container;
}

// Initialize page with common elements
function initPage() {
    const currentUser = checkAuth();
    if (!currentUser) return;
    
    // Create sidebar
    createSidebar();
    
    // Add logout button
    const logoutBtn = document.createElement('button');
    logoutBtn.className = 'logout-btn';
    logoutBtn.textContent = 'Logout';
    logoutBtn.onclick = logout;
    
    const sidebar = document.querySelector('.sidebar');
    if (sidebar) {
        sidebar.appendChild(logoutBtn);
    }
    
    return currentUser;
}

// Utility functions for data manipulation
function filterData(data, searchTerm, filterValue, searchFields) {
    return data.filter(item => {
        const matchesSearch = !searchTerm || searchFields.some(field => 
            item[field] && item[field].toString().toLowerCase().includes(searchTerm.toLowerCase())
        );
        
        const matchesFilter = !filterValue || item.status === filterValue || item.department === filterValue;
        
        return matchesSearch && matchesFilter;
    });
}

function sortData(data, field, direction = 'asc') {
    return data.sort((a, b) => {
        const aVal = a[field];
        const bVal = b[field];
        
        if (direction === 'asc') {
            return aVal > bVal ? 1 : -1;
        } else {
            return aVal < bVal ? 1 : -1;
        }
    });
}

// Export data to JSON
function exportToJSON(data, filename) {
    const jsonString = JSON.stringify(data, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

// Export data to CSV
function exportToCSV(data, filename) {
    if (data.length === 0) return;
    
    const headers = Object.keys(data[0]);
    const csvContent = [
        headers.join(','),
        ...data.map(row => headers.map(header => `"${row[header] || ''}"`).join(','))
    ].join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}
