// RegisterPage.jsx — Create a new patient account
// ============================================================
// Simple registration form — name, email, password.
// On success, the backend gives us a Health ID.
// ============================================================

import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import api from '../../api'
import './RegisterPage.css'

export function RegisterPage() {

  // Form field states
  const [name,            setName]            = useState('');
  const [email,           setEmail]           = useState('');
  const [password,        setPassword]        = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // UI states
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState('');
  const [success,  setSuccess]  = useState('');

  const navigate = useNavigate(); // Used to redirect after registration

  // handleRegister() — called when the form is submitted
  const handleRegister = async () => {
    // Basic client-side validation before sending to backend
    if (!name || !email || !password || !confirmPassword) {
      setError('Please fill in all fields.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);  // show loading state
    setError('');      // clear old errors

    try {
      const response = await api.post('/api/register', { name, email, password });

      // Show success message with their new Health ID
      setSuccess(`Account created! Your Health ID is: ${response.data.healthId}. Redirecting to login...`);

      // Wait 2 seconds then redirect to login page
      setTimeout(() => {
        navigate('/login');
      }, 2500);

    } catch (error) {
      // The backend sends error messages in error.response.data.message
      setError(error.response?.data?.message || 'Something went wrong. Please try again.');
    }

    setLoading(false);
  }


  return (
    <div className="auth-page">
      <div className="auth-card">

        {/* Header */}
        <div className="auth-header">
          <Link to="/" className="auth-logo">🏥 Life Link</Link>
          <h1>Create your profile</h1>
          <p>Get your Health ID, upload emergency documents, and stay ready</p>
        </div>

        {/* Error / Success messages */}
        {error   && <div className="error-message">{error}</div>}
        {success && <div className="success-message">{success}</div>}

        {/* Registration Form */}
        <div className="auth-form">

          <div className="form-group">
            <label>Full Name</label>
            <input
              type="text"
              className="form-input"
              placeholder="e.g. Rahul Sharma"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div className="form-group">
            <label>Email Address</label>
            <input
              type="email"
              className="form-input"
              placeholder="e.g. rahul@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <div className="form-group">
            <label>Enter password</label>
            <input
              type="password"
              className="form-input"
              placeholder="Enter password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          <div className="form-group">
            <label>Confirm password</label>
            <input
              type="password"
              className="form-input"
              placeholder="Confirm password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
            />
          </div>

          <button
            className="btn-primary auth-submit-btn"
            onClick={handleRegister}
            disabled={loading}
          >
            {loading ? 'Creating Account...' : 'Create Account'}
          </button>

        </div>

        {/* Link to login page */}
        <div className="auth-footer">
          Already have a patient account? <Link to="/login">Login here</Link>
          <br />
          Doctor onboarding? <Link to="/doctor/register">Register as a doctor</Link>
        </div>

      </div>
    </div>
  )
}
