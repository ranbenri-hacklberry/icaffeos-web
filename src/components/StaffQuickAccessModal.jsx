import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { loginEmployee, clockEvent, getShiftStatus } from '@/lib/employees/employeeService';
import { X, Clock, LogOut, RefreshCw, UserCheck } from 'lucide-react';

const StaffQuickAccessModal = ({ isOpen, onClose }) => {
    const navigate = useNavigate();
    const { logout, currentUser } = useAuth(); // Get currentUser from context

    const [pin, setPin] = useState('');
    const [tempUser, setTempUser] = useState(null);
    const [shiftStatus, setShiftStatus] = useState(null);
    const [isLoading, setIsLoading] = useState(false);
    const [message, setMessage] = useState('');
    const [isAuthenticated, setIsAuthenticated] = useState(false);

    // Use current user's phone if available, otherwise fall back to demo/prompt
    // Ideally we should ask for phone if not logged in, but for Quick Access we assume logged in context or Demo fallback
    const targetPhone = currentUser?.whatsapp_phone || '0500000000';

    if (!isOpen) return null;

    const handleNumberClick = (num) => {
        setMessage('');
        if (pin.length < 4) setPin(prev => prev + num);
    };

    const handleBackspace = () => {
        setMessage('');
        setPin(prev => prev.slice(0, -1));
    };

    const handlePinSubmit = async () => {
        if (pin.length < 4) {
            setMessage('קוד לא תקין');
            return;
        }

        setIsLoading(true);
        try {
            console.log('🔐 Authenticating Quick Access for:', targetPhone);
            const result = await loginEmployee(targetPhone, pin);
            if (result.success) {
                setTempUser(result.employee);
                // Check shift status
                const status = await getShiftStatus(result.employee.id);
                setShiftStatus(status);
                setIsAuthenticated(true);
            } else {
                setMessage(result.message || 'קוד שגוי');
                setPin('');
            }
        } catch (err) {
            console.error('Login error:', err);
            setMessage('שגיאה בתקשורת');
        } finally {
            setIsLoading(false);
        }
    };

    const handleClockAction = async (action) => {
        setIsLoading(true);
        try {
            const result = await clockEvent(tempUser.id, action);
            if (result.success) {
                setMessage(action === 'clock_in' ? 'נכנסת למשמרת בהצלחה! 👋' : 'יצאת מהמשמרת בהצלחה! 🙏');
                // Refresh status
                const status = await getShiftStatus(tempUser.id);
                setShiftStatus(status);

                // Auto close after 2 seconds
                setTimeout(() => {
                    handleClose();
                }, 2000);
            } else {
                setMessage(result.message);
            }
        } catch (err) {
            setMessage('שגיאה בביצוע הפעולה');
        } finally {
            setIsLoading(false);
        }
    };

    const handleSwitchMode = () => {
        navigate('/mode-selection');
        onClose();
    };

    const handleClose = () => {
        setPin('');
        setTempUser(null);
        setMessage('');
        setIsAuthenticated(false);
        onClose();
    };

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 font-heebo" dir="rtl">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden relative">
                <button
                    onClick={handleClose}
                    className="absolute top-4 left-4 p-2 rounded-full hover:bg-gray-100 text-gray-500"
                >
                    <X size={24} />
                </button>

                <div className="p-6 text-center">
                    <h2 className="text-2xl font-black text-slate-900 mb-2">תפריט צוות</h2>

                    {!isAuthenticated && (
                        <p className="text-slate-500 mb-6">הזן קוד אישי</p>
                    )}

                    {isAuthenticated ? (
                        <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-300">
                            <div className="bg-slate-50 p-4 rounded-xl mb-6">
                                <h3 className="font-bold text-lg text-slate-900">היי, {tempUser?.name}</h3>
                                <p className={`text-sm font-medium ${shiftStatus?.is_clocked_in ? 'text-green-600' : 'text-slate-500'}`}>
                                    {shiftStatus?.is_clocked_in
                                        ? `במשמרת משעה ${new Date(shiftStatus.clock_in_time).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}`
                                        : 'לא במשמרת'
                                    }
                                </p>
                            </div>

                            {message && (
                                <div className="bg-blue-50 text-blue-800 p-3 rounded-lg text-sm font-bold mb-4">
                                    {message}
                                </div>
                            )}

                            <div className="grid grid-cols-2 gap-3">
                                <button
                                    onClick={() => handleClockAction('clock_in')}
                                    disabled={shiftStatus?.is_clocked_in || isLoading}
                                    className="p-4 bg-green-100 text-green-800 rounded-xl font-bold hover:bg-green-200 disabled:opacity-50 disabled:cursor-not-allowed flex flex-col items-center gap-2"
                                >
                                    <Clock size={24} />
                                    כניסה למשמרת
                                </button>
                                <button
                                    onClick={() => handleClockAction('clock_out')}
                                    disabled={!shiftStatus?.is_clocked_in || isLoading}
                                    className="p-4 bg-red-100 text-red-800 rounded-xl font-bold hover:bg-red-200 disabled:opacity-50 disabled:cursor-not-allowed flex flex-col items-center gap-2"
                                >
                                    <LogOut size={24} />
                                    יציאה ממשמרת
                                </button>
                            </div>

                            <div className="border-t border-gray-100 my-4 pt-4 space-y-3">
                                <button
                                    onClick={handleSwitchMode}
                                    className="w-full py-3 bg-slate-100 text-slate-700 rounded-xl font-bold hover:bg-slate-200 flex items-center justify-center gap-2"
                                >
                                    <RefreshCw size={20} />
                                    החלף מצב תצוגה
                                </button>

                                {/* Only show full logout if needed, usually switch mode is enough */}
                                <button
                                    onClick={() => {
                                        logout();
                                        navigate('/login');
                                        handleClose();
                                    }}
                                    className="w-full py-3 text-red-600 font-medium hover:bg-red-50 rounded-xl"
                                >
                                    יציאה מלאה מהמכשיר
                                </button>
                            </div>
                        </div>
                    ) : (
                        <>
                            {/* PIN Input Display */}
                            <div className="mb-6 bg-slate-50 rounded-xl p-4">
                                <div className="text-3xl font-mono font-bold tracking-widest text-slate-800 h-10 flex items-center justify-center gap-2">
                                    <div className="flex gap-4">
                                        {[...Array(4)].map((_, i) => (
                                            <div key={i} className={`w-3 h-3 rounded-full ${i < pin.length ? 'bg-slate-800' : 'bg-gray-300'}`} />
                                        ))}
                                    </div>
                                </div>
                            </div>

                            {message && <p className="text-red-500 text-sm mb-4 font-bold">{message}</p>}

                            {/* Keypad */}
                            <div className="grid grid-cols-3 gap-3 mb-4" dir="ltr">
                                {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(num => (
                                    <button
                                        key={num}
                                        onClick={() => handleNumberClick(num)}
                                        className="h-14 rounded-xl bg-white border border-gray-200 text-xl font-bold text-slate-700 hover:bg-gray-50 active:scale-95 transition-all shadow-sm"
                                    >
                                        {num}
                                    </button>
                                ))}
                                <button
                                    onClick={() => handleNumberClick(0)}
                                    className="h-14 rounded-xl bg-white border border-gray-200 text-xl font-bold text-slate-700 hover:bg-gray-50 active:scale-95 transition-all shadow-sm"
                                >
                                    0
                                </button>
                                <button
                                    onClick={handleBackspace}
                                    className="h-14 rounded-xl bg-red-50 text-red-600 font-bold hover:bg-red-100 active:scale-95 transition-all flex items-center justify-center"
                                >
                                    ⌫
                                </button>
                                <button
                                    onClick={handlePinSubmit}
                                    disabled={isLoading}
                                    className="h-14 rounded-xl bg-slate-900 text-white font-bold hover:bg-slate-800 active:scale-95 transition-all flex items-center justify-center disabled:opacity-50"
                                >
                                    אישור
                                </button>
                            </div>

                            {/* Emergency Logout Button - Always Visible */}
                            <button
                                onClick={() => {
                                    logout();
                                    navigate('/login');
                                    handleClose();
                                }}
                                className="w-full py-3 text-red-400 text-sm font-medium hover:text-red-600 hover:bg-red-50 rounded-xl mt-4"
                            >
                                תקוע? יציאה מהמכשיר
                            </button>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};

export default StaffQuickAccessModal;
