import { useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Link } from 'react-router-dom';

export function HealthDataModal({ isOpen, onClose, profile, user, qrCodeValue }) {
    const [activeTab, setActiveTab] = useState('clinical'); // 'clinical' | 'documents' | 'medications' | 'qr'
    const [previewImage, setPreviewImage] = useState(null);
    const [copiedHealthId, setCopiedHealthId] = useState(false);

    if (!isOpen) return null;

    const parseSafeArray = (val) => {
        if (!val) return [];
        if (Array.isArray(val)) return val;
        if (typeof val === 'string') {
            try {
                const parsed = JSON.parse(val);
                return Array.isArray(parsed) ? parsed : [];
            } catch (_e) {
                return [];
            }
        }
        return [];
    };

    const documentImages = parseSafeArray(profile?.document_images);
    const medicationImages = parseSafeArray(profile?.medication_images);
    const documentLinks = parseSafeArray(profile?.medical_file_links);

    const handleCopyHealthId = () => {
        if (user?.healthId) {
            navigator.clipboard.writeText(user.healthId);
            setCopiedHealthId(true);
            setTimeout(() => setCopiedHealthId(false), 2000);
        }
    };

    return (
        <div className="health-modal-overlay" onClick={onClose}>
            <div className="health-modal-container" onClick={(e) => e.stopPropagation()}>
                {/* MODAL HEADER */}
                <div className="health-modal-header">
                    <div className="health-modal-title-group">
                        <div className="health-modal-icon">
                            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
                        </div>
                        <div>
                            <h2>Personal Health Data & Medical Records</h2>
                            <p className="health-modal-subtitle">
                                Encrypted records connected to Health ID: <strong>{user?.healthId}</strong>
                            </p>
                        </div>
                    </div>
                    <div className="health-modal-header-actions">
                        <Link to="/edit-profile" className="health-modal-edit-btn" onClick={onClose}>
                            Edit Records
                        </Link>
                        <button className="health-modal-close-btn" onClick={onClose} aria-label="Close modal">
                            &times;
                        </button>
                    </div>
                </div>

                {/* MODAL TABS */}
                <div className="health-modal-tabs">
                    <button
                        className={`health-tab-btn ${activeTab === 'clinical' ? 'active' : ''}`}
                        onClick={() => setActiveTab('clinical')}
                    >
                        Clinical Summary
                    </button>
                    <button
                        className={`health-tab-btn ${activeTab === 'documents' ? 'active' : ''}`}
                        onClick={() => setActiveTab('documents')}
                    >
                        Documents & PDFs ({documentImages.length + documentLinks.length})
                    </button>
                    <button
                        className={`health-tab-btn ${activeTab === 'medications' ? 'active' : ''}`}
                        onClick={() => setActiveTab('medications')}
                    >
                        Medication Photos ({medicationImages.length})
                    </button>
                    <button
                        className={`health-tab-btn ${activeTab === 'qr' ? 'active' : ''}`}
                        onClick={() => setActiveTab('qr')}
                    >
                        Emergency QR Card
                    </button>
                </div>

                {/* TAB CONTENT */}
                <div className="health-modal-body">
                    {/* TAB 1: CLINICAL SUMMARY */}
                    {activeTab === 'clinical' && (
                        <div className="health-tab-panel">
                            <div className="health-id-banner">
                                <div className="health-id-banner-left">
                                    <span className="banner-label">Portable Health ID</span>
                                    <span className="banner-id-value">{user?.healthId}</span>
                                </div>
                                <button className="banner-copy-btn" onClick={handleCopyHealthId}>
                                    {copiedHealthId ? 'Copied!' : 'Copy ID'}
                                </button>
                            </div>

                            <div className="health-clinical-grid">
                                <div className="clinical-stat-card highlight-card">
                                    <span className="stat-label">Blood Group</span>
                                    <div className="stat-value blood-value">{profile?.blood_group || 'Not specified'}</div>
                                    <span className="stat-hint">Crossmatch ready</span>
                                </div>

                                <div className="clinical-stat-card warning-card">
                                    <span className="stat-label">Critical Allergies</span>
                                    <div className="stat-value allergy-value">{profile?.allergies || 'None documented'}</div>
                                    <span className="stat-hint">Checked during triage</span>
                                </div>

                                <div className="clinical-stat-card">
                                    <span className="stat-label">Current Medications</span>
                                    <div className="stat-value">{profile?.current_medications || 'None recorded'}</div>
                                    <span className="stat-hint">{medicationImages.length} packaging photos</span>
                                </div>

                                <div className="clinical-stat-card">
                                    <span className="stat-label">Chronic Conditions</span>
                                    <div className="stat-value">{profile?.chronic_conditions || 'None listed'}</div>
                                    <span className="stat-hint">Long-term diagnosis</span>
                                </div>

                                <div className="clinical-stat-card">
                                    <span className="stat-label">Previous Surgeries</span>
                                    <div className="stat-value">{profile?.previous_surgeries || 'None listed'}</div>
                                    <span className="stat-hint">Surgical history</span>
                                </div>

                                <div className="clinical-stat-card">
                                    <span className="stat-label">Organ Donor Preference</span>
                                    <div className="stat-value">{profile?.organ_donor_status || 'Not specified'}</div>
                                    <span className="stat-hint">Verified donor registry</span>
                                </div>

                                <div className="clinical-stat-card full-span">
                                    <span className="stat-label">Emergency Contacts</span>
                                    <div className="stat-value">
                                        {profile?.emergency_contact_name ? (
                                            <span>
                                                <strong>{profile.emergency_contact_name}</strong> — Phone: {profile.emergency_contact_phone || 'No phone'}
                                            </span>
                                        ) : (
                                            'No emergency contact added yet.'
                                        )}
                                    </div>
                                    <span className="stat-hint">First responders notify this contact immediately</span>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* TAB 2: DOCUMENTS & PDFS */}
                    {activeTab === 'documents' && (
                        <div className="health-tab-panel">
                            {/* Cloud / Drive Links */}
                            <div className="health-subgroup">
                                <h3>Secure Document Links & PDFs</h3>
                                {documentLinks.length > 0 ? (
                                    <div className="health-links-list">
                                        {documentLinks.map((link, idx) => (
                                            <a
                                                key={idx}
                                                href={link}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="health-link-row"
                                            >
                                                <span className="link-icon">
                                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                                                </span>
                                                <span className="link-url">{link}</span>
                                                <span className="link-badge">Open ↗</span>
                                            </a>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="empty-subgroup">
                                        No cloud document links added yet. Add Google Drive or Hospital portal links in Edit Profile.
                                    </div>
                                )}
                            </div>

                            {/* Scanned Document Photos */}
                            <div className="health-subgroup">
                                <h3>Prescription Slips & Document Photos ({documentImages.length})</h3>
                                {documentImages.length > 0 ? (
                                    <div className="health-gallery-grid">
                                        {documentImages.map((img, idx) => (
                                            <div
                                                key={idx}
                                                className="health-gallery-card"
                                                onClick={() => setPreviewImage(img)}
                                                title="Click to view full image"
                                            >
                                                <img src={img} alt={`Document ${idx + 1}`} className="health-gallery-thumb" />
                                                <div className="gallery-card-overlay">
                                                    <span>View Full</span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="empty-subgroup">
                                        No document photos uploaded yet. You can upload doctor notes and lab reports in Edit Profile.
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* TAB 3: MEDICATION PHOTOS */}
                    {activeTab === 'medications' && (
                        <div className="health-tab-panel">
                            <div className="health-subgroup">
                                <h3>Medication Packaging & Pill Photos ({medicationImages.length})</h3>
                                <p className="health-subgroup-hint">
                                    Emergency doctors reference these packaging photos to identify active chemical dosages when medications cannot be confirmed verbally.
                                </p>
                                {medicationImages.length > 0 ? (
                                    <div className="health-gallery-grid">
                                        {medicationImages.map((img, idx) => (
                                            <div
                                                key={idx}
                                                className="health-gallery-card"
                                                onClick={() => setPreviewImage(img)}
                                                title="Click to view full image"
                                            >
                                                <img src={img} alt={`Medication ${idx + 1}`} className="health-gallery-thumb" />
                                                <div className="gallery-card-overlay">
                                                    <span>View Full</span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="empty-subgroup">
                                        No medication photos attached yet. Take photos of your prescription bottles or pill blisters and add them in Edit Profile.
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* TAB 4: QR CARD */}
                    {activeTab === 'qr' && (
                        <div className="health-tab-panel qr-tab-panel">
                            <div className="qr-preview-box">
                                <div className="qr-preview-card">
                                    <div className="qr-preview-header">
                                        <div className="qr-brand">
                                            <img src="/logo_cross.png" alt="LifeLink" className="qr-logo-img" />
                                            <span>Life Link Emergency ID</span>
                                        </div>
                                        <span className="qr-status-pill">Doctor Verified</span>
                                    </div>

                                    <div className="qr-code-wrapper">
                                        <QRCodeSVG
                                            value={qrCodeValue}
                                            size={200}
                                            level="H"
                                            includeMargin={true}
                                        />
                                    </div>

                                    <div className="qr-card-info">
                                        <div className="qr-patient-name">{user?.name}</div>
                                        <div className="qr-patient-id">{user?.healthId}</div>
                                        <div className="qr-patient-blood">Blood Group: <strong>{profile?.blood_group || 'N/A'}</strong></div>
                                    </div>

                                    <div className="qr-card-footer">
                                        Scannable by authorized paramedics & verified hospital teams.
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* MODAL FOOTER */}
                <div className="health-modal-footer">
                    <span className="health-encryption-tag">
                        AES-256 Encrypted · Verified Doctor Authentication Required
                    </span>
                    <button className="health-modal-btn-done" onClick={onClose}>
                        Done
                    </button>
                </div>

                {/* LIGHTBOX FOR IMAGE ZOOM */}
                {previewImage && (
                    <div className="image-lightbox-overlay" onClick={() => setPreviewImage(null)}>
                        <div className="image-lightbox-content" onClick={(e) => e.stopPropagation()}>
                            <button className="lightbox-close" onClick={() => setPreviewImage(null)}>&times;</button>
                            <img src={previewImage} alt="Expanded Medical Record" className="lightbox-img" />
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
