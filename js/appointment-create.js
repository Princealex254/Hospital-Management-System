﻿/**
 * PRINCE ALEX DIGITAL HMS — Appointment Creation Module
 * 
 * Handles:
 * - Loading doctors and departments for the form
 * - Patient search for appointment creation
 * - Creating appointments in Firestore
 * - Audit logging
 */

import { db, collection, addDoc, getDocs, query, where, orderBy, serverTimestamp, limit } from "./firebase-config.js";
import { requireAuth } from "./auth-guard.js";
import { loadSidebar } from "./sidebar.js";
import { showToast, showLoading, hideLoading } from "./notifications.js";
import { debug, debugError } from "./debug.js";
import { getTenantId, getCurrentUser } from "./permissions.js";

// ─── Initialize Page ─────────────────────────────────────────────────────────

document.addEventListener("DOMContentLoaded", async () => {
    debug("Appointment create page: Initializing...");

    showLoading("Loading appointment form...");

    try {
        const user = await requireAuth();
        if (!user) return;

        await loadSidebar();

        // Set default date to today
        const today = new Date().toISOString().split("T")[0];
        document.getElementById("appointment-date").value = today;

        // Load doctors and departments
        await loadDoctors();
        await loadDepartments();

        // Set up patient search
        await setupPatientSearch();

        // Set up form
        setupForm();

        hideLoading();
        debug("Appointment create page: Initialization complete.");
    } catch (error) {
        debugError("Appointment create page initialization error:", error);
        hideLoading();
        showToast("Unable to load page. Please try again.", "error");
    }
});

/**
 * Escapes HTML to prevent XSS.
 * @param {string} text
 * @returns {string}
 */
function escapeHtml(text) {
    if (!text) return "";
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
}

// ─── Load Doctors ────────────────────────────────────────────────────────────

/**
 * Loads doctors from the staff collection for the dropdown.
 */
async function loadDoctors() {
    debug("Loading doctors...");
    const tenantId = getTenantId();
    if (!tenantId) return;

    try {
        const q = query(
            collection(db, "users"),
            where("tenantId", "==", tenantId),
            where("role", "==", "DOCTOR")
        );
        const snapshot = await getDocs(q);

        const select = document.getElementById("doctor");
        if (!select) return;

        // Clear existing options (except placeholder)
        select.innerHTML = '<option value="">Select Doctor</option>';

        snapshot.forEach((doc) => {
            const staff = doc.data();
            const option = document.createElement("option");
            option.value = staff.uid || doc.id;
            option.textContent = staff.name || staff.displayName || "Unknown";
            option.setAttribute("data-department", staff.department || "");
            select.appendChild(option);
        });

        debug("Doctors loaded:", snapshot.size);
    } catch (error) {
        debugError("Error loading doctors:", error);
    }
}

// ─── Patient Search ───────────────────────────────────────────────────────────

/**
 * Sets up the custom searchable patient selector used by the form.
 */
async function setupPatientSearch() {
    const root = document.getElementById("patient-searchable-select");
    const selectControl = root?.querySelector(".select-control");
    const selectValue = root?.querySelector(".select-value");
    const searchInput = root?.querySelector(".select-search");
    const optionsContainer = root?.querySelector(".select-options");
    const patientIdInput = document.getElementById("patient-id");
    const errorDiv = document.getElementById("patient-error");

    if (!root || !selectControl || !selectValue || !searchInput || !optionsContainer || !patientIdInput) return;

    let allPatients = [];

    const setPlaceholder = () => {
        selectValue.textContent = "Select Patient";
        selectValue.classList.add("placeholder");
    };

    const getPatientDisplayName = (patient) => {
        if (patient.name) return patient.name;
        const names = [patient.firstName, patient.lastName].filter(Boolean);
        return names.join(" ") || "Unknown Patient";
    };

    const renderPatients = (patients) => {
        optionsContainer.innerHTML = "";

        if (!patients.length) {
            const emptyOption = document.createElement("div");
            emptyOption.className = "select-option";
            emptyOption.style.color = "var(--color-gray-500)";
            emptyOption.textContent = "No patients found";
            optionsContainer.appendChild(emptyOption);
            return;
        }

        patients.forEach((patient) => {
            const option = document.createElement("div");
            option.className = "select-option";
            const fullName = getPatientDisplayName(patient);
            const patientId = patient.patientId || patient.id || "";
            const phone = patient.phone || "No phone";

            option.innerHTML = `
                <div style="font-weight: 600; color: var(--color-gray-900);">${escapeHtml(fullName)}</div>
                <div style="font-size: 11px; color: var(--color-gray-500); margin-top: 2px;">
                    ${escapeHtml(patientId)} • ${escapeHtml(phone)}
                </div>
            `;

            option.addEventListener("click", () => {
                patientIdInput.value = patient.id;
                selectValue.textContent = fullName;
                selectValue.classList.remove("placeholder");
                root.classList.remove("open");
                searchInput.value = "";
                if (errorDiv) errorDiv.textContent = "";
                renderPatients(allPatients);
            });

            optionsContainer.appendChild(option);
        });
    };

    const filterPatients = (value) => {
        const q = value.trim().toLowerCase();
        if (!q) {
            renderPatients(allPatients);
            return;
        }

        const filtered = allPatients.filter((patient) => {
            const fullName = getPatientDisplayName(patient).toLowerCase();
            const patientId = (patient.patientId || "").toLowerCase();
            const phone = (patient.phone || "").toLowerCase();
            const email = (patient.email || "").toLowerCase();
            return fullName.includes(q) || patientId.includes(q) || phone.includes(q) || email.includes(q);
        });

        renderPatients(filtered);
    };

    const loadPatients = async () => {
        const tenantId = getTenantId();
        if (!tenantId) return;

        try {
            const q = query(
                collection(db, "patients"),
                where("tenantId", "==", tenantId),
                orderBy("createdAt", "desc")
            );
            const snapshot = await getDocs(q);
            allPatients = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
            renderPatients(allPatients);

            const urlParams = new URLSearchParams(window.location.search);
            const selectedPatientId = urlParams.get("patientId");
            if (selectedPatientId) {
                const chosen = allPatients.find((patient) => patient.id === selectedPatientId || patient.patientId === selectedPatientId);
                if (chosen) {
                    patientIdInput.value = chosen.id;
                    selectValue.textContent = getPatientDisplayName(chosen);
                    selectValue.classList.remove("placeholder");
                }
            }
        } catch (error) {
            debugError("Error loading patients for appointment form:", error);
            if (errorDiv) errorDiv.textContent = "Unable to load patients.";
        }
    };

    selectControl.addEventListener("click", () => {
        root.classList.toggle("open");
        if (root.classList.contains("open")) {
            searchInput.focus();
        }
    });

    searchInput.addEventListener("input", (event) => {
        filterPatients(event.target.value);
    });

    document.addEventListener("click", (event) => {
        if (!root.contains(event.target)) {
            root.classList.remove("open");
        }
    });

    setPlaceholder();
    await loadPatients();
}

