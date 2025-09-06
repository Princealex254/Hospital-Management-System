// Prince Alex Hospital - Firebase Services
// Comprehensive Firebase integration for all HMS modules

import { 
  collection, 
  doc, 
  getDocs, 
  getDoc,
  addDoc, 
  updateDoc, 
  deleteDoc, 
  query, 
  where, 
  orderBy,
  serverTimestamp,
  onSnapshot
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

import { 
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

// Wait for Firebase to initialize
let db, auth;

function waitForFirebase() {
  return new Promise((resolve) => {
    const checkFirebase = () => {
      if (window.firebaseDb && window.firebaseAuth) {
        db = window.firebaseDb;
        auth = window.firebaseAuth;
        resolve();
      } else {
        setTimeout(checkFirebase, 100);
      }
    };
    checkFirebase();
  });
}

// Patient Management Services
export class PatientService {
  static async getAllPatients() {
    await waitForFirebase();
    try {
      const patientsRef = collection(db, 'patients');
      const q = query(patientsRef, orderBy('createdAt', 'desc'));
      const querySnapshot = await getDocs(q);
      
      const patients = [];
      querySnapshot.forEach((doc) => {
        patients.push({ id: doc.id, ...doc.data() });
      });
      
      return patients;
    } catch (error) {
      console.error('Error fetching patients:', error);
      throw error;
    }
  }

  static async addPatient(patientData) {
    await waitForFirebase();
    try {
      const patientsRef = collection(db, 'patients');
      const docRef = await addDoc(patientsRef, {
        ...patientData,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      
      return docRef.id;
    } catch (error) {
      console.error('Error adding patient:', error);
      throw error;
    }
  }

  static async updatePatient(patientId, updateData) {
    await waitForFirebase();
    try {
      const patientRef = doc(db, 'patients', patientId);
      await updateDoc(patientRef, {
        ...updateData,
        updatedAt: serverTimestamp()
      });
    } catch (error) {
      console.error('Error updating patient:', error);
      throw error;
    }
  }

  static async deletePatient(patientId) {
    await waitForFirebase();
    try {
      const patientRef = doc(db, 'patients', patientId);
      await deleteDoc(patientRef);
    } catch (error) {
      console.error('Error deleting patient:', error);
      throw error;
    }
  }
}

// Doctor Management Services
export class DoctorService {
  static async getAllDoctors() {
    await waitForFirebase();
    try {
      const doctorsRef = collection(db, 'doctors');
      const q = query(doctorsRef, orderBy('createdAt', 'desc'));
      const querySnapshot = await getDocs(q);
      
      const doctors = [];
      querySnapshot.forEach((doc) => {
        doctors.push({ id: doc.id, ...doc.data() });
      });
      
      return doctors;
    } catch (error) {
      console.error('Error fetching doctors:', error);
      throw error;
    }
  }

  static async addDoctor(doctorData) {
    await waitForFirebase();
    try {
      const doctorsRef = collection(db, 'doctors');
      const docRef = await addDoc(doctorsRef, {
        ...doctorData,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      
      return docRef.id;
    } catch (error) {
      console.error('Error adding doctor:', error);
      throw error;
    }
  }

  static async updateDoctor(doctorId, updateData) {
    await waitForFirebase();
    try {
      const doctorRef = doc(db, 'doctors', doctorId);
      await updateDoc(doctorRef, {
        ...updateData,
        updatedAt: serverTimestamp()
      });
    } catch (error) {
      console.error('Error updating doctor:', error);
      throw error;
    }
  }
}

// Appointment Management Services
export class AppointmentService {
  static async getAllAppointments() {
    await waitForFirebase();
    try {
      const appointmentsRef = collection(db, 'appointments');
      const q = query(appointmentsRef, orderBy('appointmentDate', 'desc'));
      const querySnapshot = await getDocs(q);
      
      const appointments = [];
      querySnapshot.forEach((doc) => {
        appointments.push({ id: doc.id, ...doc.data() });
      });
      
      return appointments;
    } catch (error) {
      console.error('Error fetching appointments:', error);
      throw error;
    }
  }

  static async addAppointment(appointmentData) {
    await waitForFirebase();
    try {
      const appointmentsRef = collection(db, 'appointments');
      const docRef = await addDoc(appointmentsRef, {
        ...appointmentData,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      
      return docRef.id;
    } catch (error) {
      console.error('Error adding appointment:', error);
      throw error;
    }
  }

  static async updateAppointment(appointmentId, updateData) {
    await waitForFirebase();
    try {
      const appointmentRef = doc(db, 'appointments', appointmentId);
      await updateDoc(appointmentRef, {
        ...updateData,
        updatedAt: serverTimestamp()
      });
    } catch (error) {
      console.error('Error updating appointment:', error);
      throw error;
    }
  }

  static async deleteAppointment(appointmentId) {
    await waitForFirebase();
    try {
      const appointmentRef = doc(db, 'appointments', appointmentId);
      await deleteDoc(appointmentRef);
    } catch (error) {
      console.error('Error deleting appointment:', error);
      throw error;
    }
  }
}

// Lab Results Services
export class LabService {
  static async getAllLabResults() {
    await waitForFirebase();
    try {
      const labRef = collection(db, 'labResults');
      const q = query(labRef, orderBy('createdAt', 'desc'));
      const querySnapshot = await getDocs(q);
      
      const labResults = [];
      querySnapshot.forEach((doc) => {
        labResults.push({ id: doc.id, ...doc.data() });
      });
      
      return labResults;
    } catch (error) {
      console.error('Error fetching lab results:', error);
      throw error;
    }
  }

  static async addLabResult(labData) {
    await waitForFirebase();
    try {
      const labRef = collection(db, 'labResults');
      const docRef = await addDoc(labRef, {
        ...labData,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      
      return docRef.id;
    } catch (error) {
      console.error('Error adding lab result:', error);
      throw error;
    }
  }

  static async updateLabResult(labId, updateData) {
    await waitForFirebase();
    try {
      const labRef = doc(db, 'labResults', labId);
      await updateDoc(labRef, {
        ...updateData,
        updatedAt: serverTimestamp()
      });
    } catch (error) {
      console.error('Error updating lab result:', error);
      throw error;
    }
  }
}

// Pharmacy Services
export class PharmacyService {
  static async getAllMedications() {
    await waitForFirebase();
    try {
      const medsRef = collection(db, 'medications');
      const q = query(medsRef, orderBy('createdAt', 'desc'));
      const querySnapshot = await getDocs(q);
      
      const medications = [];
      querySnapshot.forEach((doc) => {
        medications.push({ id: doc.id, ...doc.data() });
      });
      
      return medications;
    } catch (error) {
      console.error('Error fetching medications:', error);
      throw error;
    }
  }

  static async addMedication(medicationData) {
    await waitForFirebase();
    try {
      const medsRef = collection(db, 'medications');
      const docRef = await addDoc(medsRef, {
        ...medicationData,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      
      return docRef.id;
    } catch (error) {
      console.error('Error adding medication:', error);
      throw error;
    }
  }

  static async updateMedication(medId, updateData) {
    await waitForFirebase();
    try {
      const medRef = doc(db, 'medications', medId);
      await updateDoc(medRef, {
        ...updateData,
        updatedAt: serverTimestamp()
      });
    } catch (error) {
      console.error('Error updating medication:', error);
      throw error;
    }
  }
}

// Triage Services
export class TriageService {
  static async getAllTriageRecords() {
    await waitForFirebase();
    try {
      const triageRef = collection(db, 'triage');
      const q = query(triageRef, orderBy('createdAt', 'desc'));
      const querySnapshot = await getDocs(q);
      
      const triageRecords = [];
      querySnapshot.forEach((doc) => {
        triageRecords.push({ id: doc.id, ...doc.data() });
      });
      
      return triageRecords;
    } catch (error) {
      console.error('Error fetching triage records:', error);
      throw error;
    }
  }

  static async addTriageRecord(triageData) {
    await waitForFirebase();
    try {
      const triageRef = collection(db, 'triage');
      const docRef = await addDoc(triageRef, {
        ...triageData,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      
      return docRef.id;
    } catch (error) {
      console.error('Error adding triage record:', error);
      throw error;
    }
  }

  static async updateTriageRecord(triageId, updateData) {
    await waitForFirebase();
    try {
      const triageRef = doc(db, 'triage', triageId);
      await updateDoc(triageRef, {
        ...updateData,
        updatedAt: serverTimestamp()
      });
    } catch (error) {
      console.error('Error updating triage record:', error);
      throw error;
    }
  }
}

// Billing Services
export class BillingService {
  static async getAllBills() {
    await waitForFirebase();
    try {
      const billsRef = collection(db, 'bills');
      const q = query(billsRef, orderBy('createdAt', 'desc'));
      const querySnapshot = await getDocs(q);
      
      const bills = [];
      querySnapshot.forEach((doc) => {
        bills.push({ id: doc.id, ...doc.data() });
      });
      
      return bills;
    } catch (error) {
      console.error('Error fetching bills:', error);
      throw error;
    }
  }

  static async addBill(billData) {
    await waitForFirebase();
    try {
      const billsRef = collection(db, 'bills');
      const docRef = await addDoc(billsRef, {
        ...billData,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      
      return docRef.id;
    } catch (error) {
      console.error('Error adding bill:', error);
      throw error;
    }
  }

  static async updateBill(billId, updateData) {
    await waitForFirebase();
    try {
      const billRef = doc(db, 'bills', billId);
      await updateDoc(billRef, {
        ...updateData,
        updatedAt: serverTimestamp()
      });
    } catch (error) {
      console.error('Error updating bill:', error);
      throw error;
    }
  }
}

// Dashboard Statistics Service
export class DashboardService {
  static async getDashboardStats() {
    await waitForFirebase();
    try {
      const [patients, appointments, labResults, medications] = await Promise.all([
        PatientService.getAllPatients(),
        AppointmentService.getAllAppointments(),
        LabService.getAllLabResults(),
        PharmacyService.getAllMedications()
      ]);

      const today = new Date().toDateString();
      const todayAppointments = appointments.filter(apt => 
        new Date(apt.appointmentDate).toDateString() === today
      );

      return {
        totalPatients: patients.length,
        totalAppointments: appointments.length,
        todayAppointments: todayAppointments.length,
        totalLabResults: labResults.length,
        totalMedications: medications.length,
        activePatients: patients.filter(p => p.status === 'Active').length,
        dischargedPatients: patients.filter(p => p.status === 'Discharged').length
      };
    } catch (error) {
      console.error('Error fetching dashboard stats:', error);
      throw error;
    }
  }

  static async getRecentActivities() {
    await waitForFirebase();
    try {
      const [patients, appointments, labResults] = await Promise.all([
        PatientService.getAllPatients(),
        AppointmentService.getAllAppointments(),
        LabService.getAllLabResults()
      ]);

      const activities = [];
      
      // Add recent patients
      patients.slice(0, 5).forEach(patient => {
        activities.push({
          type: 'patient',
          message: `New patient ${patient.firstName} ${patient.lastName} registered`,
          timestamp: patient.createdAt,
          icon: '👤'
        });
      });

      // Add recent appointments
      appointments.slice(0, 5).forEach(appointment => {
        activities.push({
          type: 'appointment',
          message: `Appointment scheduled for ${appointment.patientName}`,
          timestamp: appointment.createdAt,
          icon: '📅'
        });
      });

      // Add recent lab results
      labResults.slice(0, 5).forEach(lab => {
        activities.push({
          type: 'lab',
          message: `Lab results ready for ${lab.patientName}`,
          timestamp: lab.createdAt,
          icon: '🧪'
        });
      });

      // Sort by timestamp and return top 10
      return activities
        .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
        .slice(0, 10);
    } catch (error) {
      console.error('Error fetching recent activities:', error);
      throw error;
    }
  }
}

// Authentication and Authorization Service
export class AuthService {
  static async getCurrentUser() {
    await waitForFirebase();
    return new Promise((resolve) => {
      onAuthStateChanged(auth, async (user) => {
        if (user) {
          try {
            // Get user role from Firestore
            const roleRef = doc(db, 'roles', user.email);
            const roleSnap = await getDoc(roleRef);
            
            if (roleSnap.exists()) {
              const userRole = roleSnap.data();
              resolve({
                uid: user.uid,
                email: user.email,
                displayName: user.displayName,
                role: userRole.role,
                department: userRole.department,
                status: userRole.status
              });
            } else {
              resolve(null);
            }
          } catch (error) {
            console.error('Error getting user role:', error);
            resolve(null);
          }
        } else {
          resolve(null);
        }
      });
    });
  }

  static async logout() {
    await waitForFirebase();
    try {
      await signOut(auth);
      localStorage.removeItem('currentUser');
      window.location.href = 'login.html';
    } catch (error) {
      console.error('Error logging out:', error);
      throw error;
    }
  }

  static async checkUserAccess(requiredRole) {
    const user = await this.getCurrentUser();
    if (!user) {
      window.location.href = 'login.html';
      return false;
    }

    if (user.role !== requiredRole && user.role !== 'Admin') {
      showAlert('Access denied. Insufficient privileges.', 'error');
      return false;
    }

    return true;
  }
}

// Utility function for showing alerts
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

// Export all services
export {
  PatientService,
  DoctorService,
  AppointmentService,
  LabService,
  PharmacyService,
  TriageService,
  BillingService,
  DashboardService,
  AuthService,
  showAlert
};
