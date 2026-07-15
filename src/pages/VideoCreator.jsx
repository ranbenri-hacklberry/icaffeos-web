// @ts-nocheck
/**
 * Video Creator - Kling AI Integration
 * Create AI-generated videos with optional opening/ending images
 */

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Video,
  Upload,
  Sparkles,
  Loader2,
  CheckCircle2,
  AlertCircle,
  X,
  Download,
  ArrowLeft,
  Film
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const VideoCreator = () => {
  const { currentUser } = useAuth();

  // Form state
  const [prompt, setPrompt] = useState('');
  const [openingImage, setOpeningImage] = useState(null);
  const [endingImage, setEndingImage] = useState(null);
  const [openingPreview, setOpeningPreview] = useState(null);
  const [endingPreview, setEndingPreview] = useState(null);

  // Generation state
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [generatedVideo, setGeneratedVideo] = useState(null);
  const [error, setError] = useState(null);
  const [creditsRemaining, setCreditsRemaining] = useState(66); // Will fetch from backend

  // Fetch credits on mount (graceful fallback if unavailable)
  React.useEffect(() => {
    const fetchCredits = async () => {
      try {
        const response = await fetch(
          `http://localhost:8081/api/kling/credits?business_id=${currentUser.business_id}`
        );
        const data = await response.json();

        if (response.ok) {
          setCreditsRemaining(data.credits_remaining);
          console.log('ℹ️ Credits:', data.message || `${data.credits_remaining} units available`);
        } else {
          // Graceful fallback - don't show error, just use default
          console.warn('⚠️ Credits check unavailable, using default');
          setCreditsRemaining(66);
        }
      } catch (err) {
        // Graceful fallback - don't show error, just use default
        console.warn('⚠️ Credits check failed, using default:', err.message);
        setCreditsRemaining(66);
      }
    };

    if (currentUser?.business_id) {
      fetchCredits();
    }
  }, [currentUser]);

  const handleImageUpload = (file, type) => {
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      setError('אנא בחר קובץ תמונה בלבד');
      return;
    }

    // Validate file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      setError('גודל התמונה חייב להיות פחות מ-10MB');
      return;
    }

    // Create preview
    const reader = new FileReader();
    reader.onloadend = () => {
      if (type === 'opening') {
        setOpeningImage(file);
        setOpeningPreview(reader.result);
      } else {
        setEndingImage(file);
        setEndingPreview(reader.result);
      }
    };
    reader.readAsDataURL(file);
  };

  const removeImage = (type) => {
    if (type === 'opening') {
      setOpeningImage(null);
      setOpeningPreview(null);
    } else {
      setEndingImage(null);
      setEndingPreview(null);
    }
  };

  const handleGenerate = async () => {
    if (!prompt.trim()) {
      setError('אנא הזן תיאור לסרטון');
      return;
    }

    try {
      setIsGenerating(true);
      setError(null);
      setProgress(0);

      // Prepare form data
      const formData = new FormData();
      formData.append('prompt', prompt);
      formData.append('business_id', currentUser.business_id);

      if (openingImage) {
        formData.append('opening_image', openingImage);
      }
      if (endingImage) {
        formData.append('ending_image', endingImage);
      }

      // Call backend API
      const response = await fetch('http://localhost:8081/api/kling/generate-video', {
        method: 'POST',
        body: formData
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'שגיאה ביצירת הסרטון');
      }

      const data = await response.json();

      // Start polling for progress
      pollVideoStatus(data.task_id);

    } catch (err) {
      console.error('Video generation error:', err);
      setError(err.message || 'שגיאה ביצירת הסרטון');
      setIsGenerating(false);
    }
  };

  const pollVideoStatus = async (taskId) => {
    const pollInterval = setInterval(async () => {
      try {
        const response = await fetch(
          `http://localhost:8081/api/kling/video-status/${taskId}?business_id=${currentUser.business_id}`
        );
        const data = await response.json();

        setProgress(data.progress || 0);

        if (data.status === 'completed') {
          clearInterval(pollInterval);
          setGeneratedVideo(data.video_url);
          setCreditsRemaining(data.credits_remaining);
          setIsGenerating(false);
          setProgress(100);
        } else if (data.status === 'failed') {
          clearInterval(pollInterval);
          throw new Error(data.error || 'הסרטון נכשל');
        }
      } catch (err) {
        clearInterval(pollInterval);
        setError(err.message);
        setIsGenerating(false);
      }
    }, 2000); // Poll every 2 seconds
  };

  const handleReset = () => {
    setPrompt('');
    setOpeningImage(null);
    setEndingImage(null);
    setOpeningPreview(null);
    setEndingPreview(null);
    setGeneratedVideo(null);
    setError(null);
    setProgress(0);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 p-8">
      {/* Back button */}
      <button
        onClick={() => window.history.back()}
        className="fixed top-6 left-6 z-50 p-3 bg-white/10 backdrop-blur-md rounded-xl border border-white/20 hover:bg-white/20 transition-colors"
      >
        <ArrowLeft className="w-5 h-5 text-white" />
      </button>

      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-8"
        >
          <div className="flex items-center justify-center gap-3 mb-4">
            <Film className="w-12 h-12 text-purple-400" />
            <h1 className="text-4xl font-bold text-white">
              יצירת סרטון AI
            </h1>
          </div>
          <p className="text-white/60 mb-2">
            צור סרטונים מדהימים עם Kling AI
          </p>
          <div className="text-sm text-cyan-400">
            {creditsRemaining} יחידות נותרו היום
          </div>
        </motion.div>

        {/* Main Card */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-white/5 backdrop-blur-xl rounded-3xl border border-white/20 shadow-2xl shadow-purple-500/20 p-8"
        >
          {!generatedVideo ? (
            <div className="space-y-6">
              {/* Prompt Input */}
              <div>
                <label className="block text-white font-medium mb-3 flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-purple-400" />
                  תיאור הסרטון
                </label>
                <textarea
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder="תאר את הסרטון שאתה רוצה ליצור... (לדוגמה: 'חתול מצחיק משחק עם כדור צמר')"
                  className="w-full h-32 px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-white/40 focus:outline-none focus:border-purple-400 transition-colors resize-none"
                  dir="rtl"
                />
                <div className="text-xs text-white/40 mt-2">
                  {prompt.length}/500 תווים
                </div>
              </div>

              {/* Image Uploads */}
              <div className="grid md:grid-cols-2 gap-6">
                {/* Opening Image */}
                <div>
                  <label className="block text-white font-medium mb-3 flex items-center gap-2">
                    <Upload className="w-5 h-5 text-green-400" />
                    תמונת פתיחה (אופציונלי)
                  </label>

                  {openingPreview ? (
                    <div className="relative group">
                      <img
                        src={openingPreview}
                        alt="Opening"
                        className="w-full h-48 object-cover rounded-xl border-2 border-green-400/50"
                      />
                      <button
                        onClick={() => removeImage('opening')}
                        className="absolute top-2 right-2 p-2 bg-red-500 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <X className="w-4 h-4 text-white" />
                      </button>
                    </div>
                  ) : (
                    <label className="block w-full h-48 border-2 border-dashed border-white/20 rounded-xl hover:border-green-400/50 transition-colors cursor-pointer">
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => handleImageUpload(e.target.files[0], 'opening')}
                        className="hidden"
                      />
                      <div className="flex flex-col items-center justify-center h-full text-white/40 hover:text-green-400 transition-colors">
                        <Upload className="w-8 h-8 mb-2" />
                        <span className="text-sm">לחץ להעלאת תמונה</span>
                        <span className="text-xs mt-1">PNG, JPG עד 10MB</span>
                      </div>
                    </label>
                  )}
                </div>

                {/* Ending Image */}
                <div>
                  <label className="block text-white font-medium mb-3 flex items-center gap-2">
                    <Upload className="w-5 h-5 text-blue-400" />
                    תמונת סיום (אופציונלי)
                  </label>

                  {endingPreview ? (
                    <div className="relative group">
                      <img
                        src={endingPreview}
                        alt="Ending"
                        className="w-full h-48 object-cover rounded-xl border-2 border-blue-400/50"
                      />
                      <button
                        onClick={() => removeImage('ending')}
                        className="absolute top-2 right-2 p-2 bg-red-500 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <X className="w-4 h-4 text-white" />
                      </button>
                    </div>
                  ) : (
                    <label className="block w-full h-48 border-2 border-dashed border-white/20 rounded-xl hover:border-blue-400/50 transition-colors cursor-pointer">
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => handleImageUpload(e.target.files[0], 'ending')}
                        className="hidden"
                      />
                      <div className="flex flex-col items-center justify-center h-full text-white/40 hover:text-blue-400 transition-colors">
                        <Upload className="w-8 h-8 mb-2" />
                        <span className="text-sm">לחץ להעלאת תמונה</span>
                        <span className="text-xs mt-1">PNG, JPG עד 10MB</span>
                      </div>
                    </label>
                  )}
                </div>
              </div>

              {/* Error Message */}
              <AnimatePresence>
                {error && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="flex items-center gap-3 p-4 bg-red-500/20 border border-red-500/40 rounded-xl"
                  >
                    <AlertCircle className="w-5 h-5 text-red-400" />
                    <span className="text-red-400">{error}</span>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Generate Button */}
              <button
                onClick={handleGenerate}
                disabled={isGenerating || !prompt.trim()}
                className="w-full py-4 bg-gradient-to-r from-purple-500 to-pink-500 rounded-xl text-white font-bold text-lg disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-90 transition-opacity flex items-center justify-center gap-3"
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="w-6 h-6 animate-spin" />
                    יוצר סרטון... {progress}%
                  </>
                ) : (
                  <>
                    <Video className="w-6 h-6" />
                    צור סרטון ✨
                  </>
                )}
              </button>

              {/* Progress Bar */}
              {isGenerating && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="w-full h-2 bg-white/10 rounded-full overflow-hidden"
                >
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${progress}%` }}
                    transition={{ duration: 0.5 }}
                    className="h-full bg-gradient-to-r from-purple-500 to-pink-500"
                  />
                </motion.div>
              )}
            </div>
          ) : (
            /* Video Result */
            <div className="space-y-6">
              <motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="text-center"
              >
                <CheckCircle2 className="w-16 h-16 text-green-400 mx-auto mb-4" />
                <h2 className="text-2xl font-bold text-white mb-2">
                  הסרטון מוכן! 🎉
                </h2>
                <p className="text-white/60 mb-6">
                  הסרטון שלך נוצר בהצלחה
                </p>

                {/* Video Player */}
                <div className="bg-black rounded-xl overflow-hidden mb-6">
                  <video
                    src={generatedVideo}
                    controls
                    className="w-full max-h-96"
                  />
                </div>

                {/* Action Buttons */}
                <div className="flex gap-4">
                  <a
                    href={generatedVideo}
                    download
                    className="flex-1 py-3 bg-gradient-to-r from-green-500 to-emerald-500 rounded-xl text-white font-bold flex items-center justify-center gap-2 hover:opacity-90 transition-opacity"
                  >
                    <Download className="w-5 h-5" />
                    הורד סרטון
                  </a>
                  <button
                    onClick={handleReset}
                    className="flex-1 py-3 bg-white/10 border border-white/20 rounded-xl text-white font-bold hover:bg-white/20 transition-colors"
                  >
                    צור סרטון נוסף
                  </button>
                </div>

                {/* Credits Info */}
                <div className="mt-4 text-sm text-white/60">
                  נותרו {creditsRemaining} יחידות להיום
                </div>
              </motion.div>
            </div>
          )}
        </motion.div>

        {/* Info Cards */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="mt-6 grid md:grid-cols-3 gap-4"
        >
          <div className="p-4 bg-white/5 backdrop-blur-md rounded-xl border border-white/10">
            <div className="text-purple-400 font-bold mb-1">⚡ מהיר</div>
            <div className="text-sm text-white/60">יצירת סרטון תוך דקות ספורות</div>
          </div>
          <div className="p-4 bg-white/5 backdrop-blur-md rounded-xl border border-white/10">
            <div className="text-cyan-400 font-bold mb-1">🎨 איכותי</div>
            <div className="text-sm text-white/60">רזולוציה גבוהה ואיכות מקצועית</div>
          </div>
          <div className="p-4 bg-white/5 backdrop-blur-md rounded-xl border border-white/10">
            <div className="text-pink-400 font-bold mb-1">✨ פשוט</div>
            <div className="text-sm text-white/60">רק תאר מה אתה רוצה ואנחנו נדאג לשאר</div>
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default VideoCreator;
