// LoginPage.jsx — Login with email and password
// ============================================================
// After successful login, the backend gives us:
//   1) A JWT token (we save this to make future API calls)
//   2) User info (name, email, healthId)
//
// We pass both to the login() function from App.jsx
// which saves them to state AND localStorage
// ============================================================

import axios from 'axios'
import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import '../RegisterPage/RegisterPage.css'  // reuse the same form styles!

export function LoginPage({ login }) {

  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState('');

  const navigate = useNavigate();

  const handleLogin = async () => {
    if (!email || !password) {
      setError('Please fill in both email and password.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await axios.post('/api/login', { email, password });

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
            <input
              type="password"
              className="form-input"
              placeholder="Enter your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyPress={handleKeyPress}
            />
          </div>

          <button
            className="btn-primary auth-submit-btn"
            onClick={handleLogin}
            disabled={loading}
          >
            {loading ? 'Logging in...' : 'Login'}
          </button>

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
