# 🏥 Prince Alex Hospital Management System (HMS)

A comprehensive Hospital Management System built with HTML5, CSS3, JavaScript, and Firebase. This system provides secure role-based access control for hospital staff and administrators.

## 🌟 Features

### 🔐 **Authentication & Security**
- **Firebase Email/Password Authentication** - Secure login system
- **Role-Based Access Control (RBAC)** - 8 different user roles
- **Page-Level Protection** - Automatic access control
- **Session Management** - Secure user sessions

### 👥 **User Roles**
- **Admin** - Full system access and user management
- **Doctor** - Patient care and consultations
- **Nurse** - Patient management and triage
- **Pharmacy** - Medication and prescription management
- **Lab** - Laboratory test management
- **Reception** - Appointment scheduling and billing
- **Triage** - Emergency intake management
- **Staff** - General access and patient viewing

### 📱 **Modules**
- **Patient Management** - Complete patient records
- **Appointment Scheduling** - Calendar-based booking
- **Doctor Consultations** - Medical consultation records
- **Laboratory Management** - Test requests and results
- **Pharmacy Management** - Prescription and inventory
- **Billing System** - Payment processing
- **Reports & Analytics** - System insights
- **Admin Dashboard** - User and system management

## 🚀 Quick Start

### **Prerequisites**
- Modern web browser (Chrome, Firefox, Safari, Edge)
- Firebase project with Authentication and Firestore enabled
- Basic knowledge of HTML, CSS, and JavaScript

### **Installation**

1. **Clone the repository**
   ```bash
   git clone https://github.com/yourusername/prince-alex-hospital-hms.git
   cd prince-alex-hospital-hms
   ```

