import { useState, useEffect } from 'react';
import { getCachedImageURL } from '@/services/imageSyncService';

/**
 * Hook to automatically provide a local object URL if an image is cached in Dexie.
 * Falls back to the original URL if not cached or offline.
 */
export const useCachedImage = (originalUrl) => {
    const [displayUrl, setDisplayUrl] = useState(originalUrl);
    const [isCached, setIsCached] = useState(false);

    useEffect(() => {
        if (!originalUrl) {
            setDisplayUrl(null);
            return;
        }

        let objectUrl = null;

        const checkCache = async () => {
            try {
                const localUrl = await getCachedImageURL(originalUrl);
                if (localUrl) {
                    objectUrl = localUrl;
                    setDisplayUrl(localUrl);
                    setIsCached(true);
                } else {
                    setDisplayUrl(originalUrl);
                    setIsCached(false);
                }
            } catch (err) {
                console.warn('Failed to check image cache:', err);
                setDisplayUrl(originalUrl);
            }
        };

        checkCache();

        // Cleanup object URL to prevent memory leaks
        return () => {
            if (objectUrl) {
                URL.revokeObjectURL(objectUrl);
            }
        };
    }, [originalUrl]);

    return { displayUrl, isCached };
};
