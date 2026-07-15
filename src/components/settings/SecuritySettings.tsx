import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Shield, Camera, Key, Loader2, Save } from 'lucide-react';
import { supabase } from '@/lib/supabase';

interface SecuritySettingsProps {
    businessId: string;
}

const SecuritySettings: React.FC<SecuritySettingsProps> = ({ businessId }) => {
    const [settings, setSettings] = useState<any>({});
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        const fetchSettings = async () => {
            if (!businessId) return;
            try {
                const { data, error } = await supabase
                    .from('businesses')
                    .select('settings')
                    .eq('id', businessId)
                    .single();

                if (error) throw error;
                setSettings(data?.settings || {});
            } catch (err) {
                console.error('Error fetching security settings:', err);
            } finally {
                setLoading(false);
            }
        };

        fetchSettings();
    }, [businessId]);

    const handleToggleFace = () => {
        const current = settings.face_recognition || {};
        setSettings({
            ...settings,
            face_recognition: {
                ...current,
                enabled: !current.enabled
            }
        });
    };

    const handleToggleFaceRequired = () => {
        const current = settings.face_recognition || {};
        setSettings({
            ...settings,
            face_recognition: {
                ...current,
                required_for_clockin: !current.required_for_clockin
            }
        });
    };

    const saveSettings = async () => {
        setSaving(true);
        try {
            const { error } = await supabase
                .from('businesses')
                .update({ settings })
                .eq('id', businessId);

            if (error) throw error;
            alert('✅ הגדרות אבטחה נשמרו בהצלחה');
        } catch (err) {
            console.error('Error saving settings:', err);
            alert('❌ שגיאה בשמירת הגדרות');
        } finally {
            setSaving(false);
        }
    };

    if (loading) return (
        <div className="flex items-center justify-center p-8">
            <Loader2 className="animate-spin text-cyan-400" />
        </div>
    );

    const faceEnabled = settings.face_recognition?.enabled || false;
    const faceRequired = settings.face_recognition?.required_for_clockin || false;

    return (
        <motion.div
            layout
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-slate-800/50 backdrop-blur-xl border border-slate-700/50 rounded-2xl p-6 overflow-hidden relative"
        >
            <div className="flex items-center gap-3 mb-6">
                <div className="p-2 bg-cyan-500/20 text-cyan-400 rounded-lg">
                    <Shield size={24} />
                </div>
                <div>
                    <h2 className="text-xl font-black text-white">אבטחה וזיהוי</h2>
                    <p className="text-slate-400 text-sm">הגדרות כניסה וזיהוי ביומטרי</p>
                </div>
            </div>

            <div className="space-y-6">
                {/* Face Recognition Toggle */}
                <div className="flex items-center justify-between p-4 bg-slate-900/40 rounded-xl border border-slate-700/30">
                    <div className="flex items-center gap-4">
                        <div className={`p-2 rounded-lg ${faceEnabled ? 'bg-cyan-500/20 text-cyan-400' : 'bg-slate-800 text-slate-500'}`}>
                            <Camera size={20} />
                        </div>
                        <div>
                            <h4 className="text-white font-bold">זיהוי פנים (Maya AI)</h4>
                            <p className="text-slate-400 text-xs">מאפשר לעובדים להיכנס באמצעות סריקה ביומטרית</p>
                        </div>
                    </div>
                    <button
                        onClick={handleToggleFace}
                        className={`w-12 h-6 rounded-full transition-colors relative ${faceEnabled ? 'bg-cyan-500' : 'bg-slate-700'}`}
                    >
                        <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${faceEnabled ? 'left-7' : 'left-1'}`} />
                    </button>
                </div>

                {/* Face Required for Clock-in (Only visible if face enabled) */}
                <AnimatePresence>
                    {faceEnabled && (
                        <motion.div
                            layout
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            className="bg-slate-900/40 rounded-xl border border-slate-700/30 overflow-hidden"
                        >
                            <div className="flex items-center justify-between p-4">
                                <div className="flex items-center gap-4">
                                    <div className={`p-2 rounded-lg ${faceRequired ? 'bg-amber-500/20 text-amber-400' : 'bg-slate-800 text-slate-500'}`}>
                                        <Key size={20} />
                                    </div>
                                    <div className="max-w-[250px]">
                                        <h4 className="text-white font-bold text-sm">חובה לסריקת פנים בהחתמת שעון</h4>
                                        <p className="text-slate-400 text-[10px]">מחייב סריקה ביומטרית כדי להחתים כניסה/יציאה (מונע זיופים)</p>
                                    </div>
                                </div>
                                <button
                                    onClick={handleToggleFaceRequired}
                                    className={`w-12 h-6 rounded-full transition-colors relative ${faceRequired ? 'bg-amber-500' : 'bg-slate-700'}`}
                                >
                                    <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${faceRequired ? 'left-7' : 'left-1'}`} />
                                </button>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Save Button */}
                <button
                    onClick={saveSettings}
                    disabled={saving}
                    className="w-full flex items-center justify-center gap-2 bg-cyan-600 hover:bg-cyan-500 disabled:bg-slate-700 text-white font-bold py-3 rounded-xl transition-all shadow-lg shadow-cyan-900/20"
                >
                    {saving ? <Loader2 className="animate-spin" size={20} /> : <Save size={20} />}
                    <span>שמור הגדרות אבטחה</span>
                </button>
            </div>
        </motion.div>
    );
};

export default SecuritySettings;
