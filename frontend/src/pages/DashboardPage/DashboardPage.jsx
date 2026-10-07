// DashboardPage.jsx — The patient's main dashboard
// ============================================================
// This page shows:
//   1) The patient's Health ID (big and visible)
//   2) A QR Code that encodes the Health ID
//   3) A summary of their health profile
//   4) Links to edit profile and view access log
//
// If not logged in, redirect to login page.
// ============================================================

import { useState, useEffect } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import api from '../../api';
import { saveEmergencyCardOffline, getEmergencyCardOffline } from '../../utils/offlineStorage';
import './DashboardPage.css';

export function DashboardPage({ user, token, logout }) {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isOfflineCard, setIsOfflineCard] = useState(false);

  const navigate = useNavigate();

  // If user is not logged in, send them to the login page
  if (!user || !token) {
    return <Navigate to="/login" replace />;
  }

  // Fetch the user's profile from the backend or fallback to offline card
  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const response = await api.get('/api/profile', {
          headers: {
            Authorization: `Bearer ${token}`
          }
        });
        const serverProfile = response.data.profile;
        setProfile(serverProfile);
        // Cache emergency card locally for offline emergency readiness
        saveEmergencyCardOffline(serverProfile, user);
        setIsOfflineCard(false);
      } catch (error) {
        console.warn('Network issue fetching live profile, checking offline storage:', error);
        if (error.response?.status === 401) {
          logout();
          navigate('/login');
          return;
        }

        // Try offline cached emergency card
        const cached = getEmergencyCardOffline();
        if (cached && cached.profile) {
          setProfile(cached.profile);
          setIsOfflineCard(true);
        }
      }
      setLoading(false);
    };

    fetchProfile();
  }, [logout, navigate, token, user]);

  const qrCodeValue = `${window.location.origin}/doctor/portal?healthId=${user.healthId}`;
  const documentImages = profile?.document_images || [];
  const medicationImages = profile?.medication_images || [];
  const documentLinks = profile?.medical_file_links || [];

  if (loading) {
    return <div className="loading-text">Loading your dashboard...</div>;
  }

  return (
    <div className="dashboard-page">
      {/* ---- HEADER / NAVBAR ---- */}
      <nav className="dashboard-nav">
        <Link to="/" className="nav-logo-text">
          <img src="/logo_cross.png" alt="Life Link Logo" style={{ width: '28px', height: '28px', objectFit: 'contain', verticalAlign: 'middle', marginRight: '8px' }} />
          <span>Life Link</span>
        </Link>
        <div className="nav-right">
          {isOfflineCard && (
            <span className="offline-pill" title="Loaded from device storage">⚡ Offline Card</span>
          )}
          <Link to="/access-log" className="nav-link">📋 Access Log</Link>
          <button onClick={logout} className="btn-secondary nav-logout-btn">Logout</button>
        </div>
      </nav>

      <div className="dashboard-content">

        {/* ---- WELCOME BANNER ---- */}
        <div className="welcome-banner">
          <h1>Hello, {user.name} 👋</h1>
          <p>Your emergency health profile is {profile ? 'set up and doctor-ready.' : 'not yet complete.'}</p>
        </div>


        {/* ---- HEALTH ID + QR CODE SECTION ---- */}
        <div className="id-qr-section">

          <div className="health-id-card">
            <div className="health-id-label">Your Health ID</div>
            <div className="health-id-value">{user.healthId}</div>
            <p className="health-id-hint">
              Share this ID carefully. Verified doctors use it to access your profile after secure login and approval.
            </p>

            {/* Buttons to quickly go to emergency page */}
            <div className="id-card-buttons">
              <Link to="/edit-profile" className="btn-primary id-card-btn">
                {profile ? '✏️ Edit Profile' : '+ Setup Health Profile'}
              </Link>
              <Link to="/access-log" className="btn-secondary id-card-btn">
                🔒 Review Access Log
              </Link>
            </div>
          </div>

          <div className="qr-code-card">
            <div className="qr-label">📱 QR Code</div>
            <div className="qr-container">
              {/* QRCodeSVG from qrcode.react — renders an SVG QR code */}
              <QRCodeSVG
                value={qrCodeValue}
                size={180}
                level="H"    /* H = High error correction */
                includeMargin={true}
              />
            </div>
            <p className="qr-hint">Scans open the verified doctor portal with your Health ID prefilled</p>
            <p className="qr-url-text">or visit: /doctor/portal?healthId={user.healthId}</p>
          </div>

        </div>


        {/* ---- PROFILE SUMMARY ---- */}
        {profile ? (
          <div className="profile-summary-card">
            <div className="summary-header">
              <h2>🩺 Your Health Profile Summary</h2>
              <Link to="/edit-profile" className="btn-secondary summary-edit-btn">Edit</Link>
            </div>

            <div className="summary-grid">
              <div className="summary-item">
                <span className="summary-label">Blood Group</span>
                <span className="summary-value blood-badge-inline">{profile.blood_group || 'Not specified'}</span>
              </div>
              <div className="summary-item">
                <span className="summary-label">Date of Birth</span>
                <span className="summary-value">{profile.date_of_birth || 'Not specified'}</span>
              </div>
              <div className="summary-item">
                <span className="summary-label">Allergies</span>
                <span className="summary-value">{profile.allergies || 'None listed'}</span>
              </div>
              <div className="summary-item">
                <span className="summary-label">Chronic Conditions</span>
                <span className="summary-value">{profile.chronic_conditions || 'None listed'}</span>
              </div>
              <div className="summary-item">
                <span className="summary-label">Current Medications</span>
                <span className="summary-value">{profile.current_medications || 'None listed'}</span>
              </div>
              <div className="summary-item">
                <span className="summary-label">Previous Surgeries</span>
                <span className="summary-value">{profile.previous_surgeries || 'None listed'}</span>
              </div>
              <div className="summary-item">
                <span className="summary-label">Emergency Contact</span>
                <span className="summary-value">
                  {profile.emergency_contact_name
                    ? `${profile.emergency_contact_name} — ${profile.emergency_contact_phone}`
                    : 'Not specified'}
                </span>
              </div>
              <div className="summary-item">
                <span className="summary-label">Organ Donor</span>
                <span className={`summary-value ${profile.organ_donor_status === 'Yes' ? 'donor-yes' : ''}`}>
                  {profile.organ_donor_status || 'Not specified'}
                </span>
              </div>

              <div className="summary-item">
                <span className="summary-label">Medical Files</span>
                <span className="summary-value">
                  {documentLinks.length > 0 ? `${documentLinks.length} secure link(s)` : 'None listed'}
                </span>
              </div>

              <div className="summary-item">
                <span className="summary-label">Medical Document Images</span>
                <span className="summary-value">{documentImages.length} uploaded</span>
              </div>

              <div className="summary-item">
                <span className="summary-label">Medication Photos</span>
                <span className="summary-value">{medicationImages.length} uploaded</span>
              </div>

            </div>

            <div className="dashboard-security-note">
              Emergency profile access is now restricted to authenticated, verified doctor accounts. Every lookup is written to your access log with doctor identity details.
            </div>
          </div>
        ) : (
          /* If profile is not set up yet, show a prompt */
          <div className="no-profile-card">
            <div className="no-profile-icon">⚠️</div>
            <h2>Your health profile is empty!</h2>
            <p>
              Without your profile, doctors cannot help you in an emergency.
              It only takes 2 minutes to fill in your critical information.
            </p>
            <Link to="/edit-profile" className="btn-primary">
              Setup Health Profile Now
            </Link>
          </div>
        )}

      </div>
    </div>
  )
}
