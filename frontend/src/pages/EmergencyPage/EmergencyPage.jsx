import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import api from '../../api';
import {
    saveDoctorPatientOffline,
    getDoctorPatientOffline,
    queueOfflineAuditLog,
    syncPendingAuditLogs
} from '../../utils/offlineStorage';
import './EmergencyPage.css';

function DoctorAccessGuard({ healthId }) {
    const healthIdSuffix = healthId ? `?healthId=${encodeURIComponent(healthId)}` : '';

    return (
        <div className="portal-lock-shell">
            <div className="portal-lock-card">
                <div className="portal-lock-badge">Verified doctor access required</div>
                <h1>Secure emergency profile access now requires doctor login and verification.</h1>
                <p>
                    Patient data is hidden until a doctor account is authenticated and approved. Use your verified doctor credentials
                    to continue with a Health ID or QR lookup.
                </p>

                {healthId && (
                    <div className="portal-health-preview">
                        Ready to continue lookup for <strong>{healthId}</strong> after doctor login.
                    </div>
                )}

                <div className="portal-lock-actions">
                    <Link to={`/doctor/login${healthIdSuffix}`} className="hero-btn-primary">Doctor Login</Link>
                    <Link to={`/doctor/register${healthIdSuffix}`} className="hero-btn-secondary">Register Doctor Account</Link>
                </div>
            </div>
        </div>
    );
}

function renderImageGallery(title, items, className) {
    if (!items?.length) {
        return null;
    }

    return (
        <div className="details-section">
            <h2 className="details-section-title">{title}</h2>
            <div className={`image-gallery ${className}`}>
                {items.map((item, index) => (
                    <a key={`${title}-${index}`} href={item} target="_blank" rel="noreferrer" className="image-thumb-link">
                        <img src={item} alt={`${title} ${index + 1}`} className="image-thumb" loading="lazy" />
                    </a>
                ))}
            </div>
        </div>
    );
}

function renderLinkList(links) {
    if (!links?.length) {
        return <span className="detail-value">None listed</span>;
    }

    return (
        <div className="link-list">
            {links.map((link, index) => (
                <a key={`${link}-${index}`} href={link} target="_blank" rel="noreferrer">
                    {link}
                </a>
            ))}
        </div>
    );
}

function CircularTimer({ timeLeft }) {
    const totalDuration = 1800; // 30 minutes in seconds
    const minutes = Math.floor(timeLeft / 60);
    const seconds = timeLeft % 60;
    const formattedTime = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;

    // SVG parameters
    const size = 32;
    const strokeWidth = 3;
    const radius = (size - strokeWidth) / 2;
    const circumference = 2 * Math.PI * radius;
    
    const progress = timeLeft / totalDuration;
    const strokeDashoffset = circumference * (1 - progress);

    return (
        <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            background: 'rgba(239, 68, 68, 0.08)',
            border: '1px solid rgba(239, 68, 68, 0.2)',
            padding: '4px 10px',
            borderRadius: '16px',
            color: '#ef4444',
            fontFamily: 'monospace',
            fontSize: '13px',
            fontWeight: 'bold',
            userSelect: 'none'
        }}>
            <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
                <circle
                    cx={size / 2}
                    cy={size / 2}
                    r={radius}
                    fill="transparent"
                    stroke="rgba(239, 68, 68, 0.15)"
                    strokeWidth={strokeWidth}
                />
                <circle
                    cx={size / 2}
                    cy={size / 2}
                    r={radius}
                    fill="transparent"
                    stroke="#ef4444"
                    strokeWidth={strokeWidth}
                    strokeDasharray={circumference}
                    strokeDashoffset={strokeDashoffset}
                    strokeLinecap="round"
                    style={{ transition: 'stroke-dashoffset 1s linear' }}
                />
            </svg>
            <span>{formattedTime}</span>
        </div>
    );
}

