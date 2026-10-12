import { useState, useEffect } from 'react';
import api from '../../api';

export function DoctorProfileModal({ isOpen, onClose, doctorToken, doctor, onDoctorUpdated }) {
    const [formData, setFormData] = useState({
        hospital: '',
        department: 'General Medicine',
        specialization: '',
        qualifications: '',
        experienceYears: '',
        phone: '',
        bio: ''
    });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    useEffect(() => {
        if (doctor) {
            setFormData({
                hospital: doctor.hospital || '',
                department: doctor.department || doctor.specialization || 'General Medicine',
                specialization: doctor.specialization || '',
                qualifications: doctor.qualifications || '',
                experienceYears: doctor.experienceYears || doctor.experience_years || '',
                phone: doctor.phone || '',
                bio: doctor.bio || ''
            });
        }
    }, [doctor, isOpen]);

    if (!isOpen) return null;

    const handleChange = (field, value) => {
        setFormData((prev) => ({ ...prev, [field]: value }));
    };

    const handleSave = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');
        setSuccess('');

        try {
            const res = await api.put('/api/doctors/profile', formData, {
                headers: { Authorization: `Bearer ${doctorToken}` }
            });
            setSuccess('Doctor practice details updated successfully.');
            if (onDoctorUpdated) {
                onDoctorUpdated(res.data.doctor);
            }
            setTimeout(() => {
                onClose();
            }, 1200);
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to update doctor profile.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="health-modal-overlay" onClick={onClose} style={{ zIndex: 1100 }}>
            <div className="settings-modal-container" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '580px' }}>
                <div className="health-modal-header">
                    <div className="health-modal-title-group">
                        <div className="health-modal-icon">
                            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                                <circle cx="12" cy="7" r="4" />
                            </svg>
                        </div>
                        <div>
                            <h2>Doctor Practice Profile</h2>
                            <p className="health-modal-subtitle">
                                These details are displayed to patients on their secure access audit logs.
                            </p>
                        </div>
                    </div>
                    <button className="health-modal-close-btn" onClick={onClose} aria-label="Close modal">
                        &times;
                    </button>
                </div>

                <form onSubmit={handleSave} className="settings-modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    {error && <div className="error-message">{error}</div>}
                    {success && <div className="success-message" style={{ color: '#10b981', background: '#ecfdf5', padding: '10px 14px', borderRadius: '8px', border: '1px solid #a7f3d0', fontSize: '13px' }}>{success}</div>}

                    <div className="settings-group">
                        <h3>Identity & Credentials</h3>
                        <div className="settings-row">
                            <span className="settings-row-label">Doctor Name</span>
                            <span className="settings-row-val"><strong>{doctor?.name}</strong></span>
                        </div>
                        <div className="settings-row">
                            <span className="settings-row-label">License Number</span>
                            <span className="settings-row-val health-id-badge">{doctor?.licenseNumber || doctor?.license_number}</span>
                        </div>
                    </div>

                    <div className="settings-group">
                        <h3>Department & Specialization</h3>
                        <div className="form-group" style={{ marginBottom: '12px' }}>
                            <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#334155', marginBottom: '6px' }}>Primary Department</label>
                            <select
                                className="form-input"
                                value={formData.department}
                                onChange={(e) => handleChange('department', e.target.value)}
                                style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1' }}
                            >
                                <option value="Cardiology">Cardiology</option>
                                <option value="Orthopedics">Orthopedics</option>
                                <option value="Neurology">Neurology</option>
                                <option value="Emergency Medicine">Emergency Medicine</option>
                                <option value="General Medicine">General Medicine</option>
                                <option value="Pediatrics">Pediatrics</option>
                                <option value="General Surgery">General Surgery</option>
                                <option value="Dermatology">Dermatology</option>
                                <option value="Oncology">Oncology</option>
                            </select>
                        </div>

                        <div className="form-group" style={{ marginBottom: '12px' }}>
                            <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#334155', marginBottom: '6px' }}>Specialization / Clinical Sub-focus</label>
                            <input
                                className="form-input"
                                placeholder="e.g. Musculoskeletal Trauma, Interventional Cardiology"
                                value={formData.specialization}
                                onChange={(e) => handleChange('specialization', e.target.value)}
                                style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1' }}
                            />
                        </div>

                        <div className="form-group" style={{ marginBottom: '12px' }}>
                            <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#334155', marginBottom: '6px' }}>Medical Qualifications & Degrees</label>
                            <input
                                className="form-input"
                                placeholder="e.g. MBBS, MD (Medicine), DM (Cardiology), FACC"
                                value={formData.qualifications}
                                onChange={(e) => handleChange('qualifications', e.target.value)}
                                style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1' }}
                            />
                        </div>
                    </div>

                    <div className="settings-group">
                        <h3>Hospital & Contact</h3>
                        <div className="form-group" style={{ marginBottom: '12px' }}>
                            <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#334155', marginBottom: '6px' }}>Hospital / Clinical Affiliation</label>
                            <input
                                className="form-input"
                                placeholder="e.g. Metro Heart Super Specialty Hospital"
                                value={formData.hospital}
                                onChange={(e) => handleChange('hospital', e.target.value)}
                                style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1' }}
                            />
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
                            <div className="form-group">
                                <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#334155', marginBottom: '6px' }}>Clinical Experience</label>
                                <input
                                    className="form-input"
                                    placeholder="e.g. 10 Years"
                                    value={formData.experienceYears}
                                    onChange={(e) => handleChange('experienceYears', e.target.value)}
                                    style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1' }}
                                />
                            </div>

                            <div className="form-group">
                                <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#334155', marginBottom: '6px' }}>Practice Contact Phone</label>
                                <input
                                    className="form-input"
                                    placeholder="e.g. +1 (555) 382-9102"
                                    value={formData.phone}
                                    onChange={(e) => handleChange('phone', e.target.value)}
                                    style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1' }}
                                />
                            </div>
                        </div>

                        <div className="form-group" style={{ marginBottom: '12px' }}>
                            <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#334155', marginBottom: '6px' }}>Clinical Biography / Focus</label>
                            <textarea
                                className="form-input"
                                rows={3}
                                placeholder="Brief summary of your clinical specialty and acute consultation practice..."
                                value={formData.bio}
                                onChange={(e) => handleChange('bio', e.target.value)}
                                style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1', resize: 'vertical' }}
                            />
                        </div>
                    </div>

                    <div className="health-modal-footer" style={{ marginTop: '12px', display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                        <button type="button" className="btn-secondary" onClick={onClose} disabled={loading}>
                            Cancel
                        </button>
                        <button type="submit" className="btn-primary" disabled={loading} style={{ background: '#018ABE', color: '#fff', border: 'none', padding: '10px 22px', borderRadius: '8px', fontWeight: '600', cursor: 'pointer' }}>
                            {loading ? 'Saving...' : 'Save Practice Details'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
