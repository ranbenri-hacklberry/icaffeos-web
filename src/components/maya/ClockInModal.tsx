// @ts-nocheck
/**
 * ClockInModal Component - Role Selection for Shift
 *
 * Displays role cards with icons and glows
 * Fetches last used role and highlights as recommended
 * Calls /api/maya/clock-in endpoint
 *
 * Usage:
 * <ClockInModal
 *   employee={employee}
 *   onClockInSuccess={() => {...}}
 *   onError={(error) => {...}}
 *   onSkip={() => {...}}
 * />
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '@/lib/supabase';
import {
  Terminal,
  Utensils,
  Coffee,
  ClipboardCheck,
  Clock,
  MapPin,
  Loader2,
  CheckCircle,
  Star,
  TrendingUp,
  Banknote
} from 'lucide-react';

interface ClockInModalProps {
  employee: {
    id: string;
    name: string;
    accessLevel: string;
    businessId: string;
  };
  onClockInSuccess: (role: string, eventId: string) => void;
  onError?: (error: string) => void;
  onSkip?: () => void;
}

// Role configuration with icons, colors, and Hebrew labels
const ROLES = [
  {
    id: 'Cashier',
    label: 'קופאי',
    icon: Banknote,
    color: 'cyan',
    gradient: 'from-cyan-500 to-blue-500',
    glowColor: 'cyan-500',
    description: 'ניהול קופה והזמנות'
  },
  {
    id: 'Kitchen',
    label: 'מטבח',
    icon: Utensils,
    color: 'orange',
    gradient: 'from-orange-500 to-red-500',
    glowColor: 'orange-500',
    description: 'הכנת מנות ומטבח'
  },
  {
    id: 'Barista',
    label: 'בריסטה',
    icon: Coffee,
    color: 'purple',
    gradient: 'from-purple-500 to-pink-500',
    glowColor: 'purple-500',
    description: 'הכנת משקאות וקפה'
  },
  {
    id: 'Checker',
    label: 'צ׳קר',
    icon: ClipboardCheck,
    color: 'green',
    gradient: 'from-green-500 to-emerald-500',
    glowColor: 'green-500',
    description: 'בדיקת איכות וסדר'
  }
];

export const ClockInModal: React.FC<ClockInModalProps> = ({
  employee,
  onClockInSuccess,
  onError,
  onSkip
}) => {
  const [selectedRole, setSelectedRole] = useState<string | null>(null);
  const [lastUsedRole, setLastUsedRole] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isClockingIn, setIsClockingIn] = useState(false);
  const [location, setLocation] = useState<string>('Unknown');
  const [completionComment, setCompletionComment] = useState<string | null>(null);
  const [alreadyClockedIn, setAlreadyClockedIn] = useState(false);

  // Funny comments per role
  const FUNNY_COMMENTS: Record<string, string[]> = {
    Cashier: [
      "כסף זה לא הכל בחיים, אבל זה התחלה טובה 🤑",
      "תחייך, זה בחינם (בינתיים) 😉",
      "אל תשכח לשמור על הקופה! 🛡️",
      "היום אנחנו עושים מיליונים! 🚀",
      "מי אם לא אתה? המאסטר של הקופה! 💳"
    ],
    Kitchen: [
      "אם אתה לא יכול לסבול את החום... תדליק מזגן 🔥",
      "הלקוח תמיד צודק (גם אם הטעם שלו מוזר) 🥘",
      "בתיאבון! אל תאכל את כל הסחורה 😋",
      "ידיים של זהב, לב של שף 👨‍🍳",
      "היום מוציאים מנות אש! 🍽️"
    ],
    Barista: [
      "החיים מתחילים אחרי קפה ☕",
      "אספרסו קצר, יום ארוך, חיוך ענק 😄",
      "בלי קצף, בלי דאגות 🥛",
      "תן להם בוסט של אנרגיה! ⚡",
      "אומנות הלאטה זה בדם שלך 🎨"
    ],
    Checker: [
      "בודק, בודק, אחת שתיים... 👀",
      "הסדר הוא האויב של הכאוס 🌪️",
      "עין הנץ בפעולה! 🦅",
      "שום דבר לא עובר אותך! 🚫",
      "היום הכל מתקתק כמו שעון ⏰"
    ]
  };

  // Fetch last used role AND check if already clocked in
  useEffect(() => {
    // AUTO-SKIP for Super Admin
    if (employee.accessLevel === 'super-admin') {
      console.log('👑 Super Admin Detected - Auto-Skipping Clock-In Modal');
      onSkip?.();
      return;
    }

    const fetchLastRole = async () => {
      try {
        // First, check if user is already clocked in
        const { data: clockStatus, error: clockError } = await supabase.rpc('check_clocked_in', {
          p_employee_id: employee.id
        });

        if (!clockError && clockStatus && clockStatus.isClockedIn) {
          console.warn('⚠️ User is already clocked in! Last event:', clockStatus.lastEvent);
          setAlreadyClockedIn(true);
          // If already clocked in and they try to clock in again, skip to success
          // This prevents duplicate clock-ins
          setIsLoading(false);
          return;
        }

        // Query clock_events table for last clock-in event to get recommendation
        const { data, error } = await supabase
          .from('clock_events')
          .select('assigned_role, timestamp')
          .eq('employee_id', employee.id)
          .eq('event_type', 'clock-in')
          .order('timestamp', { ascending: false })
          .limit(1)
          .single();

        if (!error && data) {
          setLastUsedRole(data.assigned_role);
          console.log('📊 Last used role:', data.assigned_role);
        }
      } catch (err) {
        console.error('❌ Error fetching last role:', err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchLastRole();

    // Detect location (simple heuristic: check hostname)
    const hostname = window.location.hostname;
    if (hostname.includes('n150') || hostname === '192.168.1.150') {
      setLocation('N150');
    } else if (hostname === 'localhost' || hostname === '127.0.0.1') {
      setLocation('Mac Dev');
    } else {
      setLocation('Production');
    }
  }, [employee.id]);

  // Handle role selection
  const handleRoleSelect = async (roleId: string) => {
    setSelectedRole(roleId);
    setIsClockingIn(true);

    try {
      // Call Supabase RPC directly
      const { data, error } = await supabase.rpc('create_clock_event', {
        p_employee_id: employee.id,
        p_business_id: employee.businessId,
        p_event_type: 'clock-in',
        p_assigned_role: roleId
      });

      if (error) {
        console.error('❌ Clock-in failed:', error);
        onError?.(error.message || 'Failed to clock in');
        setSelectedRole(null);
        setIsClockingIn(false);
        return;
      }

      if (data && data.success) {
        console.log('✅ Clocked in successfully:', data);

        // Pick a random funny comment
        const comments = FUNNY_COMMENTS[roleId] || ["שיהיה אחלה סרוויס! 🚀"];
        const randomComment = comments[Math.floor(Math.random() * comments.length)];

        setCompletionComment(randomComment);

        // Wait for comment to be read before finishing
        setTimeout(() => {
          onClockInSuccess(roleId, data.eventId);
        }, 3000);

      } else {
        console.error('❌ Clock-in failed:', data);
        onError?.(data?.message || 'Failed to clock in');
        setSelectedRole(null);
        setIsClockingIn(false);
      }
    } catch (err) {
      console.error('❌ Clock-in error:', err);
      onError?.('Network error during clock-in');
      setSelectedRole(null);
      setIsClockingIn(false);
    }
    // Do NOT reset isClockingIn on success, we want to show the loader/comment
  };

  const cardVariants = {
    rest: { scale: 1, y: 0 },
    hover: {
      scale: 1.03,
      y: -4,
      transition: {
        type: 'spring',
        damping: 20,
        stiffness: 300
      }
    },
    tap: { scale: 0.97 }
  };

  return (
    <div className="w-full max-w-3xl mx-auto px-4">
      <AnimatePresence mode="wait">
        {/* Header - HIDDEN WHEN SUCCESS TO FOCUS ON MESSAGE */}
        {!completionComment && (
          <motion.div
            key="header" // <--- Add key
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }} // Add exit prop for smoothness
            className="text-center mb-8"
          >
            <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-indigo-500/20 to-purple-500/20 backdrop-blur-xl border border-indigo-400/30 rounded-2xl mb-4">
              <Clock className="w-8 h-8 text-indigo-400" />
            </div>
            <h3 className="text-3xl font-black text-white mb-2">
              שלום, {employee.name}! 👋
            </h3>
            <p className="text-white/60 text-sm">
              בחר את התפקיד שלך למשמרת הזו
            </p>

            {/* Location Badge */}
            <div className="inline-flex items-center gap-2 mt-3 bg-slate-800/40 backdrop-blur-sm border border-slate-700/50 px-3 py-1.5 rounded-full">
              <MapPin size={14} className="text-cyan-400" />
              <span className="text-xs font-medium text-white/70">{location}</span>
            </div>
          </motion.div>
        )}

        {/* Loading State */}
        {isLoading && (
          <motion.div
            key="loading" // <--- Add key and use motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex flex-col items-center justify-center py-12"
          >
            <Loader2 className="w-12 h-12 text-cyan-400 animate-spin mb-4" />
            <p className="text-white/60 text-sm">טוען נתונים...</p>
          </motion.div>
        )}

        {/* Already Clocked In Warning */}
        {!isLoading && alreadyClockedIn && (
          <motion.div
            key="already-clocked-in"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="flex flex-col items-center justify-center py-8"
          >
            <div className="w-20 h-20 bg-amber-500/20 backdrop-blur-xl border border-amber-400/30 rounded-full flex items-center justify-center mb-6">
              <CheckCircle className="w-10 h-10 text-amber-400" />
            </div>
            <h4 className="text-2xl font-black text-white mb-3">
              אתה כבר במשמרת! ⏰
            </h4>
            <p className="text-white/60 text-center mb-8 max-w-md">
              זוהה שאתה כבר עשית clock-in. אין צורך לעשות שוב.
            </p>
            {onSkip && (
              <motion.button
                onClick={onSkip}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="px-8 py-4 bg-gradient-to-r from-amber-500/30 to-orange-500/30 hover:from-amber-500/40 hover:to-orange-500/40 backdrop-blur-xl border border-amber-400/30 text-white font-bold rounded-xl transition-all shadow-lg shadow-amber-500/10"
              >
                🚀 המשך לעבודה
              </motion.button>
            )}
          </motion.div>
        )}

        {/* Role Selection Grid */}
        {!isLoading && !isClockingIn && !alreadyClockedIn && (
          <motion.div
            key="roles" // <--- Add key
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            transition={{ delay: 0.1 }}
            className="grid grid-cols-2 gap-4 mb-6"
          >
            {ROLES.map((role, index) => {
              const Icon = role.icon;
              const isRecommended = role.id === lastUsedRole;

              return (
                <motion.button
                  key={role.id}
                  variants={cardVariants}
                  initial="rest"
                  whileHover="hover"
                  whileTap="tap"
                  onClick={() => handleRoleSelect(role.id)}
                  disabled={selectedRole !== null}
                  className={`
                    relative p-6 rounded-3xl
                    bg-slate-900/40 backdrop-blur-xl
                    border-2
                    ${isRecommended
                      ? `border-${role.color}-400/60 shadow-lg shadow-${role.glowColor}/30`
                      : `border-${role.color}-400/20`
                    }
                    hover:border-${role.color}-400/60
                    disabled:opacity-50 disabled:cursor-not-allowed
                    transition-all duration-300
                    group
                    overflow-hidden
                  `}
                  style={{
                    borderColor: isRecommended
                      ? `rgba(var(--${role.color}-400-rgb), 0.6)`
                      : `rgba(var(--${role.color}-400-rgb), 0.2)`
                  }}
                >
                  {/* Recommended Badge */}
                  {isRecommended && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="absolute top-3 left-3 flex items-center gap-1 bg-gradient-to-r from-amber-500 to-orange-500 px-2 py-0.5 rounded-full z-10"
                    >
                      <Star size={10} className="text-white fill-white" />
                      <span className="text-[9px] font-black text-white">מומלץ</span>
                    </motion.div>
                  )}

                  {/* Background Gradient Glow */}
                  <div
                    className={`absolute inset-0 bg-gradient-to-br ${role.gradient} opacity-0 group-hover:opacity-10 transition-opacity duration-300`}
                  />

                  {/* Icon */}
                  <div className={`
                    w-16 h-16 mx-auto mb-4
                    bg-gradient-to-br ${role.gradient}
                    rounded-2xl
                    flex items-center justify-center
                    shadow-lg shadow-${role.glowColor}/30
                    group-hover:scale-110
                    transition-transform duration-300
                  `}>
                    <Icon className="w-8 h-8 text-white" />
                  </div>

                  {/* Label */}
                  <h4 className="text-xl font-black text-white mb-1 text-center">
                    {role.label}
                  </h4>

                  {/* Description */}
                  <p className="text-xs text-white/50 text-center">
                    {role.description}
                  </p>

                  {/* Last Used Indicator */}
                  {isRecommended && (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.2 }}
                      className="flex items-center justify-center gap-1 mt-3 text-[10px] text-white/40"
                    >
                      <TrendingUp size={10} />
                      <span>שימוש אחרון</span>
                    </motion.div>
                  )}
                </motion.button>
              );
            })}
          </motion.div>
        )}

        {/* Clocking In State / Completion */}
        {isClockingIn && selectedRole && (
          <motion.div
            key="clocking-in" // <--- Add key
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="flex flex-col items-center justify-center py-12"
          >
            {completionComment ? (
              <motion.div
                key="comment" // Nested key for comment transition
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                className="text-center"
              >
                <div className="w-24 h-24 mb-6 mx-auto bg-green-500/20 rounded-full flex items-center justify-center border border-green-500/50">
                  <div className="text-4xl">✨</div>
                </div>
                <h3 className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-green-400 to-emerald-400 mb-4">
                  נרשמת בהצלחה!
                </h3>
                <p className="text-white/90 text-xl font-medium px-8 leading-relaxed">
                  "{completionComment}"
                </p>
              </motion.div>
            ) : (
              <>
                <motion.div
                  animate={{
                    rotate: 360,
                    transition: { duration: 1, repeat: Infinity, ease: 'linear' }
                  }}
                  className="w-20 h-20 mb-6"
                >
                  <div className="w-full h-full rounded-full border-4 border-cyan-400/30 border-t-cyan-400" />
                </motion.div>

                <h3 className="text-2xl font-bold text-white mb-2">נרשם למשמרת...</h3>
                <p className="text-white/60 text-sm">
                  {ROLES.find(r => r.id === selectedRole)?.label}
                </p>
              </>
            )}
          </motion.div>
        )}

        {/* Skip Option (for admins/managers/super admins) */}
        {onSkip && !isClockingIn && !isLoading && !completionComment && !alreadyClockedIn && (
          <motion.div
            key="skip"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ delay: 0.2 }}
            className="text-center mt-6"
          >
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={onSkip}
              className="px-6 py-3 bg-gradient-to-r from-amber-500/20 to-orange-500/20
                         border-2 border-amber-400/40 hover:border-amber-400/60
                         rounded-xl text-amber-400 font-bold text-base
                         shadow-lg shadow-amber-500/20 hover:shadow-amber-500/30
                         transition-all duration-200
                         backdrop-blur-sm"
            >
              🚀 דלג - כניסה ישירה
            </motion.button>
            <p className="text-white/30 text-xs mt-2">
              או בחר תפקיד לבדיקת המערכת
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      <style>{`
        /* CSS custom properties for dynamic colors */
        :root {
          --cyan-400-rgb: 34, 211, 238;
          --orange-400-rgb: 251, 146, 60;
          --purple-400-rgb: 192, 132, 252;
          --green-400-rgb: 74, 222, 128;
        }
      `}</style>
    </div>
  );
};

export default ClockInModal;
