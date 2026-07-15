// @ts-nocheck
/**
 * Profile Settings Page
 * דף הגדרות פרופיל אישי - עובד יכול לעדכן את הפרטים שלו
 */

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import { motion, AnimatePresence } from 'framer-motion';
import {
  User,
  Mail,
  Lock,
  Key,
  Phone,
  Camera,
  Save,
  Eye,
  EyeOff,
  CheckCircle,
  AlertCircle,
  Loader2,
  Home,
  Shield,
  Scan,
  LayoutGrid
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import FaceScannerReusable from '@/components/maya/FaceScannerReusable';
import AppVisibilitySettings from './AppVisibilitySettings';

interface ProfileFormData {
  name: string;
  email: string;
  phone: string;
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
  pinCode: string;
}

const ProfileSettings: React.FC = () => {
  const { currentUser, login } = useAuth();
  const navigate = useNavigate();

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [showPasswords, setShowPasswords] = useState(false);

  // Face enrollment state
  const [showFaceEnrollment, setShowFaceEnrollment] = useState(false);
  const [faceEmbedding, setFaceEmbedding] = useState<number[] | null>(null);
  const [faceConfidence, setFaceConfidence] = useState<number>(0);
  const [hasFaceEnrolled, setHasFaceEnrolled] = useState(false);

  const [form, setForm] = useState<ProfileFormData>({
    name: '',
    email: '',
    phone: '',
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
    pinCode: ''
  });

  useEffect(() => {
    loadUserProfile();
  }, [currentUser]);

  const loadUserProfile = async () => {
    if (!currentUser?.id) {
      setErrorMessage('לא נמצא משתמש מחובר');
      setIsLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('employees')
        .select('name, email, phone, face_embedding')
        .eq('id', currentUser.id)
        .single();

      if (error) throw error;

      setForm(prev => ({
        ...prev,
        name: data.name || '',
        email: data.email || '',
        phone: data.phone || ''
      }));

      setHasFaceEnrolled(!!data.face_embedding);
    } catch (err) {
      console.error('Error loading profile:', err);
      setErrorMessage('שגיאה בטעינת הפרופיל');
    } finally {
      setIsLoading(false);
    }
  };

  const handleFaceScanComplete = (embedding: Float32Array, confidence: number) => {
    setFaceEmbedding(Array.from(embedding));
    setFaceConfidence(confidence);
  };

  const handleSaveFaceEmbedding = async () => {
    if (!faceEmbedding) {
      setErrorMessage('לא נלכד זיהוי פנים');
      return;
    }

    try {
      setIsSaving(true);
      setErrorMessage('');

      const { data, error } = await supabase.rpc('update_employee_face', {
        p_employee_id: currentUser.id,
        p_embedding: JSON.stringify(faceEmbedding)
      });

      if (error) throw error;

      if (data?.success) {
        setSuccessMessage('זיהוי פנים עודכן בהצלחה! 👤');
        setHasFaceEnrolled(true);
        setShowFaceEnrollment(false);
        setTimeout(() => setSuccessMessage(''), 3000);
      } else {
        throw new Error(data?.message || 'Failed to save face embedding');
      }
    } catch (err) {
      console.error('Face enrollment error:', err);
      setErrorMessage('שגיאה בשמירת זיהוי הפנים');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setErrorMessage('');
    setSuccessMessage('');

    try {
      const updates: any = {};

      // Update basic info
      if (form.name !== currentUser.name) {
        updates.name = form.name;
      }

      if (form.email !== currentUser.email) {
        updates.email = form.email.toLowerCase().trim();
      }

      if (form.phone) {
        updates.phone = form.phone;
      }

      // Update password if provided
      if (form.newPassword) {
        if (form.newPassword !== form.confirmPassword) {
          throw new Error('הסיסמאות החדשות לא תואמות');
        }

        if (!form.currentPassword) {
          throw new Error('יש להזין את הסיסמה הנוכחית');
        }

        // Call RPC to update password
        const { data: pwdData, error: pwdError } = await supabase.rpc('update_employee_password', {
          p_employee_id: currentUser.id,
          p_current_password: form.currentPassword,
          p_new_password: form.newPassword
        });

        if (pwdError) throw pwdError;
        if (!pwdData?.success) throw new Error(pwdData?.message || 'Failed to update password');
      }

      // Update PIN if provided
      if (form.pinCode && form.pinCode.length >= 4) {
        const { data: pinData, error: pinError } = await supabase.rpc('update_employee_pin', {
          p_employee_id: currentUser.id,
          p_pin_code: form.pinCode
        });

        if (pinError) throw pinError;
        if (!pinData?.success) throw new Error(pinData?.message || 'Failed to update PIN');
      }

      // Update basic fields directly
      if (Object.keys(updates).length > 0) {
        const { error: updateError } = await supabase
          .from('employees')
          .update(updates)
          .eq('id', currentUser.id);

        if (updateError) throw updateError;
      }

      setSuccessMessage('הפרופיל עודכן בהצלחה! ✅');

      // Refresh user data in context
      await login({ ...currentUser, ...updates });

      // Clear password fields
      setForm(prev => ({
        ...prev,
        currentPassword: '',
        newPassword: '',
        confirmPassword: '',
        pinCode: ''
      }));

      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (err: any) {
      console.error('Error saving profile:', err);
      setErrorMessage(err.message || 'שגיאה בשמירת השינויים');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Loader2 className="w-12 h-12 text-indigo-600 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 py-8 px-4" dir="rtl">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <button
            onClick={() => navigate('/mode-selection')}
            className="p-3 hover:bg-white rounded-xl transition-all group"
          >
            <Home className="w-6 h-6 text-slate-600 group-hover:text-indigo-600" />
          </button>
          <div>
            <h1 className="text-3xl font-black text-slate-900">הגדרות פרופיל</h1>
            <p className="text-slate-600 font-medium mt-1">עדכן את הפרטים האישיים שלך</p>
          </div>
        </div>

        {/* Success/Error Messages */}
        <AnimatePresence>
          {successMessage && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="mb-6 p-4 bg-green-50 border border-green-200 rounded-xl flex items-center gap-3"
            >
              <CheckCircle className="w-5 h-5 text-green-600" />
              <p className="text-green-800 font-bold">{successMessage}</p>
            </motion.div>
          )}

          {errorMessage && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl flex items-center gap-3"
            >
              <AlertCircle className="w-5 h-5 text-red-600" />
              <p className="text-red-800 font-bold">{errorMessage}</p>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Form */}
          <div className="lg:col-span-2 bg-white rounded-2xl shadow-sm p-6">
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Basic Info */}
              <div>
                <h3 className="text-lg font-black text-slate-900 mb-4 flex items-center gap-2">
                  <User className="w-5 h-5 text-indigo-600" />
                  פרטים בסיסיים
                </h3>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-2">שם מלא</label>
                    <input
                      type="text"
                      value={form.name}
                      onChange={e => setForm({ ...form, name: e.target.value })}
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all font-medium"
                      placeholder="שם מלא"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-2 flex items-center gap-2">
                      <Mail className="w-4 h-4 text-indigo-500" />
                      אימייל
                    </label>
                    <input
                      type="email"
                      value={form.email}
                      onChange={e => setForm({ ...form, email: e.target.value })}
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all font-medium"
                      placeholder="email@example.com"
                      dir="ltr"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-2 flex items-center gap-2">
                      <Phone className="w-4 h-4 text-indigo-500" />
                      טלפון (אופציונלי)
                    </label>
                    <input
                      type="tel"
                      value={form.phone}
                      onChange={e => setForm({ ...form, phone: e.target.value })}
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all font-medium"
                      placeholder="050-1234567"
                      dir="ltr"
                    />
                  </div>
                </div>
              </div>

              {/* Security Settings */}
              <div className="pt-6 border-t border-slate-200">
                <h3 className="text-lg font-black text-slate-900 mb-4 flex items-center gap-2">
                  <Shield className="w-5 h-5 text-indigo-600" />
                  אבטחה והתחברות
                </h3>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-2 flex items-center gap-2">
                      <Lock className="w-4 h-4 text-indigo-500" />
                      סיסמה נוכחית (רק אם משנים סיסמה)
                    </label>
                    <div className="relative">
                      <input
                        type={showPasswords ? "text" : "password"}
                        value={form.currentPassword}
                        onChange={e => setForm({ ...form, currentPassword: e.target.value })}
                        className="w-full pr-4 pl-12 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all font-medium"
                        placeholder="••••••••"
                        dir="ltr"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPasswords(!showPasswords)}
                        className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-indigo-600"
                      >
                        {showPasswords ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-bold text-slate-700 mb-2">סיסמה חדשה</label>
                      <input
                        type={showPasswords ? "text" : "password"}
                        value={form.newPassword}
                        onChange={e => setForm({ ...form, newPassword: e.target.value })}
                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all font-medium"
                        placeholder="••••••••"
                        dir="ltr"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-bold text-slate-700 mb-2">אימות סיסמה</label>
                      <input
                        type={showPasswords ? "text" : "password"}
                        value={form.confirmPassword}
                        onChange={e => setForm({ ...form, confirmPassword: e.target.value })}
                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all font-medium"
                        placeholder="••••••••"
                        dir="ltr"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-2 flex items-center gap-2">
                      <Key className="w-4 h-4 text-indigo-500" />
                      קוד PIN חדש (לכניסה מהירה)
                    </label>
                    <input
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      maxLength={6}
                      value={form.pinCode}
                      onChange={e => setForm({ ...form, pinCode: e.target.value.replace(/\D/g, '') })}
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all font-black text-xl text-center tracking-[0.3em]"
                      placeholder="0000"
                    />
                  </div>
                </div>
              </div>

              {/* Save Button */}
              <button
                type="submit"
                disabled={isSaving}
                className="w-full py-4 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl font-black text-lg transition-all shadow-lg shadow-indigo-100 flex items-center justify-center gap-2"
              >
                {isSaving ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <>
                    <Save className="w-5 h-5" />
                    שמור שינויים
                  </>
                )}
              </button>
            </form>
          </div>

          {/* Face Enrollment Sidebar */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-2xl shadow-sm p-6 sticky top-8">
              <h3 className="text-lg font-black text-slate-900 mb-4 flex items-center gap-2">
                <Camera className="w-5 h-5 text-indigo-600" />
                זיהוי פנים ביומטרי
              </h3>

              {hasFaceEnrolled && !showFaceEnrollment && (
                <div className="space-y-4">
                  <div className="p-4 bg-green-50 border border-green-200 rounded-xl">
                    <div className="flex items-center gap-2 text-green-700 font-bold mb-2">
                      <CheckCircle className="w-5 h-5" />
                      פנים רשומות
                    </div>
                    <p className="text-sm text-green-600">
                      ניתן להתחבר עם זיהוי פנים במסך הקופה
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => setShowFaceEnrollment(true)}
                    className="w-full py-3 bg-indigo-100 hover:bg-indigo-200 text-indigo-700 rounded-xl font-bold transition-colors flex items-center justify-center gap-2"
                  >
                    <Scan className="w-5 h-5" />
                    עדכן זיהוי פנים
                  </button>
                </div>
              )}

              {(!hasFaceEnrolled || showFaceEnrollment) && (
                <div className="space-y-4">
                  {!showFaceEnrollment ? (
                    <>
                      <p className="text-sm text-slate-600 mb-4">
                        הוסף זיהוי פנים לכניסה מהירה ובטוחה למערכת
                      </p>
                      <button
                        type="button"
                        onClick={() => setShowFaceEnrollment(true)}
                        className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold transition-colors flex items-center justify-center gap-2"
                      >
                        <Camera className="w-5 h-5" />
                        התחל רישום פנים
                      </button>
                    </>
                  ) : (
                    <>
                      <div className="bg-slate-900 rounded-xl p-4">
                        <FaceScannerReusable
                          onScanComplete={handleFaceScanComplete}
                          onError={(err) => setErrorMessage(err)}
                          compact={true}
                          autoStart={true}
                          showInstructions={true}
                        />
                      </div>

                      {faceEmbedding && (
                        <div className="p-3 bg-green-50 border border-green-200 rounded-xl flex items-center gap-2">
                          <CheckCircle className="w-5 h-5 text-green-600" />
                          <span className="text-sm font-bold text-green-700">
                            נלכד! אמינות: {(faceConfidence * 100).toFixed(0)}%
                          </span>
                        </div>
                      )}

                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setShowFaceEnrollment(false);
                            setFaceEmbedding(null);
                          }}
                          className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold transition-colors"
                        >
                          ביטול
                        </button>

                        <button
                          type="button"
                          onClick={handleSaveFaceEmbedding}
                          disabled={!faceEmbedding || isSaving}
                          className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl font-bold transition-colors flex items-center justify-center gap-2"
                        >
                          {isSaving ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <>
                              <Save className="w-4 h-4" />
                              שמור
                            </>
                          )}
                        </button>
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* App Visibility Settings - Full Width Section */}
        <div className="bg-white rounded-2xl shadow-sm p-6 mt-6">
          <div className="flex items-center gap-2 mb-6">
            <LayoutGrid className="w-5 h-5 text-indigo-600" />
            <h2 className="text-xl font-black text-slate-900">התאמה אישית של מסך ראשי</h2>
          </div>
          <AppVisibilitySettings
            userId={currentUser?.id || ''}
            userAccessLevel={currentUser?.access_level || ''}
            isDriver={currentUser?.is_driver}
            isSuperAdmin={currentUser?.is_super_admin}
          />
        </div>
      </div>
    </div>
  );
};

export default ProfileSettings;
