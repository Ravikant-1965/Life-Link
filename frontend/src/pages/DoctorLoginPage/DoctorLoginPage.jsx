import axios from 'axios';
import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import '../RegisterPage/RegisterPage.css';

export function DoctorLoginPage({ loginDoctor }) {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
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
            const response = await axios.post('/api/doctors/login', { email, password });
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
                        <input
                            type="password"
                            className="form-input"
                            placeholder="Enter your doctor password"
                            value={password}
                            onChange={(event) => setPassword(event.target.value)}
                        />
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
