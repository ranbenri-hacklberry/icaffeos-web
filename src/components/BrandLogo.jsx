import React from 'react';

const BrandLogo = ({ size = 'large', variant = 'dark' }) => {
    // variant 'dark' means dark text (for light background)
    // variant 'light' means white text (for dark background)

    const textColor = variant === 'light' ? 'text-white' : 'text-slate-800';
    const subTextColor = variant === 'light' ? 'text-slate-300' : 'text-slate-500';

    return (
        <div className="flex flex-col items-center justify-center text-center select-none">
            <img
                src="rainbow_cup.png"
                alt="iCaffeOS Logo"
                className={`${size === 'large' ? "w-40 h-40 mb-2" : "w-20 h-20 mb-1"} object-contain drop-shadow-sm`}
            />
            <h1 className={`${size === 'large' ? 'text-5xl' : 'text-2xl'} font-black ${textColor} tracking-tight leading-none`}>
                iCaffeOS
            </h1>
            <p className={`${size === 'large' ? 'text-xl mt-1' : 'text-xs mt-0.5'} ${subTextColor} font-medium opacity-90 tracking-wide`}>
                CoffeeShops Operating System
            </p>
        </div>
    );
};

export default BrandLogo;
