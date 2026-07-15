import React from 'react';
import MiniMusicBar from '@/components/music/MiniMusicBar';

// This component now solely renders the MiniMusicBar in its original locations across the app.
// The "Status" part has been moved to the new global ConnectivityStatus component.
const ConnectionStatusBar = ({ isIntegrated = false }) => {
    return (
        <div className="flex items-center gap-2">
            {/* The Music Player - Restored to original position */}
            <MiniMusicBar />
        </div>
    );
};

export default ConnectionStatusBar;
