import { Delete } from 'lucide-react';
import { useTheme } from '@/context/ThemeContext';

const NumericKeypad = ({ onKeyPress }) => {
    const { isDarkMode } = useTheme();
    const keys = [
        '1', '2', '3',
        '4', '5', '6',
        '7', '8', '9',
        '*', '0', 'delete'
    ];

    return (
        <div className="grid grid-cols-3 gap-3" dir="ltr">
            {keys.map((key) => (
                <button
                    key={key}
                    onClick={() => onKeyPress(key)}
                    className={`h-16 rounded-2xl flex items-center justify-center text-2xl font-black transition-all active:scale-95 transition-colors ${key === 'delete'
                        ? (isDarkMode ? 'bg-red-900/30 text-red-400 hover:bg-red-900/50' : 'bg-red-50 text-red-500 hover:bg-red-100')
                        : key === '*'
                            ? (isDarkMode ? 'bg-slate-800 text-slate-700 cursor-not-allowed' : 'bg-gray-50 text-gray-300 cursor-not-allowed')
                            : (isDarkMode
                                ? 'bg-slate-800 border-2 border-slate-700 text-white hover:border-purple-600 hover:bg-slate-700'
                                : 'bg-white border-2 border-gray-100 text-gray-800 hover:border-orange-200 hover:bg-orange-50/30')
                        }`}
                >
                    {key === 'delete' ? <Delete size={24} /> : key}
                </button>
            ))}
        </div>
    );
};

export default NumericKeypad;
