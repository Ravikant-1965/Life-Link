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
                    ✕
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
                            🩺
                        </div>
                        <div className="choice-card-text">
                            <h3>Create a doctor Profile</h3>
                            <p>For verified healthcare professionals & medical emergency responders.</p>
                        </div>
                        <div className="choice-arrow-icon">→</div>
                    </button>

                    <button
                        className="choice-option-card user-card"
                        onClick={() => handleSelectChoice('/register')}
                    >
                        <div className="choice-icon-wrapper">
                            👤
                        </div>
                        <div className="choice-card-text">
                            <h3>Create an user Profile</h3>
                            <p>For patients to manage emergency health IDs, records, and contact details.</p>
                        </div>
                        <div className="choice-arrow-icon">→</div>
                    </button>
                </div>
            </div>
        </div>
    );
}
