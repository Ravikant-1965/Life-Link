import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import api from '../../api';
import '../RegisterPage/RegisterPage.css';

export function DoctorRegisterPage() {
    const [formData, setFormData] = useState({
        name: '',
        email: '',
        password: '',
        licenseNumber: '',
        hospital: '',
        specialization: '',
        verificationCode: ''
    });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();

    const healthId = searchParams.get('healthId');

    const updateField = (field, value) => {
        setFormData((current) => ({ ...current, [field]: value }));
    };

    const handleRegister = async () => {
        const requiredFields = ['name', 'email', 'password', 'licenseNumber', 'hospital', 'specialization'];
        const missingField = requiredFields.some((field) => !formData[field]);

        if (missingField) {
            setError('Please fill in every required doctor registration field.');
            return;
        }

        setLoading(true);
        setError('');
        setSuccess('');

        try {
            const response = await api.post('/api/doctors/register', formData);
            setSuccess(response.data.message);

            setTimeout(() => {
                navigate(`/doctor/login${healthId ? `?healthId=${healthId}` : ''}`);
            }, 2200);
        } catch (requestError) {
            setError(requestError.response?.data?.message || 'Doctor registration failed. Please try again.');
        }

        setLoading(false);
    };

    return (
        <div className="auth-page">
            <div className="auth-card">
                <div className="auth-header">
                    <Link to="/" className="auth-logo">🏥 Life Link</Link>
                    <h1>Doctor verification signup</h1>
                    <p>Register with your professional credentials to request secure patient access.</p>
                </div>

                {error && <div className="error-message">{error}</div>}
                {success && <div className="success-message">{success}</div>}

                <div className="auth-form">
                    <div className="form-group">
                        <label>Full Name</label>
                        <input className="form-input" value={formData.name} onChange={(event) => updateField('name', event.target.value)} />
                    </div>

                    <div className="form-group">
                        <label>Professional Email</label>
                        <input className="form-input" type="email" value={formData.email} onChange={(event) => updateField('email', event.target.value)} />
                    </div>

                    <div className="form-group">
                        <label>Password</label>
                        <input className="form-input" type="password" value={formData.password} onChange={(event) => updateField('password', event.target.value)} />
                    </div>

                    <div className="form-group">
                        <label>Medical License Number</label>
                        <input className="form-input" value={formData.licenseNumber} onChange={(event) => updateField('licenseNumber', event.target.value)} />
                    </div>

                    <div className="form-group">
                        <label>Hospital / Clinic</label>
                        <input className="form-input" value={formData.hospital} onChange={(event) => updateField('hospital', event.target.value)} />
                    </div>

                    <div className="form-group">
                        <label>Specialization</label>
                        <input className="form-input" value={formData.specialization} onChange={(event) => updateField('specialization', event.target.value)} />
                    </div>

                    <div className="form-group">
                        <label>Verification Code <span className="field-hint">(optional, for pre-approved doctors)</span></label>
                        <input className="form-input" value={formData.verificationCode} onChange={(event) => updateField('verificationCode', event.target.value)} />
                    </div>

                    <button className="btn-primary auth-submit-btn" onClick={handleRegister} disabled={loading}>
                        {loading ? 'Submitting verification...' : 'Submit Doctor Registration'}
                    </button>
                </div>

                <div className="auth-footer">
                    Already registered? <Link to={`/doctor/login${healthId ? `?healthId=${healthId}` : ''}`}>Doctor login</Link>
                    <br />
                    Patient signup instead? <Link to="/register">Create patient profile</Link>
                </div>
            </div>
        </div>
    );
}
