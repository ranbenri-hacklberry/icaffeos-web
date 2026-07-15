import React, { useRef, useEffect, useCallback } from 'react';
import { useMusic } from '../../context/MusicContext';

/**
 * Real-time audio visualizer using Web Audio API AnalyserNode.
 * Renders frequency bars that react to the actual music being played.
 */
const AudioVisualizer = ({ 
    barCount = 32, 
    className = '',
    style = {},
    colorMode = 'purple' // 'purple' | 'rainbow'
}) => {
    const { analyserNode, isPlaying } = useMusic();
    const canvasRef = useRef(null);
    const animFrameRef = useRef(null);

    const draw = useCallback(() => {
        const canvas = canvasRef.current;
        const analyser = analyserNode;
        if (!canvas || !analyser) return;

        const ctx = canvas.getContext('2d');
        const { width, height } = canvas;

        const bufferLength = analyser.frequencyBinCount; // half of fftSize = 128
        const dataArray = new Uint8Array(bufferLength);
        analyser.getByteFrequencyData(dataArray);

        ctx.clearRect(0, 0, width, height);

        // Pick evenly spaced bins for the requested bar count
        const step = Math.floor(bufferLength / barCount);
        const barWidth = (width / barCount) * 0.7;
        const gap = (width / barCount) * 0.3;

        for (let i = 0; i < barCount; i++) {
            const value = dataArray[i * step] / 255; // normalise 0-1
            const barHeight = Math.max(value * height, 2); // minimum 2px

            const x = i * (barWidth + gap) + gap / 2;
            const y = height - barHeight;

            // Color gradient
            if (colorMode === 'rainbow') {
                const hue = (i / barCount) * 280 + 250; // purple → pink → magenta
                ctx.fillStyle = `hsla(${hue % 360}, 80%, ${55 + value * 25}%, ${0.6 + value * 0.4})`;
            } else {
                // Purple mode
                const intensity = 0.3 + value * 0.7;
                const lightness = 50 + value * 30;
                ctx.fillStyle = `hsla(270, 80%, ${lightness}%, ${intensity})`;
            }

            // Draw bar with rounded top
            const radius = Math.min(barWidth / 2, 3);
            ctx.beginPath();
            ctx.moveTo(x + radius, y);
            ctx.lineTo(x + barWidth - radius, y);
            ctx.quadraticCurveTo(x + barWidth, y, x + barWidth, y + radius);
            ctx.lineTo(x + barWidth, height);
            ctx.lineTo(x, height);
            ctx.lineTo(x, y + radius);
            ctx.quadraticCurveTo(x, y, x + radius, y);
            ctx.fill();
        }

        animFrameRef.current = requestAnimationFrame(draw);
    }, [analyserNode, barCount, colorMode]);

    useEffect(() => {
        if (isPlaying && analyserNode) {
            animFrameRef.current = requestAnimationFrame(draw);
        }
        return () => {
            if (animFrameRef.current) {
                cancelAnimationFrame(animFrameRef.current);
            }
        };
    }, [isPlaying, analyserNode, draw]);

    // Handle canvas resize
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const resizeObserver = new ResizeObserver(entries => {
            for (const entry of entries) {
                const { width, height } = entry.contentRect;
                canvas.width = width * window.devicePixelRatio;
                canvas.height = height * window.devicePixelRatio;
                const ctx = canvas.getContext('2d');
                ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
            }
        });
        resizeObserver.observe(canvas);
        return () => resizeObserver.disconnect();
    }, []);

    return (
        <canvas
            ref={canvasRef}
            className={className}
            style={{ 
                width: '100%', 
                height: '100%',
                ...style 
            }}
        />
    );
};

export default AudioVisualizer;
