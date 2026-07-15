import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Minus, Plus } from 'lucide-react';

/**
 * SmartStepper - iPad-optimized stepper with configurable step value
 * 
 * Features:
 * - 44px+ touch targets for iPad
 * - Haptic-style visual feedback on tap
 * - Configurable step (0.5 for bulk, 1 for units)
 * - Long-press acceleration
 * - Orange highlight when value differs from reference
 */
const SmartStepper = ({
    value = 0,
    onChange,
    step = 1,
    min = 0,
    max = 9999,
    referenceValue = null, // If set, highlights when value differs
    unit = '',
    disabled = false,
    size = 'default' // 'default' | 'compact' | 'mini'
}) => {
    const [isPressed, setIsPressed] = useState(null); // 'minus' | 'plus' | null
    const [flashColor, setFlashColor] = useState(null);
    const intervalRef = useRef(null);
    const timeoutRef = useRef(null);

    const hasVariance = referenceValue !== null && value !== referenceValue;

    const buttonSize = size === 'mini' ? 'w-7 h-7' : size === 'compact' ? 'w-11 h-11' : 'w-14 h-14';
    const fontSize = size === 'mini' ? 'text-sm' : size === 'compact' ? 'text-2xl' : 'text-3xl';
    const iconSize = size === 'mini' ? 14 : size === 'compact' ? 20 : 24;

    // Haptic-style visual flash
    const triggerFlash = useCallback((color) => {
        setFlashColor(color);
        setTimeout(() => setFlashColor(null), 150);
    }, []);

    const increment = useCallback(() => {
        const newValue = Math.min(max, Number((value + step).toFixed(2)));
        onChange(newValue);
        triggerFlash('green');
    }, [value, step, max, onChange, triggerFlash]);

    const decrement = useCallback(() => {
        const newValue = Math.max(min, Number((value - step).toFixed(2)));
        onChange(newValue);
        triggerFlash('red');
    }, [value, step, min, onChange, triggerFlash]);

    // Long-press handling
    const startLongPress = useCallback((action) => {
        if (disabled) return;

        setIsPressed(action);
        action === 'plus' ? increment() : decrement();

        // Start repeat after 400ms
        timeoutRef.current = setTimeout(() => {
            intervalRef.current = setInterval(() => {
                action === 'plus' ? increment() : decrement();
            }, 100); // Fast repeat
        }, 400);
    }, [increment, decrement, disabled]);

    const stopLongPress = useCallback(() => {
        setIsPressed(null);
        if (intervalRef.current) {
            clearInterval(intervalRef.current);
            intervalRef.current = null;
        }
        if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
            timeoutRef.current = null;
        }
    }, []);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (intervalRef.current) clearInterval(intervalRef.current);
            if (timeoutRef.current) clearTimeout(timeoutRef.current);
        };
    }, []);

    return (
        <div
            className={`
        flex items-center justify-center ${size === 'mini' ? 'gap-1 p-1' : 'gap-2 p-2'} rounded-xl transition-all duration-200
        ${hasVariance ? 'bg-orange-100 border-2 border-orange-400 shadow-orange-200 shadow-md' : 'bg-slate-100'}
        ${flashColor === 'green' ? 'ring-4 ring-green-400' : ''}
        ${flashColor === 'red' ? 'ring-4 ring-red-400' : ''}
      `}
        >
            {/* Minus Button */}
            <button
                type="button"
                disabled={disabled || value <= min}
                onTouchStart={() => startLongPress('minus')}
                onTouchEnd={stopLongPress}
                onMouseDown={() => startLongPress('minus')}
                onMouseUp={stopLongPress}
                onMouseLeave={stopLongPress}
                className={`
          ${buttonSize} rounded-xl flex items-center justify-center
          transition-all duration-100 select-none
          ${disabled || value <= min
                        ? 'bg-slate-200 text-slate-400'
                        : isPressed === 'minus'
                            ? 'bg-red-600 text-white scale-95'
                            : 'bg-red-500 text-white active:bg-red-600 active:scale-95'
                    }
        `}
            >
                <Minus size={iconSize} strokeWidth={3} />
            </button>

            {/* Value Display */}
            <div className={`flex flex-col items-center ${size === 'mini' ? 'min-w-[40px]' : 'min-w-[60px]'}`}>
                <span className={`${fontSize} font-black text-slate-800`}>
                    {value % 1 === 0 ? value : value.toFixed(1)}
                </span>
                {unit && size !== 'mini' && (
                    <span className="text-xs text-slate-500 font-medium">{unit}</span>
                )}
                {hasVariance && size !== 'mini' && (
                    <span className="text-xs text-orange-600 font-bold">
                        {value > referenceValue ? `+${(value - referenceValue).toFixed(1)}` : (value - referenceValue).toFixed(1)}
                    </span>
                )}
            </div>

            {/* Plus Button */}
            <button
                type="button"
                disabled={disabled || value >= max}
                onTouchStart={() => startLongPress('plus')}
                onTouchEnd={stopLongPress}
                onMouseDown={() => startLongPress('plus')}
                onMouseUp={stopLongPress}
                onMouseLeave={stopLongPress}
                className={`
          ${buttonSize} rounded-xl flex items-center justify-center
          transition-all duration-100 select-none
          ${disabled || value >= max
                        ? 'bg-slate-200 text-slate-400'
                        : isPressed === 'plus'
                            ? 'bg-green-600 text-white scale-95'
                            : 'bg-green-500 text-white active:bg-green-600 active:scale-95'
                    }
        `}
            >
                <Plus size={iconSize} strokeWidth={3} />
            </button>
        </div>
    );
};

export default SmartStepper;
