import React from 'react';

const PriceAdjuster = ({
    value,
    onChange,
    label,
    size = 'large' // 'large' | 'small'
}) => {
    const adjustPrice = (amount) => {
        const newValue = Math.max(0, parseFloat((Number(value) + amount).toFixed(2)));
        onChange(newValue);
    };

    if (size === 'small') {
        return (
            <div className="flex items-center bg-gray-50 rounded-lg border border-gray-200">
                <button
                    type="button"
                    onClick={() => adjustPrice(-1)}
                    className="w-8 h-8 flex items-center justify-center text-red-500 font-bold hover:bg-white rounded-r-lg"
                >
                    -
                </button>
                <input
                    type="number"
                    value={value}
                    onChange={e => onChange(e.target.value)}
                    className="w-12 text-center text-sm font-black bg-transparent outline-none"
                />
                <button
                    type="button"
                    onClick={() => adjustPrice(1)}
                    className="w-8 h-8 flex items-center justify-center text-blue-500 font-bold hover:bg-white rounded-l-lg"
                >
                    +
                </button>
            </div>
        );
    }

    return (
        <div className="bg-blue-50/50 rounded-2xl border border-blue-100 p-2 flex items-center justify-between gap-1 h-16 lg:h-auto">
            <button
                type="button"
                onClick={() => adjustPrice(-10)}
                className="w-10 lg:w-12 h-full flex items-center justify-center bg-white text-red-500 rounded-xl hover:bg-red-50 font-black text-lg shadow-sm border border-gray-200"
            >
                -10
            </button>
            <button
                type="button"
                onClick={() => adjustPrice(-1)}
                className="w-8 lg:w-10 h-full flex items-center justify-center bg-white text-red-500 rounded-lg hover:bg-red-50 font-bold shadow-sm border border-gray-200"
            >
                -1
            </button>

            <div className="flex-1 h-full mx-1 lg:mx-2">
                <input
                    type="number"
                    step="0.1"
                    placeholder="0"
                    value={value}
                    onChange={e => onChange(e.target.value)}
                    className="w-full h-full text-center font-black text-2xl lg:text-4xl bg-white rounded-xl shadow-inner outline-none text-gray-900 focus:ring-2 focus:ring-blue-500/20"
                    required
                />
            </div>

            <button
                type="button"
                onClick={() => adjustPrice(1)}
                className="w-8 lg:w-10 h-full flex items-center justify-center bg-white text-blue-500 rounded-lg hover:bg-blue-50 font-bold shadow-sm border border-gray-200"
            >
                +1
            </button>
            <button
                type="button"
                onClick={() => adjustPrice(10)}
                className="w-10 lg:w-12 h-full flex items-center justify-center bg-white text-blue-600 rounded-xl hover:bg-blue-50 font-black text-lg shadow-sm border border-gray-200"
            >
                +10
            </button>
        </div>
    );
};

export default React.memo(PriceAdjuster);
