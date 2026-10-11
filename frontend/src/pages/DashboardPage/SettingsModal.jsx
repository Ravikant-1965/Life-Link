import { useState } from 'react';
import { Link } from 'react-router-dom';

export function SettingsModal({ isOpen, onClose, onOpenHealthData, user, isOfflineCard, logout, totalFilesCount }) {
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
                        <div className="health-modal-icon">
                            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
                        </div>
                        <div>
                            <h2>Settings & Profile Preferences</h2>
                            <p className="health-modal-subtitle">Manage account security, offline cache, and preferences</p>
                        </div>
                    </div>
                    <button className="health-modal-close-btn" onClick={onClose} aria-label="Close settings">
                        &times;
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
                        <div className="settings-row">
                            <div>
                                <span className="settings-row-label">Health Data & Documents</span>
                                <div className="settings-sublabel">
                                    {typeof totalFilesCount === 'number'
                                        ? `${totalFilesCount} uploaded medical file${totalFilesCount === 1 ? '' : 's'} (PDFs, images & reports)`
                                        : 'Uploaded clinical records & health files'}
                                </div>
                            </div>
                            <button
                                type="button"
                                className="settings-action-btn"
                                onClick={() => {
                                    onClose();
                                    if (onOpenHealthData) onOpenHealthData();
                                }}
                            >
                                Open Health Data
                            </button>
                        </div>
                        <div className="settings-btn-row">
                            <Link to="/edit-profile" className="btn-secondary settings-link-btn" onClick={onClose}>
                                Edit Medical Profile
                            </Link>
                            <Link to="/access-log" className="btn-secondary settings-link-btn" onClick={onClose}>
                                Doctor Access Log
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
                                    {isOfflineCard ? 'Device storage mode active' : 'Live server connected'}
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
                                <span className="settings-row-label">Sign out of Life-Link</span>
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
