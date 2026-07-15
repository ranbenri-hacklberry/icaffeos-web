import React, { useState } from 'react';
import { DollarSign, ChevronDown } from 'lucide-react';
import AnimatedSection from '@/components/manager/menu-editor/AnimatedSection';

const PricingSection = ({
    formData,
    setFormData,
    isOpen,
    onToggle
}) => {
    const [showSaleDates, setShowSaleDates] = useState(false);

    const salePriceNum = Number(formData.sale_price || 0);
    const regularPriceNum = Number(formData.price || 0);
    const isSaleActive = salePriceNum > 0 && salePriceNum < regularPriceNum;

    // Check start date (logic preserved)
    let saleStartLabel = '';
    if (formData.sale_start_date) {
        const startDate = new Date(formData.sale_start_date + (formData.sale_start_time ? `T${formData.sale_start_time}` : 'T00:00'));
        const now = new Date();
        if (startDate > now) {
            const diffMs = startDate - now;
            const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
            const diffDays = Math.floor(diffHours / 24);
            if (diffDays > 0) saleStartLabel = `מתחיל בעוד ${diffDays} ימים`;
            else if (diffHours > 0) saleStartLabel = `מתחיל בעוד ${diffHours} שעות`;
            else saleStartLabel = 'מתחיל בקרוב';
        }
    }

    return (
        <div
            id="price-section"
            className={`bg-white rounded-2xl border transition-all duration-300 ${isOpen ? 'border-blue-300 shadow-md ring-1 ring-blue-100' : 'border-gray-200 shadow-sm'} overflow-hidden relative`}
        >
            {/* Header - Collapsible */}
            <div
                onClick={onToggle}
                className={`p-4 flex items-center justify-between cursor-pointer select-none transition-colors ${isOpen ? 'bg-blue-50/30' : 'bg-white hover:bg-gray-50'}`}
            >
                <div className="flex items-center gap-4 overflow-hidden flex-1">
                    <div className="w-12 h-12 flex items-center justify-center rounded-2xl shrink-0 bg-green-100 text-green-600">
                        <DollarSign size={24} strokeWidth={1.5} />
                    </div>
                    <div className="flex flex-col min-w-0">
                        <h3 className="font-black text-gray-800 text-base truncate leading-tight">מחיר ומבצעים</h3>
                        {!isOpen && (
                            <div className="flex items-center gap-2 mt-0.5">
                                {isSaleActive ? (
                                    <>
                                        <span className="text-xs font-bold text-red-500">מבצע פעיל: ₪{formData.sale_price}</span>
                                        <span className="text-[10px] text-gray-400 font-bold line-through">₪{formData.price}</span>
                                    </>
                                ) : (
                                    <span className="text-xs font-bold text-gray-500">הגדרת מחיר, הנחות ותוקף</span>
                                )}
                            </div>
                        )}
                    </div>
                </div>

                <div className="flex items-center gap-3 pl-1">
                    {!isOpen && (
                        <div className="flex flex-col items-center justify-center px-3 py-1.5 rounded-xl border min-w-[3.5rem] bg-gray-50 border-gray-100 text-gray-700">
                            <span className="text-[9px] font-bold text-gray-400 leading-none mb-0.5 uppercase tracking-wide">מחיר</span>
                            <span className="font-black text-lg leading-none">₪{formData.price || 0}</span>
                        </div>
                    )}
                    <div className={`p-1 rounded-full text-gray-400 transition-transform duration-300 ${isOpen ? 'rotate-180 bg-gray-100' : ''}`}>
                        <ChevronDown size={20} />
                    </div>
                </div>
            </div>

            {/* Expanded Content */}
            <AnimatedSection show={isOpen}>
                <div className="border-t border-gray-100 p-4 bg-white space-y-2">

                    {/* Part 1: Regular Price */}
                    <div>
                        <div className="flex items-center gap-3">
                            <button type="button" onClick={() => setFormData(p => ({ ...p, price: Math.max(0, (Number(p.price || 0) || 0) - 1), sale_price: '', sale_start_date: '', sale_end_date: '' }))} className="h-12 w-12 flex items-center justify-center bg-gray-50 border border-gray-200 rounded-xl text-gray-400 hover:text-red-500 hover:bg-red-50 hover:border-red-200 active:scale-95 transition-all">
                                <span className="text-xl font-bold">-</span>
                            </button>
                            <div className="flex-1 relative">
                                <input
                                    type="number"
                                    value={formData.price}
                                    onChange={e => setFormData({ ...formData, price: e.target.value, sale_price: '', sale_start_date: '', sale_end_date: '' })}
                                    className="w-full h-12 text-center font-black text-2xl bg-gray-50 border border-gray-200 rounded-xl outline-none focus:bg-white focus:border-blue-500 transition-all z-10 relative"
                                    placeholder="0"
                                />
                                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 text-sm font-bold z-20">₪</span>
                            </div>
                            <button type="button" onClick={() => setFormData(p => ({ ...p, price: (Number(p.price || 0) || 0) + 1, sale_price: '', sale_start_date: '', sale_end_date: '' }))} className="h-12 w-12 flex items-center justify-center bg-gray-50 border border-gray-200 rounded-xl text-gray-400 hover:text-green-600 hover:bg-green-50 hover:border-green-200 active:scale-95 transition-all">
                                <span className="text-xl font-bold">+</span>
                            </button>
                        </div>
                    </div>

                    <div className="h-px bg-gray-100 w-full"></div>

                    {/* Part 2: Sale Section */}
                    <div>
                        {/* Sale Price Input */}
                        {(() => {
                            const isSaleModified = formData.sale_price !== undefined && Number(formData.sale_price) < Number(formData.price) && Number(formData.sale_price) > 0;
                            return (
                                <div className={`p-4 rounded-xl transition-colors ${isSaleModified ? 'bg-red-50 border border-red-100' : 'bg-gray-50/50 border border-transparent'}`}>
                                    <div className="flex items-center justify-between mb-3">
                                        <div className="flex flex-col">
                                            <span className={`text-sm font-black flex items-center gap-1.5 ${isSaleModified ? 'text-red-800' : 'text-gray-500'}`}>
                                                מחיר מבצע
                                            </span>
                                            <span className="text-[11px] text-gray-400 font-bold">המחיר שיוצג ללקוח</span>
                                        </div>
                                        {isSaleModified && <span className="text-xs font-bold text-red-600 bg-red-100 px-2 py-0.5 rounded-md">פעיל</span>}
                                    </div>

                                    <div className="flex items-center gap-3">
                                        <button type="button" onClick={() => {
                                            const current = formData.sale_price ? Number(formData.sale_price) : Number(formData.price);
                                            setFormData(p => ({ ...p, sale_price: Math.max(0, current - 1) }));
                                        }} className={`h-12 w-12 flex items-center justify-center bg-white border rounded-xl shadow-sm active:scale-95 transition-all ${isSaleModified ? 'border-red-200 text-red-500' : 'border-gray-200 text-gray-300'}`}>
                                            <span className="text-xl font-bold">-</span>
                                        </button>
                                        <div className="flex-1 relative">
                                            <input
                                                type="number"
                                                value={formData.sale_price || ''}
                                                onChange={e => setFormData({ ...formData, sale_price: e.target.value })}
                                                className={`w-full h-12 text-center font-black text-2xl bg-white border rounded-xl outline-none transition-all ${isSaleModified ? 'border-red-200 text-red-600' : 'border-gray-200 focus:border-blue-300'}`}
                                                placeholder={formData.price}
                                            />
                                            <span className={`absolute left-4 top-1/2 -translate-y-1/2 text-sm font-bold ${isSaleModified ? 'text-red-300' : 'text-gray-300'}`}>₪</span>
                                        </div>
                                        <button type="button" onClick={() => {
                                            const current = formData.sale_price ? Number(formData.sale_price) : Number(formData.price);
                                            setFormData(p => ({ ...p, sale_price: current + 1 }));
                                        }} className="h-12 w-12 flex items-center justify-center bg-white border border-gray-200 rounded-xl text-gray-400 hover:text-green-600 active:scale-95 transition-all shadow-sm">
                                            <span className="text-xl font-bold">+</span>
                                        </button>
                                    </div>
                                </div>
                            );
                        })()}

                        {/* Date Logic (Preserved) */}
                        {(() => {
                            const hasDateSet = formData.sale_start_date || formData.sale_end_date;
                            const formatDate = (dateStr) => {
                                if (!dateStr) return '';
                                const d = new Date(dateStr);
                                return d.toLocaleDateString('he-IL', { day: 'numeric', month: 'short', year: '2-digit' });
                            };

                            return (
                                <div className="mt-2">
                                    {hasDateSet && !showSaleDates ? (
                                        <div className="bg-amber-50 border border-amber-100 rounded-xl p-3 flex items-center justify-between">
                                            <div className="text-sm font-bold text-amber-800">
                                                {formatDate(formData.sale_start_date)} {formData.sale_start_time} - {formatDate(formData.sale_end_date)} {formData.sale_end_time}
                                            </div>
                                            <div className="flex gap-2">
                                                <button type="button" onClick={() => setShowSaleDates(true)} className="text-xs font-bold text-amber-600 hover:text-amber-800 px-2 py-1 hover:bg-amber-100 rounded-lg">ערוך</button>
                                                <button type="button" onClick={() => setFormData(p => ({ ...p, sale_price: '', sale_start_date: '', sale_start_time: '', sale_end_date: '', sale_end_time: '' }))} className="text-xs font-bold text-red-500 hover:text-red-700 px-2 py-1 hover:bg-red-50 rounded-lg">בטל מבצע</button>
                                            </div>
                                        </div>
                                    ) : !showSaleDates ? (
                                        // <button type="button" onClick={() => setShowSaleDates(true)} className="w-full py-3 border-2 border-dashed border-gray-200 rounded-xl text-gray-400 font-bold hover:border-blue-300 hover:text-blue-500 transition-all text-xs">
                                        //     + הגדר תאריכי תוקף למבצע
                                        // </button>
                                        null
                                    ) : (
                                        <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 animate-in slide-in-from-top-2">
                                            <div className="text-xs font-bold text-gray-500 mb-3">תקופת המבצע</div>
                                            <div className="grid grid-cols-2 gap-4 mb-4">
                                                <div>
                                                    <div className="text-[10px] font-bold text-gray-400 mb-2">התחלה</div>
                                                    <input type="date" value={formData.sale_start_date || ''} min={new Date().toLocaleDateString('en-CA')} onChange={e => setFormData({ ...formData, sale_start_date: e.target.value })} className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm font-bold outline-none mb-2" />
                                                    <select value={formData.sale_start_time || ''} onChange={e => setFormData({ ...formData, sale_start_time: e.target.value })} className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm font-bold outline-none">
                                                        <option value="">שעה...</option>
                                                        {[...Array(24)].map((_, h) => <option key={h} value={`${String(h).padStart(2, '0')}:00`}>{`${String(h).padStart(2, '0')}:00`}</option>)}
                                                    </select>
                                                </div>
                                                <div>
                                                    <div className="text-[10px] font-bold text-gray-400 mb-2">סיום</div>
                                                    <input type="date" value={formData.sale_end_date || ''} min={formData.sale_start_date} onChange={e => setFormData({ ...formData, sale_end_date: e.target.value })} className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm font-bold outline-none mb-2" />
                                                    <select value={formData.sale_end_time || ''} onChange={e => setFormData({ ...formData, sale_end_time: e.target.value })} className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm font-bold outline-none">
                                                        <option value="">שעה...</option>
                                                        {[...Array(24)].map((_, h) => <option key={h} value={`${String(h).padStart(2, '0')}:00`}>{`${String(h).padStart(2, '0')}:00`}</option>)}
                                                    </select>
                                                </div>
                                            </div>
                                            <div className="flex gap-2">
                                                <button type="button" onClick={() => setShowSaleDates(false)} className="flex-1 py-2 bg-blue-600 text-white font-bold text-sm rounded-xl hover:bg-blue-700">שמור תאריכים</button>
                                                <button type="button" onClick={() => { setShowSaleDates(false); setFormData(p => ({ ...p, sale_start_date: '', sale_end_date: '' })); }} className="px-4 py-2 bg-gray-100 text-gray-600 font-bold rounded-xl">ביטול</button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            );
                        })()}
                    </div>
                </div>
            </AnimatedSection>
        </div>
    );
};

export default PricingSection;
