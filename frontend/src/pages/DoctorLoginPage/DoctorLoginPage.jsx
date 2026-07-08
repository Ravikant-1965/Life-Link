import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import api from '../../api';
import '../RegisterPage/RegisterPage.css';

export function DoctorLoginPage({ loginDoctor }) {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();

    const healthId = searchParams.get('healthId');

    const handleLogin = async () => {
        if (!email || !password) {
            setError('Please fill in both email and password.');
            return;
        }

        setLoading(true);
        setError('');

        try {
            const response = await api.post('/api/doctors/login', { email, password });
            loginDoctor(response.data.doctor, response.data.token);
            navigate(healthId ? `/doctor/portal?healthId=${healthId}` : '/doctor/portal');
        } catch (requestError) {
            setError(requestError.response?.data?.message || 'Doctor login failed. Please try again.');
        }

        setLoading(false);
    };

    return (
        <div className="auth-page">
            <div className="auth-card">
                <div className="auth-header">
                    <Link to="/" className="auth-logo">🏥 Life Link</Link>
                    <h1>Verified doctor login</h1>
                    <p>Only approved doctor accounts can access emergency patient profiles.</p>
                </div>

                {error && <div className="error-message">{error}</div>}

                <div className="auth-form">
                    <div className="form-group">
                        <label>Doctor Email</label>
                        <input
                            type="email"
                            className="form-input"
                            placeholder="e.g. doctor@hospital.org"
                            value={email}
                            onChange={(event) => setEmail(event.target.value)}
                        />
                    </div>

                    <div className="form-group">
                        <label>Password</label>
                        <div style={{ position: 'relative' }}>
                            <input
                                type={showPassword ? 'text' : 'password'}
                                className="form-input"
                                style={{ paddingRight: '40px' }}
                                placeholder="Enter your doctor password"
                                value={password}
                                onChange={(event) => setPassword(event.target.value)}
                            />
                            <button
                                type="button"
                                onMouseDown={(e) => { e.preventDefault(); setShowPassword(true); }}
                                onMouseUp={(e) => { e.preventDefault(); setShowPassword(false); }}
                                onMouseLeave={(e) => { e.preventDefault(); setShowPassword(false); }}
                                onTouchStart={(e) => { e.preventDefault(); setShowPassword(true); }}
                                onTouchEnd={(e) => { e.preventDefault(); setShowPassword(false); }}
                                onTouchCancel={(e) => { e.preventDefault(); setShowPassword(false); }}
                                style={{
                                    position: 'absolute',
                                    right: '12px',
                                    top: '50%',
                                    transform: 'translateY(-50%)',
                                    background: 'none',
                                    border: 'none',
                                    cursor: 'pointer',
                                    color: '#718096',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    padding: '4px',
                                    userSelect: 'none',
                                    WebkitUserSelect: 'none'
                                }}
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
                                    <circle cx="12" cy="12" r="3" />
                                </svg>
                            </button>
                        </div>
                    </div>

                    <button className="btn-primary auth-submit-btn" onClick={handleLogin} disabled={loading}>
                        {loading ? 'Checking verification...' : 'Doctor Login'}
                    </button>
                </div>

                <div className="auth-footer">
                    Need a doctor account? <Link to={`/doctor/register${healthId ? `?healthId=${healthId}` : ''}`}>Register here</Link>
                    <br />
                    Patient access? <Link to="/login">Patient login</Link>
                </div>
            </div>
        </div>
    );
}
