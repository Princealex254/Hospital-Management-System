/**
 * PRINCE ALEX DIGITAL HMS — Beds Module
 * 
 * Handles:
 * - Loading and displaying beds from Firestore
 * - Filtering by ward and status
 * - Adding new beds
 * - Editing bed status
 * - Audit logging
 */

import { db, collection, query, where, getDocs, getDoc, orderBy, addDoc, updateDoc, deleteDoc, doc, serverTimestamp } from "./firebase-config.js";
import { requireAuth } from "./auth-guard.js";
import { loadSidebar } from "./sidebar.js";
import { showToast, showLoading, hideLoading, showConfirm, showModal } from "./notifications.js";
import { debug, debugError } from "./debug.js";
import { icon } from "./icons.js";
import { getTenantId, getCurrentUser, hasPermission, PERMISSIONS } from "./permissions.js";

document.addEventListener("DOMContentLoaded", async () => {
    debug("Beds page: Initializing...");
    showLoading("Loading beds...");
    try {
        const user = await requireAuth();
        if (!user) return;
        await loadSidebar();
        const pageTitleEl = document.getElementById("page-title");
        if (pageTitleEl) pageTitleEl.textContent = "Beds";
        await loadWardsForFilter();
        await loadBeds();
        setupAddBed();
        setupBulkBeds();
        setupFilter();
        hideLoading();
        debug("Beds page: Initialization complete.");
    } catch (error) {
        debugError("Beds page initialization error:", error);
        hideLoading();
        showToast("Unable to load beds page. Please try again.", "error");
    }
});

let currentBeds = [];
let currentFilters = { ward: "", status: "" };

async function loadWardsForFilter() {
    debug("Loading wards for filter...");
    const tenantId = getTenantId();
    if (!tenantId) return;
    try {
        const q = query(
            collection(db, "wards"),
            where("tenantId", "==", tenantId),
            orderBy("name")
        );
        const snapshot = await getDocs(q);
        const select = document.getElementById("filter-ward");
        if (!select) return;
        select.innerHTML = '<option value="">All Wards</option>';
        snapshot.forEach((doc) => {
            const ward = doc.data();
            const option = document.createElement("option");
            option.value = doc.id;
            option.textContent = ward.name || "Unknown";
            select.appendChild(option);
        });
        debug("Wards loaded for filter:", snapshot.size);
    } catch (error) {
        debugError("Error loading wards for filter:", error);
    }
}

async function loadBeds() {
    debug("Loading beds...");
    const tenantId = getTenantId();
    if (!tenantId) return;
    try {
        const q = query(
            collection(db, "beds"),
            where("tenantId", "==", tenantId),
            orderBy("bedNumber")
        );
        const snapshot = await getDocs(q);
        currentBeds = [];
        snapshot.forEach((doc) => {
            currentBeds.push({ id: doc.id, ...doc.data() });
        });
        debug("Beds loaded:", currentBeds.length);
        renderBeds(currentBeds);
    } catch (error) {
        debugError("Error loading beds:", error);
        showToast("Unable to load beds. Please try again.", "error");
        renderEmptyState("Unable to load beds.");
    }
}

function renderBeds(beds) {
    const tbody = document.getElementById("beds-tbody");
    if (!tbody) return;
    if (beds.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6"><div class="table-empty"><div class="empty-icon">${icon('beds', '18', 'icon-svg')}</div><h3>No beds found</h3></div></td></tr>`;
        return;
    }
    tbody.innerHTML = beds.map((bed) => {
        const status = bed.status || "available";
        return `
            <tr>
                <td><strong>${escapeHtml(bed.bedNumber || "")}</strong></td>
                <td>${escapeHtml(bed.wardName || "")}</td>
                <td>${escapeHtml(bed.floor || "")}</td>
                <td>${escapeHtml(bed.bedType || "")}</td>
                <td><span class="badge badge-${getStatusBadge(status)}">${escapeHtml(status)}</span></td>
                <td class="text-right">
                    <div class="table-actions">
                        <button class="btn btn-sm btn-outline" onclick="editBed('${bed.id}')"> ${icon('edit', '18', 'icon-svg')} Edit</button>
                        <button class="btn btn-sm btn-error" onclick="deleteBed('${bed.id}', '${escapeHtml(bed.bedNumber || "")}')"> ${icon('trash', '18', 'icon-svg')} Delete</button>
                    </div>
                </td>
            </tr>
        `;
    }).join("");
}

