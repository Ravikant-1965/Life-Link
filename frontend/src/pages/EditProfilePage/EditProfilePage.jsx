import axios from 'axios';
import { useEffect, useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
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

    useEffect(() => {
        const loadProfile = async () => {
            try {
                const response = await axios.get('/api/profile', {
                    headers: { Authorization: `Bearer ${token}` }
                });

                const profile = response.data.profile;

                if (profile) {
                    setFullName(profile.full_name || '');
                    setDateOfBirth(profile.date_of_birth || '');
                    setBloodGroup(profile.blood_group || '');
                    setAllergies(profile.allergies || '');
                    setChronicConditions(profile.chronic_conditions || '');
                    setCurrentMedications(profile.current_medications || '');
                    setPreviousSurgeries(profile.previous_surgeries || '');
                    setPreviousPrescriptions(profile.previous_prescriptions || '');
                    setEmergencyContactName(profile.emergency_contact_name || '');
                    setEmergencyContactPhone(profile.emergency_contact_phone || '');
                    setOrganDonorStatus(profile.organ_donor_status || 'Not specified');
                    setDocumentLinks(profile.medical_file_links?.join('\n') || profile.medical_files || '');
                    setDocumentImages(profile.document_images || []);
                    setMedicationImages(profile.medication_images || []);
                }
            } catch (requestError) {
                if (requestError.response?.status === 401) {
                    logout();
                    navigate('/login');
                }
            }

            setLoading(false);
        };

        loadProfile();
    }, [logout, navigate, token]);

    const handleDocumentUpload = async (event, type) => {
        try {
            const files = await readFilesAsDataUrls(event.target.files);

            if (type === 'documents') {
                setDocumentImages((current) => [...current, ...files]);
            } else {
                setMedicationImages((current) => [...current, ...files]);
            }

            event.target.value = '';
        } catch (_error) {
            setError('One of the selected images could not be read. Please try again.');
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

        try {
            await axios.post(
                '/api/profile',
                {
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
                },
                {
                    headers: { Authorization: `Bearer ${token}` }
                }
            );

            setSuccess('Health profile saved successfully!');
            window.scrollTo({ top: 0, behavior: 'smooth' });

            setTimeout(() => {
                navigate('/dashboard');
            }, 1500);
        } catch (requestError) {
            setError(requestError.response?.data?.message || 'Failed to save. Please try again.');
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }

        setSaving(false);
    };

    if (loading) {
        return <div className="loading-text">Loading your profile...</div>;
    }

    return (
        <div className="edit-profile-page">
            <nav className="dashboard-nav">
                <Link to="/dashboard" className="nav-logo-text">🏥 Life Link</Link>
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