2. **Firebase Setup**
   - Create a new Firebase project at [Firebase Console](https://console.firebase.google.com/)
   - Enable Authentication (Email/Password)
   - Enable Firestore Database
   - Copy your Firebase configuration

3. **Configure Firebase**
   - Update Firebase configuration in all HTML files
   - Set up Firestore security rules
   - Deploy to Firebase Hosting (optional)

4. **Initial Setup**
   - Open `setup.html` in your browser
   - Create admin user
   - Copy security rules to Firebase Console
   - Test login system

## 🔧 Configuration

### **Firebase Configuration**
Update the Firebase configuration in all HTML files:

```javascript
const firebaseConfig = {
    apiKey: "your-api-key",
    authDomain: "your-project.firebaseapp.com",
    projectId: "your-project-id",
    storageBucket: "your-project.appspot.com",
    messagingSenderId: "your-sender-id",
    appId: "your-app-id"
};
```

### **Default Credentials**
```
Admin: admin@princealexhospital.com / Admin123!
Doctor: doctor@princealexhospital.com / Doctor123!
Nurse: nurse@princealexhospital.com / Nurse123!
Pharmacy: pharmacy@princealexhospital.com / Pharmacy123!
Lab: lab@princealexhospital.com / Lab123!
Reception: reception@princealexhospital.com / Reception123!
```

## 📁 Project Structure

```
prince-alex-hospital-hms/
├── 📄 HTML Files
│   ├── login.html              # Login page
│   ├── index.html              # General dashboard
│   ├── admin.html              # Admin dashboard
│   ├── patients.html           # Patient management
│   ├── appointments.html       # Appointment scheduling
│   ├── doctors.html            # Doctor consultations
│   ├── lab.html                # Laboratory management
│   ├── pharmacy.html           # Pharmacy management
│   ├── billing.html            # Billing system
│   ├── reports.html            # Reports & analytics
│   ├── triage.html             # Triage management
│   └── setup.html              # Initial setup page
├── 🎨 Styling
│   └── styles.css              # Global styles
├── ⚙️ JavaScript Files
│   ├── login-auth.js           # Login authentication
│   ├── admin-role-management.js # Role management
│   ├── admin-setup.js          # Admin setup
│   ├── firebase-auth-system.js # Firebase auth system
│   ├── page-protection-auth.js # Page protection
│   └── [module]-auth-example.js # Example implementations
├── 📚 Documentation
│   ├── README.md               # This file
│   ├── LOGIN-SYSTEM-README.md  # Login system guide
│   ├── ADMIN-ROLE-MANAGEMENT-GUIDE.md # Admin guide
│   ├── FIREBASE-AUTH-GUIDE.md  # Firebase auth guide
│   └── RBAC-GUIDE.md           # Role-based access guide
└── 🔧 Configuration
    ├── .gitignore              # Git ignore file
    └── firebase-config.js      # Firebase configuration
```

## 🛡️ Security Features

### **Authentication Security**
- Firebase Authentication handles all security
- Email/password validation
- Session management
- Automatic logout on permission changes

### **Authorization Security**
- Role-based access control
- Firestore security rules
- Page-level protection
- Action-level protection

### **Data Security**
- Encrypted data transmission
- Secure role storage
- Audit trail for user actions
- Network error handling

## 🔄 Workflow

### **1. User Registration**
1. User registers with Firebase Auth
2. Admin assigns role to user
3. User can now log in

### **2. Login Process**
1. User enters email/password
2. Firebase Auth verifies credentials
3. System checks Firestore roles collection
4. User is redirected to appropriate page

### **3. Role Management**
1. Admin assigns roles to users
2. Roles determine page access
3. Users see only authorized content
4. All actions are logged

## 📊 Database Structure

### **Firestore Collections**
- **`roles`** - User roles and permissions
- **`patients`** - Patient records
- **`appointments`** - Appointment data
- **`consultations`** - Doctor consultations
- **`labRequests`** - Laboratory requests
- **`labResults`** - Laboratory results
- **`prescriptions`** - Medication prescriptions
- **`medicines`** - Medicine inventory
- **`billing`** - Billing records

## 🚀 Deployment

### **Firebase Hosting**
1. Install Firebase CLI
   ```bash
   npm install -g firebase-tools
   ```

2. Login to Firebase
   ```bash
   firebase login
   ```

3. Initialize Firebase project
   ```bash
   firebase init hosting
   ```

4. Deploy to Firebase
   ```bash
   firebase deploy
   ```

### **Other Hosting Options**
- **Netlify** - Drag and drop deployment
- **Vercel** - Git-based deployment
- **GitHub Pages** - Free hosting for public repos
- **Traditional Web Hosting** - Upload files via FTP

## 🔧 Customization

### **Adding New Roles**
1. Update `ROLE_REDIRECTS` in JavaScript files
2. Add role to admin form dropdown
3. Update Firestore security rules
4. Create role-specific pages

### **Modifying Permissions**
1. Update Firestore security rules
2. Modify permission checks in JavaScript
3. Update UI elements with permission attributes
4. Test role-based access

### **Styling Customization**
1. Modify `styles.css` for global changes
2. Add page-specific styles
3. Update color scheme and branding
4. Customize responsive design

## 📈 Performance Optimization

### **Caching**
- User data cached in localStorage
- Permissions cached in memory
- Role data cached locally

### **Lazy Loading**
- Firebase modules loaded on demand
- Page components loaded based on permissions
- User data fetched only when needed

## 🐛 Troubleshooting

### **Common Issues**

1. **"You do not have access. Contact Admin."**
   - User exists in Firebase Auth but not in roles collection
   - Solution: Admin assigns role to user

2. **"Incorrect email or password"**
   - Check Firebase Auth configuration
   - Verify user exists in Firebase Auth

3. **"Network error"**
   - Check internet connection
   - Verify Firebase project configuration

4. **Redirect not working**
   - Check ROLE_REDIRECTS mapping
   - Verify role name in Firestore

### **Debug Steps**
1. Check browser console for errors
2. Verify Firebase configuration
3. Check Firestore security rules
4. Test with admin credentials
5. Verify role data in Firestore

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

### **Development Guidelines**
- Follow existing code style
- Add comments for complex logic
- Test all user roles
- Update documentation
- Ensure security best practices

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 📞 Support

For technical support or questions:
- Check the documentation files
- Review browser console for errors
- Verify Firebase configuration
- Test with provided sample credentials

## 🎯 Roadmap

### **Planned Features**
- Two-factor authentication
- Single sign-on (SSO)
- Advanced user management
- Role hierarchy system
- Audit logging dashboard
- Mobile app integration
- Advanced reporting
- API integration
- Multi-language support

## 🏆 Acknowledgments

- Firebase for authentication and database services
- Modern web standards for responsive design
- Hospital management best practices
- Open source community for inspiration

---

**Prince Alex Hospital Management System** - Built with ❤️ for healthcare professionals

*Version 1.0.0 - December 2024*
