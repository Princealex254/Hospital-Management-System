// Firebase Database Utilities for Prince Alex Hospital HMS
import { 
  collection, 
  doc, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  getDocs, 
  getDoc, 
  query, 
  where, 
  orderBy, 
  limit,
  onSnapshot,
  serverTimestamp 
} from "firebase/firestore";
import { db } from "./firebase-config.js";

// Collection names
const COLLECTIONS = {
  USERS: 'users',
  PATIENTS: 'patients',
  DOCTORS: 'doctors',
  APPOINTMENTS: 'appointments',
  TRIAGE: 'triage',
  CONSULTATIONS: 'consultations',
  LAB_REQUESTS: 'labRequests',
  LAB_RESULTS: 'labResults',
  PRESCRIPTIONS: 'prescriptions',
  MEDICINES: 'medicines',
  BILLING: 'billing',
  DEPARTMENTS: 'departments',
  SYSTEM_SETTINGS: 'systemSettings'
};

// Generic CRUD operations
export class FirebaseService {
  
  // Create a new document
  static async create(collectionName, data) {
    try {
      const docRef = await addDoc(collection(db, collectionName), {
        ...data,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      return { id: docRef.id, ...data };
    } catch (error) {
      console.error('Error creating document:', error);
      throw error;
    }
  }

  // Read all documents from a collection
  static async getAll(collectionName, orderByField = 'createdAt', orderDirection = 'desc') {
    try {
      const q = query(
        collection(db, collectionName),
        orderBy(orderByField, orderDirection)
      );
      const querySnapshot = await getDocs(q);
      return querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
    } catch (error) {
      console.error('Error getting documents:', error);
      throw error;
    }
  }

  // Read a single document
  static async getById(collectionName, docId) {
    try {
      const docRef = doc(db, collectionName, docId);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        return { id: docSnap.id, ...docSnap.data() };
      } else {
        return null;
      }
    } catch (error) {
      console.error('Error getting document:', error);
      throw error;
    }
  }

  // Update a document
  static async update(collectionName, docId, data) {
    try {
      const docRef = doc(db, collectionName, docId);
      await updateDoc(docRef, {
        ...data,
        updatedAt: serverTimestamp()
      });
      return { id: docId, ...data };
    } catch (error) {
      console.error('Error updating document:', error);
      throw error;
    }
  }

  // Delete a document
  static async delete(collectionName, docId) {
    try {
      await deleteDoc(doc(db, collectionName, docId));
      return true;
    } catch (error) {
      console.error('Error deleting document:', error);
      throw error;
    }
  }

  // Query documents with conditions
  static async query(collectionName, conditions = [], orderByField = 'createdAt', orderDirection = 'desc') {
    try {
      let q = collection(db, collectionName);
      
      // Add where conditions
      conditions.forEach(condition => {
        q = query(q, where(condition.field, condition.operator, condition.value));
      });
      
      // Add ordering
      q = query(q, orderBy(orderByField, orderDirection));
      
      const querySnapshot = await getDocs(q);
      return querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
    } catch (error) {
      console.error('Error querying documents:', error);
      throw error;
    }
  }

  // Real-time listener
  static subscribe(collectionName, callback, orderByField = 'createdAt', orderDirection = 'desc') {
    const q = query(
      collection(db, collectionName),
      orderBy(orderByField, orderDirection)
    );
    
    return onSnapshot(q, (querySnapshot) => {
      const data = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      callback(data);
    });
  }
}

// Specific service classes for each entity
export class PatientService {
  static async createPatient(patientData) {
    return await FirebaseService.create(COLLECTIONS.PATIENTS, patientData);
  }

  static async getAllPatients() {
    return await FirebaseService.getAll(COLLECTIONS.PATIENTS);
  }

  static async getPatientById(patientId) {
    return await FirebaseService.getById(COLLECTIONS.PATIENTS, patientId);
  }

  static async updatePatient(patientId, patientData) {
    return await FirebaseService.update(COLLECTIONS.PATIENTS, patientId, patientData);
  }

  static async deletePatient(patientId) {
    return await FirebaseService.delete(COLLECTIONS.PATIENTS, patientId);
  }

