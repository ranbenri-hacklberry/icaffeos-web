import React, { useState, useRef } from 'react';
import { Camera, Images, Power, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const BasicInfoSection = ({
    formData,
    setFormData,
    availableCategories,
    handleImageUpload
}) => {
    const [showImagePicker, setShowImagePicker] = useState(false);
    const [isNewCategory, setIsNewCategory] = useState(false);

    // Refs for file inputs
    const cameraInputRef = useRef(null);
    const galleryInputRef = useRef(null);

    return (
        <>
            {/* Image Picker Modal */}
            <AnimatePresence>
                {showImagePicker && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setShowImagePicker(false)}>
                        <motion.div
                            initial={{ scale: 0.9, opacity: 0, y: 20 }}
                            animate={{ scale: 1, opacity: 1, y: 0 }}
                            exit={{ scale: 0.9, opacity: 0, y: 20 }}
                            className="bg-white rounded-2xl shadow-xl w-full max-w-xs p-6"
                            onClick={e => e.stopPropagation()}
                        >
                            <h3 className="text-lg font-black text-gray-800 text-center mb-6">בחר מקור תמונה</h3>
                            <div className="grid grid-cols-2 gap-4">
                                <button
                                    type="button"
                                    onClick={() => {
                                        setShowImagePicker(false);
                                        cameraInputRef.current?.click();
                                    }}
                                    className="flex flex-col items-center justify-center gap-3 p-6 bg-blue-50 hover:bg-blue-100 text-blue-600 rounded-2xl border-2 border-blue-100 transition-all active:scale-95"
                                >
                                    <Camera size={32} />
                                    <span className="font-bold text-sm">מצלמה</span>
                                </button>
                                <button
                                    type="button"
                                    onClick={() => {
                                        setShowImagePicker(false);
                                        galleryInputRef.current?.click();
                                    }}
                                    className="flex flex-col items-center justify-center gap-3 p-6 bg-purple-50 hover:bg-purple-100 text-purple-600 rounded-2xl border-2 border-purple-100 transition-all active:scale-95"
                                >
                                    <Images size={32} />
                                    <span className="font-bold text-sm">גלריה</span>
                                </button>
                            </div>
                            <button
                                type="button"
                                onClick={() => setShowImagePicker(false)}
                                className="w-full mt-4 py-3 bg-gray-100 text-gray-600 font-bold rounded-xl hover:bg-gray-200 transition-all"
                            >
                                ביטול
                            </button>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* Hidden file inputs */}
            <input
                type="file"
                ref={cameraInputRef}
                className="hidden"
                accept="image/*"
                capture="environment"
                onChange={handleImageUpload}
            />
            <input
                type="file"
                ref={galleryInputRef}
                className="hidden"
                accept="image/*"
                onChange={handleImageUpload}
            />

            {/* Basic Info Card */}
            <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-200 mb-2">
                {/* Top Row: Image + Stock */}
                <div className="flex items-stretch gap-4 mb-4">
                    {/* Image Group */}
                    <div
                        className="flex items-stretch gap-0 bg-gray-50 rounded-xl overflow-hidden border border-gray-200 cursor-pointer"
                        onClick={() => setShowImagePicker(true)}
                    >
                        <div className="w-16 h-16 bg-gray-100 overflow-hidden relative group shrink-0">
                            {formData.image_url ? (
                                <img src={formData.image_url} alt="" className="w-full h-full object-cover" />
                            ) : (
                                <div className="flex flex-col items-center justify-center h-full text-gray-400">
                                    <Camera size={20} />
                                </div>
                            )}
                        </div>
                        <div className="px-4 flex items-center justify-center bg-gray-50 text-gray-600 font-bold text-xs hover:bg-gray-100 transition-all border-r border-gray-200">
                            {formData.image_url ? 'החלף' : 'הוסף'}
                        </div>
                    </div>

                    <div className="flex-1" />

                    {/* Stock Toggle */}
                    <button
                        type="button"
                        onClick={() => setFormData(p => ({ ...p, is_in_stock: !p.is_in_stock }))}
                        className={`w-16 h-16 rounded-xl flex flex-col items-center justify-center gap-1 font-bold text-xs transition-all shrink-0 ${formData.is_in_stock ? 'bg-green-100 text-green-700 hover:bg-green-200 border-2 border-green-200' : 'bg-red-100 text-red-700 hover:bg-red-200 border-2 border-red-200'}`}
                    >
                        <Power size={20} strokeWidth={2.5} />
                        <span>{formData.is_in_stock ? 'במלאי' : 'חסר'}</span>
                    </button>
                </div>

                {/* Row 2: Name + Category */}
                <div className="grid grid-cols-2 gap-4 items-start">
                    <div>
                        <label className="block text-xs font-bold text-slate-500 mb-1.5 mr-1">שם המנה</label>
                        <input
                            type="text"
                            value={formData.name}
                            onChange={e => setFormData({ ...formData, name: e.target.value })}
                            className="w-full text-lg font-bold px-4 py-3 bg-gray-50 border-2 border-transparent focus:bg-white focus:border-blue-500 rounded-xl outline-none transition-all placeholder-gray-300"
                            placeholder="לדוגמה: קפוצ'ינו..."
                            required
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-500 mb-1.5 mr-1">קטגוריה</label>
                        {isNewCategory ? (
                            <div className="flex gap-2">
                                <input autoFocus value={formData.category} onChange={e => setFormData({ ...formData, category: e.target.value })} className="flex-1 px-4 py-3 bg-white border-2 border-blue-500 rounded-xl font-bold outline-none text-sm" placeholder="שם קטגוריה..." />
                                <button type="button" onClick={() => setIsNewCategory(false)} className="px-3 bg-gray-100 rounded-xl hover:bg-gray-200"><X size={18} /></button>
                            </div>
                        ) : (
                            <select
                                value={formData.category}
                                onChange={(e) => e.target.value === '__NEW__' ? setIsNewCategory(true) : setFormData({ ...formData, category: e.target.value })}
                                className="w-full px-4 py-3.5 bg-gray-50 border border-gray-200 rounded-xl font-bold text-slate-700 outline-none focus:border-blue-500 text-sm appearance-none"
                            >
                                <option value="">בחר...</option>
                                {availableCategories.map(c => <option key={c} value={c}>{c}</option>)}
                                <option value="__NEW__" className="font-black text-blue-600">+ קטגוריה חדשה</option>
                            </select>
                        )}
                    </div>
                </div>
            </div>
        </>
    );
};

export default BasicInfoSection;
