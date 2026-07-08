import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import api from '../../api';
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

export function EmergencyPage({ doctor, doctorToken, logoutDoctor }) {
    const [healthId, setHealthId] = useState('');
    const [patientData, setPatientData] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [timeLeft, setTimeLeft] = useState(0);
    const [searchParams] = useSearchParams();

    const idFromUrl = searchParams.get('healthId');

    const handleSessionExpired = () => {
        setPatientData(null);
        setError('Your authorized viewing session has expired. Please re-enter the Patient ID to continue.');
    };

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
        setPatientData(null);

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
        } catch (requestError) {
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
                    <Link to="/" className="emergency-logo">+ Life Link Doctor Portal</Link>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                        {patientData && <CircularTimer timeLeft={timeLeft} />}
                        <div className="doctor-chip">
                            <span>{doctor.name}</span>
                            <span className="doctor-chip-meta">{doctor.specialization} · {doctor.hospital}</span>
                        </div>
                    </div>
                </div>
            </div>

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
                </div>

                {patientData && (
                    <div className="patient-profile-card">
                        <div className="patient-profile-header">
                            <div>
                                <div className="patient-name">{patientData.user.name}</div>
                                <div className="patient-id-badge">Health ID: {patientData.user.healthId}</div>
                            </div>
                            <div className="access-logged-badge">Verified access logged</div>
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
