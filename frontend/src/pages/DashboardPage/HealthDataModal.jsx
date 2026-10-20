import { useState, useEffect } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Link } from 'react-router-dom';

export function HealthDataModal({ isOpen, onClose, profile, user, qrCodeValue, token }) {
    const [activeTab, setActiveTab] = useState('clinical'); // 'clinical' | 'documents' | 'medications' | 'qr'
    const [previewImage, setPreviewImage] = useState(null);
    const [copiedHealthId, setCopiedHealthId] = useState(false);

    // Cloudflare R2 Document Storage State
    const [cloudDocs, setCloudDocs] = useState([]);
    const [loadingDocs, setLoadingDocs] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [selectedFile, setSelectedFile] = useState(null);
    const [selectedCategory, setSelectedCategory] = useState('Lab Report');
    const [uploadStatus, setUploadStatus] = useState({ type: null, message: '' });
    const [actionDocId, setActionDocId] = useState(null);
    const [isDragOver, setIsDragOver] = useState(false);

    // Fetch cloud documents when modal opens or tab changes to documents
    useEffect(() => {
        if (isOpen && token) {
            fetchCloudDocuments();
        }
    }, [isOpen, token]);

    const fetchCloudDocuments = async () => {
        if (!token) return;
        setLoadingDocs(true);
        try {
            const res = await fetch('/api/documents', {
                headers: {
                    Authorization: `Bearer ${token}`
                }
            });
            const data = await res.json();
            if (res.ok && data.documents) {
                setCloudDocs(data.documents);
            }
        } catch (err) {
            console.error('Failed to fetch cloud documents:', err);
        } finally {
            setLoadingDocs(false);
        }
    };

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

    const handleFileSelect = (e) => {
        const file = e.target.files?.[0];
        if (file) {
            setSelectedFile(file);
            setUploadStatus({ type: null, message: '' });
        }
    };

    const handleDrop = (e) => {
        e.preventDefault();
        setIsDragOver(false);
        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            setSelectedFile(e.dataTransfer.files[0]);
            setUploadStatus({ type: null, message: '' });
        }
    };

    const handleDragOver = (e) => {
        e.preventDefault();
        setIsDragOver(true);
    };

    const handleDragLeave = () => {
        setIsDragOver(false);
    };

    const handleUploadDocument = async (e) => {
        e.preventDefault();
        if (!selectedFile) {
            setUploadStatus({ type: 'error', message: 'Please select a medical file to upload.' });
            return;
        }

        if (!token) {
            setUploadStatus({ type: 'error', message: 'Authentication required. Please refresh or re-login.' });
            return;
        }

        setUploading(true);
        setUploadStatus({ type: null, message: '' });

        try {
            const formData = new FormData();
            formData.append('file', selectedFile);
            formData.append('category', selectedCategory);

            const res = await fetch('/api/documents/upload', {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${token}`
                },
                body: formData
            });

            const data = await res.json();

            if (!res.ok) {
                throw new Error(data.message || 'Upload failed');
            }

            setUploadStatus({
                type: 'success',
                message: `"${selectedFile.name}" encrypted and uploaded successfully.`
            });
            setSelectedFile(null);
            const inputElem = document.getElementById('r2-file-input');
            if (inputElem) inputElem.value = '';

            await fetchCloudDocuments();
            setTimeout(() => setUploadStatus({ type: null, message: '' }), 4500);
        } catch (err) {
            setUploadStatus({
                type: 'error',
                message: err.message || 'An error occurred while uploading.'
            });
        } finally {
            setUploading(false);
        }
    };

    const handleViewDocument = async (doc) => {
        setActionDocId(doc.id);
        try {
            const res = await fetch(`/api/documents/${doc.id}/view`, {
                headers: {
                    Authorization: `Bearer ${token}`
                }
            });
            const data = await res.json();
            if (res.ok && data.viewUrl) {
                window.open(data.viewUrl, '_blank', 'noopener,noreferrer');
            } else {
                alert(data.message || 'Unable to open document view.');
            }
        } catch (err) {
            alert('Error generating preview link: ' + err.message);
        } finally {
            setActionDocId(null);
        }
    };

    const handleDownloadDocument = async (doc) => {
        setActionDocId(doc.id);
        try {
            const res = await fetch(`/api/documents/${doc.id}/download`, {
                headers: {
                    Authorization: `Bearer ${token}`
                }
            });
            const data = await res.json();
            if (res.ok && data.downloadUrl) {
                const link = document.createElement('a');
                link.href = data.downloadUrl;
                link.setAttribute('download', data.fileName || doc.file_name);
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
            } else {
                alert(data.message || 'Unable to initiate download.');
            }
        } catch (err) {
            alert('Error generating download link: ' + err.message);
        } finally {
            setActionDocId(null);
        }
    };

    const handleDeleteDocument = async (doc) => {
        if (!window.confirm(`Permanently remove "${doc.file_name}" from secure cloud storage?`)) {
            return;
        }

        setActionDocId(doc.id);
        try {
            const res = await fetch(`/api/documents/${doc.id}`, {
                method: 'DELETE',
                headers: {
                    Authorization: `Bearer ${token}`
                }
            });
            const data = await res.json();
            if (res.ok) {
                setCloudDocs((prev) => prev.filter((d) => d.id !== doc.id));
            } else {
                alert(data.message || 'Failed to delete document.');
            }
        } catch (err) {
            alert('Error deleting document: ' + err.message);
        } finally {
            setActionDocId(null);
        }
    };

    const getCategoryBadgeClass = (category) => {
        switch (category) {
            case 'Lab Report':
                return 'badge-blue';
            case 'Prescription':
                return 'badge-green';
            case 'Discharge Summary':
                return 'badge-amber';
            case 'Diagnostic Scan':
                return 'badge-purple';
            default:
                return 'badge-slate';
        }
    };

    const isPdf = (doc) => {
        return doc.mime_type === 'application/pdf' || doc.file_name?.toLowerCase().endsWith('.pdf');
    };

    const totalDocsCount = cloudDocs.length + documentImages.length + documentLinks.length;

    return (
        <div className="health-modal-overlay" onClick={onClose}>
            <div className="health-modal-container" onClick={(e) => e.stopPropagation()}>
                {/* MODAL HEADER */}
                <div className="health-modal-header">
                    <div className="health-modal-title-group">
                        <div className="health-modal-icon">
                            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
                            </svg>
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
                        Documents & PDFs ({totalDocsCount})
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
                            {/* SECTION A: CLOUDFLARE R2 SECURE STORAGE */}
                            <div className="health-subgroup">
                                <div className="r2-storage-header">
                                    <div>
                                        <div className="r2-storage-title-row">
                                            <h3>Cloud Medical Documents</h3>
                                            <span className="r2-free-badge">Cloudflare R2 Encrypted</span>
                                        </div>
                                        <p className="health-subgroup-hint">
                                            Store official medical PDFs, blood tests, and doctor reports in encrypted cloud storage with zero bandwidth fees.
                                        </p>
                                    </div>
                                </div>

                                {/* UPLOAD CARD */}
                                <form className="r2-upload-card" onSubmit={handleUploadDocument}>
                                    <div
                                        className={`r2-drop-zone ${isDragOver ? 'drag-over' : ''} ${selectedFile ? 'has-file' : ''}`}
                                        onDrop={handleDrop}
                                        onDragOver={handleDragOver}
                                        onDragLeave={handleDragLeave}
                                        onClick={() => document.getElementById('r2-file-input').click()}
                                    >
                                        <input
                                            id="r2-file-input"
                                            type="file"
                                            style={{ display: 'none' }}
                                            accept=".pdf,image/png,image/jpeg,image/webp,image/heic"
                                            onChange={handleFileSelect}
                                        />

                                        <div className="r2-drop-content">
                                            <div className="r2-drop-icon">
                                                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                                                    <polyline points="17 8 12 3 7 8"/>
                                                    <line x1="12" y1="3" x2="12" y2="15"/>
                                                </svg>
                                            </div>

                                            {selectedFile ? (
                                                <div className="r2-file-preview-info">
                                                    <div className="r2-selected-filename">{selectedFile.name}</div>
                                                    <div className="r2-selected-filesize">
                                                        {(selectedFile.size / (1024 * 1024)).toFixed(2)} MB · Ready to upload
                                                    </div>
                                                </div>
                                            ) : (
                                                <div className="r2-drop-instructions">
                                                    <span className="r2-drop-title">Click to browse or drag & drop files here</span>
                                                    <span className="r2-drop-sub">Supported formats: PDF, PNG, JPG, WEBP (Max 25 MB)</span>
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    <div className="r2-upload-controls">
                                        <div className="r2-category-select-group">
                                            <label htmlFor="r2-category" className="r2-category-label">Document Category</label>
                                            <select
                                                id="r2-category"
                                                className="r2-category-select"
                                                value={selectedCategory}
                                                onChange={(e) => setSelectedCategory(e.target.value)}
                                            >
                                                <option value="Lab Report">Lab Report (Blood / Urine / Pathology)</option>
                                                <option value="Prescription">Prescription Slip / Doctor Order</option>
                                                <option value="Discharge Summary">Hospital Discharge Summary</option>
                                                <option value="Diagnostic Scan">Diagnostic Scan (X-Ray / MRI / CT)</option>
                                                <option value="General">General Medical Record</option>
                                            </select>
                                        </div>

                                        <button
                                            type="submit"
                                            className="r2-upload-btn"
                                            disabled={!selectedFile || uploading}
                                        >
                                            {uploading ? (
                                                <>
                                                    <svg className="r2-spin-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                                        <circle cx="12" cy="12" r="10" strokeOpacity="0.25"/>
                                                        <path d="M12 2a10 10 0 0 1 10 10" strokeLinecap="round"/>
                                                    </svg>
                                                    Uploading to R2...
                                                </>
                                            ) : (
                                                <>
                                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                                        <polyline points="16 16 12 12 8 16"/>
                                                        <line x1="12" y1="12" x2="12" y2="21"/>
                                                        <path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3"/>
                                                    </svg>
                                                    Upload Document
                                                </>
                                            )}
                                        </button>
                                    </div>

                                    {uploadStatus.message && (
                                        <div className={`r2-upload-alert ${uploadStatus.type === 'error' ? 'alert-error' : 'alert-success'}`}>
                                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                {uploadStatus.type === 'error' ? (
                                                    <>
                                                        <circle cx="12" cy="12" r="10"/>
                                                        <line x1="12" y1="8" x2="12" y2="12"/>
                                                        <line x1="12" y1="16" x2="12.01" y2="16"/>
                                                    </>
                                                ) : (
                                                    <>
                                                        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
                                                        <polyline points="22 4 12 14.01 9 11.01"/>
                                                    </>
                                                )}
                                            </svg>
                                            <span>{uploadStatus.message}</span>
                                        </div>
                                    )}
                                </form>

                                {/* UPLOADED DOCUMENTS LIST */}
                                <div className="r2-docs-container">
                                    <div className="r2-docs-header">
                                        <h4>Your Uploaded Documents ({cloudDocs.length})</h4>
                                        {loadingDocs && <span className="r2-loading-pill">Refreshing...</span>}
                                    </div>

                                    {loadingDocs && cloudDocs.length === 0 ? (
                                        <div className="r2-loading-state">
                                            <svg className="r2-spin-icon" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                <circle cx="12" cy="12" r="10" strokeOpacity="0.25"/>
                                                <path d="M12 2a10 10 0 0 1 10 10" strokeLinecap="round"/>
                                            </svg>
                                            <span>Loading cloud storage documents...</span>
                                        </div>
                                    ) : cloudDocs.length > 0 ? (
                                        <div className="r2-docs-grid">
                                            {cloudDocs.map((doc) => (
                                                <div key={doc.id} className="r2-doc-card">
                                                    <div className="r2-doc-icon-box">
                                                        {isPdf(doc) ? (
                                                            <div className="r2-file-badge-pdf">
                                                                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                                                                    <polyline points="14 2 14 8 20 8"/>
                                                                    <line x1="16" y1="13" x2="8" y2="13"/>
                                                                    <line x1="16" y1="17" x2="8" y2="17"/>
                                                                    <polyline points="10 9 9 9 8 9"/>
                                                                </svg>
                                                                <span>PDF</span>
                                                            </div>
                                                        ) : (
                                                            <div className="r2-file-badge-img">
                                                                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                                    <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                                                                    <circle cx="8.5" cy="8.5" r="1.5"/>
                                                                    <polyline points="21 15 16 10 5 21"/>
                                                                </svg>
                                                                <span>IMG</span>
                                                            </div>
                                                        )}
                                                    </div>

                                                    <div className="r2-doc-info">
                                                        <div className="r2-doc-name" title={doc.file_name}>
                                                            {doc.file_name}
                                                        </div>
                                                        <div className="r2-doc-meta-row">
                                                            <span className={`r2-cat-tag ${getCategoryBadgeClass(doc.category)}`}>
                                                                {doc.category || 'General'}
                                                            </span>
                                                            <span className="r2-doc-size">{doc.formatted_size || 'Unknown size'}</span>
                                                            {doc.uploaded_at && (
                                                                <span className="r2-doc-date">
                                                                    {new Date(doc.uploaded_at).toLocaleDateString(undefined, {
                                                                        month: 'short',
                                                                        day: 'numeric',
                                                                        year: 'numeric'
                                                                    })}
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>

                                                    <div className="r2-doc-actions">
                                                        <button
                                                            className="r2-action-btn btn-view"
                                                            title="Preview in browser"
                                                            disabled={actionDocId === doc.id}
                                                            onClick={() => handleViewDocument(doc)}
                                                        >
                                                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                                                                <circle cx="12" cy="12" r="3"/>
                                                            </svg>
                                                            View
                                                        </button>

                                                        <button
                                                            className="r2-action-btn btn-download"
                                                            title="Download original file"
                                                            disabled={actionDocId === doc.id}
                                                            onClick={() => handleDownloadDocument(doc)}
                                                        >
                                                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                                                                <polyline points="7 10 12 15 17 10"/>
                                                                <line x1="12" y1="15" x2="12" y2="3"/>
                                                            </svg>
                                                            Download
                                                        </button>

                                                        <button
                                                            className="r2-action-btn btn-delete"
                                                            title="Permanently delete document"
                                                            disabled={actionDocId === doc.id}
                                                            onClick={() => handleDeleteDocument(doc)}
                                                        >
                                                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                                <polyline points="3 6 5 6 21 6"/>
                                                                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                                                            </svg>
                                                        </button>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <div className="r2-empty-state">
                                            <div className="r2-empty-icon">
                                                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                                                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                                                    <polyline points="14 2 14 8 20 8"/>
                                                    <line x1="12" y1="18" x2="12" y2="12"/>
                                                    <line x1="9" y1="15" x2="15" y2="15"/>
                                                </svg>
                                            </div>
                                            <p className="r2-empty-title">No cloud documents uploaded yet</p>
                                            <p className="r2-empty-sub">
                                                Upload your recent diagnostic reports, doctor prescriptions, or discharge papers above. They will be encrypted and accessible during authorized medical emergencies.
                                            </p>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* SECTION B: CLOUD / DRIVE LINKS */}
                            <div className="health-subgroup">
                                <h3>External Document Links & Portals ({documentLinks.length})</h3>
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
                                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                                                        <polyline points="14 2 14 8 20 8"/>
                                                    </svg>
                                                </span>
                                                <span className="link-url">{link}</span>
                                                <span className="link-badge">
                                                    Open
                                                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginLeft: '4px' }}>
                                                        <line x1="7" y1="17" x2="17" y2="7"></line>
                                                        <polyline points="7 7 17 7 17 17"></polyline>
                                                    </svg>
                                                </span>
                                            </a>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="empty-subgroup">
                                        No external document links linked yet. You can add external links in Edit Profile.
                                    </div>
                                )}
                            </div>

                            {/* SECTION C: SCANNED DOCUMENT PHOTOS */}
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
                                        No document photos attached yet. You can upload doctor notes and lab reports in Edit Profile.
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
                        AES-256 Cloudflare R2 Encrypted · Verified Doctor Authentication Required
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
