// LoginPage.jsx — Unified Login for Patients & Doctors
// ============================================================
// Automatically detects whether the credentials belong to a Patient or a Doctor
// without requiring the user to explicitly select their role up front.
// ============================================================

import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import api from '../../api';
import { RegisterChoiceModal } from '../../components/RegisterChoiceModal/RegisterChoiceModal';
import '../RegisterPage/RegisterPage.css';

export function LoginPage({ login, loginDoctor }) {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [isChoiceModalOpen, setIsChoiceModalOpen] = useState(false);

    // MFA States for Doctor Login
    const [mfaStep, setMfaStep] = useState(false);
    const [tempToken, setTempToken] = useState('');
    const [mfaCode, setMfaCode] = useState('');
    const [mfaLoading, setMfaLoading] = useState(false);

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
            // Step 1: Attempt Patient Login first
            const patientRes = await api.post('/api/login', { email, password });
            login(patientRes.data.user, patientRes.data.token);
            navigate('/dashboard');
            return;
        } catch (patientErr) {
            const patientStatus = patientErr.response?.status;

            // If invalid credentials (401), attempt Doctor Login next
            if (patientStatus === 401 || patientErr.response?.data?.message === 'Invalid email or password.') {
                try {
                    const doctorRes = await api.post('/api/doctors/login', { email, password });

                    if (doctorRes.data.mfaRequired) {
                        setTempToken(doctorRes.data.tempToken);
                        setMfaStep(true);
                    } else {
                        loginDoctor(doctorRes.data.doctor, doctorRes.data.token);
                        navigate(healthId ? `/doctor/portal?healthId=${healthId}` : '/doctor/portal');
                    }
                    return;
                } catch (doctorErr) {
                    const docMsg = doctorErr.response?.data?.message;
                    if (doctorErr.response?.status === 403) {
                        setError(docMsg || 'Doctor account is not yet verified. Approval is required before accessing profiles.');
                    } else {
                        setError('Invalid email or password.');
                    }
                }
            } else {
                setError(patientErr.response?.data?.message || 'Login failed. Please try again.');
            }
        } finally {
            setLoading(false);
        }
    };

    const handleMfaVerify = async () => {
        if (!mfaCode || mfaCode.trim().length !== 6) {
            setError('Please enter the full 6-digit code from your authenticator app.');
            return;
        }

        setMfaLoading(true);
        setError('');

        try {
            const response = await api.post('/api/doctors/mfa/verify-login', {
                tempToken,
                code: mfaCode.trim()
            });

            loginDoctor(response.data.doctor, response.data.token);
            navigate(healthId ? `/doctor/portal?healthId=${healthId}` : '/doctor/portal');
        } catch (requestError) {
            setError(requestError.response?.data?.message || 'MFA verification failed. Please check your code.');
        } finally {
            setMfaLoading(false);
        }
    };

    const handleKeyPress = (e) => {
        if (e.key === 'Enter') {
            if (mfaStep) {
                handleMfaVerify();
            } else {
                handleLogin();
            }
        }
    };

    const EyeIcon = () => (
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
            <circle cx="12" cy="12" r="3" />
        </svg>
    );

    if (mfaStep) {
        return (
            <div className="auth-page">
                <div className="auth-card">
                    <div className="auth-header">
                        <Link to="/" className="auth-logo">
                            <img src="/logo_cross.png" alt="Life Link Logo" className="auth-logo-img" />
                            <span>Life Link</span>
                        </Link>
                        <h1>2-Step Verification 🔐</h1>
                        <p>Enter the 6-digit verification code from your authenticator app.</p>
                    </div>

                    {error && <div className="error-message">{error}</div>}

                    <div className="auth-form">
                        <div className="form-group">
                            <label>6-Digit Authenticator Code</label>
                            <input
                                type="text"
                                className="form-input"
                                style={{
                                    letterSpacing: '8px',
                                    textAlign: 'center',
                                    fontSize: '20px',
                                    fontWeight: 'bold',
                                    fontFamily: 'monospace'
                                }}
                                maxLength={6}
                                placeholder="123456"
                                value={mfaCode}
                                onChange={(event) => setMfaCode(event.target.value.replace(/\D/g, ''))}
                                onKeyPress={handleKeyPress}
                                autoFocus
                            />
                        </div>

                        <button className="btn-primary auth-submit-btn" onClick={handleMfaVerify} disabled={mfaLoading}>
                            {mfaLoading ? 'Verifying Code...' : 'Verify & Log In'}
                        </button>

                        <button
                            type="button"
                            className="btn-secondary"
                            style={{ width: '100%', marginTop: '10px' }}
                            onClick={() => {
                                setMfaStep(false);
                                setTempToken('');
                                setMfaCode('');
                                setError('');
                            }}
                        >
                            ← Back to LogIn
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="auth-page">
            <div className="auth-card">
                <div className="auth-header">
                    <Link to="/" className="auth-logo">
                        <img src="/logo_cross.png" alt="Life Link Logo" className="auth-logo-img" />
                        <span>Life Link</span>
                    </Link>
                    <h1>LogIn</h1>
                    <p>Enter your credentials to log in to your account</p>
                </div>

                {error && <div className="error-message">{error}</div>}

                <div className="auth-form">
                    <div className="form-group">
                        <label>Email Address</label>
                        <input
                            type="email"
                            className="form-input"
                            placeholder="Enter your email address"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            onKeyPress={handleKeyPress}
                        />
                    </div>

                    <div className="form-group">
                        <label>Password</label>
                        <div style={{ position: 'relative' }}>
                            <input
                                type={showPassword ? 'text' : 'password'}
                                className="form-input"
                                style={{ paddingRight: '40px' }}
                                placeholder="Enter your password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                onKeyPress={handleKeyPress}
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
                                <EyeIcon />
                            </button>
                        </div>
                    </div>

                    <button
                        className="btn-primary auth-submit-btn"
                        onClick={handleLogin}
                        disabled={loading}
                    >
                        {loading ? 'Logging in...' : 'LogIn'}
                    </button>

                    <div style={{ textAlign: 'center', marginTop: '6px' }}>
                        <Link
                            to="/forgot-password"
                            style={{ color: '#018ABE', textDecoration: 'none', fontSize: '14px', fontWeight: '600' }}
                            onMouseEnter={(e) => e.target.style.textDecoration = 'underline'}
                            onMouseLeave={(e) => e.target.style.textDecoration = 'none'}
                        >
                            Forgot Password?
                        </Link>
                    </div>
                </div>

                <div className="auth-footer">
                    Don't have an account?{' '}
                    <button
                        type="button"
                        style={{
                            background: 'none',
                            border: 'none',
                            color: '#018ABE',
                            fontWeight: '600',
                            cursor: 'pointer',
                            padding: 0,
                            font: 'inherit',
                            textDecoration: 'underline'
                        }}
                        onClick={() => setIsChoiceModalOpen(true)}
                    >
                        Create new profile
                    </button>
                </div>
            </div>

            <RegisterChoiceModal
                isOpen={isChoiceModalOpen}
                onClose={() => setIsChoiceModalOpen(false)}
            />
        </div>
    );
}