function renderEmptyState(message) {
    const tbody = document.getElementById("beds-tbody");
    if (!tbody) return;
    tbody.innerHTML = `<tr><td colspan="6"><div class="table-empty"><div class="empty-icon">${icon('beds', '18', 'icon-svg')}</div><h3>${escapeHtml(message)}</h3></div></td></tr>`;
}

function setupAddBed() {
    const addBtn = document.getElementById("add-bed-btn");
    if (addBtn) {
        addBtn.addEventListener("click", () => {
            if (!hasPermission(PERMISSIONS.BED_MANAGE)) {
                showToast("You don't have permission to manage beds.", "error");
                return;
            }
            showAddBedModal();
        });
    }
}

function setupBulkBeds() {
    const bulkBtn = document.getElementById("bulk-beds-btn");
    if (!bulkBtn) return;

    bulkBtn.addEventListener("click", () => {
        if (!hasPermission(PERMISSIONS.BED_MANAGE)) {
            showToast("You don't have permission to manage beds.", "error");
            return;
        }
        showBulkBedsModal();
    });
}

function showBulkBedsModal() {
    const modalHtml = `
        <div class="modal" style="max-width: 760px;">
            <div class="modal-header">
                <h3>Bulk Add or Update Beds</h3>
                <button class="modal-close" onclick="closeModal()">&times;</button>
            </div>
            <div class="modal-body">
                <p class="text-muted" style="margin-bottom: 12px;">
                    Paste rows in CSV format. Each row creates or updates a bed in a ward.
                </p>
                <div class="form-group">
                    <label class="form-label" for="bulk-beds-csv">CSV data</label>
                    <textarea id="bulk-beds-csv" class="form-textarea" rows="14" placeholder="wardName,bedNumber,bedType,status\nGeneral Ward,B-01,general,available\nICU,B-101,icu,occupied\n..."></textarea>
                </div>
                <div class="form-help">
                    Supported columns: <strong>wardName</strong>, <strong>bedNumber</strong>, <strong>bedType</strong>, <strong>status</strong>, <strong>floor</strong>
                </div>
            </div>
            <div class="modal-footer" style="justify-content: space-between;">
                <button class="btn btn-secondary" onclick="downloadBulkBedsTemplate()">Download Template</button>
                <div style="display: flex; gap: 8px;">
                    <button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
                    <button class="btn btn-primary" onclick="importBedsFromCsv()">Import Beds</button>
                </div>
            </div>
        </div>
    `;
    showModal(modalHtml);
}

window.downloadBulkBedsTemplate = function() {
    const csv = [
        "wardName,bedNumber,bedType,status,floor",
        "General Ward,B-01,general,available,Ground Floor",
        "ICU,B-101,icu,occupied,2nd Floor",
        "Maternity,B-201,maternity,reserved,1st Floor"
    ].join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "beds-template.csv";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    showToast("CSV template downloaded.", "success");
};

function parseCsvLine(line) {
    const result = [];
    let current = "";
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"') {
            if (inQuotes && line[i + 1] === '"') {
                current += '"';
                i++;
            } else {
                inQuotes = !inQuotes;
            }
        } else if (char === ',' && !inQuotes) {
            result.push(current.trim());
            current = "";
        } else {
            current += char;
        }
    }

    result.push(current.trim());
    return result;
}

async function loadWardMap() {
    const tenantId = getTenantId();
    if (!tenantId) return {};

    const snapshot = await getDocs(query(
        collection(db, "wards"),
        where("tenantId", "==", tenantId)
    ));

    const map = {};
    snapshot.forEach((doc) => {
        const ward = doc.data();
        map[String(doc.id).toLowerCase()] = doc.id;
        map[String(ward.name || "").toLowerCase()] = doc.id;
    });

    return map;
}

