import { useNavigate } from 'react-router-dom';
import './RegisterChoiceModal.css';

export function RegisterChoiceModal({ isOpen, onClose }) {
    const navigate = useNavigate();

    if (!isOpen) return null;

    const handleSelectChoice = (path) => {
        onClose();
        navigate(path);
    };

    return (
        <div className="choice-modal-overlay" onClick={onClose}>
            <div className="choice-modal-card" onClick={(e) => e.stopPropagation()}>
                <button className="choice-modal-close" onClick={onClose} aria-label="Close modal">
                    &times;
                </button>

                <div className="choice-modal-header">
                    <div className="choice-badge">Get Started</div>
                    <h2>Create new profile</h2>
                    <p>Select your profile type below to complete your registration</p>
                </div>

                <div className="choice-options-grid">
                    <button
                        className="choice-option-card doctor-card"
                        onClick={() => handleSelectChoice('/doctor/register')}
                    >
                        <div className="choice-icon-wrapper">
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4.8 2.3A.3.3 0 1 0 5 2H4a2 2 0 0 0-2 2v5a6 6 0 0 0 6 6v0a6 6 0 0 0 6-6V4a2 2 0 0 0-2-2h-1a.2.2 0 1 0 .3.3"/><path d="M8 15v1a6 6 0 0 0 6 6v0a6 6 0 0 0 6-6v-4"/><circle cx="20" cy="10" r="2"/></svg>
                        </div>
                        <div className="choice-card-text">
                            <h3>Create a doctor Profile</h3>
                            <p>For verified healthcare professionals & medical emergency responders.</p>
                        </div>
                        <div className="choice-arrow-icon">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12"></line><polyline points="12 5 19 12 12 19"></polyline></svg>
                        </div>
                    </button>

                    <button
                        className="choice-option-card user-card"
                        onClick={() => handleSelectChoice('/register')}
                    >
                        <div className="choice-icon-wrapper">
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                        </div>
                        <div className="choice-card-text">
                            <h3>Create an user Profile</h3>
                            <p>For patients to manage emergency health IDs, records, and contact details.</p>
                        </div>
                        <div className="choice-arrow-icon">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12"></line><polyline points="12 5 19 12 12 19"></polyline></svg>
                        </div>
                    </button>
                </div>
            </div>
        </div>
    );
}