  static async searchPatients(searchTerm) {
    // Note: Firestore doesn't support full-text search natively
    // This is a basic implementation - for production, consider using Algolia or similar
    const patients = await FirebaseService.getAll(COLLECTIONS.PATIENTS);
    return patients.filter(patient => 
      patient.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      patient.contact.includes(searchTerm) ||
      patient.id.includes(searchTerm)
    );
  }
}

export class DoctorService {
  static async createDoctor(doctorData) {
    return await FirebaseService.create(COLLECTIONS.DOCTORS, doctorData);
  }

  static async getAllDoctors() {
    return await FirebaseService.getAll(COLLECTIONS.DOCTORS);
  }

  static async getDoctorById(doctorId) {
    return await FirebaseService.getById(COLLECTIONS.DOCTORS, doctorId);
  }

  static async updateDoctor(doctorId, doctorData) {
    return await FirebaseService.update(COLLECTIONS.DOCTORS, doctorId, doctorData);
  }

  static async getDoctorsByDepartment(department) {
    return await FirebaseService.query(COLLECTIONS.DOCTORS, [
      { field: 'department', operator: '==', value: department }
    ]);
  }
}

export class AppointmentService {
  static async createAppointment(appointmentData) {
    return await FirebaseService.create(COLLECTIONS.APPOINTMENTS, appointmentData);
  }

  static async getAllAppointments() {
    return await FirebaseService.getAll(COLLECTIONS.APPOINTMENTS);
  }

  static async getAppointmentsByDate(date) {
    return await FirebaseService.query(COLLECTIONS.APPOINTMENTS, [
      { field: 'appointmentDate', operator: '==', value: date }
    ]);
  }

  static async getAppointmentsByDoctor(doctorId) {
    return await FirebaseService.query(COLLECTIONS.APPOINTMENTS, [
      { field: 'doctorId', operator: '==', value: doctorId }
    ]);
  }

  static async updateAppointment(appointmentId, appointmentData) {
    return await FirebaseService.update(COLLECTIONS.APPOINTMENTS, appointmentId, appointmentData);
  }

  static async deleteAppointment(appointmentId) {
    return await FirebaseService.delete(COLLECTIONS.APPOINTMENTS, appointmentId);
  }
}

export class TriageService {
  static async createTriageRecord(triageData) {
    return await FirebaseService.create(COLLECTIONS.TRIAGE, triageData);
  }

  static async getAllTriageRecords() {
    return await FirebaseService.getAll(COLLECTIONS.TRIAGE);
  }

  static async getTriageByStatus(status) {
    return await FirebaseService.query(COLLECTIONS.TRIAGE, [
      { field: 'status', operator: '==', value: status }
    ]);
  }

  static async updateTriageRecord(triageId, triageData) {
    return await FirebaseService.update(COLLECTIONS.TRIAGE, triageId, triageData);
  }
}

export class ConsultationService {
  static async createConsultation(consultationData) {
    return await FirebaseService.create(COLLECTIONS.CONSULTATIONS, consultationData);
  }

  static async getAllConsultations() {
    return await FirebaseService.getAll(COLLECTIONS.CONSULTATIONS);
  }

  static async getConsultationsByDoctor(doctorId) {
    return await FirebaseService.query(COLLECTIONS.CONSULTATIONS, [
      { field: 'doctorId', operator: '==', value: doctorId }
    ]);
  }

  static async getConsultationsByPatient(patientId) {
    return await FirebaseService.query(COLLECTIONS.CONSULTATIONS, [
      { field: 'patientId', operator: '==', value: patientId }
    ]);
  }

  static async updateConsultation(consultationId, consultationData) {
    return await FirebaseService.update(COLLECTIONS.CONSULTATIONS, consultationId, consultationData);
  }
}

export class LabService {
  static async createLabRequest(labRequestData) {
    return await FirebaseService.create(COLLECTIONS.LAB_REQUESTS, labRequestData);
  }

  static async getAllLabRequests() {
    return await FirebaseService.getAll(COLLECTIONS.LAB_REQUESTS);
  }

  static async getLabRequestsByStatus(status) {
    return await FirebaseService.query(COLLECTIONS.LAB_REQUESTS, [
      { field: 'status', operator: '==', value: status }
    ]);
  }

