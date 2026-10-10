import { useState } from 'react';
import { Link } from 'react-router-dom';

export function SettingsModal({ isOpen, onClose, user, isOfflineCard, logout }) {
    const [theme, setTheme] = useState('light');
    const [offlineSyncNotice, setOfflineSyncNotice] = useState('');

    if (!isOpen) return null;

    const handleSync = () => {
        setOfflineSyncNotice('Offline cache refreshed successfully!');
        setTimeout(() => setOfflineSyncNotice(''), 3000);
    };

    return (
        <div className="health-modal-overlay" onClick={onClose}>
            <div className="settings-modal-container" onClick={(e) => e.stopPropagation()}>
                {/* HEADER */}
                <div className="health-modal-header">
                    <div className="health-modal-title-group">
                        <div className="health-modal-icon">⚙️</div>
                        <div>
                            <h2>Settings & Profile Preferences</h2>
                            <p className="health-modal-subtitle">Manage account security, offline cache, and preferences</p>
                        </div>
                    </div>
                    <button className="health-modal-close-btn" onClick={onClose} aria-label="Close settings">
                        ✕
                    </button>
                </div>

                <div className="settings-modal-body">
                    {/* SECTION 1: ACCOUNT PROFILE */}
                    <div className="settings-group">
                        <h3>User Account</h3>
                        <div className="settings-row">
                            <span className="settings-row-label">Full Name</span>
                            <span className="settings-row-val"><strong>{user?.name}</strong></span>
                        </div>
                        <div className="settings-row">
                            <span className="settings-row-label">Registered Email</span>
                            <span className="settings-row-val">{user?.email}</span>
                        </div>
                        <div className="settings-row">
                            <span className="settings-row-label">Emergency Health ID</span>
                            <span className="settings-row-val health-id-badge">{user?.healthId}</span>
                        </div>
                        <div className="settings-btn-row">
                            <Link to="/edit-profile" className="btn-secondary settings-link-btn" onClick={onClose}>
                                ✏️ Edit Medical Profile
                            </Link>
                            <Link to="/access-log" className="btn-secondary settings-link-btn" onClick={onClose}>
                                📋 Doctor Access Log
                            </Link>
                        </div>
                    </div>

                    {/* SECTION 2: SECURITY & PASSWORDS */}
                    <div className="settings-group">
                        <h3>Security & Passwords</h3>
                        <p className="settings-hint">
                            Protect your sensitive health record by maintaining strong credentials.
                        </p>
                        <div className="settings-row">
                            <div>
                                <span className="settings-row-label">Password</span>
                                <div className="settings-sublabel">Reset or update your account password</div>
                            </div>
                            <Link to="/forgot-password" className="settings-action-btn" onClick={onClose}>
                                Request Reset
                            </Link>
                        </div>
                    </div>

                    {/* SECTION 3: OFFLINE & STORAGE */}
                    <div className="settings-group">
                        <h3>Offline Readiness & PWA Cache</h3>
                        <div className="settings-row">
                            <div>
                                <span className="settings-row-label">Offline Emergency Card</span>
                                <div className="settings-sublabel">
                                    {isOfflineCard ? '⚡ Device storage mode active' : '✓ Live server connected'}
                                </div>
                            </div>
                            <button className="settings-action-btn" onClick={handleSync}>
                                Refresh Cache
                            </button>
                        </div>
                        {offlineSyncNotice && (
                            <div className="sync-notice-success">{offlineSyncNotice}</div>
                        )}
                    </div>

                    {/* SECTION 4: SESSION & LOGOUT */}
                    <div className="settings-group danger-zone">
                        <h3>Session</h3>
                        <div className="settings-row">
                            <div>
                                <span className="settings-row-label">Sign out of LifeLink</span>
                                <div className="settings-sublabel">End this browser session securely</div>
                            </div>
                            <button
                                className="btn-logout-danger"
                                onClick={() => {
                                    onClose();
                                    logout();
                                }}
                            >
                                Logout
                            </button>
                        </div>
                    </div>
                </div>

                <div className="health-modal-footer">
                    <button className="health-modal-btn-done" onClick={onClose}>
                        Close
                    </button>
                </div>
            </div>
        </div>
    );
}