window.importBedsFromCsv = async function() {
    const text = document.getElementById("bulk-beds-csv")?.value || "";
    if (!text.trim()) {
        showToast("Please paste CSV data first.", "error");
        return;
    }

    const lines = text.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
    if (lines.length === 0) {
        showToast("No valid rows found.", "error");
        return;
    }

    try {
        showLoading("Importing beds...");

        const rawHeader = parseCsvLine(lines[0]);
        const hasHeader = rawHeader.some(value => /ward|bed|type|status|floor/i.test(value));
        const dataLines = hasHeader ? lines.slice(1) : lines;
        const tenantId = getTenantId();
        if (!tenantId) {
            throw new Error("No tenant context found.");
        }

        const wardLookup = await loadWardMap();
        const validStatuses = ["available", "occupied", "reserved", "maintenance"];
        const results = [];

        for (const line of dataLines) {
            const cells = parseCsvLine(line);
            if (cells.length < 2) continue;

            const record = {};
            const headers = hasHeader ? rawHeader.map(h => h.toLowerCase()) : ["wardName", "bedNumber", "bedType", "status", "floor"];
            headers.forEach((header, index) => {
                record[header] = cells[index] || "";
            });

            const wardKey = (record.wardName || record.ward || record.wardid || "").trim();
            const wardId = wardLookup[String(wardKey).toLowerCase()] || wardKey;
            const bedNumber = (record.bedNumber || record.number || "").trim();
            const bedType = (record.bedType || record.type || "general").trim() || "general";
            const status = (record.status || "available").trim().toLowerCase();
            const floor = (record.floor || "").trim();

            if (!wardId || !bedNumber) {
                continue;
            }

            if (!validStatuses.includes(status)) {
                results.push({ wardId, bedNumber, status: "available" });
            }

            const wardDoc = await getDoc(doc(db, "wards", wardId));
            if (!wardDoc.exists()) {
                continue;
            }

            const wardData = wardDoc.data();
            const existingQuery = query(
                collection(db, "beds"),
                where("tenantId", "==", tenantId),
                where("wardId", "==", wardId),
                where("bedNumber", "==", bedNumber)
            );
            const existingSnapshot = await getDocs(existingQuery);

            const bedData = {
                tenantId,
                wardId,
                wardName: wardData.name || "",
                floor: floor || wardData.floor || null,
                bedNumber,
                bedType: bedType || "general",
                status: validStatuses.includes(status) ? status : "available",
                updatedAt: serverTimestamp(),
                createdBy: getCurrentUser()?.uid || ""
            };

            if (!existingSnapshot.empty) {
                const existingRef = doc(db, "beds", existingSnapshot.docs[0].id);
                await updateDoc(existingRef, bedData);
            } else {
                await addDoc(collection(db, "beds"), {
                    ...bedData,
                    createdAt: serverTimestamp()
                });
            }

            results.push({ wardId, bedNumber, status: bedData.status });
        }

        hideLoading();
        closeModal();
        await loadBeds();
        showToast(`Imported ${results.length} bed rows.`, "success");
    } catch (error) {
        debugError("Error importing beds:", error);
        hideLoading();
        showToast("Unable to import beds. Please check the CSV and try again.", "error");
    }
};

