import { useState, useEffect } from 'react';
import './NetworkStatusBanner.css';

export function NetworkStatusBanner({ onSync }) {
    const [isOnline, setIsOnline] = useState(navigator.onLine);
    const [showReconnected, setShowReconnected] = useState(false);
    const [deferredInstallPrompt, setDeferredInstallPrompt] = useState(null);
    const [isInstalled, setIsInstalled] = useState(false);

    useEffect(() => {
        const handleOnline = () => {
            setIsOnline(true);
            setShowReconnected(true);
            if (onSync) onSync();
            setTimeout(() => {
                setShowReconnected(false);
            }, 4000);
        };

        const handleOffline = () => {
            setIsOnline(false);
            setShowReconnected(false);
        };

        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);

        // PWA Install prompt listener
        const handleBeforeInstall = (e) => {
            e.preventDefault();
            setDeferredInstallPrompt(e);
        };

        const handleAppInstalled = () => {
            setIsInstalled(true);
            setDeferredInstallPrompt(null);
        };

        window.addEventListener('beforeinstallprompt', handleBeforeInstall);
        window.addEventListener('appinstalled', handleAppInstalled);

        // Check standalone mode
        if (window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone) {
            setIsInstalled(true);
        }

        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
            window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
            window.removeEventListener('appinstalled', handleAppInstalled);
        };
    }, [onSync]);

    const handleInstallClick = async () => {
        if (!deferredInstallPrompt) return;
        deferredInstallPrompt.prompt();
        const { outcome } = await deferredInstallPrompt.userChoice;
        if (outcome === 'accepted') {
            setDeferredInstallPrompt(null);
        }
    };

    return (
        <aside className="network-status-container" aria-label="Network and app status">
            {!isOnline && (
                <div className="network-banner offline-banner" role="status" aria-live="polite">
                    <div className="banner-content">
                        <span className="banner-icon">⚡</span>
                        <div className="banner-text">
                            <strong>Offline Mode:</strong> No internet connection. Your emergency Health ID, QR code, and saved medical data are ready on device.
                        </div>
                    </div>
                </div>
            )}

            {showReconnected && isOnline && (
                <div className="network-banner reconnected-banner" role="status" aria-live="polite">
                    <div className="banner-content">
                        <span className="banner-icon">✓</span>
                        <div className="banner-text">
                            <strong>Back Online:</strong> Reconnected to Life Link cloud. Changes synchronized.
                        </div>
                    </div>
                </div>
            )}

            {deferredInstallPrompt && !isInstalled && isOnline && (
                <div className="pwa-install-pill" role="region" aria-label="Install web application">
                    <img src="/logo_cross.png" alt="Life Link Cross" className="pwa-mini-logo" />
                    <span>Install Life Link App for quick emergency access</span>
                    <button onClick={handleInstallClick} className="pwa-install-btn">
                        Install App
                    </button>
                    <button onClick={() => setDeferredInstallPrompt(null)} className="pwa-dismiss-btn" aria-label="Dismiss">
                        ✕
                    </button>
                </div>
            )}
        </aside>
    );
}