  static async createLabResult(labResultData) {
    return await FirebaseService.create(COLLECTIONS.LAB_RESULTS, labResultData);
  }

  static async getAllLabResults() {
    return await FirebaseService.getAll(COLLECTIONS.LAB_RESULTS);
  }

  static async updateLabRequest(labRequestId, labRequestData) {
    return await FirebaseService.update(COLLECTIONS.LAB_REQUESTS, labRequestId, labRequestData);
  }
}

export class PrescriptionService {
  static async createPrescription(prescriptionData) {
    return await FirebaseService.create(COLLECTIONS.PRESCRIPTIONS, prescriptionData);
  }

  static async getAllPrescriptions() {
    return await FirebaseService.getAll(COLLECTIONS.PRESCRIPTIONS);
  }

  static async getPrescriptionsByStatus(status) {
    return await FirebaseService.query(COLLECTIONS.PRESCRIPTIONS, [
      { field: 'status', operator: '==', value: status }
    ]);
  }

  static async updatePrescription(prescriptionId, prescriptionData) {
    return await FirebaseService.update(COLLECTIONS.PRESCRIPTIONS, prescriptionId, prescriptionData);
  }
}

export class MedicineService {
  static async createMedicine(medicineData) {
    return await FirebaseService.create(COLLECTIONS.MEDICINES, medicineData);
  }

  static async getAllMedicines() {
    return await FirebaseService.getAll(COLLECTIONS.MEDICINES);
  }

  static async getMedicineById(medicineId) {
    return await FirebaseService.getById(COLLECTIONS.MEDICINES, medicineId);
  }

  static async updateMedicine(medicineId, medicineData) {
    return await FirebaseService.update(COLLECTIONS.MEDICINES, medicineId, medicineData);
  }

  static async getLowStockMedicines() {
    const medicines = await FirebaseService.getAll(COLLECTIONS.MEDICINES);
    return medicines.filter(medicine => medicine.quantity <= medicine.minStock);
  }
}

export class BillingService {
  static async createBill(billData) {
    return await FirebaseService.create(COLLECTIONS.BILLING, billData);
  }

  static async getAllBills() {
    return await FirebaseService.getAll(COLLECTIONS.BILLING);
  }

  static async getBillsByStatus(status) {
    return await FirebaseService.query(COLLECTIONS.BILLING, [
      { field: 'status', operator: '==', value: status }
    ]);
  }

  static async updateBill(billId, billData) {
    return await FirebaseService.update(COLLECTIONS.BILLING, billId, billData);
  }

  static async getRevenueByDateRange(startDate, endDate) {
    return await FirebaseService.query(COLLECTIONS.BILLING, [
      { field: 'billDate', operator: '>=', value: startDate },
      { field: 'billDate', operator: '<=', value: endDate }
    ]);
  }
}

export class DepartmentService {
  static async createDepartment(departmentData) {
    return await FirebaseService.create(COLLECTIONS.DEPARTMENTS, departmentData);
  }

  static async getAllDepartments() {
    return await FirebaseService.getAll(COLLECTIONS.DEPARTMENTS);
  }

  static async updateDepartment(departmentId, departmentData) {
    return await FirebaseService.update(COLLECTIONS.DEPARTMENTS, departmentId, departmentData);
  }

  static async deleteDepartment(departmentId) {
    return await FirebaseService.delete(COLLECTIONS.DEPARTMENTS, departmentId);
  }
}

export class UserService {
  static async createUser(userData) {
    return await FirebaseService.create(COLLECTIONS.USERS, userData);
  }

  static async getAllUsers() {
    return await FirebaseService.getAll(COLLECTIONS.USERS);
  }

  static async getUserById(userId) {
    return await FirebaseService.getById(COLLECTIONS.USERS, userId);
  }

  static async updateUser(userId, userData) {
    return await FirebaseService.update(COLLECTIONS.USERS, userId, userData);
  }

  static async getUsersByDepartment(department) {
    return await FirebaseService.query(COLLECTIONS.USERS, [
      { field: 'department', operator: '==', value: department }
    ]);
  }
}

// Export collection names for reference
export { COLLECTIONS };
