// Prince Alex Hospital - Admin Setup Script
// Run this script once to create the first admin user and set up the roles collection

import { 
  createUserWithEmailAndPassword,
  updateProfile
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

import { 
  collection, 
  doc,
  addDoc, 
  setDoc,
  serverTimestamp 
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

// Admin setup function
async function setupAdmin() {
  await waitForFirebase();
  
  const adminEmail = 'admin@princealexhospital.com';
  const adminPassword = 'Admin123!';
  const adminName = 'System Administrator';
  
  try {
    console.log('Creating admin user...');
    
    // Create admin user with Firebase Auth
    const userCredential = await createUserWithEmailAndPassword(auth, adminEmail, adminPassword);
    const user = userCredential.user;
    
    // Update user profile
    await updateProfile(user, {
      displayName: adminName
    });
    
    console.log('Admin user created successfully!');
    
    // Add admin role to Firestore (using email as document ID)
    const roleRef = doc(db, 'roles', adminEmail);
    const roleData = {
      email: adminEmail,
      role: 'Admin',
      department: 'Admin',
      uid: user.uid,
      displayName: adminName,
      createdAt: serverTimestamp(),
      createdBy: 'system'
    };
    
    await setDoc(roleRef, roleData);
    
    console.log('Admin role added to Firestore!');
    console.log('Admin setup complete!');
    console.log('Email:', adminEmail);
    console.log('Password:', adminPassword);
    console.log('You can now login with these credentials.');
    
    // Sign out the admin user
    await auth.signOut();
    
  } catch (error) {
    console.error('Admin setup error:', error);
    
    if (error.code === 'auth/email-already-in-use') {
      console.log('Admin user already exists. Checking role...');
      
      // Check if role exists in Firestore
      const { query, where, getDocs } = await import("https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js");
      const rolesRef = collection(db, 'roles');
      const q = query(rolesRef, where('email', '==', adminEmail));
      const querySnapshot = await getDocs(q);
      
      if (querySnapshot.empty) {
        console.log('Admin user exists but no role found. Adding role...');
        
        // Get the existing user
        const { signInWithEmailAndPassword } = await import("https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js");
        const userCredential = await signInWithEmailAndPassword(auth, adminEmail, adminPassword);
        const user = userCredential.user;
        
        // Add role (using email as document ID)
        const roleRef = doc(db, 'roles', adminEmail);
        const roleData = {
          email: adminEmail,
          role: 'Admin',
          department: 'Admin',
          uid: user.uid,
          displayName: adminName,
          createdAt: serverTimestamp(),
          createdBy: 'system'
        };
        
        await setDoc(roleRef, roleData);
        await auth.signOut();
        
        console.log('Admin role added successfully!');
      } else {
        console.log('Admin user and role already exist.');
      }
    }
  }
}

// Sample users setup function
async function setupSampleUsers() {
  await waitForFirebase();
  
  const sampleUsers = [
    {
      email: 'doctor@princealexhospital.com',
      password: 'Doctor123!',
      name: 'Dr. Sarah Johnson',
      role: 'Doctor',
      department: 'Cardiology'
    },
    {
      email: 'nurse@princealexhospital.com',
      password: 'Nurse123!',
      name: 'Nurse Mary Smith',
      role: 'Nurse',
      department: 'Emergency'
    },
    {
      email: 'pharmacy@princealexhospital.com',
      password: 'Pharmacy123!',
      name: 'Pharmacist John Doe',
      role: 'Pharmacy',
      department: 'Pharmacy'
    },
    {
      email: 'lab@princealexhospital.com',
      password: 'Lab123!',
      name: 'Lab Technician Jane Wilson',
      role: 'Lab',
      department: 'Laboratory'
    },
    {
      email: 'reception@princealexhospital.com',
      password: 'Reception123!',
      name: 'Receptionist Mike Brown',
      role: 'Reception',
      department: 'Reception'
    }
  ];
  
  console.log('Creating sample users...');
  
  for (const userData of sampleUsers) {
    try {
      // Create user
      const userCredential = await createUserWithEmailAndPassword(auth, userData.email, userData.password);
      const user = userCredential.user;
      
      // Update profile
      await updateProfile(user, {
        displayName: userData.name
      });
      
      // Add role to Firestore (using email as document ID)
      const roleRef = doc(db, 'roles', userData.email);
      const roleData = {
        email: userData.email,
        role: userData.role,
        department: userData.department,
        uid: user.uid,
        displayName: userData.name,
        createdAt: serverTimestamp(),
        createdBy: 'admin'
      };
      
      await setDoc(roleRef, roleData);
      
      console.log(`Created ${userData.role}: ${userData.email}`);
      
    } catch (error) {
      if (error.code === 'auth/email-already-in-use') {
        console.log(`${userData.role} user already exists: ${userData.email}`);
      } else {
        console.error(`Error creating ${userData.role}:`, error);
      }
    }
  }
  
  console.log('Sample users setup complete!');
}

// Firestore security rules template
function getSecurityRules() {
  return `
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Roles collection - only authenticated users can read
    match /roles/{document} {
      allow read, write: if request.auth != null;
    }
    
    // Patients collection - role-based access
    match /patients/{document} {
      allow read: if request.auth != null;
      allow write: if request.auth != null && 
        (get(/databases/$(database)/documents/roles/$(request.auth.uid)).data.role == 'Admin' ||
         get(/databases/$(database)/documents/roles/$(request.auth.uid)).data.role in ['Doctor', 'Nurse']);
    }
    
    // Appointments collection
    match /appointments/{document} {
      allow read: if request.auth != null;
      allow write: if request.auth != null && 
        (get(/databases/$(database)/documents/roles/$(request.auth.uid)).data.role == 'Admin' ||
         get(/databases/$(database)/documents/roles/$(request.auth.uid)).data.role in ['Reception', 'Doctor']);
    }
    
    // Consultations collection
    match /consultations/{document} {
      allow read: if request.auth != null;
      allow write: if request.auth != null && 
        (get(/databases/$(database)/documents/roles/$(request.auth.uid)).data.role == 'Admin' ||
         get(/databases/$(database)/documents/roles/$(request.auth.uid)).data.role == 'Doctor');
    }
    
    // Lab requests and results
    match /labRequests/{document} {
      allow read: if request.auth != null;
      allow write: if request.auth != null && 
        (get(/databases/$(database)/documents/roles/$(request.auth.uid)).data.role == 'Admin' ||
         get(/databases/$(database)/documents/roles/$(request.auth.uid)).data.role in ['Doctor', 'Lab']);
    }
    
    match /labResults/{document} {
      allow read: if request.auth != null;
      allow write: if request.auth != null && 
        (get(/databases/$(database)/documents/roles/$(request.auth.uid)).data.role == 'Admin' ||
         get(/databases/$(database)/documents/roles/$(request.auth.uid)).data.role == 'Lab');
    }
    
    // Prescriptions and medicines
    match /prescriptions/{document} {
      allow read: if request.auth != null;
      allow write: if request.auth != null && 
        (get(/databases/$(database)/documents/roles/$(request.auth.uid)).data.role == 'Admin' ||
         get(/databases/$(database)/documents/roles/$(request.auth.uid)).data.role in ['Doctor', 'Pharmacy']);
    }
    
    match /medicines/{document} {
      allow read: if request.auth != null;
      allow write: if request.auth != null && 
        (get(/databases/$(database)/documents/roles/$(request.auth.uid)).data.role == 'Admin' ||
         get(/databases/$(database)/documents/roles/$(request.auth.uid)).data.role == 'Pharmacy');
    }
    
    // Billing collection
    match /billing/{document} {
      allow read: if request.auth != null;
      allow write: if request.auth != null && 
        (get(/databases/$(database)/documents/roles/$(request.auth.uid)).data.role == 'Admin' ||
         get(/databases/$(database)/documents/roles/$(request.auth.uid)).data.role == 'Reception');
    }
  }
}`;
}

// Export functions for use in console
window.AdminSetup = {
  setupAdmin,
  setupSampleUsers,
  getSecurityRules
};

console.log('Admin Setup Script Loaded!');
console.log('Available functions:');
console.log('- AdminSetup.setupAdmin() - Create first admin user');
console.log('- AdminSetup.setupSampleUsers() - Create sample users for testing');
console.log('- AdminSetup.getSecurityRules() - Get Firestore security rules');
console.log('');
console.log('To create the first admin user, run: AdminSetup.setupAdmin()');
