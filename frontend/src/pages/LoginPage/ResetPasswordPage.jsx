import { useState } from 'react';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import api from '../../api';
import '../RegisterPage/RegisterPage.css'; // reuse the same form styles!

export function ResetPasswordPage() {
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState('');
    const [error, setError] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);

    const [searchParams] = useSearchParams();
    const token = searchParams.get('token');
    const navigate = useNavigate();

    const handleResetPassword = async () => {
        if (!token) {
            setError('Missing or invalid reset token.');
            return;
        }

        if (!password || password.length < 6) {
            setError('Password must be at least 6 characters.');
            return;
        }

        if (password !== confirmPassword) {
            setError('Passwords do not match.');
            return;
        }

        setLoading(true);
        setError('');
        setMessage('');

        try {
            const response = await api.post('/api/reset-password', {
                token,
                password,
                confirmPassword
            });
            setMessage(response.data.message);
            // Redirect after 3 seconds
            setTimeout(() => {
                navigate('/login');
            }, 3000);
        } catch (requestError) {
            setError(requestError.response?.data?.message || 'Something went wrong. Please try again.');
        }

        setLoading(false);
    };

    const handleKeyPress = (e) => {
        if (e.key === 'Enter') {
            handleResetPassword();
        }
    };

    const EyeIcon = () => (
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
            <circle cx="12" cy="12" r="3" />
        </svg>
    );

    return (
        <div className="auth-page">
            <div className="auth-card">
                <div className="auth-header">
                    <Link to="/" className="auth-logo">
                        <img src="/logo_cross.png" alt="Life Link Logo" className="auth-logo-img" />
                        <span>Life Link</span>
                    </Link>
                    <h1>Reset Password</h1>
                    <p>Enter your new password below.</p>
                </div>

                {error && <div className="error-message">{error}</div>}
                {message && <div className="success-message">{message} (Redirecting to login...)</div>}

                <div className="auth-form">
                    <div className="form-group">
                        <label>New Password</label>
                        <div style={{ position: 'relative' }}>
                            <input
                                type={showPassword ? "text" : "password"}
                                className="form-input"
                                style={{ paddingRight: '40px' }}
                                placeholder="At least 6 characters"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                onKeyPress={handleKeyPress}
                                disabled={loading || !!message}
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

                    <div className="form-group">
                        <label>Confirm Password</label>
                        <div style={{ position: 'relative' }}>
                            <input
                                type={showConfirmPassword ? "text" : "password"}
                                className="form-input"
                                style={{ paddingRight: '40px' }}
                                placeholder="Confirm your new password"
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                onKeyPress={handleKeyPress}
                                disabled={loading || !!message}
                            />
                            <button
                                type="button"
                                onMouseDown={(e) => { e.preventDefault(); setShowConfirmPassword(true); }}
                                onMouseUp={(e) => { e.preventDefault(); setShowConfirmPassword(false); }}
                                onMouseLeave={(e) => { e.preventDefault(); setShowConfirmPassword(false); }}
                                onTouchStart={(e) => { e.preventDefault(); setShowConfirmPassword(true); }}
                                onTouchEnd={(e) => { e.preventDefault(); setShowConfirmPassword(false); }}
                                onTouchCancel={(e) => { e.preventDefault(); setShowConfirmPassword(false); }}
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
                        onClick={handleResetPassword}
                        disabled={loading || !!message}
                    >
                        {loading ? 'Resetting Password...' : 'Reset Password'}
                    </button>
                </div>

                <div className="auth-footer">
                    Back to <Link to="/login">Login</Link>
                </div>
            </div>
        </div>
    );
}
