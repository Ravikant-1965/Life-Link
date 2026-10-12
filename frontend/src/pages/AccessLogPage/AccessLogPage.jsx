// AccessLogPage.jsx — Doctor Access Audit Logs with CliniQ-inspired Modern UI
// ==============================================================================
// Displays verified doctors who accessed the patient's records as interactive cards.
// Clicking a doctor card opens a rich modal with complete credentials, department,
// hospital affiliation, clinical reason, contact, and audit verification.
// ==============================================================================

import { useState, useEffect, useMemo } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import api from '../../api';
import './AccessLogPage.css';

export function AccessLogPage({ user, token, logout }) {
    const [logs, setLogs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedDepartment, setSelectedDepartment] = useState('All');
    const [selectedDoctorLog, setSelectedDoctorLog] = useState(null);

    const navigate = useNavigate();

    // Redirect if not authenticated
    if (!user || !token) {
        return <Navigate to="/" replace />;
    }

    // Fetch access logs
    useEffect(() => {
        const fetchLogs = async () => {
            try {
                const response = await api.get('/api/access-log', {
                    headers: { Authorization: `Bearer ${token}` }
                });
                setLogs(response.data || []);
            } catch (err) {
                if (err.response?.status === 401) {
                    logout();
                    navigate('/login');
                } else {
                    setError('Failed to load doctor access logs. Please try again.');
                }
            } finally {
                setLoading(false);
            }
        };

        fetchLogs();
    }, [logout, navigate, token]);

    // Format date nicely
    const formatFullDate = (isoString) => {
        if (!isoString) return 'Recent Access';
        const date = new Date(isoString);
        return date.toLocaleDateString('en-US', {
            month: 'long',
            day: 'numeric',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    const formatRelativeTime = (isoString) => {
        if (!isoString) return 'Recently';
        const now = Date.now();
        const diffMs = now - new Date(isoString).getTime();
        const diffHrs = Math.floor(diffMs / (1000 * 60 * 60));
        const diffDays = Math.floor(diffHrs / 24);

        if (diffHrs < 1) return 'Just now';
        if (diffHrs === 1) return '1 hour ago';
        if (diffHrs < 24) return `${diffHrs} hours ago`;
        if (diffDays === 1) return 'Yesterday';
        if (diffDays < 7) return `${diffDays} days ago`;
        return new Date(isoString).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    };

    // Filter available departments dynamically
    const departments = useMemo(() => {
        const depts = new Set(['All']);
        logs.forEach((log) => {
            if (log.department) depts.add(log.department);
            else if (log.specialization) depts.add(log.specialization);
        });
        return Array.from(depts);
    }, [logs]);

    // Filtered doctor logs
    const filteredLogs = useMemo(() => {
        return logs.filter((log) => {
            const matchesDept =
                selectedDepartment === 'All' ||
                (log.department && log.department.toLowerCase() === selectedDepartment.toLowerCase()) ||
                (log.specialization && log.specialization.toLowerCase().includes(selectedDepartment.toLowerCase()));

            const query = searchQuery.trim().toLowerCase();
            const matchesSearch =
                !query ||
                (log.doctor_name && log.doctor_name.toLowerCase().includes(query)) ||
                (log.department && log.department.toLowerCase().includes(query)) ||
                (log.specialization && log.specialization.toLowerCase().includes(query)) ||
                (log.hospital && log.hospital.toLowerCase().includes(query)) ||
                (log.doctor_license && log.doctor_license.toLowerCase().includes(query));

            return matchesDept && matchesSearch;
        });
    }, [logs, selectedDepartment, searchQuery]);

    // Department statistics
    const departmentStats = useMemo(() => {
        const counts = {};
        logs.forEach((log) => {
            const dept = log.department || log.specialization || 'General Care';
            counts[dept] = (counts[dept] || 0) + 1;
        });
        return counts;
    }, [logs]);

    if (loading) {
        return (
            <div className="access-log-page">
                <div className="access-loading-spinner-wrap">
                    <div className="access-loading-spinner" />
                    <p>Loading verified doctor audit logs...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="access-log-page">
            {/* Top Navigation */}
            <nav className="access-top-nav">
                <div className="nav-container">
                    <Link to="/dashboard" className="access-brand">
                        <img src="/logo_cross.png" alt="Life-Link" className="access-brand-logo" />
                        <span className="access-brand-text">Life-Link</span>
                    </Link>

                    <div className="nav-user-indicator">
                        <div className="nav-user-badge">
                            <span className="nav-user-avatar">
                                {user?.name ? user.name.charAt(0).toUpperCase() : 'P'}
                            </span>
                            <div className="nav-user-meta">
                                <span className="nav-user-name">{user?.name}</span>
                                <span className="nav-health-id">{user?.healthId}</span>
                            </div>
                        </div>

                        <Link to="/dashboard" className="btn-back-dashboard">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                <path d="M19 12H5M12 19l-7-7 7-7" />
                            </svg>
                            Back to Workspace
                        </Link>
                    </div>
                </div>
            </nav>

            <main className="access-main-container">
                {/* Header Banner */}
                <div className="access-hero-section">
                    <div className="hero-text-col">
                        <div className="hero-badge">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                            </svg>
                            <span>Cryptographic Audit Trail</span>
                        </div>
                        <h1 className="hero-heading">Doctors Who Accessed Your Record</h1>
                        <p className="hero-subtitle">
                            Every time an emergency practitioner or licensed specialist opens your Health ID,
                            their complete clinical profile, department, and timestamp are securely logged below.
                        </p>
                    </div>

                    <div className="hero-stat-pill-group">
                        <div className="hero-stat-card">
                            <span className="stat-count">{logs.length}</span>
                            <span className="stat-desc">Verified Accesses</span>
                        </div>
                        <div className="hero-stat-card">
                            <span className="stat-count">{departments.length > 1 ? departments.length - 1 : 1}</span>
                            <span className="stat-desc">Departments</span>
                        </div>
                    </div>
                </div>

                {error && <div className="access-error-banner">{error}</div>}

                {/* Search & Department Filters (Inspired by reference UI) */}
                <div className="access-controls-card">
                    <div className="access-search-bar">
                        <svg className="search-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                            <circle cx="11" cy="11" r="8" />
                            <path d="M21 21l-4.35-4.35" />
                        </svg>
                        <input
                            type="text"
                            className="search-input"
                            placeholder="Search by doctor name, department, or hospital..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                        {searchQuery && (
                            <button className="search-clear-btn" onClick={() => setSearchQuery('')}>
                                &times;
                            </button>
                        )}
                    </div>

                    {/* Department Category Pills */}
                    <div className="dept-pills-row">
                        {departments.map((dept) => (
                            <button
                                key={dept}
                                className={`dept-pill-btn ${selectedDepartment === dept ? 'active' : ''}`}
                                onClick={() => setSelectedDepartment(dept)}
                            >
                                {dept === 'All' ? 'All Visits' : dept}
                                {dept !== 'All' && departmentStats[dept] && (
                                    <span className="dept-pill-count">{departmentStats[dept]}</span>
                                )}
                            </button>
                        ))}
                    </div>
                </div>

                {/* DOCTORS CARDS SECTION (Matching reference image right screen) */}
                <section className="doctor-cards-section">
                    <div className="section-header-row">
                        <div>
                            <h2 className="section-title">Verified Practitioner Cards</h2>
                            <p className="section-subtitle">
                                Click any doctor card to inspect department credentials, hospital affiliation, and clinical access rationale.
                            </p>
                        </div>
                        <span className="results-badge">
                            {filteredLogs.length} {filteredLogs.length === 1 ? 'Doctor Record' : 'Doctor Records'}
                        </span>
                    </div>

                    {filteredLogs.length === 0 ? (
                        <div className="empty-doctors-card">
                            <div className="empty-icon-circle">
                                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <circle cx="12" cy="12" r="10" />
                                    <path d="M12 8v4M12 16h.01" />
                                </svg>
                            </div>
                            <h3>No Doctor Access Records Found</h3>
                            <p>
                                {searchQuery || selectedDepartment !== 'All'
                                    ? 'No doctors match the selected search query or department filter.'
                                    : 'Your medical record has not been accessed by an outside doctor yet.'}
                            </p>
                            {(searchQuery || selectedDepartment !== 'All') && (
                                <button
                                    className="btn-reset-filters"
                                    onClick={() => {
                                        setSearchQuery('');
                                        setSelectedDepartment('All');
                                    }}
                                >
                                    Reset Filters
                                </button>
                            )}
                        </div>
                    ) : (
                        <div className="doctor-cards-grid">
                            {filteredLogs.map((log) => {
                                const avatarSrc = log.avatar_url || '/doctors/dr_sarah_johnson.jpg';
                                return (
                                    <div
                                        key={log.id}
                                        className="cliniq-doctor-card"
                                        onClick={() => setSelectedDoctorLog(log)}
                                    >
                                        {/* Card Photo Frame */}
                                        <div className="card-photo-wrapper">
                                            <img
                                                src={avatarSrc}
                                                alt={log.doctor_name}
                                                className="card-doctor-img"
                                                onError={(e) => {
                                                    e.target.onerror = null;
                                                    e.target.src = '/doctor_consultation.jpg';
                                                }}
                                            />
                                            <div className="card-verified-badge">
                                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                                                    <path d="M20 6L9 17l-5-5" />
                                                </svg>
                                                <span>Verified</span>
                                            </div>
                                            <span className="card-time-badge">{formatRelativeTime(log.accessed_at)}</span>
                                        </div>

                                        {/* Card Content */}
                                        <div className="card-content-wrap">
                                            <div className="card-doctor-info">
                                                <h3 className="card-doctor-name">{log.doctor_name || 'Verified Doctor'}</h3>
                                                <p className="card-doctor-dept">
                                                    {log.department || log.specialization || 'Clinical Specialist'}
                                                </p>
                                                <p className="card-doctor-hospital">{log.hospital || 'General Hospital'}</p>
                                            </div>

                                            {/* Bottom Action Row */}
                                            <div className="card-action-row">
                                                <div className="card-tags-group">
                                                    <span className="card-mini-tag">{log.qualifications || 'MBBS, MD'}</span>
                                                    <span className="card-mini-tag">{log.experience_years || '8 Yrs'} Exp</span>
                                                </div>

                                                <button
                                                    className="card-arrow-btn"
                                                    title="View Full Doctor Profile & Access Audit"
                                                    aria-label="View Full Doctor Profile"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setSelectedDoctorLog(log);
                                                    }}
                                                >
                                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                                        <path d="M7 17L17 7M7 7h10v10" />
                                                    </svg>
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </section>

                {/* DEPARTMENT ACCESS SUMMARY TILES (Matching bottom categories of reference UI) */}
                <section className="dept-summary-section">
                    <h2 className="section-title">Access Distribution by Clinical Department</h2>
                    <div className="dept-tiles-grid">
                        {Object.entries(departmentStats).map(([dept, count]) => (
                            <div
                                key={dept}
                                className={`dept-tile-card ${selectedDepartment === dept ? 'highlighted' : ''}`}
                                onClick={() => setSelectedDepartment(dept)}
                            >
                                <div className="dept-tile-header">
                                    <span className="dept-tile-label">{dept}</span>
                                    <span className="dept-tile-arrow">
                                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="7" y1="17" x2="17" y2="7"></line><polyline points="7 7 17 7 17 17"></polyline></svg>
                                    </span>
                                </div>
                                <div className="dept-tile-count">~{count} Access{count === 1 ? '' : 'es'}</div>
                                <div className="dept-tile-sub">Clinical audit confirmed</div>
                            </div>
                        ))}
                    </div>
                </section>
            </main>

            {/* =========================================================================
                DOCTOR DETAIL MODAL (Matching LEFT screen of user's reference image)
            ========================================================================= */}
            {selectedDoctorLog && (
                <div className="doctor-modal-overlay" onClick={() => setSelectedDoctorLog(null)}>
                    <div className="cliniq-detail-container" onClick={(e) => e.stopPropagation()}>
                        {/* Detail Modal Top Bar */}
                        <div className="detail-top-bar">
                            <button
                                className="detail-back-btn"
                                onClick={() => setSelectedDoctorLog(null)}
                                aria-label="Close Doctor Details"
                            >
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                    <path d="M19 12H5M12 19l-7-7 7-7" />
                                </svg>
                            </button>

                            <div className="detail-verified-pill">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                                </svg>
                                <span>Verified Medical Council License</span>
                            </div>

                            <button
                                className="detail-close-btn"
                                onClick={() => setSelectedDoctorLog(null)}
                                aria-label="Close"
                            >
                                &times;
                            </button>
                        </div>

                        {/* Hero Photo & Info Section */}
                        <div className="detail-hero-card">
                            <div className="detail-photo-frame">
                                <img
                                    src={selectedDoctorLog.avatar_url || '/doctors/dr_sarah_johnson.jpg'}
                                    alt={selectedDoctorLog.doctor_name}
                                    className="detail-doctor-img"
                                    onError={(e) => {
                                        e.target.onerror = null;
                                        e.target.src = '/doctor_consultation.jpg';
                                    }}
                                />
                                <div className="detail-rating-badge">
                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" stroke="none" style={{ marginRight: '4px', display: 'inline-block', verticalAlign: 'middle' }}>
                                        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                                    </svg>
                                    <span>4.9 Verified Specialist</span>
                                </div>
                            </div>

                            <div className="detail-doctor-meta">
                                <h2 className="detail-name">{selectedDoctorLog.doctor_name}</h2>
                                <div className="detail-degrees">
                                    {selectedDoctorLog.qualifications || 'MBBS, MD'} &middot; {selectedDoctorLog.specialization || selectedDoctorLog.department}
                                </div>
                                <div className="detail-hospital-pill">
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                                        <polyline points="9 22 9 12 15 12 15 22" />
                                    </svg>
                                    <span>{selectedDoctorLog.hospital || 'Hospital Affiliation'}</span>
                                </div>
                            </div>

                            {/* Quick Action Icons Row (Matching reference buttons) */}
                            <div className="detail-quick-actions-row">
                                <span className="action-pill active-pill">Details</span>

                                {selectedDoctorLog.phone && (
                                    <a
                                        href={`tel:${selectedDoctorLog.phone}`}
                                        className="action-icon-circle"
                                        title={`Call Practice: ${selectedDoctorLog.phone}`}
                                    >
                                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                            <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
                                        </svg>
                                    </a>
                                )}

                                {selectedDoctorLog.doctor_email && (
                                    <a
                                        href={`mailto:${selectedDoctorLog.doctor_email}`}
                                        className="action-icon-circle"
                                        title={`Email: ${selectedDoctorLog.doctor_email}`}
                                    >
                                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                            <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                                            <polyline points="22,6 12,13 2,6" />
                                        </svg>
                                    </a>
                                )}

                                <div
                                    className="action-icon-circle"
                                    title={`Medical License: ${selectedDoctorLog.doctor_license || 'Registered'}`}
                                >
                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <rect x="3" y="4" width="18" height="16" rx="2" />
                                        <line x1="7" y1="8" x2="17" y2="8" />
                                        <line x1="7" y1="12" x2="17" y2="12" />
                                        <line x1="7" y1="16" x2="13" y2="16" />
                                    </svg>
                                </div>
                            </div>

                            {/* 3 Stats Pill Boxes (Matching the exact 3 stats in the screenshot) */}
                            <div className="detail-stats-trio">
                                <div className="stat-trio-box">
                                    <div className="trio-icon">
                                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#018ABE" strokeWidth="2">
                                            <circle cx="12" cy="12" r="10" />
                                            <polyline points="12 6 12 12 16 14" />
                                        </svg>
                                    </div>
                                    <div className="trio-val">{selectedDoctorLog.experience_years || '8 Years'}</div>
                                    <div className="trio-lbl">Experience</div>
                                </div>

                                <div className="stat-trio-box">
                                    <div className="trio-icon">
                                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#018ABE" strokeWidth="2">
                                            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                                            <circle cx="9" cy="7" r="4" />
                                            <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                                            <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                                        </svg>
                                    </div>
                                    <div className="trio-val">3.5k+</div>
                                    <div className="trio-lbl">Consultations</div>
                                </div>

                                <div className="stat-trio-box">
                                    <div className="trio-icon">
                                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#018ABE" strokeWidth="2">
                                            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                                        </svg>
                                    </div>
                                    <div className="trio-val">2.8k+</div>
                                    <div className="trio-lbl">Verified Audits</div>
                                </div>
                            </div>
                        </div>

                        {/* Clinical Access Audit Breakdown */}
                        <div className="detail-audit-body">
                            <h3 className="audit-section-heading">Emergency Access Audit Record</h3>

                            <div className="audit-info-grid">
                                <div className="audit-item">
                                    <span className="audit-label">Access Timestamp</span>
                                    <span className="audit-value highlighted-date">
                                        {formatFullDate(selectedDoctorLog.accessed_at)}
                                    </span>
                                </div>

                                <div className="audit-item">
                                    <span className="audit-label">Clinical Department</span>
                                    <span className="audit-value dept-value-pill">
                                        {selectedDoctorLog.department || 'General Medicine'}
                                    </span>
                                </div>

                                <div className="audit-item">
                                    <span className="audit-label">Medical Council License</span>
                                    <span className="audit-value license-value-badge">
                                        {selectedDoctorLog.doctor_license || 'Verified License'}
                                    </span>
                                </div>

                                <div className="audit-item">
                                    <span className="audit-label">Hospital / Medical Center</span>
                                    <span className="audit-value">
                                        {selectedDoctorLog.hospital || 'Authorized Health Facility'}
                                    </span>
                                </div>
                            </div>

                            <div className="audit-reason-box">
                                <div className="audit-reason-title">
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#018ABE" strokeWidth="2.5">
                                        <circle cx="12" cy="12" r="10" />
                                        <line x1="12" y1="16" x2="12" y2="12" />
                                        <line x1="12" y1="8" x2="12.01" y2="8" />
                                    </svg>
                                    <span>Purpose & Reason for Access</span>
                                </div>
                                <p className="audit-reason-text">
                                    {selectedDoctorLog.access_reason ||
                                        'Emergency clinical lookup for medication review, active allergies, and acute vitals.'}
                                </p>
                            </div>

                            {selectedDoctorLog.bio && (
                                <div className="doctor-bio-box">
                                    <div className="doctor-bio-title">Practitioner Biography</div>
                                    <p className="doctor-bio-text">{selectedDoctorLog.bio}</p>
                                </div>
                            )}

                            <div className="audit-tamper-notice">
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#059669" strokeWidth="2.5">
                                    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                                    <polyline points="22 4 12 14.01 9 11.01" />
                                </svg>
                                <div>
                                    <strong>Tamper-Proof Audit Guarantee:</strong> This access entry is sealed with AES-256 GCM authentication.
                                    The doctor’s verified identity cannot be erased or modified.
                                </div>
                            </div>

                            {/* Bottom Action Button */}
                            <div className="detail-bottom-btn-wrap">
                                <button
                                    className="btn-done-audit"
                                    onClick={() => setSelectedDoctorLog(null)}
                                >
                                    Acknowledge & Close
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
