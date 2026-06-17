// AccessLogPage.jsx — Shows the patient who has accessed their profile
// ============================================================
// Every time a doctor views your emergency profile, we log it.
// This page shows those logs to the patient so they know
// who accessed their data and when.
//
// This page requires login (we check for user and token).
// ============================================================

import axios from 'axios'
import { useState, useEffect } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import './AccessLogPage.css'

export function AccessLogPage({ user, token, logout }) {

  const [logs,    setLogs]    = useState([]);   // array of access log entries
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState('');

  const navigate = useNavigate();

  // Redirect if not logged in
  if (!user || !token) {
    return <Navigate to="/login" replace />;
  }

  // Fetch access logs from the backend when page loads
  useEffect(() => {
    const fetchLogs = async () => {
      try {
        const response = await axios.get('/api/access-log', {
          headers: { Authorization: `Bearer ${token}` }
        });
        setLogs(response.data);
      } catch (error) {
        if (error.response?.status === 401) {
          // Token expired — logout and redirect
          logout();
          navigate('/login');
        } else {
          setError('Failed to load access logs. Please try again.');
        }
      }
      setLoading(false);
    }

    fetchLogs();
  }, [logout, navigate, token]);


  // formatDate() — turns "2024-03-15T10:30:00.000Z" into "March 15, 2024 at 10:30 AM"
  // We could use a library like dayjs (like your ecommerce project did),
  // but let's keep it simple with built-in JavaScript Date!
  const formatDate = (isoString) => {
    const date = new Date(isoString);

    const dateStr = date.toLocaleDateString('en-IN', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    const timeStr = date.toLocaleTimeString('en-IN', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });

    return `${dateStr} at ${timeStr}`;
  }
  const verifiedAccesses = logs.filter((log) => log.doctor_id || log.doctor_name || log.doctor_email).length;

  if (loading) {
    return <div className="loading-text">Loading access logs...</div>
  }


  return (
    <div className="access-log-page">

      {/* ---- NAVBAR ---- */}
      <nav className="dashboard-nav">
        <Link to="/" className="nav-logo-text">🏥 Life Link</Link>
        <div className="nav-right">
          <Link to="/dashboard" className="nav-link">← Back to Dashboard</Link>
          <button onClick={logout} className="btn-secondary nav-logout-btn">Logout</button>
        </div>
      </nav>

      <div className="access-log-content">

        {/* ---- PAGE HEADER ---- */}
        <div className="access-log-header">
          <h1>📋 Profile Access Log</h1>
          <p>
            Every verified doctor lookup for your Health ID <strong>({user.healthId})</strong> is recorded here with
            doctor identity details. This is your privacy audit trail.
          </p>
        </div>

        {error && <div className="error-message">{error}</div>}

        {/* ---- LOG STATS ---- */}
        <div className="log-stats">
          <div className="stat-card">
            <div className="stat-number">{verifiedAccesses}</div>
            <div className="stat-label">Verified Doctor Views</div>
          </div>
          <div className="stat-card">
            <div className="stat-number">
              {logs.length > 0 ? formatDate(logs[0].accessed_at).split(' at')[0] : '—'}
            </div>
            <div className="stat-label">Most Recent Access</div>
          </div>
        </div>


        {/* ---- LOG LIST ---- */}
        {logs.length === 0 ? (
          /* Nobody has looked up this patient yet */
          <div className="no-logs-card">
            <div className="no-logs-icon">🔒</div>
            <h2>No accesses yet</h2>
            <p>
              Your profile has not been opened by a verified doctor yet.
              When secure emergency access happens, it will appear here.
            </p>
          </div>
        ) : (
          <div className="logs-list">
            <div className="logs-list-header">
              <span>Access #</span>
              <span>Doctor</span>
              <span>License</span>
              <span>Date &amp; Time</span>
            </div>

            {/* Map through each log entry and show it as a row */}
            {logs.map((log, index) => (
              <div key={log.id} className="log-row">
                <span className="log-number">#{logs.length - index}</span>

                <div className="log-doctor">
                  <strong>{log.doctor_name || 'Verified doctor'}</strong>
                  <span className="log-doctor-email">{log.doctor_email || 'Doctor email unavailable'}</span>
                  <span className="log-health-id">Health ID: {log.health_id}</span>
                </div>

                <span className="log-license">{log.doctor_license || 'Not recorded'}</span>
                <span className="log-time">{formatDate(log.accessed_at)}</span>
              </div>
            ))}
          </div>
        )}

        {/* ---- PRIVACY NOTE ---- */}
        <div className="privacy-note">
          <strong>🔒 Privacy Note:</strong> Access logs store the doctor identity and access time only.
          Your full medical profile data is never copied into the log.
          This log is only visible to you.
        </div>

      </div>
    </div>
  )
}
