// LoginPage.jsx — Login with email and password
// ============================================================
// After successful login, the backend gives us:
//   1) A JWT token (we save this to make future API calls)
//   2) User info (name, email, healthId)
//
// We pass both to the login() function from App.jsx
// which saves them to state AND localStorage
// ============================================================

import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import api from '../../api'
import '../RegisterPage/RegisterPage.css'  // reuse the same form styles!

export function LoginPage({ login }) {

  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const navigate = useNavigate();

  const handleLogin = async () => {
    if (!email || !password) {
      setError('Please fill in both email and password.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await api.post('/api/login', { email, password });

      // Call the login() function from App.jsx to save the token and user info
      login(response.data.user, response.data.token);

      // Redirect to the dashboard
      navigate('/dashboard');

    } catch (error) {
      setError(error.response?.data?.message || 'Login failed. Please try again.');
    }

    setLoading(false);
  }

  // Allow pressing Enter to submit
  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      handleLogin();
    }
  }

  const handlePasswordShow = (e) => {
    e.preventDefault();
    setShowPassword(true);
  };

  const handlePasswordHide = (e) => {
    e.preventDefault();
    setShowPassword(false);
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
          <Link to="/" className="auth-logo">🏥 Life Link</Link>
          <h1>Patient login</h1>
          <p>Login to manage your health profile, uploads, and access logs</p>
        </div>

        {error && <div className="error-message">{error}</div>}

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
            />
          </div>

          <div className="form-group">
            <label>Password</label>
            <div style={{ position: 'relative' }}>
              <input
                type={showPassword ? "text" : "password"}
                className="form-input"
                style={{ paddingRight: '40px' }}
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyPress={handleKeyPress}
              />
              <button
                type="button"
                onMouseDown={handlePasswordShow}
                onMouseUp={handlePasswordHide}
                onMouseLeave={handlePasswordHide}
                onTouchStart={handlePasswordShow}
                onTouchEnd={handlePasswordHide}
                onTouchCancel={handlePasswordHide}
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
            {loading ? 'Logging in...' : 'Login'}
          </button>

          <div style={{ textAlign: 'center', marginTop: '6px' }}>
            <Link 
              to="/forgot-password" 
              style={{ color: '#0077b6', textDecoration: 'none', fontSize: '14px', fontWeight: '600' }}
              onMouseEnter={(e) => e.target.style.textDecoration = 'underline'}
              onMouseLeave={(e) => e.target.style.textDecoration = 'none'}
            >
              Forgot Password?
            </Link>
          </div>

        </div>


        <div className="auth-footer">
          Don't have a patient account? <Link to="/register">Register here</Link>
          <br />
          Are you a doctor? <Link to="/doctor/login">Doctor login</Link>
        </div>

      </div>
    </div>
  )
}
