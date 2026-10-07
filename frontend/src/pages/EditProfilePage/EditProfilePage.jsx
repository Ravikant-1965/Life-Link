import { useEffect, useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import api from '../../api';
import {
    saveEmergencyCardOffline,
    getEmergencyCardOffline,
    savePendingProfileUpdate
} from '../../utils/offlineStorage';
import './EditProfilePage.css';

function readFilesAsDataUrls(fileList) {
    return Promise.all(
        Array.from(fileList).map(
            (file) =>
                new Promise((resolve, reject) => {
                    const reader = new FileReader();
                    reader.onload = () => resolve(reader.result);
                    reader.onerror = () => reject(new Error(`Failed to read ${file.name}`));
                    reader.readAsDataURL(file);
                })
        )
    );
}

function UploadPreviewGrid({ items, title, onRemove }) {
    if (!items.length) {
        return null;
    }

    return (
        <div className="upload-preview-block">
            <p className="upload-preview-title">{title}</p>
            <div className="upload-preview-grid">
                {items.map((item, index) => (
                    <div key={`${title}-${index}`} className="upload-preview-card">
                        <img src={item} alt={`${title} ${index + 1}`} className="upload-preview-image" loading="lazy" />
                        <button type="button" className="upload-remove-btn" onClick={() => onRemove(index)}>
                            Remove
                        </button>
                    </div>
                ))}
            </div>
        </div>
    );
}

export function EditProfilePage({ user, token, logout }) {
    const [fullName, setFullName] = useState('');
    const [dateOfBirth, setDateOfBirth] = useState('');
    const [bloodGroup, setBloodGroup] = useState('');
    const [allergies, setAllergies] = useState('');
    const [chronicConditions, setChronicConditions] = useState('');
    const [currentMedications, setCurrentMedications] = useState('');
    const [previousSurgeries, setPreviousSurgeries] = useState('');
    const [previousPrescriptions, setPreviousPrescriptions] = useState('');
    const [emergencyContactName, setEmergencyContactName] = useState('');
    const [emergencyContactPhone, setEmergencyContactPhone] = useState('');
    const [organDonorStatus, setOrganDonorStatus] = useState('Not specified');
    const [documentLinks, setDocumentLinks] = useState('');
    const [documentImages, setDocumentImages] = useState([]);
    const [medicationImages, setMedicationImages] = useState([]);

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    const navigate = useNavigate();

    if (!user || !token) {
        return <Navigate to="/login" replace />;
    }

    const populateForm = (profile) => {
        if (!profile) return;
        setFullName(profile.full_name || profile.fullName || '');
        setDateOfBirth(profile.date_of_birth || profile.dateOfBirth || '');
        setBloodGroup(profile.blood_group || profile.bloodGroup || '');
        setAllergies(profile.allergies || '');
        setChronicConditions(profile.chronic_conditions || profile.chronicConditions || '');
        setCurrentMedications(profile.current_medications || profile.currentMedications || '');
        setPreviousSurgeries(profile.previous_surgeries || profile.previousSurgeries || '');
        setPreviousPrescriptions(profile.previous_prescriptions || profile.previousPrescriptions || '');
        setEmergencyContactName(profile.emergency_contact_name || profile.emergencyContactName || '');
        setEmergencyContactPhone(profile.emergency_contact_phone || profile.emergencyContactPhone || '');
        setOrganDonorStatus(profile.organ_donor_status || profile.organDonorStatus || 'Not specified');
        setDocumentLinks(profile.medical_file_links?.join('\n') || profile.medical_files || profile.documentLinks || '');
        setDocumentImages(profile.document_images || profile.documentImages || []);
        setMedicationImages(profile.medication_images || profile.medicationImages || []);
    };

    useEffect(() => {
        const loadProfile = async () => {
            try {
                const response = await api.get('/api/profile', {
                    headers: { Authorization: `Bearer ${token}` }
                });

                const profile = response.data.profile;
                if (profile) {
                    populateForm(profile);
                    saveEmergencyCardOffline(profile, user);
                }
            } catch (requestError) {
                if (requestError.response?.status === 401) {
                    logout();
                    navigate('/login');
                    return;
                }
                // Try prefilling from offline cache
                const cached = getEmergencyCardOffline();
                if (cached && cached.profile) {
                    populateForm(cached.profile);
                }
            }

            setLoading(false);
        };

        loadProfile();
    }, [logout, navigate, token, user]);

    const [uploadingImages, setUploadingImages] = useState(false);

    const uploadSingleFile = async (dataUrl) => {
        try {
            const response = await api.post('/api/upload-image', {
                image: dataUrl,
                folder: 'lifelink_medical_docs'
            }, {
                headers: { Authorization: `Bearer ${token}` }
            });
            return response.data.url;
        } catch (_err) {
            return dataUrl;
        }
    };

    const handleDocumentUpload = async (event, type) => {
        if (!event.target.files?.length) return;

        setUploadingImages(true);
        setError('');

        try {
            const dataUrls = await readFilesAsDataUrls(event.target.files);
            const uploadedUrls = await Promise.all(dataUrls.map((url) => uploadSingleFile(url)));

            if (type === 'documents') {
                setDocumentImages((current) => [...current, ...uploadedUrls]);
            } else {
                setMedicationImages((current) => [...current, ...uploadedUrls]);
            }

            event.target.value = '';
        } catch (_error) {
            setError('One of the selected images could not be uploaded. Please try again.');
        } finally {
            setUploadingImages(false);
        }
    };

    const removeDocumentImage = (index) => {
        setDocumentImages((current) => current.filter((_, itemIndex) => itemIndex !== index));
    };

    const removeMedicationImage = (index) => {
        setMedicationImages((current) => current.filter((_, itemIndex) => itemIndex !== index));
    };

    const handleSave = async () => {
        setSaving(true);
        setError('');
        setSuccess('');

        const profileData = {
            fullName,
            dateOfBirth,
            bloodGroup,
            allergies,
            chronicConditions,
            currentMedications,
            previousSurgeries,
            previousPrescriptions,
            emergencyContactName,
            emergencyContactPhone,
            organDonorStatus,
            documentLinks,
            documentImages,
            medicationImages
        };

        // Always save to offline device emergency card immediately
        saveEmergencyCardOffline(profileData, user);

        if (!navigator.onLine) {
            // Queue offline update for cloud sync when connection returns
            savePendingProfileUpdate(profileData);
            setSuccess('⚡ Saved offline! Profile updated on this device and queued to sync with cloud once reconnected.');
            window.scrollTo({ top: 0, behavior: 'smooth' });
            setSaving(false);
            setTimeout(() => {
                navigate('/dashboard');
            }, 1800);
            return;
        }

        try {
            await api.post('/api/profile', profileData, {
                headers: { Authorization: `Bearer ${token}` }
            });

            setSuccess('Health profile saved and synchronized with cloud successfully!');
            window.scrollTo({ top: 0, behavior: 'smooth' });

            setTimeout(() => {
                navigate('/dashboard');
            }, 1500);
        } catch (requestError) {
            // Fallback to offline queue if network drops mid-save
            savePendingProfileUpdate(profileData);
            setSuccess('⚡ Saved offline! Server was unreachable, changes queued to sync automatically.');
            window.scrollTo({ top: 0, behavior: 'smooth' });
            setTimeout(() => {
                navigate('/dashboard');
            }, 1800);
        }

        setSaving(false);
    };

    if (loading) {
        return <div className="loading-text">Loading your profile...</div>;
    }

    return (
        <div className="edit-profile-page">
            <nav className="dashboard-nav">
                <Link to="/dashboard" className="nav-logo-text">
                    <img src="/logo_cross.png" alt="Life Link Logo" style={{ width: '28px', height: '28px', objectFit: 'contain', verticalAlign: 'middle', marginRight: '8px' }} />
                    <span>Life Link</span>
                </Link>
                <div className="nav-right">
                    <Link to="/dashboard" className="nav-link">← Back to Dashboard</Link>
                </div>
            </nav>

            <div className="edit-profile-content">
                <div className="edit-profile-header">
                    <h1>🩺 Your Health Profile</h1>
                    <p>Keep your emergency profile current with health details, document photos, medicine images, and trusted record links.</p>
                </div>

                {error && <div className="error-message">{error}</div>}
                {success && <div className="success-message">{success}</div>}

                <div className="profile-form">
                    <div className="form-section">
                        <h2 className="section-title">👤 Personal Information</h2>

                        <div className="form-row-2">
                            <div className="form-group">
                                <label>Full Name</label>
                                <input type="text" className="form-input" value={fullName} onChange={(event) => setFullName(event.target.value)} />
                            </div>
                            <div className="form-group">
                                <label>Date of Birth</label>
                                <input type="date" className="form-input" value={dateOfBirth} onChange={(event) => setDateOfBirth(event.target.value)} />
                            </div>
                        </div>

                        <div className="form-row-2">
                            <div className="form-group">
                                <label>Blood Group</label>
                                <select className="form-input" value={bloodGroup} onChange={(event) => setBloodGroup(event.target.value)}>
                                    <option value="">-- Select Blood Group --</option>
                                    <option value="A+">A+</option>
                                    <option value="A-">A-</option>
                                    <option value="B+">B+</option>
                                    <option value="B-">B-</option>
                                    <option value="O+">O+</option>
                                    <option value="O-">O-</option>
                                    <option value="AB+">AB+</option>
                                    <option value="AB-">AB-</option>
                                    <option value="Unknown">Unknown</option>
                                </select>
                            </div>
                            <div className="form-group">
                                <label>Organ Donor Status</label>
                                <select className="form-input" value={organDonorStatus} onChange={(event) => setOrganDonorStatus(event.target.value)}>
                                    <option value="Not specified">Not specified</option>
                                    <option value="Yes">Yes — I am an organ donor</option>
                                    <option value="No">No — I am not an organ donor</option>
                                </select>
                            </div>
                        </div>
                    </div>

                    <div className="form-section">
                        <h2 className="section-title">💊 Medical Information</h2>

                        <div className="form-group">
                            <label>Google Drive / Cloud Report Links <span className="field-hint">(one per line)</span></label>
                            <textarea
                                className="form-input form-textarea"
                                placeholder={`Recent ECG: https://drive.google.com/...${'\n'}Prescription scan: https://drive.google.com/...`}
                                value={documentLinks}
                                onChange={(event) => setDocumentLinks(event.target.value)}
                            />
                        </div>

                        <div className="form-group">
                            <label>Upload Medical Document Photos <span className="field-hint">(reports, scans, prescriptions)</span></label>
                            <input type="file" accept="image/*" multiple className="form-input file-input" onChange={(event) => handleDocumentUpload(event, 'documents')} />
                        </div>

                        <UploadPreviewGrid items={documentImages} title="Medical document uploads" onRemove={removeDocumentImage} />

                        <div className="form-group">
                            <label>Upload Medication Photos <span className="field-hint">(medicine strips, labels, bottles)</span></label>
                            <input type="file" accept="image/*" multiple className="form-input file-input" onChange={(event) => handleDocumentUpload(event, 'medications')} />
                        </div>

                        <UploadPreviewGrid items={medicationImages} title="Medication image uploads" onRemove={removeMedicationImage} />

                        <div className="form-group">
                            <label>Allergies <span className="field-hint">(drug or food)</span></label>
                            <textarea className="form-input form-textarea" value={allergies} onChange={(event) => setAllergies(event.target.value)} />
                        </div>

                        <div className="form-group">
                            <label>Chronic Conditions</label>
                            <textarea className="form-input form-textarea" value={chronicConditions} onChange={(event) => setChronicConditions(event.target.value)} />
                        </div>

                        <div className="form-group">
                            <label>Current Medications</label>
                            <textarea className="form-input form-textarea" value={currentMedications} onChange={(event) => setCurrentMedications(event.target.value)} />
                        </div>

                        <div className="form-group">
                            <label>Previous Surgeries</label>
                            <textarea className="form-input form-textarea" value={previousSurgeries} onChange={(event) => setPreviousSurgeries(event.target.value)} />
                        </div>

                        <div className="form-group">
                            <label>Previous Prescriptions / Medical History</label>
                            <textarea className="form-input form-textarea" value={previousPrescriptions} onChange={(event) => setPreviousPrescriptions(event.target.value)} />
                        </div>
                    </div>

                    <div className="form-section">
                        <h2 className="section-title">📞 Emergency Contact</h2>
                        <p className="section-description">Who should doctors call if you are unconscious or unable to speak?</p>

                        <div className="form-row-2">
                            <div className="form-group">
                                <label>Contact Name</label>
                                <input type="text" className="form-input" value={emergencyContactName} onChange={(event) => setEmergencyContactName(event.target.value)} />
                            </div>
                            <div className="form-group">
                                <label>Contact Phone Number</label>
                                <input type="tel" className="form-input" value={emergencyContactPhone} onChange={(event) => setEmergencyContactPhone(event.target.value)} />
                            </div>
                        </div>
                    </div>

                    <div className="form-actions">
                        <button className="btn-primary save-btn" onClick={handleSave} disabled={saving}>
                            {saving ? 'Saving...' : '💾 Save Health Profile'}
                        </button>
                        <Link to="/dashboard" className="btn-secondary cancel-btn">Cancel</Link>
                    </div>
                </div>
            </div>
        </div>
    );
}
