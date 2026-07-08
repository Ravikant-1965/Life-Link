import { useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../../api';
import '../RegisterPage/RegisterPage.css'; // reuse the same form styles!

export function ForgotPasswordPage() {
    const [email, setEmail] = useState('');
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState('');
    const [error, setError] = useState('');

    const handleRequestReset = async () => {
        if (!email) {
            setError('Please enter your email address.');
            return;
        }

        setLoading(true);
        setError('');
        setMessage('');

        try {
            const response = await api.post('/api/forgot-password', { email });
            setMessage(response.data.message);
        } catch (requestError) {
            setError(requestError.response?.data?.message || 'Something went wrong. Please try again.');
        }

        setLoading(false);
    };

    const handleKeyPress = (e) => {
        if (e.key === 'Enter') {
            handleRequestReset();
        }
    };

    return (
        <div className="auth-page">
            <div className="auth-card">
                <div className="auth-header">
                    <Link to="/" className="auth-logo">🏥 Life Link</Link>
                    <h1>Forgot Password</h1>
                    <p>Enter your registered email address to receive a secure password reset link.</p>
                </div>

                {error && <div className="error-message">{error}</div>}
                {message && <div className="success-message">{message}</div>}

                <div className="auth-form">
                    <div className="form-group">
                        <label>Email Address</label>
                        <input
                            type="email"
                            className="form-input"
                            placeholder="e.g. rahul@email.com"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            onKeyPress={handleKeyPress}
                            disabled={loading || !!message}
                        />
                    </div>

                    <button
                        className="btn-primary auth-submit-btn"
                        onClick={handleRequestReset}
                        disabled={loading || !!message}
                    >
                        {loading ? 'Submitting...' : 'Submit'}
                    </button>
                </div>

                <div className="auth-footer">
                    Remember your password? <Link to="/login">Login here</Link>
                </div>
            </div>
        </div>
    );
}
