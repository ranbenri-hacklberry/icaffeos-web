/**
 * useOrderAlerts Hook
 * Plays a gentle notification sound every 5 minutes for pending online orders
 */

import { useEffect, useRef, useCallback } from 'react';

// Gentle notification sound (base64 encoded short beep)
const NOTIFICATION_SOUND_URL = 'data:audio/mp3;base64,SUQzBAAAAAAAI1RTU0UAAAAPAAADTGF2ZjU4Ljc2LjEwMAAAAAAAAAAAAAAA//tQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWGluZwAAAA8AAAACAAABhgC7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7//////////////////////////////////////////////////////////////////8AAAAATGF2YzU4LjEzAAAAAAAAAAAAAAAAJAAAAAAAAAAAAYYehNfAAAAAAAAAAAAAAAAAAAAA//tQZAAP8AAAaQAAAAgAAA0gAAABAAABpAAAACAAADSAAAAETEFNRTMuMTAwVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV//tQZB8P8AAAaQAAAAgAAA0gAAABAAABpAAAACAAADSAAAAEVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV';

const ALERT_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

export function useOrderAlerts({ pendingOrders = [], enabled = true }) {
    const audioRef = useRef(null);
    const intervalRef = useRef(null);

    // Initialize audio
    useEffect(() => {
        audioRef.current = new Audio(NOTIFICATION_SOUND_URL);
        audioRef.current.volume = 0.3; // Keep it gentle

        return () => {
            if (audioRef.current) {
                audioRef.current.pause();
                audioRef.current = null;
            }
        };
    }, []);

    // Play notification sound
    const playSound = useCallback(() => {
        // 🔇 SOUND DISABLED PER USER REQUEST
        return;
/*
        if (audioRef.current && pendingOrders.length > 0) {
            audioRef.current.currentTime = 0;
            audioRef.current.play().catch(err => {
                // Browser may block autoplay - this is expected
                console.log('[useOrderAlerts] Sound blocked:', err.message);
            });
        }
*/
    }, [pendingOrders.length]);

    // Setup interval for repeating alert
    useEffect(() => {
        if (!enabled) return;

        // Clear existing interval
        if (intervalRef.current) {
            clearInterval(intervalRef.current);
            intervalRef.current = null;
        }

        // If there are pending orders, start the interval
        if (pendingOrders.length > 0) {
            // Play immediately on first pending order
            playSound();

            // Then every 5 minutes
            intervalRef.current = setInterval(() => {
                if (pendingOrders.length > 0) {
                    playSound();
                }
            }, ALERT_INTERVAL_MS);
        }

        return () => {
            if (intervalRef.current) {
                clearInterval(intervalRef.current);
            }
        };
    }, [enabled, pendingOrders.length, playSound]);

    // Manual trigger
    const triggerAlert = useCallback(() => {
        playSound();
    }, [playSound]);

    return {
        pendingCount: pendingOrders.length,
        triggerAlert
    };
}

export default useOrderAlerts;