function showAddBedModal() {
    const modalHtml = `
        <div class="modal">
            <div class="modal-header">
                <h3>Add New Bed</h3>
                <button class="modal-close" onclick="closeModal()">&times;</button>
            </div>
            <div class="modal-body">
                <div class="form-group">
                    <label class="form-label required" for="bed-number">Bed Number</label>
                    <input type="text" id="bed-number" class="form-input" placeholder="e.g. B-101">
                </div>
                <div class="form-group">
                    <label class="form-label required" for="bed-ward">Ward</label>
                    <select id="bed-ward" class="form-select">
                        <option value="">Select Ward</option>
                    </select>
                </div>
                <div class="form-group">
                    <label class="form-label" for="bed-floor">Floor</label>
                    <input type="text" id="bed-floor" class="form-input" placeholder="e.g. Ground Floor">
                </div>
                <div class="form-group">
                    <label class="form-label" for="bed-type">Bed Type</label>
                    <select id="bed-type" class="form-select">
                        <option value="general">General</option>
                        <option value="icu">ICU</option>
                        <option value="maternity">Maternity</option>
                        <option value="private">Private</option>
                    </select>
                </div>
            </div>
            <div class="modal-footer">
                <button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
                <button class="btn btn-primary" onclick="saveBed()">Save Bed</button>
            </div>
        </div>
    `;
    showModal(modalHtml);
    // Load wards for the dropdown
    loadWardsForBedSelect();
}

async function loadWardsForBedSelect() {
    const tenantId = getTenantId();
    if (!tenantId) return;
    try {
        const q = query(
            collection(db, "wards"),
            where("tenantId", "==", tenantId),
            orderBy("name")
        );
        const snapshot = await getDocs(q);
        const select = document.getElementById("bed-ward");
        if (!select) return;
        select.innerHTML = '<option value="">Select Ward</option>';
        snapshot.forEach((doc) => {
            const ward = doc.data();
            const option = document.createElement("option");
            option.value = doc.id;
            option.textContent = ward.name || "Unknown";
            option.setAttribute("data-floor", ward.floor || "");
            select.appendChild(option);
        });
        // Auto-fill floor when ward is selected
        select.addEventListener("change", () => {
            const selected = select.selectedOptions[0];
            const floor = selected?.getAttribute("data-floor") || "";
            document.getElementById("bed-floor").value = floor;
        });
    } catch (error) {
        debugError("Error loading wards for bed select:", error);
    }
}

window.saveBed = async function() {
    debug("Saving bed...");
    const tenantId = getTenantId();
    if (!tenantId) return;

    const bedNumber = document.getElementById("bed-number")?.value.trim();
    const wardId = document.getElementById("bed-ward")?.value;
    const floor = document.getElementById("bed-floor")?.value.trim();
    const bedType = document.getElementById("bed-type")?.value;

    if (!bedNumber || !wardId) {
        showToast("Please fill in all required fields.", "error");
        return;
    }

    try {
        showLoading("Saving bed...");

        // Get ward name
        let wardName = "";
        const wardDoc = await getDoc(doc(db, "wards", wardId));
        if (wardDoc.exists()) {
            wardName = wardDoc.data().name || "";
        }

        await addDoc(collection(db, "beds"), {
            tenantId,
            bedNumber,
            wardId,
            wardName,
            floor: floor || null,
            bedType: bedType || "general",
            status: "available",
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
            createdBy: getCurrentUser()?.uid || ""
        });

        await addDoc(collection(db, "auditLogs"), {
            tenantId,
            userId: getCurrentUser()?.uid || "",
            action: "CREATE_BED",
            module: "beds",
            details: { bedNumber, wardName, bedType },
            createdAt: serverTimestamp()
        });

        hideLoading();
        showToast("Bed created successfully!", "success");
        closeModal();
        await loadBeds();
    } catch (error) {
        debugError("Error saving bed:", error);
        hideLoading();
        showToast("Unable to save bed. Please try again.", "error");
    }
};

