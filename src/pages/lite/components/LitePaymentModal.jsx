
import React from 'react';
import { CreditCard, Banknote, Gift, X } from 'lucide-react';

const LitePaymentModal = ({ total, onClose, onPaymentComplete }) => {
    const [isProcessing, setIsProcessing] = React.useState(false);
    const [customerName, setCustomerName] = React.useState('');
    const [phoneNumber, setPhoneNumber] = React.useState('');

    const handlePayment = (method) => {
        if (isProcessing) return;
        setIsProcessing(true);
        onPaymentComplete(method, { customerName, phoneNumber });
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in zoom-in duration-200" dir="rtl">
            <div className="bg-slate-900 w-full max-w-sm rounded-[2rem] shadow-2xl overflow-hidden border border-slate-700 flex flex-col max-h-[90vh]">

                <div className="bg-slate-800 p-6 text-center border-b border-slate-700 relative shrink-0">
                    <button
                        onClick={onClose}
                        disabled={isProcessing}
                        className="absolute top-4 left-4 p-2 bg-slate-700 hover:bg-slate-600 rounded-full text-slate-300 transition-colors disabled:opacity-50"
                    >
                        <X size={20} />
                    </button>
                    <h2 className="text-slate-400 text-sm font-bold uppercase tracking-wider mb-1">סכום לתשלום</h2>
                    <div className="text-5xl font-black text-white">
                        ₪{total}
                    </div>
                </div>

                <div className="p-6 overflow-y-auto custom-scrollbar">
                    {/* Customer Details Inputs */}
                    <div className="mb-6 space-y-3">
                        <div>
                            <label className="block text-slate-400 text-xs font-bold mb-1 mr-1">שם הלקוח (אופציונלי)</label>
                            <input
                                type="text"
                                value={customerName}
                                onChange={(e) => setCustomerName(e.target.value)}
                                className="w-full bg-slate-800 border-2 border-slate-700 rounded-xl px-4 py-3 text-white focus:border-amber-500 focus:outline-none transition-colors text-right font-bold"
                                placeholder="הכנס שם..."
                            />
                        </div>
                        <div>
                            <label className="block text-slate-400 text-xs font-bold mb-1 mr-1">מספר טלפון (ל-SMS)</label>
                            <input
                                type="tel"
                                value={phoneNumber}
                                onChange={(e) => setPhoneNumber(e.target.value)}
                                className="w-full bg-slate-800 border-2 border-slate-700 rounded-xl px-4 py-3 text-white focus:border-amber-500 focus:outline-none transition-colors text-right font-bold font-mono"
                                placeholder="050..."
                                dir="ltr"
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-1 gap-3">
                        <button
                            onClick={() => handlePayment('credit_card')}
                            disabled={isProcessing}
                            className="group flex items-center justify-between p-4 bg-slate-800 hover:bg-blue-600/20 hover:border-blue-500/50 border border-slate-700 rounded-2xl transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 rounded-xl bg-blue-500/20 text-blue-400 flex items-center justify-center group-hover:bg-blue-500 group-hover:text-white transition-colors">
                                    <CreditCard size={24} />
                                </div>
                                <div className="text-right">
                                    <div className="text-white font-bold text-lg">כרטיס אשראי</div>
                                </div>
                            </div>
                        </button>

                        <button
                            onClick={() => handlePayment('cash')}
                            disabled={isProcessing}
                            className="group flex items-center justify-between p-4 bg-slate-800 hover:bg-green-600/20 hover:border-green-500/50 border border-slate-700 rounded-2xl transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 rounded-xl bg-green-500/20 text-green-400 flex items-center justify-center group-hover:bg-green-500 group-hover:text-white transition-colors">
                                    <Banknote size={24} />
                                </div>
                                <div className="text-right">
                                    <div className="text-white font-bold text-lg">מזומן</div>
                                </div>
                            </div>
                        </button>

                        <button
                            onClick={() => handlePayment('bit')}
                            disabled={isProcessing}
                            className="group flex items-center justify-between p-4 bg-slate-800 hover:bg-cyan-600/20 hover:border-cyan-500/50 border border-slate-700 rounded-2xl transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 rounded-xl bg-cyan-500/20 text-cyan-400 flex items-center justify-center group-hover:bg-cyan-500 group-hover:text-white transition-colors">
                                    <Gift size={24} />
                                </div>
                                <div className="text-right">
                                    <div className="text-white font-bold text-lg">אחר</div>
                                </div>
                            </div>
                        </button>
                    </div>
                </div>

            </div>
        </div>
    );
};

export default LitePaymentModal;
