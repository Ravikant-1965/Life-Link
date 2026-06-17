import { Link } from 'react-router-dom';
import './LandingPage.css';

export function LandingPage({ user, doctor, logout, logoutDoctor }) {
    return (
        <div className="landing-page">
            <nav className="landing-nav">
                <div className="nav-logo">
                    <span className="logo-icon">+</span>
                    <div>
                        <div className="logo-text">Life Link</div>
                        <div className="logo-subtext">Emergency health identity platform</div>
                    </div>
                </div>

                <div className="nav-links">
                    <a href="#security" className="nav-link">Security</a>
                    <a href="#how-it-works" className="nav-link">How it works</a>

                    {doctor ? (
                        <>
                            <Link to="/doctor/portal" className="nav-btn btn-secondary">Doctor Portal</Link>
                            <button onClick={logoutDoctor} className="nav-btn btn-primary">Doctor Logout</button>
                        </>
                    ) : user ? (
                        <>
                            <Link to="/dashboard" className="nav-btn btn-secondary">Patient Dashboard</Link>
                            <button onClick={logout} className="nav-btn btn-primary">Logout</button>
                        </>
                    ) : (
                        <>
                            <Link to="/doctor/login" className="nav-btn btn-secondary">Doctor Login</Link>
                            <Link to="/register" className="nav-btn btn-primary">Create Patient Profile</Link>
                        </>
                    )}
                </div>
            </nav>

            <section className="hero-section">
                <div className="hero-copy">
                    <div className="hero-badge">Verified doctor access. Faster emergency decisions.</div>
                    <h1 className="hero-title">
                        Life Link makes your critical health data available
                        <span className="hero-highlight"> only to authenticated, verified doctors.</span>
                    </h1>
                    <p className="hero-subtitle">
                        Patients maintain emergency-ready records with document uploads, medication photos, and trusted contact details.
                        Doctors sign in, verify themselves, and unlock the information they need when every minute matters.
                    </p>

                    <div className="hero-actions">
                        {user ? (
                            <Link to="/dashboard" className="hero-btn-primary">Open Patient Dashboard</Link>
                        ) : (
                            <>
                                <Link to="/register" className="hero-btn-primary">Create Patient Profile</Link>
                                <Link to="/login" className="hero-btn-secondary">Patient Login</Link>
                            </>
                        )}

                        {doctor ? (
                            <Link to="/doctor/portal" className="hero-btn-ghost">Go to Doctor Portal</Link>
                        ) : (
                            <Link to="/doctor/login" className="hero-btn-ghost">Verified Doctor Access</Link>
                        )}
                    </div>

                    <div className="hero-trust">
                        <div className="trust-pill">Doctor login required</div>
                        <div className="trust-pill">Verification-gated patient access</div>
                        <div className="trust-pill">Mobile-ready emergency lookup</div>
                    </div>
                </div>

                <div className="hero-panel">
                    <div className="profile-preview-card">
                        <div className="preview-header">
                            <span>Emergency Snapshot</span>
                            <span className="preview-status">Verified Doctor View</span>
                        </div>

                        <div className="preview-row">
                            <span>Health ID</span>
                            <strong>LL-K7P2Q</strong>
                        </div>
                        <div className="preview-row">
                            <span>Blood Group</span>
                            <strong className="preview-blood">O+</strong>
                        </div>
                        <div className="preview-row">
                            <span>Critical Allergies</span>
                            <strong>Penicillin, Peanuts</strong>
                        </div>
                        <div className="preview-row">
                            <span>Medication Photos</span>
                            <strong>3 attached</strong>
                        </div>
                        <div className="preview-row">
                            <span>Medical Records</span>
                            <strong>Scans + Drive links</strong>
                        </div>

                        <div className="preview-audit">
                            Every emergency view is linked to a doctor identity and written to the patient access log.
                        </div>
                    </div>
                </div>
            </section>

            <section id="how-it-works" className="feature-section">
                <div className="section-heading">
                    <p className="section-kicker">How it works</p>
                    <h2>Designed for patients, trusted by verified doctors</h2>
                </div>

                <div className="feature-grid">
                    <article className="feature-card">
                        <div className="feature-icon">01</div>
                        <h3>Create a patient profile</h3>
                        <p>Add allergies, medications, surgeries, emergency contacts, document photos, and Google Drive report links.</p>
                    </article>

                    <article className="feature-card">
                        <div className="feature-icon">02</div>
                        <h3>Get your Health ID and QR code</h3>
                        <p>Patients receive a portable Health ID and QR code that can be shared on lock screens, wallets, or printed cards.</p>
                    </article>

                    <article className="feature-card">
                        <div className="feature-icon">03</div>
                        <h3>Doctor verification before access</h3>
                        <p>Doctors register separately, provide professional credentials, and gain access only after verification is approved.</p>
                    </article>
                </div>
            </section>

            <section id="security" className="security-section">
                <div className="section-heading section-heading-light">
                    <p className="section-kicker">Security and trust</p>
                    <h2>Stronger privacy by default</h2>
                </div>

                <div className="security-grid">
                    <div className="security-card">
                        <h3>Role-based access</h3>
                        <p>Patient dashboards stay private, and emergency records stay hidden until a verified doctor logs in.</p>
                    </div>
                    <div className="security-card">
                        <h3>Verification workflow</h3>
                        <p>Doctor accounts include hospital, specialization, and license details, then move through approval before use.</p>
                    </div>
                    <div className="security-card">
                        <h3>Traceable access logs</h3>
                        <p>Every emergency lookup is written into the patient’s audit trail with doctor identity details.</p>
                    </div>
                </div>
            </section>

            <section className="doctor-message">
                <div className="doctor-message-card">
                    <h2>Doctor and emergency responder access</h2>
                    <p>
                        Access a patient’s emergency profile securely using their Health ID or QR code. Doctor account login and verification are required.
                    </p>
                </div>
            </section>

            <footer className="landing-footer">
                <p>Life Link helps patients stay prepared and helps verified doctors act faster in emergencies.</p>
                <p className="landing-footer-note">Keep records updated, review your access logs, and store only the medical data you want available in emergencies.</p>
            </footer>
        </div>
    );
}