// ─── Load Departments ────────────────────────────────────────────────────────

/**
 * Loads departments from the departments collection.
 */
async function loadDepartments() {
    debug("Loading departments...");
    const tenantId = getTenantId();
    if (!tenantId) return;

    try {
        const q = query(
            collection(db, "departments"),
            where("tenantId", "==", tenantId)
        );
        const snapshot = await getDocs(q);

        const select = document.getElementById("department");
        if (!select) return;

        // Clear existing options (except placeholder)
        select.innerHTML = '<option value="">Select Department</option>';

        snapshot.forEach((doc) => {
            const dept = doc.data();
            const option = document.createElement("option");
            option.value = doc.id;
            option.textContent = dept.name || "Unknown";
            select.appendChild(option);
        });

        debug("Departments loaded:", snapshot.size);
    } catch (error) {
        debugError("Error loading departments:", error);
    }
}

// ─── Form Setup ──────────────────────────────────────────────────────────────

/**
 * Sets up the appointment creation form.
 */
function setupForm() {
    const form = document.getElementById("appointment-form");
    const submitBtn = document.getElementById("submit-btn");
    const btnText = submitBtn.querySelector(".btn-text");
    const btnLoading = submitBtn.querySelector(".btn-loading");

    if (!form) return;

    form.addEventListener("submit", async (e) => {
        e.preventDefault();

        btnText.style.display = "none";
        btnLoading.style.display = "inline";
        submitBtn.disabled = true;

        try {
            await createAppointment();
        } catch (error) {
            debugError("Appointment creation error:", error);
            showToast(error.message || "Unable to create appointment. Please try again.", "error");
        } finally {
            btnText.style.display = "inline";
            btnLoading.style.display = "none";
            submitBtn.disabled = false;
        }
    });
}

// ─── Create Appointment ──────────────────────────────────────────────────────

/**
 * Collects form data and creates a new appointment in Firestore.
 */
async function createAppointment() {
    debug("Creating appointment...");

    const tenantId = getTenantId();
    if (!tenantId) {
        throw new Error("No tenant ID found. Please log in again.");
    }

    // Collect form data
    const patientId = document.getElementById("patient-id").value;
    const patientName = document.getElementById("patient-searchable-select").querySelector(".select-value").textContent.trim();
    const doctorId = document.getElementById("doctor").value;
    const doctorName = document.getElementById("doctor").selectedOptions[0]?.textContent || "";
    const department = document.getElementById("department").value;
    const appointmentType = document.getElementById("appointment-type").value;
    const date = document.getElementById("appointment-date").value;
    const time = document.getElementById("appointment-time").value;
    const duration = document.getElementById("duration").value;
    const priority = document.getElementById("priority").value;
    const notes = document.getElementById("notes").value.trim();

    // Validate required fields
    if (!patientId || !doctorId || !date || !time) {
        throw new Error("Please fill in all required fields (marked with *).");
    }

    // Build appointment object
    const appointmentData = {
        tenantId,
        patientId,
        patientName,
        doctorId,
        doctorName,
        department,
        type: appointmentType,
        date: new Date(date),
        timeSlot: time,
        duration: parseInt(duration) || 30,
        priority,
        status: "scheduled",
        notes: notes || null,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        createdBy: getCurrentUser()?.uid || ""
    };

    showLoading("Saving appointment...");

    const docRef = await addDoc(collection(db, "appointments"), appointmentData);
    debug("Appointment created with ID:", docRef.id);

    // Log audit
    await addDoc(collection(db, "auditLogs"), {
        tenantId,
        userId: getCurrentUser()?.uid || "",
        action: "CREATE_APPOINTMENT",
        module: "appointments",
        recordId: docRef.id,
        details: { patientName, doctorName, date, time },
        createdAt: serverTimestamp()
    });

    hideLoading();
    showToast("Appointment created successfully!", "success");

    // Redirect to appointments list
    setTimeout(() => {
        window.location.href = "appointments.html";
    }, 1500);

    return docRef.id;
}

// ─── Export ──────────────────────────────────────────────────────────────────
export { createAppointment };
