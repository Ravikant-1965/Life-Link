// offlineStorage.js — Offline-First Storage & Synchronization Manager for Life Link
// Manages:
//   1. Patient Emergency Snapshot & QR Code caching (Offline Health Card)
//   2. Patient Profile Edit Queueing & Background Cloud Sync
//   3. Doctor Emergency Cache for offline lookup in emergency rooms / ambulances
//   4. Doctor Audit Log Queueing & Cloud Synchronization

const STORAGE_KEYS = {
    PATIENT_EMERGENCY_CARD: 'lifelink_offline_emergency_card',
    PENDING_PROFILE_UPDATE: 'lifelink_pending_profile_update',
    DOCTOR_PATIENT_CACHE: 'lifelink_doctor_patient_cache',
    PENDING_AUDIT_LOGS: 'lifelink_pending_audit_logs'
};

// Safe JSON reading
function readJson(key, defaultValue = null) {
    try {
        const raw = localStorage.getItem(key);
        return raw ? JSON.parse(raw) : defaultValue;
    } catch (_err) {
        return defaultValue;
    }
}

// Safe JSON writing
function writeJson(key, value) {
    try {
        localStorage.setItem(key, JSON.stringify(value));
        return true;
    } catch (_err) {
        console.warn(`Failed to write offline key "${key}":`, _err);
        return false;
    }
}

// ============================================================
// 1. PATIENT EMERGENCY CARD (OFFLINE READINESS)
// ============================================================
export function saveEmergencyCardOffline(profile, user) {
    if (!profile && !user) return false;

    const payload = {
        user: user || null,
        profile: profile || null,
        cachedAt: new Date().toISOString()
    };

    return writeJson(STORAGE_KEYS.PATIENT_EMERGENCY_CARD, payload);
}

export function getEmergencyCardOffline() {
    return readJson(STORAGE_KEYS.PATIENT_EMERGENCY_CARD, null);
}

export function clearEmergencyCardOffline() {
    localStorage.removeItem(STORAGE_KEYS.PATIENT_EMERGENCY_CARD);
}

// ============================================================
// 2. PATIENT PROFILE EDITS (OFFLINE QUEUE & SYNC)
// ============================================================
export function savePendingProfileUpdate(profileFormData) {
    const payload = {
        data: profileFormData,
        queuedAt: new Date().toISOString()
    };
    return writeJson(STORAGE_KEYS.PENDING_PROFILE_UPDATE, payload);
}

export function getPendingProfileUpdate() {
    return readJson(STORAGE_KEYS.PENDING_PROFILE_UPDATE, null);
}

export function clearPendingProfileUpdate() {
    localStorage.removeItem(STORAGE_KEYS.PENDING_PROFILE_UPDATE);
}

export async function syncPendingProfile(api, token) {
    const pending = getPendingProfileUpdate();
    if (!pending || !pending.data || !token) {
        return false;
    }

    try {
        await api.post('/api/profile', pending.data, {
            headers: { Authorization: `Bearer ${token}` }
        });
        clearPendingProfileUpdate();
        return true;
    } catch (err) {
        console.warn('Failed to sync offline profile update:', err);
        return false;
    }
}

// ============================================================
// 3. DOCTOR EMERGENCY PATIENT CACHE
// ============================================================
export function saveDoctorPatientOffline(patientData) {
    const id = patientData?.healthId || patientData?.user?.healthId;
    if (!patientData || !id) return false;

    const cache = readJson(STORAGE_KEYS.DOCTOR_PATIENT_CACHE, {});
    cache[id.toUpperCase()] = {
        ...patientData,
        cachedAt: new Date().toISOString()
    };

    return writeJson(STORAGE_KEYS.DOCTOR_PATIENT_CACHE, cache);
}

export function getDoctorPatientOffline(healthId) {
    if (!healthId) return null;
    const cache = readJson(STORAGE_KEYS.DOCTOR_PATIENT_CACHE, {});
    return cache[healthId.trim().toUpperCase()] || null;
}

// ============================================================
// 4. DOCTOR OFFLINE AUDIT LOG QUEUE & SYNC
// ============================================================
export function queueOfflineAuditLog(logItem) {
    if (!logItem || !logItem.healthId) return false;

    const logs = readJson(STORAGE_KEYS.PENDING_AUDIT_LOGS, []);
    logs.push({
        healthId: logItem.healthId,
        accessedAt: logItem.accessedAt || new Date().toISOString()
    });

    return writeJson(STORAGE_KEYS.PENDING_AUDIT_LOGS, logs);
}

export function getPendingAuditLogs() {
    return readJson(STORAGE_KEYS.PENDING_AUDIT_LOGS, []);
}

export function clearPendingAuditLogs() {
    localStorage.removeItem(STORAGE_KEYS.PENDING_AUDIT_LOGS);
}

export async function syncPendingAuditLogs(api, doctorToken) {
    const logs = getPendingAuditLogs();
    if (!logs.length || !doctorToken) {
        return false;
    }

    try {
        await api.post('/api/access-log/offline-sync', { logs }, {
            headers: { Authorization: `Bearer ${doctorToken}` }
        });
        clearPendingAuditLogs();
        return true;
    } catch (err) {
        console.warn('Failed to sync offline audit logs:', err);
        return false;
    }
}

// ============================================================
// 5. MASTER SYNC TRIGGER (CALLED ON ONLINE EVENT)
// ============================================================
export async function syncAllPendingData(api, { userToken, doctorToken }) {
    let syncedProfile = false;
    let syncedAuditLogs = false;

    if (userToken) {
        syncedProfile = await syncPendingProfile(api, userToken);
    }

    if (doctorToken) {
        syncedAuditLogs = await syncPendingAuditLogs(api, doctorToken);
    }

    return { syncedProfile, syncedAuditLogs };
}
