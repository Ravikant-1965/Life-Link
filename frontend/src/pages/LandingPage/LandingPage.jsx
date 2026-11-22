import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import api from '../../api';
import { RegisterChoiceModal } from '../../components/RegisterChoiceModal/RegisterChoiceModal';
import './LandingPage.css';

const PROJECT_MOTTOS = [
    "Bridging patients and verified emergency doctors with instant, offline-ready medical records when every second matters.",
    "Critical allergy, blood group, and emergency contact visibility — unlocked strictly by verified doctors in moments of crisis.",
    "A portable, tamper-proof digital health identity ready on ambulances, lock screens, and emergency rooms.",
    "Because in critical trauma and emergency decisions, the right information in the right hands saves lives."
];

export function LandingPage({ user, doctor, logout, logoutDoctor }) {
    const [openFaq, setOpenFaq] = useState(null);
    const [visitorCount, setVisitorCount] = useState(1428);
    const [isChoiceModalOpen, setIsChoiceModalOpen] = useState(false);
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    const hasIncrementedRef = useRef(false);

    // Typewriter effect state for project goal motto (cycles every ~15 seconds)
    const [mottoIndex, setMottoIndex] = useState(0);
    const [displayedMotto, setDisplayedMotto] = useState(PROJECT_MOTTOS[0]);
    const [isDeletingMotto, setIsDeletingMotto] = useState(false);
    const [isPaused, setIsPaused] = useState(true);

    useEffect(() => {
        const fullMotto = PROJECT_MOTTOS[mottoIndex];
        let timer;

        if (isPaused) {
            // Hold completed motto for ~11 seconds so user can comfortably read it
            timer = setTimeout(() => {
                setIsPaused(false);
                setIsDeletingMotto(true);
            }, 11000);
        } else if (isDeletingMotto) {
            // Delete text smoothly
            if (displayedMotto.length > 0) {
                timer = setTimeout(() => {
                    setDisplayedMotto(fullMotto.slice(0, displayedMotto.length - 1));
                }, 14);
            } else {
                setIsDeletingMotto(false);
                setMottoIndex((prev) => (prev + 1) % PROJECT_MOTTOS.length);
            }
        } else {
            // Type next motto forward character by character
            if (displayedMotto.length < fullMotto.length) {
                timer = setTimeout(() => {
                    setDisplayedMotto(fullMotto.slice(0, displayedMotto.length + 1));
                }, 26);
            } else {
                // Completed typing, pause again for ~11 seconds
                setIsPaused(true);
            }
        }

        return () => clearTimeout(timer);
    }, [displayedMotto, isDeletingMotto, isPaused, mottoIndex]);

    useEffect(() => {
        if (hasIncrementedRef.current) return;
        hasIncrementedRef.current = true;

        api.post('/api/visitors/increment')
            .then((res) => {
                if (res.data && typeof res.data.count === 'number') {
                    setVisitorCount(res.data.count);
                }
            })
            .catch(() => {
                const currentVisits = parseInt(localStorage.getItem('lifelink_visit_count') || '1428', 10);
                const updatedVisits = currentVisits + 1;
                localStorage.setItem('lifelink_visit_count', updatedVisits.toString());
                setVisitorCount(updatedVisits);
            });
    }, []);

    const scrollToTop = () => {
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const testimonials = [
        {
            rating: 4,
            quote: "Setting up my health profile and adding emergency records was completely effortless. The platform made it simple to store critical medical data, and everything is clearly laid out from start to finish.",
            author: "Nabila S.",
            role: "Verified Patient",
            image: "/testimonial_user.jpg"
        },
        {
            rating: 5,
            quote: "Life Link gives my patients and emergency team complete peace of mind. Verified doctors can view emergency contacts, allergies, and medication photos in real-time when every minute matters.",
            author: "Dr. Sarah Chen",
            role: "Internal Medicine",
            image: "/doctors/dr_sarah_johnson.jpg"
        },
        {
            rating: 5,
            quote: "During severe trauma in ambulance transit, instant offline visibility into blood group, chronic conditions, and surgical history prevents fatal drug interactions before arriving at the ER.",
            author: "Dr. Rajesh Sharma",
            role: "Emergency Trauma Specialist",
            image: "/doctors/dr_rajesh_sharma.jpg"
        }
    ];

    const scrollToCard = (index) => {
        const slots = document.querySelectorAll('.testimonial-slide-slot');
        if (slots[index]) {
            const navOffset = window.innerWidth <= 768 ? 72 : (window.innerWidth <= 960 ? 88 : 96);
            const targetY = slots[index].offsetTop - navOffset;
            window.scrollTo({ top: targetY, behavior: 'smooth' });
        }
    };

    const scrollToFaqs = () => {
        const faqsEl = document.getElementById('faqs');
        if (faqsEl) {
            const navOffset = window.innerWidth <= 768 ? 64 : 80;
            const targetY = faqsEl.offsetTop - navOffset;
            window.scrollTo({ top: targetY, behavior: 'smooth' });
        }
    };

    const faqs = [
        {
            question: "1. Do you support insurance?",
            answer: "Currently, direct insurance integration is not supported yet. However, patients can store emergency records and share exportable medical summaries directly with verified doctors when needed."
        },
        {
            question: "2. How do verified doctors access my emergency profile?",
            answer: "Doctors register separately with their professional license and hospital details. Only after credential verification can they search your Health ID or scan your QR code to unlock your profile."
        },
        {
            question: "3. Are my medical records encrypted at rest?",
            answer: "Yes! All sensitive health data, allergies, chronic conditions, and contact records are encrypted using AES-256 before being written to storage."
        }
    ];

    return (
        <div className="landing-page">
            <nav className="landing-nav">
                <div className="nav-logo">
                    <img src="/logo_cross.png" alt="Life Link Cross Logo" className="logo-cross-img" />
                    <div>
                        <div className="logo-text">Life Link</div>
                        <div className="logo-subtext">Emergency health identity platform</div>
                    </div>
                </div>

                {/* Desktop Navigation Links */}
                <div className="nav-links nav-links-desktop">
                    <a href="#how-it-works" className="nav-link">How it works</a>
                    <a href="#faqs" className="nav-link">FAQs</a>

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
                            <Link to="/login" className="nav-btn btn-secondary">Login</Link>
                            <button onClick={() => setIsChoiceModalOpen(true)} className="nav-btn btn-primary">Create new profile</button>
                        </>
                    )}
                </div>

                {/* Mobile Quick Controls */}
                <div className="nav-mobile-controls">
                    {doctor ? (
                        <Link to="/doctor/portal" className="nav-btn-mobile btn-secondary">Portal</Link>
                    ) : user ? (
                        <Link to="/dashboard" className="nav-btn-mobile btn-secondary">Dashboard</Link>
                    ) : (
                        <button onClick={() => setIsChoiceModalOpen(true)} className="nav-btn-mobile btn-primary">Get Started</button>
                    )}

                    <button 
                        className="hamburger-btn" 
                        onClick={() => setMobileMenuOpen(prev => !prev)} 
                        aria-label="Toggle navigation menu"
                        aria-expanded={mobileMenuOpen}
                    >
                        {mobileMenuOpen ? (
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                                <line x1="18" y1="6" x2="6" y2="18"></line>
                                <line x1="6" y1="6" x2="18" y2="18"></line>
                            </svg>
                        ) : (
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                                <line x1="3" y1="12" x2="21" y2="12"></line>
                                <line x1="3" y1="6" x2="21" y2="6"></line>
                                <line x1="3" y1="18" x2="21" y2="18"></line>
                            </svg>
                        )}
                    </button>
                </div>

                {/* Mobile Dropdown Drawer */}
                {mobileMenuOpen && (
                    <div className="mobile-menu-drawer">
                        <a href="#how-it-works" className="mobile-nav-item" onClick={() => setMobileMenuOpen(false)}>
                            How it works
                        </a>
                        <a href="#faqs" className="mobile-nav-item" onClick={() => setMobileMenuOpen(false)}>
                            FAQs
                        </a>

                        <div className="mobile-menu-divider" />

                        {doctor ? (
                            <div className="mobile-menu-actions">
                                <Link to="/doctor/portal" className="mobile-menu-btn btn-secondary" onClick={() => setMobileMenuOpen(false)}>Doctor Portal</Link>
                                <button onClick={() => { logoutDoctor(); setMobileMenuOpen(false); }} className="mobile-menu-btn btn-danger">Doctor Logout</button>
                            </div>
                        ) : user ? (
                            <div className="mobile-menu-actions">
                                <Link to="/dashboard" className="mobile-menu-btn btn-secondary" onClick={() => setMobileMenuOpen(false)}>Patient Dashboard</Link>
                                <button onClick={() => { logout(); setMobileMenuOpen(false); }} className="mobile-menu-btn btn-danger">Logout</button>
                            </div>
                        ) : (
                            <div className="mobile-menu-actions">
                                <Link to="/login" className="mobile-menu-btn btn-secondary" onClick={() => setMobileMenuOpen(false)}>Login</Link>
                                <button onClick={() => { setIsChoiceModalOpen(true); setMobileMenuOpen(false); }} className="mobile-menu-btn btn-primary">Create new profile</button>
                            </div>
                        )}
                    </div>
                )}
            </nav>

            <section className="hero-section">
                <div className="hero-copy">
                    <div className="hero-badge">Verified doctor access · Faster emergency decisions</div>
                    <h1 className="hero-title">
                        When Seconds Count,
                        <span className="hero-highlight"> Identity Saves Lives.</span>
                    </h1>
                    
                    <div className="hero-motto-wrapper">
                        <span className="motto-icon-badge">“</span>
                        <p className="hero-motto-text">
                            {displayedMotto}
                            <span className="typewriter-cursor">|</span>
                        </p>
                    </div>

                    <div className="hero-actions">
                        {user ? (
                            <Link to="/dashboard" className="hero-btn-primary">Open Patient Dashboard</Link>
                        ) : doctor ? (
                            <Link to="/doctor/portal" className="hero-btn-primary">Go to Doctor Portal</Link>
                        ) : (
                            <>
                                <button onClick={() => setIsChoiceModalOpen(true)} className="hero-btn-primary">
                                    Create Emergency Profile
                                </button>
                                <Link to="/login" className="hero-btn-secondary">
                                    Doctor / Patient Login
                                </Link>
                            </>
                        )}
                    </div>

                    <div className="hero-trust">
                        <div className="trust-pill">Offline-ready Emergency ID</div>
                        <div className="trust-pill">Doctor Verification Required</div>
                        <div className="trust-pill">Instant QR Scan in Transit</div>
                    </div>
                </div>

                <div className="hero-panel">
                    <div className="hero-curved-wrapper">
                        <div className="hero-curved-card">
                            <img
                                src="/doctor_consultation.jpg"
                                alt="Emergency Doctor Care"
                                className="hero-curved-img"
                            />
                        </div>
                        {/* Stethoscope badge kept on the circular cut */}
                        <div className="floating-pill-badge badge-left-stethoscope" title="Verified Medical Access">
                            <span className="stethoscope-icon-box">
                                <img src="/stethoscope_clean.png" alt="Stethoscope" style={{ width: '28px', height: '28px', objectFit: 'contain' }} />
                            </span>
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

            <section className="care-access-section">
                <div className="care-access-card">
                    <div className="care-access-content">
                        <h2 className="care-title">
                            Simple access to <span className="care-highlight">care. anytime, anywhere</span>
                        </h2>
                        <p className="care-description">
                            When trauma or sudden accidents strike, authorized emergency teams scan your portable Health ID to instantly unlock blood group, allergies, medications, and trusted contacts — even with zero internet connectivity.
                        </p>
                    </div>

                    <div className="care-snapshot-wrapper">
                        <div className="profile-preview-wrapper care-preview-wrapper">
                            <img src="/logo_cross.png" alt="Life Link Logo" className="hero-cross-floating" />
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
                    </div>
                </div>
            </section>

            <section id="testimonials" className="testimonial-section">
                <div className="testimonial-section-head">
                    <span className="testimonial-kicker-pill">Testimonial</span>
                    <h2 className="testimonial-title">Views of our trusted users</h2>
                </div>

                <div className="testimonial-stack-container">
                    {testimonials.map((item, index) => (
                        <div 
                            className="testimonial-slide-slot" 
                            key={index}
                            style={{ zIndex: index + 1 }}
                        >
                            <div className="testimonial-card-box">
                                <div className="testimonial-box-topbar">
                                    <span className="testimonial-story-pill">Story {index + 1} of {testimonials.length}</span>
                                    {index < testimonials.length - 1 ? (
                                        <button 
                                            type="button"
                                            className="testimonial-scroll-hint-btn"
                                            onClick={() => scrollToCard(index + 1)}
                                            aria-label="Scroll to next testimonial"
                                        >
                                            Scroll Down for next testimonial ↓
                                        </button>
                                    ) : (
                                        <button 
                                            type="button"
                                            className="testimonial-scroll-hint-btn complete"
                                            onClick={scrollToFaqs}
                                            aria-label="Scroll to FAQs"
                                        >
                                            Next: FAQs ↓
                                        </button>
                                    )}
                                </div>

                                <div className="testimonial-card-grid">
                                    <div className="testimonial-image-card">
                                        <img
                                            src={item.image}
                                            alt={item.author}
                                            className="testimonial-user-img"
                                        />
                                    </div>

                                    <div className="testimonial-quote-card">
                                        <div className="star-rating">
                                            {[...Array(5)].map((_, i) => (
                                                <span key={i} className={i < item.rating ? "star-filled" : "star-empty"}>
                                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                                                        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                                                    </svg>
                                                </span>
                                            ))}
                                        </div>

                                        <p className="testimonial-quote">
                                            "{item.quote}"
                                        </p>

                                        <div className="testimonial-author-block">
                                            <strong className="author-name">{item.author}</strong>
                                            <span className="author-role">, {item.role}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </section>

            <section id="faqs" className="faq-section">
                <div className="faq-container">
                    <div className="faq-left">
                        <span className="faq-kicker-pill">FAQs</span>
                        <h2 className="faq-title">Need Help? We've Got Answers</h2>
                        <p className="faq-subtitle">
                            Here you'll find clear, concise responses to some of the most common questions about our emergency health services.
                        </p>
                    </div>

                    <div className="faq-accordion-list">
                        {faqs.map((faq, index) => (
                            <div key={index} className={`faq-item ${openFaq === index ? 'faq-open' : ''}`}>
                                <button className="faq-question" onClick={() => setOpenFaq(openFaq === index ? null : index)}>
                                    <span>{faq.question}</span>
                                    <span className="faq-toggle-icon">
                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ transform: openFaq === index ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>
                                            <polyline points="6 9 12 15 18 9"></polyline>
                                        </svg>
                                    </span>
                                </button>
                                {openFaq === index && (
                                    <div className="faq-answer">
                                        <p>{faq.answer}</p>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            <footer className="main-footer">
                <div className="footer-top-grid">
                    <div className="footer-brand-col">
                        <div className="footer-logo">
                            <img src="/logo_cross.png" alt="Life Link Logo" className="footer-logo-img" />
                            <span className="footer-logo-text">Life Link</span>
                        </div>

                        <h3 className="footer-brand-heading">Doctor and emergency responder access</h3>
                        <p className="footer-brand-desc">
                            Access a patient’s emergency profile securely using their Health ID or QR code. Doctor account login and verification are required.
                        </p>
                        <p className="footer-brand-subdesc">
                            Life Link helps patients stay prepared and helps verified doctors act faster in emergencies. Keep records updated, review your access logs, and store only the medical data you want available in emergencies.
                        </p>
                    </div>

                    <div className="footer-contact-col">
                        <div className="social-icons-group">
                            <a href="mailto:ravikantm128@gmail.com" className="social-badge-icon" aria-label="Email Us">
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path>
                                    <polyline points="22,6 12,13 2,6"></polyline>
                                </svg>
                            </a>
                            <a href="https://x.com/Raja_G_1965" target="_blank" rel="noreferrer" className="social-badge-icon" aria-label="X Profile">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                                    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                                </svg>
                            </a>
                        </div>
                    </div>

                    <div className="footer-links-col">
                        <div className="footer-nav-menu">
                            <a href="#how-it-works" className="footer-nav-item">How it works</a>
                            <a href="#faqs" className="footer-nav-item">FAQs</a>
                        </div>

                        <div className="footer-visitor-counter">
                            <span>Total Visitors: <strong>{visitorCount.toLocaleString()}</strong></span>
                        </div>
                    </div>
                </div>

                <div className="footer-bottom-bar">
                    <p className="footer-copyright">&copy; 2026 Life Link Healthcare. All rights reserved.</p>
                    <button onClick={scrollToTop} className="scroll-top-btn">
                        Scroll Top 
                        <span className="scroll-arrow" style={{ display: 'inline-flex', alignItems: 'center', marginLeft: '4px' }}>
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="18 15 12 9 6 15"></polyline></svg>
                        </span>
                    </button>
                </div>
            </footer>

            <RegisterChoiceModal
                isOpen={isChoiceModalOpen}
                onClose={() => setIsChoiceModalOpen(false)}
            />
        </div>
    );
}