function DoctorMfaModal({ doctorToken, doctor, onClose, onMfaStatusChange }) {
    const [mfaEnabled, setMfaEnabled] = useState(doctor.mfaEnabled || false);
    const [qrCode, setQrCode] = useState('');
    const [secret, setSecret] = useState('');
    const [code, setCode] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [step, setStep] = useState('status');

    const initSetup = async () => {
        setLoading(true);
        setError('');
        setSuccess('');
        try {
            const res = await api.post('/api/doctors/mfa/setup', {}, {
                headers: { Authorization: `Bearer ${doctorToken}` }
            });
            setQrCode(res.data.qrCode);
            setSecret(res.data.secret);
            setMfaEnabled(res.data.mfaEnabled);
            setStep('setup');
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to initialize MFA setup.');
        }
        setLoading(false);
    };

    const verifySetup = async () => {
        if (!code || code.trim().length !== 6) {
            setError('Please enter a valid 6-digit code.');
            return;
        }
        setLoading(true);
        setError('');
        try {
            await api.post('/api/doctors/mfa/verify-setup', { code: code.trim() }, {
                headers: { Authorization: `Bearer ${doctorToken}` }
            });
            setMfaEnabled(true);
            setSuccess('MFA has been successfully activated for your doctor account!');
            setStep('status');
            if (onMfaStatusChange) onMfaStatusChange(true);
        } catch (err) {
            setError(err.response?.data?.message || 'Verification failed. Please check the code.');
        }
        setLoading(false);
    };

    const disableMfa = async () => {
        setLoading(true);
        setError('');
        try {
            await api.post('/api/doctors/mfa/disable', {}, {
                headers: { Authorization: `Bearer ${doctorToken}` }
            });
            setMfaEnabled(false);
            setSuccess('MFA has been disabled.');
            setStep('status');
            if (onMfaStatusChange) onMfaStatusChange(false);
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to disable MFA.');
        }
        setLoading(false);
    };

    return (
        <div className="mfa-modal-overlay" style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.65)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '20px'
        }}>
            <div className="mfa-modal-card" style={{
                background: '#1a202c',
                border: '1px solid rgba(255,255,255,0.15)',
                borderRadius: '16px',
                padding: '28px',
                maxWidth: '460px',
                width: '100%',
                color: '#fff',
                boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5)'
            }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                    <h2 style={{ fontSize: '20px', fontWeight: 'bold', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                        🛡️ Doctor MFA Security
                    </h2>
                    <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#a0aec0', fontSize: '20px', cursor: 'pointer' }}>✕</button>
                </div>

                {error && <div className="error-message" style={{ marginBottom: '16px' }}>{error}</div>}
                {success && <div style={{ background: 'rgba(72,187,120,0.15)', border: '1px solid #48bb78', color: '#48bb78', padding: '10px 14px', borderRadius: '8px', marginBottom: '16px', fontSize: '14px' }}>{success}</div>}

                {step === 'status' && (
                    <div>
                        <div style={{ background: 'rgba(255,255,255,0.05)', padding: '16px', borderRadius: '12px', marginBottom: '20px' }}>
                            <div style={{ fontSize: '13px', color: '#a0aec0', marginBottom: '4px' }}>MFA Status</div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 'bold', fontSize: '16px' }}>
                                {mfaEnabled ? (
                                    <span style={{ color: '#48bb78', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                        ● Enabled (Authenticator Active)
                                    </span>
                                ) : (
                                    <span style={{ color: '#e53e3e', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                        ○ Not Enabled
                                    </span>
                                )}
                            </div>
                        </div>

                        {!mfaEnabled ? (
                            <button className="btn-primary" onClick={initSetup} disabled={loading} style={{ width: '100%', padding: '12px' }}>
                                {loading ? 'Generating QR Code...' : 'Set Up Authenticator App (TOTP)'}
                            </button>
                        ) : (
                            <button className="btn-secondary" onClick={disableMfa} disabled={loading} style={{ width: '100%', padding: '12px', background: 'rgba(229,62,62,0.15)', color: '#fc8181', borderColor: 'rgba(229,62,62,0.3)' }}>
                                {loading ? 'Disabling...' : 'Disable MFA Security'}
                            </button>
                        )}
                    </div>
                )}

                {step === 'setup' && (
                    <div style={{ textAlign: 'center' }}>
                        <p style={{ fontSize: '14px', color: '#cbd5e0', marginBottom: '16px' }}>
                            Scan this QR Code using <strong>Google Authenticator</strong> or <strong>Authy</strong>:
                        </p>

                        {qrCode && (
                            <div style={{ background: '#fff', padding: '12px', borderRadius: '12px', display: 'inline-block', marginBottom: '16px' }}>
                                <img src={qrCode} alt="TOTP MFA QR Code" style={{ width: '180px', height: '180px', display: 'block' }} />
                            </div>
                        )}

                        <div style={{ fontSize: '12px', color: '#a0aec0', fontFamily: 'monospace', marginBottom: '20px', wordBreak: 'break-all' }}>
                            Secret Key: {secret}
                        </div>

                        <div style={{ textAlign: 'left', marginBottom: '20px' }}>
                            <label style={{ display: 'block', fontSize: '13px', color: '#cbd5e0', marginBottom: '6px' }}>Enter 6-Digit Code to Confirm Setup</label>
                            <input
                                type="text"
                                className="form-input"
                                style={{ textAlign: 'center', fontSize: '18px', letterSpacing: '6px', fontWeight: 'bold', fontFamily: 'monospace' }}
                                maxLength={6}
                                placeholder="123456"
                                value={code}
                                onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                            />
                        </div>

                        <div style={{ display: 'flex', gap: '10px' }}>
                            <button className="btn-secondary" onClick={() => setStep('status')} style={{ flex: 1 }}>Cancel</button>
                            <button className="btn-primary" onClick={verifySetup} disabled={loading} style={{ flex: 2 }}>
                                {loading ? 'Verifying...' : 'Activate MFA'}
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

export function EmergencyPage({ doctor, doctorToken, logoutDoctor }) {
    const [healthId, setHealthId] = useState('');
    const [patientData, setPatientData] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [timeLeft, setTimeLeft] = useState(0);
    const [showMfaModal, setShowMfaModal] = useState(false);
    const [doctorInfo, setDoctorInfo] = useState(doctor);
    const [isOfflineSnapshot, setIsOfflineSnapshot] = useState(false);
    const [offlineNotice, setOfflineNotice] = useState('');
    const [searchParams] = useSearchParams();

    const idFromUrl = searchParams.get('healthId');

    const handleSessionExpired = () => {
        setPatientData(null);
        setError('Your authorized viewing session has expired. Please re-enter the Patient ID to continue.');
    };

    useEffect(() => {
        const handleOnline = async () => {
            if (doctorToken) {
                const synced = await syncPendingAuditLogs(api, doctorToken);
                if (synced) {
                    setOfflineNotice('');
                }
            }
        };

        window.addEventListener('online', handleOnline);
        if (navigator.onLine && doctorToken) {
            syncPendingAuditLogs(api, doctorToken);
        }

        return () => window.removeEventListener('online', handleOnline);
    }, [doctorToken]);

    useEffect(() => {
        if (!patientData || !patientData.expiresAt) {
            setTimeLeft(0);
            return;
        }

        const calculateTimeLeft = () => {
            const diff = Math.max(0, Math.floor((patientData.expiresAt - Date.now()) / 1000));
            setTimeLeft(diff);
            return diff;
        };

        const initial = calculateTimeLeft();
        if (initial <= 0) {
            handleSessionExpired();
            return;
        }

        const interval = setInterval(() => {
            const current = calculateTimeLeft();
            if (current <= 0) {
                clearInterval(interval);
                handleSessionExpired();
            }
        }, 1000);

        return () => clearInterval(interval);
    }, [patientData]);

    useEffect(() => {
        if (idFromUrl) {
            setHealthId(idFromUrl.toUpperCase());
        }
    }, [idFromUrl]);

    useEffect(() => {
        if (doctorToken && idFromUrl) {
            fetchPatientData(idFromUrl, false);
        }
    }, [doctorToken, idFromUrl]);

    const fetchPatientData = async (id, isExplicitSearch = false) => {
        const searchId = (id || healthId).trim().toUpperCase();

        if (!searchId) {
            setError('Please enter a Health ID.');
            return;
        }

        if (!doctorToken) {
            setError('Verified doctor login is required before patient data can be accessed.');
            return;
        }

        setLoading(true);
        setError('');
        setOfflineNotice('');

        // If currently offline, directly read from device cache
        if (!navigator.onLine) {
            const cachedPatient = getDoctorPatientOffline(searchId);
            if (cachedPatient) {
                setPatientData({
                    ...cachedPatient,
                    expiresAt: Date.now() + 30 * 60 * 1000
                });
                setIsOfflineSnapshot(true);
                queueOfflineAuditLog({
                    healthId: searchId,
                    doctorId: doctorInfo?.id || doctor?.id,
                    doctorName: doctorInfo?.name || doctor?.name,
                    accessedAt: new Date().toISOString()
                });
                setOfflineNotice('Operating Offline: Displaying emergency snapshot cached on this device. Access audit has been logged locally and will automatically synchronize once reconnected.');
                setLoading(false);
                return;
            } else {
                setPatientData(null);
                setError(`Device is offline and no cached emergency snapshot exists for Health ID ${searchId}. Please connect to the internet to perform the initial lookup.`);
                setLoading(false);
                return;
            }
        }

        try {
            let response;
            if (isExplicitSearch) {
                response = await api.post(`/api/doctor/patient/${searchId}/access`, {}, {
                    headers: {
                        Authorization: `Bearer ${doctorToken}`
                    }
                });
            } else {
                response = await api.get(`/api/doctor/patient/${searchId}`, {
                    headers: {
                        Authorization: `Bearer ${doctorToken}`
                    }
                });
            }

            setPatientData(response.data);
            setIsOfflineSnapshot(false);
            // Save to doctor cache for subsequent offline emergency room / ambulance use
            saveDoctorPatientOffline(response.data);
        } catch (requestError) {
            // If request failed due to offline / lost network
            if (!requestError.response || !navigator.onLine) {
                const cachedPatient = getDoctorPatientOffline(searchId);
                if (cachedPatient) {
                    setPatientData({
                        ...cachedPatient,
                        expiresAt: Date.now() + 30 * 60 * 1000
                    });
                    setIsOfflineSnapshot(true);
                    queueOfflineAuditLog({
                        healthId: searchId,
                        doctorId: doctorInfo?.id || doctor?.id,
                        doctorName: doctorInfo?.name || doctor?.name,
                        accessedAt: new Date().toISOString()
                    });
                    setOfflineNotice('Network lost: Switched to device-cached emergency snapshot. Access audit queued locally.');
                    setLoading(false);
                    return;
                }
            }

            const message = requestError.response?.data?.message;
            const status = requestError.response?.status;

            if (status === 400 || status === 401 || status === 403) {
                setError(message || 'Doctor verification is required before profile access.');
            } else if (status === 404) {
                setError(message || 'Patient not found. Please check the Health ID.');
            } else {
                setError('Something went wrong while loading the patient record.');
            }
        }

        setLoading(false);
    };

    if (!doctor || !doctorToken) {
        return <DoctorAccessGuard healthId={healthId || idFromUrl} />;
    }

    return (
        <div className="emergency-page">
            <div className="emergency-header">
                <div className="emergency-header-content">
                    <Link to="/" className="emergency-logo">
                        <img src="/logo_cross.png" alt="Life Link Logo" className="portal-header-logo-icon" />
                        <span>Life Link Doctor Portal</span>
                    </Link>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                        {patientData && <CircularTimer timeLeft={timeLeft} />}
                        <button
                            type="button"
                            onClick={() => setShowMfaModal(true)}
                            style={{
                                background: doctorInfo?.mfaEnabled ? 'rgba(72,187,120,0.15)' : 'rgba(255,255,255,0.08)',
                                border: doctorInfo?.mfaEnabled ? '1px solid #48bb78' : '1px solid rgba(255,255,255,0.2)',
                                color: doctorInfo?.mfaEnabled ? '#48bb78' : '#e2e8f0',
                                padding: '6px 14px',
                                borderRadius: '20px',
                                fontSize: '13px',
                                fontWeight: '600',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px',
                                transition: 'all 0.2s ease'
                            }}
                        >
                            🛡️ {doctorInfo?.mfaEnabled ? 'MFA Enabled' : 'MFA Setup'}
                        </button>
                        <div className="doctor-chip">
                            <span>{doctorInfo?.name || doctor.name}</span>
                            <span className="doctor-chip-meta">{(doctorInfo || doctor).specialization} · {(doctorInfo || doctor).hospital}</span>
                        </div>
                    </div>
                </div>
            </div>

            {showMfaModal && (
                <DoctorMfaModal
                    doctorToken={doctorToken}
                    doctor={doctorInfo || doctor}
                    onClose={() => setShowMfaModal(false)}
                    onMfaStatusChange={(newStatus) => {
                        setDoctorInfo((prev) => ({ ...prev, mfaEnabled: newStatus }));
                    }}
                />
            )}

            <div className="emergency-content">
                <div className="emergency-search-card">
                    <div className="search-card-head">
                        <div>
                            <div className="emergency-title">Doctor emergency lookup</div>
                            <p className="emergency-subtitle">
                                Access a patient’s emergency profile securely using their Health ID or QR code. Doctor account login and verification are required.
                            </p>
                        </div>
                        <button className="btn-secondary doctor-logout-btn" onClick={logoutDoctor}>Doctor Logout</button>
                    </div>

                    <div className="search-row">
                        <input
                            type="text"
                            className="form-input health-id-input"
                            placeholder="e.g. LL-A3X92"
                            value={healthId}
                            onChange={(event) => setHealthId(event.target.value.toUpperCase())}
                            onKeyDown={(event) => event.key === 'Enter' && fetchPatientData(undefined, true)}
                            maxLength={8}
                        />
                        <button className="search-btn" onClick={() => fetchPatientData(undefined, true)} disabled={loading}>
                            {loading ? 'Loading profile...' : 'Open Secure Profile'}
                        </button>
                    </div>

                    {error && <div className="error-message">{error}</div>}
                    {offlineNotice && (
                        <div className="offline-notice-banner">
                            <span className="offline-badge-pill">⚡ Offline Mode</span>
                            <span className="offline-notice-text">{offlineNotice}</span>
                        </div>
                    )}
                </div>

                {patientData && (
                    <div className="patient-profile-card">
                        <div className="patient-profile-header">
                            <div>
                                <div className="patient-name">{patientData.user?.name || patientData.patientName}</div>
                                <div className="patient-id-badge">Health ID: {patientData.user?.healthId || patientData.healthId}</div>
                            </div>
                            <div className="patient-header-status-group">
                                {isOfflineSnapshot && (
                                    <div className="offline-tag-badge">
                                        ⚡ Device Cached
                                    </div>
                                )}
                                <div className={`access-logged-badge ${isOfflineSnapshot ? 'offline-sync-pending' : ''}`}>
                                    {isOfflineSnapshot ? 'Audit Queued Locally' : 'Verified access logged'}
                                </div>
                            </div>
                        </div>

                        <div className="patient-profile-body">
                            <div className="critical-section">
                                <h2 className="critical-section-title">Critical information</h2>
                                <div className="critical-grid">
                                    <div className="critical-item blood-group-item">
                                        <div className="critical-label">Blood group</div>
                                        <div className="critical-value blood-value">
                                            {patientData.profile.blood_group || 'Unknown'}
                                        </div>
                                    </div>
                                    <div className="critical-item">
                                        <div className="critical-label">Allergies</div>
                                        <div className="critical-value allergy-value">
                                            {patientData.profile.allergies || 'None listed'}
                                        </div>
                                    </div>
                                    <div className="critical-item">
                                        <div className="critical-label">Organ donor</div>
                                        <div className="critical-value">
                                            {patientData.profile.organ_donor_status || 'Not specified'}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="details-section">
                                <h2 className="details-section-title">Medical details</h2>
                                <div className="details-grid">
                                    <div className="detail-row">
                                        <span className="detail-label">Date of Birth</span>
                                        <span className="detail-value">{patientData.profile.date_of_birth || 'Not specified'}</span>
                                    </div>
                                    <div className="detail-row">
                                        <span className="detail-label">Chronic Conditions</span>
                                        <span className="detail-value">{patientData.profile.chronic_conditions || 'None listed'}</span>
                                    </div>
                                    <div className="detail-row">
                                        <span className="detail-label">Current Medications</span>
                                        <span className="detail-value">{patientData.profile.current_medications || 'None listed'}</span>
                                    </div>
                                    <div className="detail-row">
                                        <span className="detail-label">Previous Surgeries</span>
                                        <span className="detail-value">{patientData.profile.previous_surgeries || 'None listed'}</span>
                                    </div>
                                    <div className="detail-row">
                                        <span className="detail-label">Previous Prescriptions</span>
                                        <span className="detail-value">{patientData.profile.previous_prescriptions || 'None listed'}</span>
                                    </div>
                                    <div className="detail-row">
                                        <span className="detail-label">Document Links</span>
                                        {renderLinkList(patientData.profile.medical_file_links)}
                                    </div>
                                </div>
                            </div>

                            {renderImageGallery('Medical Document Photos', patientData.profile.document_images, 'document-gallery')}
                            {renderImageGallery('Medication Photos', patientData.profile.medication_images, 'medication-gallery')}

                            <div className="emergency-contact-section">
                                <h2 className="details-section-title">Emergency Contact</h2>
                                <div className="emergency-contact-box">
                                    {patientData.profile.emergency_contact_name ? (
                                        <>
                                            <div className="contact-name">{patientData.profile.emergency_contact_name}</div>
                                            <div className="contact-phone">{patientData.profile.emergency_contact_phone || 'No phone number'}</div>
                                        </>
                                    ) : (
                                        <div className="no-contact">No emergency contact listed</div>
                                    )}
                                </div>
                            </div>
                        </div>

                        <div className="search-again">
                            <button
                                className="btn-secondary"
                                onClick={() => {
                                    setPatientData(null);
                                    setHealthId('');
                                    setError('');
                                }}
                            >
                                Search Another Patient
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
