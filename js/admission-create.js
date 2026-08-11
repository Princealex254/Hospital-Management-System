/**
 * PRINCE ALEX DIGITAL HMS — Admission Creation Module
 * 
 * Handles:
 * - Loading wards and available beds
 * - Loading doctors for attending doctor selection
 * - Creating admissions in Firestore
 * - Preventing occupied bed assignment
 * - Audit logging
 */

import { db, collection, addDoc, getDocs, getDoc, query, where, orderBy, serverTimestamp, updateDoc, doc } from "./firebase-config.js";
import { requireAuth } from "./auth-guard.js";
import { loadSidebar } from "./sidebar.js";
import { showToast, showLoading, hideLoading } from "./notifications.js";
import { debug, debugError } from "./debug.js";
import { getTenantId, getCurrentUser } from "./permissions.js";

document.addEventListener("DOMContentLoaded", async () => {
    debug("Admission create page: Initializing...");
    showLoading("Loading admission form...");
    try {
        const user = await requireAuth();
        if (!user) return;

        await loadSidebar();

        const today = new Date().toISOString().split("T")[0];
        document.getElementById("admission-date").value = today;

        await setupPatientSearch();

        const urlParams = new URLSearchParams(window.location.search);
        const patientId = urlParams.get("patientId");
        const visitId = urlParams.get("visitId");

        if (patientId) {
            await prefillPatient(patientId);
        }

        if (visitId) {
            // Store visitId in a hidden field to link the admission
            const visitIdInput = document.createElement('input');
            visitIdInput.type = 'hidden';
            visitIdInput.id = 'visit-id';
            visitIdInput.value = visitId;
            document.getElementById('admission-form').appendChild(visitIdInput);
        }

        await loadWards();
        await loadDoctors();
        setupForm();
        hideLoading();
        debug("Admission create page: Initialization complete.");
    } catch (error) {
        debugError("Admission create page initialization error:", error);
        hideLoading();
        showToast("Unable to load page. Please try again.", "error");
    }
});

function setupPatientSearch() {
    const root = document.getElementById("patient-searchable-select");
    const selectControl = root?.querySelector(".select-control");
    const selectValue = root?.querySelector(".select-value");
    const searchInput = root?.querySelector(".select-search");
    const optionsContainer = root?.querySelector(".select-options");
    const patientIdInput = document.getElementById("patient-id");
    const errorDiv = document.getElementById("patient-error");

    if (!root || !selectControl || !selectValue || !searchInput || !optionsContainer || !patientIdInput) return;

    let allPatients = [];

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
                <div style="font-weight: 600; color: var(--color-gray-900);">${fullName}</div>
                <div style="font-size: 11px; color: var(--color-gray-500); margin-top: 2px;">
                    ${patientId} • ${phone}
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
        const queryValue = value.trim().toLowerCase();
        if (!queryValue) {
            renderPatients(allPatients);
            return;
        }

        const filtered = allPatients.filter((patient) => {
            const fullName = getPatientDisplayName(patient).toLowerCase();
            const patientId = (patient.patientId || "").toLowerCase();
            const phone = (patient.phone || "").toLowerCase();
            const email = (patient.email || "").toLowerCase();
            return fullName.includes(queryValue) || patientId.includes(queryValue) || phone.includes(queryValue) || email.includes(queryValue);
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
        } catch (error) {
            debugError("Error loading patients for admission form:", error);
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

    selectValue.textContent = "Select Patient";
    selectValue.classList.add("placeholder");
    loadPatients();
}

async function prefillPatient(patientId) {
    const patientDoc = await getDoc(doc(db, "patients", patientId));
    if (patientDoc.exists()) {
        const patientData = patientDoc.data();
        const root = document.getElementById("patient-searchable-select");
        const patientIdInput = document.getElementById("patient-id");
        const selectValue = root?.querySelector(".select-value");
        const searchInput = root?.querySelector(".select-search");

        const patientName = patientData.name || `${patientData.firstName || ""} ${patientData.lastName || ""}`.trim() || "Unknown Patient";

        if (root && selectValue) {
            selectValue.textContent = patientName;
            selectValue.classList.remove("placeholder");
        }
        if (searchInput) {
            searchInput.value = patientName;
            searchInput.disabled = true;
        }
        if (patientIdInput) {
            patientIdInput.value = patientId;
        }
    }
}

async function loadWards() {
    debug("Loading wards...");
    const tenantId = getTenantId();
    if (!tenantId) return;
    try {
        const q = query(
            collection(db, "wards"),
            where("tenantId", "==", tenantId)
        );
        const snapshot = await getDocs(q);
        const select = document.getElementById("ward");
        if (!select) return;
        select.innerHTML = '<option value="">Select Ward</option>';
        snapshot.forEach((doc) => {
            const ward = doc.data();
            const option = document.createElement("option");
            option.value = doc.id;
            option.textContent = ward.name || "Unknown";
            select.appendChild(option);
        });
        select.addEventListener("change", () => loadBedsForWard(select.value));
        debug("Wards loaded:", snapshot.size);
    } catch (error) {
        debugError("Error loading wards:", error);
    }
}

async function loadBedsForWard(wardId) {
    debug("Loading beds for ward:", wardId);
    const tenantId = getTenantId();
    if (!tenantId || !wardId) return;
    try {
        const q = query(
            collection(db, "beds"),
            where("tenantId", "==", tenantId),
            where("wardId", "==", wardId),
            where("status", "==", "available")
        );
        const snapshot = await getDocs(q);
        const select = document.getElementById("bed");
        if (!select) return;
        select.innerHTML = '<option value="">Select Bed</option>';
        snapshot.forEach((doc) => {
            const bed = doc.data();
            const option = document.createElement("option");
            option.value = doc.id;
            option.textContent = `${bed.bedNumber || "Bed"} (${bed.bedType || "General"})`;
            select.appendChild(option);
        });
        debug("Available beds loaded:", snapshot.size);
    } catch (error) {
        debugError("Error loading beds:", error);
    }
}

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
        const select = document.getElementById("attending-doctor");
        if (!select) return;
        select.innerHTML = '<option value="">Select Doctor</option>';
        snapshot.forEach((doc) => {
            const staff = doc.data();
            const option = document.createElement("option");
            option.value = staff.uid || doc.id;
            option.textContent = staff.name || staff.displayName || "Unknown";
            select.appendChild(option);
        });
        debug("Doctors loaded:", snapshot.size);
    } catch (error) {
        debugError("Error loading doctors:", error);
    }
}

