import React, { useState, useEffect } from 'react';
import './SplashScreen.css';

const LOADING_MESSAGES = [
    'מכין את הקפה...',
    'טוען מודולים...',
    'בודק חיבור לשרת...',
    'מסנכרן נתונים...',
    'מחמם מנועים...',
    'כמעט שם...'
];

const LoadingFallback = ({ message = 'טוען אפליקציה...' }) => {
    const [currentMessage, setCurrentMessage] = useState(message);
    const [showReload, setShowReload] = useState(false);

    useEffect(() => {
        // If the parent provided a specific static message, start with that.
        // But if it seems "stuck", cycle through encouraging messages.

        let msgIndex = 0;
        const msgInterval = setInterval(() => {
            msgIndex = (msgIndex + 1) % LOADING_MESSAGES.length;
            // Only cycle if we are in "generic" mode or after a long wait
            setCurrentMessage(LOADING_MESSAGES[msgIndex]);
        }, 3000);

        // Safety Timer: If stuck for 15 seconds, show hint. If 30s, show button.
        const safetyTimer = setTimeout(() => {
            setShowReload(true);
        }, 15000); // reduced to 15s for faster feedback on tablet

        return () => {
            clearInterval(msgInterval);
            clearTimeout(safetyTimer);
        };
    }, []);

    return (
        <div className="splash-container">
            <div className="logo-wrapper">
                <img
                    src="rainbow_cup.png"
                    alt="Logo"
                    className="brand-logo-img"
                    style={{
                        width: '180px',
                        height: 'auto',
                        marginBottom: '10px'
                    }}
                />

                <h1 className="brand-name">iCaffeOS</h1>
                <p className="tagline">CoffeeShops Operating System</p>

                <div className="mt-12 flex flex-col items-center gap-4 w-full">
                    {/* Infinite spinner instead of progress bar for indeterminate loading */}
                    <div className="loading-bar">
                        <div className="progress" style={{ animation: 'loading-loop 1.5s infinite linear', width: '30%', marginLeft: '35%' }}></div>
                        <style>{`
                            @keyframes loading-loop {
                                0% { transform: translateX(-150%); }
                                100% { transform: translateX(350%); }
                            }
                         `}</style>
                    </div>

                    <p className="text-white/60 text-[12px] font-mono animate-pulse uppercase tracking-widest min-h-[20px] text-center">
                        {currentMessage}
                    </p>

                    {showReload && (
                        <div className="mt-8 flex flex-col items-center gap-3 animate-fade-in opacity-80 hover:opacity-100 transition-opacity">
                            <p className="text-red-300 text-[11px] font-bold">נראה שהטעינה מתעכבת...</p>
                            <button
                                onClick={() => window.location.reload()}
                                className="px-6 py-2 bg-red-500/10 hover:bg-red-500/30 text-red-200 text-xs rounded-full border border-red-500/30 transition-all active:scale-95 flex items-center gap-2"
                            >
                                <span>רענן אפליקציה</span>
                                <span>↻</span>
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default LoadingFallback;
