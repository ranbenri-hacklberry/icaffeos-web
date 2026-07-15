import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Disc, Camera, ShieldCheck, CheckCircle2,
    AlertCircle, RefreshCw, X, ChevronLeft,
    ChevronRight, Music, HardDrive
} from 'lucide-react';
import { getBackendApiUrl } from '@/utils/apiUtils';

const MUSIC_API_URL = getBackendApiUrl();

const CDImportModal = ({ isOpen, onClose, onSuccess }) => {
    const [step, setStep] = useState(1); // 1: Welcome/Detect, 2: Metadata/Review, 3: Camera/Proof, 4: Legal, 5: Ripping
    const [isDetecting, setIsDetecting] = useState(false);
    const [albumMetadata, setAlbumMetadata] = useState(null);
    const [tracks, setTracks] = useState([]);
    const [provenanceImage, setProvenanceImage] = useState(null);
    const [legalAccepted, setLegalAccepted] = useState(false);
    const [profile, setProfile] = useState('lossless'); // lossless, mobile
    const [importing, setImporting] = useState(false);
    const [ripProgress, setRipProgress] = useState(0);

    const videoRef = useRef(null);
    const canvasRef = useRef(null);

    useEffect(() => {
        if (isOpen) {
            detectCD();
        }
    }, [isOpen]);

    const detectCD = async () => {
        setIsDetecting(true);
        try {
            const res = await fetch(`${MUSIC_API_URL}/api/music/cd/status`);
            const data = await res.json();
            if (data.mounted) {
                // Trigger analysis
                const analyzeRes = await fetch(`${MUSIC_API_URL}/api/music/cd/analyze`, { method: 'POST' });
                const analyzeData = await analyzeRes.json();

                // For simulation if MB lookup isn't active
                setAlbumMetadata({
                    title: 'New Physical Album',
                    artist: 'CD Artist',
                    album_token: analyzeData.album_token,
                    cover_url: null
                });

                setTracks([
                    { track_number: 1, title: 'Track 01', duration: 180 },
                    { track_number: 2, title: 'Track 02', duration: 210 },
                ]);

                setStep(2);
            }
        } catch (err) {
            console.error('Detection failed:', err);
        } finally {
            setIsDetecting(false);
        }
    };

    const startCamera = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: true });
            if (videoRef.current) {
                videoRef.current.srcObject = stream;
            }
        } catch (err) {
            console.error('Camera error:', err);
        }
    };

    const capturePhoto = () => {
        const video = videoRef.current;
        const canvas = canvasRef.current;
        if (video && canvas) {
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            canvas.getContext('2d').drawImage(video, 0, 0);
            const dataUrl = canvas.toDataURL('image/jpeg');
            setProvenanceImage(dataUrl);

            // Stop camera
            const stream = video.srcObject;
            if (stream) {
                stream.getTracks().forEach(track => track.stop());
            }
        }
    };

    const handleImport = async () => {
        setImporting(true);
        try {
            const res = await fetch(`${MUSIC_API_URL}/api/music/cd/import`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    tracks,
                    albumMetadata,
                    provenanceImage,
                    legalAccepted,
                    profile
                })
            });
            const data = await res.json();
            if (data.success) {
                onSuccess();
                onClose();
            }
        } catch (err) {
            console.error('Import failed:', err);
        } finally {
            setImporting(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-[110] flex items-center justify-center p-6" dir="rtl">
            <motion.div
                initial={{ opacity: 0, scale: 0.9, y: 30 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                className="bg-[#0f0f1a] border border-white/10 rounded-[40px] w-full max-w-4xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]"
            >
                {/* Stepper Header */}
                <div className="p-8 border-b border-white/5 flex gap-4 items-center bg-gradient-to-r from-blue-600/10 to-transparent">
                    {[1, 2, 3, 4].map(s => (
                        <div key={s} className="flex items-center gap-2">
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all
                                ${step === s ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/30' :
                                    step > s ? 'bg-green-500 text-white' : 'bg-white/10 text-white/30'}`}>
                                {step > s ? <CheckCircle2 className="w-5 h-5" /> : s}
                            </div>
                            {s < 4 && <div className={`w-12 h-0.5 rounded-full ${step > s ? 'bg-green-500/50' : 'bg-white/5'}`} />}
                        </div>
                    ))}
                    <div className="mr-auto">
                        <button onClick={onClose} className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center hover:bg-white/10">
                            <X className="w-5 h-5 text-white/50" />
                        </button>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto p-10">
                    <AnimatePresence mode="wait">
                        {step === 1 && (
                            <motion.div key="step1" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="text-center py-20">
                                <div className="relative inline-block mb-8">
                                    <div className={`w-32 h-32 rounded-full border-4 ${isDetecting ? 'border-blue-500 border-t-transparent animate-spin' : 'border-white/10'} flex items-center justify-center`}>
                                        <Disc className="w-16 h-16 text-blue-500" />
                                    </div>
                                    {isDetecting && <div className="absolute inset-0 bg-blue-500/10 blur-xl animate-pulse" />}
                                </div>
                                <h2 className="text-3xl font-black text-white mb-2">מחכה לדיסק...</h2>
                                <p className="text-white/40 max-w-md mx-auto">הכנס דיסק פיזי לכונן המחובר ליחידה. המערכת תזהה את ה-TOC ותשייך מטא-דאטה באופן אוטומטי.</p>
                                {!isDetecting && (
                                    <button onClick={detectCD} className="mt-8 px-10 py-4 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-bold transition-all shadow-xl shadow-blue-600/20">
                                        סרוק כונן כעת
                                    </button>
                                )}
                            </motion.div>
                        )}

                        {step === 2 && (
                            <motion.div key="step2" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                                <div className="flex gap-10 items-start">
                                    <div className="w-64 h-64 bg-white/5 rounded-[30px] flex items-center justify-center border border-white/10 shrink-0">
                                        <Disc className="w-32 h-32 text-white/10" />
                                    </div>
                                    <div className="flex-1">
                                        <h2 className="text-4xl font-black text-white mb-1">{albumMetadata.title}</h2>
                                        <p className="text-xl text-blue-400 font-bold mb-6">{albumMetadata.artist}</p>

                                        <div className="space-y-2 mb-10 max-h-[300px] overflow-y-auto custom-scrollbar pr-4">
                                            {tracks.map(t => (
                                                <div key={t.track_number} className="flex items-center gap-4 p-4 bg-white/5 rounded-2xl border border-white/5">
                                                    <span className="text-white/30 font-mono text-sm">{t.track_number.toString().padStart(2, '0')}</span>
                                                    <span className="text-white font-medium flex-1">{t.title}</span>
                                                    <span className="text-white/40 text-xs">HI-RES</span>
                                                </div>
                                            ))}
                                        </div>

                                        <div className="flex items-center gap-4">
                                            <button onClick={() => { startCamera(); setStep(3); }} className="px-10 py-4 bg-blue-600 text-white rounded-2xl font-bold flex items-center gap-2">
                                                המשך להוכחת בעלות
                                                <ChevronLeft className="w-5 h-5" />
                                            </button>
                                            <div className="flex gap-2">
                                                <button onClick={() => setProfile('lossless')} className={`px-4 py-2 rounded-xl text-xs font-bold border ${profile === 'lossless' ? 'bg-white text-black border-white' : 'text-white/40 border-white/10'}`}>LOSSLESS (FLAC)</button>
                                                <button onClick={() => setProfile('mobile')} className={`px-4 py-2 rounded-xl text-xs font-bold border ${profile === 'mobile' ? 'bg-white text-black border-white' : 'text-white/40 border-white/10'}`}>MP3 (320K)</button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </motion.div>
                        )}

                        {step === 3 && (
                            <motion.div key="step3" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="flex flex-col items-center">
                                <div className="w-20 h-20 rounded-3xl bg-blue-600/20 flex items-center justify-center mb-6">
                                    <Camera className="w-10 h-10 text-blue-500" />
                                </div>
                                <h2 className="text-3xl font-black text-white mb-2">צלם את הדיסק הפיזי</h2>
                                <p className="text-white/40 mb-10 text-center max-w-md">לצרכי ציות לחוק, עליך לתעד את הדיסק הפיזי נמצא בבעלותך. התמונה תישמר בארכיון הפנימי של המערכת.</p>

                                <div className="relative w-full max-w-2xl aspect-video bg-black rounded-[30px] overflow-hidden border border-white/10 shadow-2xl">
                                    {!provenanceImage ? (
                                        <>
                                            <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover grayscale" />
                                            <button onClick={capturePhoto} className="absolute bottom-10 left-1/2 -translate-x-1/2 w-20 h-20 rounded-full border-4 border-white bg-white/20 backdrop-blur-md flex items-center justify-center transition-all hover:scale-110 active:scale-90">
                                                <div className="w-16 h-16 rounded-full bg-white shadow-xl" />
                                            </button>
                                        </>
                                    ) : (
                                        <div className="relative w-full h-full">
                                            <img src={provenanceImage} className="w-full h-full object-cover" />
                                            <button onClick={() => { setProvenanceImage(null); startCamera(); }} className="absolute top-6 right-6 p-3 bg-black/50 text-white rounded-full backdrop-blur-md">
                                                צילום חוזר
                                            </button>
                                        </div>
                                    )}
                                </div>
                                <canvas ref={canvasRef} className="hidden" />

                                {provenanceImage && (
                                    <button onClick={() => setStep(4)} className="mt-10 px-12 py-4 bg-blue-600 text-white rounded-2xl font-bold flex items-center gap-2 shadow-xl shadow-blue-600/20">
                                        אישור והמשך להצהרה משפטית
                                        <ChevronLeft className="w-5 h-5" />
                                    </button>
                                )}
                            </motion.div>
                        )}

                        {step === 4 && (
                            <motion.div key="step4" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="max-w-2xl mx-auto">
                                <div className="p-10 bg-white/5 border border-white/10 rounded-[30px] space-y-8">
                                    <div className="flex items-center gap-4 text-blue-400">
                                        <ShieldCheck className="w-10 h-10" />
                                        <h2 className="text-3xl font-black">הצהרת שימוש חוקי</h2>
                                    </div>

                                    <div className="space-y-4 text-white/50 text-sm leading-relaxed overflow-y-auto max-h-[300px] pr-4 custom-scrollbar">
                                        <p>1. אני מצהיר בזאת כי הדיסק הפיזי שהוצג בתמונה נמצא בבעלותי החוקית.</p>
                                        <p>2. פעולת ה-Ripping מתבצעת לצרכי גיבוי אישי (Fair Use) לשימוש בתוך העסק המורשה בלבד.</p>
                                        <p>3. ידוע לי כי הפצת העותקים הדיגיטליים מחוץ למערכת rantunes מהווה הפרה של זכויות יוצרים.</p>
                                        <p>4. במידה והבעלות על הדיסק הפיזי תועבר לאחר, אני מתחייב להסיר את העותק הדיגיטלי מהמערכת.</p>
                                        <p>5. המערכת שומרת "Album Token" ייחודי המזהה את הדיסק הספציפי למניעת שכפול כפול.</p>
                                    </div>

                                    <div className="pt-6 border-t border-white/5 flex items-center gap-4">
                                        <button
                                            onClick={() => setLegalAccepted(!legalAccepted)}
                                            className={`w-8 h-8 rounded-lg border-2 flex items-center justify-center transition-all
                                                ${legalAccepted ? 'bg-blue-600 border-blue-600' : 'border-white/20 hover:border-white/40'}`}
                                        >
                                            {legalAccepted && <CheckCircle2 className="w-5 h-5 text-white" />}
                                        </button>
                                        <span className="text-white font-medium cursor-pointer" onClick={() => setLegalAccepted(!legalAccepted)}>אני מאשר את התנאים ומתחייב לפעול לפי החוק</span>
                                    </div>

                                    <button
                                        onClick={handleImport}
                                        disabled={!legalAccepted || importing}
                                        className={`w-full py-5 rounded-2xl font-bold text-xl transition-all flex items-center justify-center gap-3
                                            ${legalAccepted ? 'bg-blue-600 text-white shadow-xl shadow-blue-600/20' : 'bg-white/5 text-white/20 cursor-not-allowed'}`}
                                    >
                                        {importing ? <RefreshCw className="w-6 h-6 animate-spin" /> : <HardDrive className="w-6 h-6" />}
                                        {importing ? 'מבצע Import Hi-Res...' : 'התחל Ripping כעת'}
                                    </button>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            </motion.div>
        </div>
    );
};

export default CDImportModal;