function setupForm() {
    const form = document.getElementById("admission-form");
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
            await createAdmission();
        } catch (error) {
            debugError("Admission creation error:", error);
            showToast(error.message || "Unable to create admission. Please try again.", "error");
        } finally {
            btnText.style.display = "inline";
            btnLoading.style.display = "none";
            submitBtn.disabled = false;
        }
    });
}

async function createAdmission() {
    debug("Creating admission...");
    const tenantId = getTenantId();
    if (!tenantId) throw new Error("No tenant ID found. Please log in again.");

    const patientId = document.getElementById("patient-id").value;
    const patientName = document.getElementById("patient-searchable-select")?.querySelector(".select-value")?.textContent.trim() || document.getElementById("patient-search")?.value.trim() || "";
    const admissionDate = document.getElementById("admission-date").value;
    const visitId = document.getElementById("visit-id")?.value || null;
    const wardId = document.getElementById("ward").value;
    const bedId = document.getElementById("bed").value;
    const doctorId = document.getElementById("attending-doctor").value;
    const reason = document.getElementById("reason").value.trim();
    const notes = document.getElementById("admission-notes").value.trim();

    if (!patientId || !admissionDate || !wardId || !bedId) {
        throw new Error("Please fill in all required fields (marked with *).");
    }

    showLoading("Saving admission...");

    // Get bed details
    const bedDoc = await getDoc(doc(db, "beds", bedId));
    const bedData = bedDoc.exists() ? bedDoc.data() : {};

    // Get ward details
    const wardDoc = await getDoc(doc(db, "wards", wardId));
    const wardData = wardDoc.exists() ? wardDoc.data() : {};

    // Get doctor name
    let doctorName = "";
    if (doctorId) {
        const doctorDoc = await getDoc(doc(db, "users", doctorId));
        if (doctorDoc.exists()) {
            const staff = doctorDoc.data();
            doctorName = staff.name || staff.displayName || "";
        }
    }

    // Create admission
    const docRef = await addDoc(collection(db, "admissions"), {
        tenantId,
        patientId,
        visitId,
        patientName,
        admissionDate: new Date(admissionDate),
        wardId,
        wardName: wardData.name || "",
        bedId,
        bedNumber: bedData.bedNumber || "",
        doctorId,
        doctorName,
        reason: reason || null,
        notes: notes || null,
        status: "admitted",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        createdBy: getCurrentUser()?.uid || ""
    });
    debug("Admission created with ID:", docRef.id);

    // Update bed status to occupied
    await updateDoc(doc(db, "beds", bedId), {
        status: "occupied",
        patientId,
        updatedAt: serverTimestamp()
    });

    // Log audit
    await addDoc(collection(db, "auditLogs"), {
        tenantId,
        userId: getCurrentUser()?.uid || "",
        action: "CREATE_ADMISSION",
        module: "admissions",
        recordId: docRef.id,
        details: { patientName, wardName: wardData.name, bedNumber: bedData.bedNumber },
        createdAt: serverTimestamp()
    });

    hideLoading();
    showToast("Admission created successfully!", "success");

    setTimeout(() => {
        window.location.href = "admissions.html";
    }, 1500);

    return docRef.id;
}
