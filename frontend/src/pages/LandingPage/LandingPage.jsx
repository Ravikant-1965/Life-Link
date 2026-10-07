import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import api from '../../api';
import { RegisterChoiceModal } from '../../components/RegisterChoiceModal/RegisterChoiceModal';
import './LandingPage.css';

export function LandingPage({ user, doctor, logout, logoutDoctor }) {
    const [currentReviewIndex, setCurrentReviewIndex] = useState(0);
    const [openFaq, setOpenFaq] = useState(null);
    const [visitorCount, setVisitorCount] = useState(1428);
    const [isChoiceModalOpen, setIsChoiceModalOpen] = useState(false);
    const hasIncrementedRef = useRef(false);

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
            image: "/doctor_consultation.jpg"
        }
    ];

    const faqs = [
        {
            question: "1. Do you support insurance?",
            answer: "Yes, we integrate with primary health plans and provide exportable diagnostic summaries for claims and hospital verification."
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

    const nextTestimonial = () => {
        setCurrentReviewIndex((prev) => (prev + 1) % testimonials.length);
    };

    const prevTestimonial = () => {
        setCurrentReviewIndex((prev) => (prev - 1 + testimonials.length) % testimonials.length);
    };

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

                <div className="nav-links">
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
                            <Link to="/login" className="nav-btn btn-secondary">LogIn</Link>
                            <button onClick={() => setIsChoiceModalOpen(true)} className="nav-btn btn-primary">Create new profile</button>
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

                    {(user || doctor) && (
                        <div className="hero-actions">
                            {user && <Link to="/dashboard" className="hero-btn-primary">Open Patient Dashboard</Link>}
                            {doctor && <Link to="/doctor/portal" className="hero-btn-ghost">Go to Doctor Portal</Link>}
                        </div>
                    )}

                    <div className="hero-trust">
                        <div className="trust-pill">Doctor login required</div>
                        <div className="trust-pill">Verification-gated patient access</div>
                        <div className="trust-pill">Mobile-ready emergency lookup</div>
                    </div>
                </div>

                <div className="hero-panel">
                    <div className="profile-preview-wrapper">
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
                    </div>

                    <div className="care-access-image-wrapper">
                        <img
                            src="/doctor_consultation.jpg"
                            alt="Doctor Patient Care"
                            className="care-doctor-img"
                        />
                    </div>
                </div>
            </section>

            <section id="testimonials" className="testimonial-section">
                <div className="testimonial-container">
                    <div className="testimonial-header">
                        <div>
                            <span className="testimonial-kicker-pill">Testimonial</span>
                            <h2 className="testimonial-title">Views of our trusted users</h2>
                        </div>
                        <div className="testimonial-nav-arrows">
                            <button className="arrow-btn" onClick={prevTestimonial} aria-label="Previous review">←</button>
                            <button className="arrow-btn" onClick={nextTestimonial} aria-label="Next review">→</button>
                        </div>
                    </div>

                    <div className="testimonial-card-grid">
                        <div className="testimonial-image-card">
                            <img
                                src={testimonials[currentReviewIndex].image}
                                alt={testimonials[currentReviewIndex].author}
                                className="testimonial-user-img"
                            />
                        </div>

                        <div className="testimonial-quote-card">
                            <div className="star-rating">
                                {[...Array(5)].map((_, i) => (
                                    <span key={i} className={i < testimonials[currentReviewIndex].rating ? "star-filled" : "star-empty"}>★</span>
                                ))}
                            </div>

                            <p className="testimonial-quote">
                                "{testimonials[currentReviewIndex].quote}"
                            </p>

                            <div className="testimonial-author-block">
                                <strong className="author-name">{testimonials[currentReviewIndex].author}</strong>
                                <span className="author-role">, {testimonials[currentReviewIndex].role}</span>
                            </div>
                        </div>
                    </div>
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
                                    <span className="faq-toggle-icon">{openFaq === index ? '▲' : '▼'}</span>
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
                            <a href="mailto:ravikantm128@gmail.com" className="social-badge-icon" aria-label="Email Us">✉</a>
                            <a href="https://x.com/Raja_G_1965" target="_blank" rel="noreferrer" className="social-badge-icon" aria-label="X Profile">𝕏</a>
                        </div>
                    </div>

                    <div className="footer-links-col">
                        <div className="footer-nav-menu">
                            <a href="#how-it-works" className="footer-nav-item">How it works</a>
                            <a href="#faqs" className="footer-nav-item">FAQs</a>
                        </div>

                        <div className="footer-visitor-counter">
                            <span className="visitor-eye-icon">👁</span>
                            <span>Total Visitors: <strong>{visitorCount.toLocaleString()}</strong></span>
                        </div>
                    </div>
                </div>

                <div className="footer-bottom-bar">
                    <p className="footer-copyright">© 2026 Life Link Healthcare. All rights reserved.</p>
                    <button onClick={scrollToTop} className="scroll-top-btn">
                        Scroll Top <span className="scroll-arrow">^</span>
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
