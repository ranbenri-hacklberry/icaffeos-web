
import { useState, useEffect } from 'react';

/**
 * useImportContext Hook
 * Detects the current music view context for importing tracks.
 * 
 * @param {string} activeTab - The current active tab in the music page
 * @returns {Object} { contextType, collectionId, label }
 */
export const useImportContext = (activeTab) => {
    const [context, setContext] = useState({
        type: 'singles',
        collectionId: null,
        label: 'שירים בודדים'
    });

    useEffect(() => {
        switch (activeTab) {
            case 'albums':
                setContext({
                    type: 'album',
                    collectionId: null, // To be filled if a specific album is open
                    label: 'ייבוא אלבום'
                });
                break;
            case 'playlists':
                setContext({
                    type: 'playlist',
                    collectionId: null,
                    label: 'ייבוא לפלייליסט'
                });
                break;
            default:
                setContext({
                    type: 'singles',
                    collectionId: 'singles',
                    label: 'שירים בודדים'
                });
        }
    }, [activeTab]);

    return context;
};