window.editBed = async function(bedId) {
    debug("Edit bed:", bedId);
    if (!hasPermission(PERMISSIONS.BED_MANAGE)) {
        showToast("You don't have permission to manage beds.", "error");
        return;
    }
    const bed = currentBeds.find(b => b.id === bedId);
    if (!bed) return;

    const modalHtml = `
        <div class="modal">
            <div class="modal-header">
                <h3>Edit Bed</h3>
                <button class="modal-close" onclick="closeModal()">&times;</button>
            </div>
            <div class="modal-body">
                <div class="form-group">
                    <label class="form-label" for="edit-bed-number">Bed Number</label>
                    <input type="text" id="edit-bed-number" class="form-input" value="${escapeHtml(bed.bedNumber || "")}">
                </div>
                <div class="form-group">
                    <label class="form-label" for="edit-bed-status">Status</label>
                    <select id="edit-bed-status" class="form-select">
                        <option value="available" ${bed.status === "available" ? "selected" : ""}>Available</option>
                        <option value="occupied" ${bed.status === "occupied" ? "selected" : ""}>Occupied</option>
                        <option value="reserved" ${bed.status === "reserved" ? "selected" : ""}>Reserved</option>
                        <option value="maintenance" ${bed.status === "maintenance" ? "selected" : ""}>Maintenance</option>
                    </select>
                </div>
            </div>
            <div class="modal-footer">
                <button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
                <button class="btn btn-primary" onclick="updateBed('${bedId}')">Update Bed</button>
            </div>
        </div>
    `;
    showModal(modalHtml);
};

window.updateBed = async function(bedId) {
    debug("Updating bed:", bedId);
    try {
        showLoading("Updating bed...");
        await updateDoc(doc(db, "beds", bedId), {
            bedNumber: document.getElementById("edit-bed-number").value.trim(),
            status: document.getElementById("edit-bed-status").value,
            updatedAt: serverTimestamp()
        });

        await addDoc(collection(db, "auditLogs"), {
            tenantId: getTenantId(),
            userId: getCurrentUser()?.uid || "",
            action: "UPDATE_BED",
            module: "beds",
            recordId: bedId,
            createdAt: serverTimestamp()
        });

        hideLoading();
        showToast("Bed updated successfully!", "success");
        closeModal();
        await loadBeds();
    } catch (error) {
        debugError("Error updating bed:", error);
        hideLoading();
        showToast("Unable to update bed. Please try again.", "error");
    }
};

window.deleteBed = async function(bedId, bedNumber) {
    debug("Delete bed:", bedId, bedNumber);
    if (!hasPermission(PERMISSIONS.BED_MANAGE)) {
        showToast("You don't have permission to manage beds.", "error");
        return;
    }
    const confirmed = await showConfirm(
        "Delete Bed",
        `Are you sure you want to delete bed "${bedNumber}"? This action cannot be undone.`,
        "Delete",
        "Cancel"
    );
    if (!confirmed) return;
    try {
        showLoading("Deleting bed...");
        await deleteDoc(doc(db, "beds", bedId));
        await addDoc(collection(db, "auditLogs"), {
            tenantId: getTenantId(),
            userId: getCurrentUser()?.uid || "",
            action: "DELETE_BED",
            module: "beds",
            recordId: bedId,
            details: { bedNumber },
            createdAt: serverTimestamp()
        });
        hideLoading();
        showToast(`Bed "${bedNumber}" has been deleted.`, "success");
        await loadBeds();
    } catch (error) {
        debugError("Error deleting bed:", error);
        hideLoading();
        showToast("Unable to delete bed. Please try again.", "error");
    }
};

function setupFilter() {
    const wardFilter = document.getElementById("filter-ward");
    const statusFilter = document.getElementById("filter-status");
    if (wardFilter) {
        wardFilter.addEventListener("change", (e) => {
            currentFilters.ward = e.target.value;
            applyFilters();
        });
    }
    if (statusFilter) {
        statusFilter.addEventListener("change", (e) => {
            currentFilters.status = e.target.value;
            applyFilters();
        });
    }
}

function applyFilters() {
    debug("Applying filters:", currentFilters);
    const filtered = currentBeds.filter((bed) => {
        if (currentFilters.ward && bed.wardId !== currentFilters.ward) return false;
        if (currentFilters.status && bed.status !== currentFilters.status) return false;
        return true;
    });
    renderBeds(filtered);
}

function getStatusBadge(status) {
    if (!status) return "secondary";
    const s = status.toLowerCase();
    if (s.includes("available")) return "success";
    if (s.includes("occupied")) return "error";
    if (s.includes("reserved")) return "warning";
    if (s.includes("maintenance")) return "info";
    return "secondary";
}

function escapeHtml(text) {
    if (!text) return "";
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
}
export { loadBeds };
