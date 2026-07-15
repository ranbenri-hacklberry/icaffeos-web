import React, { useState, useEffect, useCallback, memo } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import Icon from '@/components/AppIcon';
import { recordTimeClockEvent, getEmployeeClockStatus } from '@/services/timeClockService';
import { safeJsonParse } from '@/utils';
import { APP_VERSION } from '@/config/version';

const Header = memo(({
  primaryAction = null,
  hideLanguage = false,
  customActions = null,
  customerName = null,
  isEditMode = false
}) => {
  const [employeeSession, setEmployeeSession] = useState(null);
  const [isClockedIn, setIsClockedIn] = useState(false);
  const [isClockingOut, setIsClockingOut] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  const navigate = useNavigate();

  // Update current time every minute
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 60000);

    return () => clearInterval(timer);
  }, []);

  // Load employee session on component mount
  useEffect(() => {
    const loadEmployeeSession = () => {
      const sessionData = sessionStorage.getItem('employee_session');
      if (sessionData) {
        const employee = safeJsonParse(sessionData);
        setEmployeeSession(employee);

        // Check clock status if employee is logged in
        if (employee?.id) {
          checkClockStatus(employee?.id);
        }
      }
    };

    loadEmployeeSession();
  }, []);

  // Check if employee is currently clocked in
  const checkClockStatus = useCallback(async (employeeId) => {
    try {
      const result = await getEmployeeClockStatus(employeeId);
      if (result?.success) {
        setIsClockedIn(result?.isClockedIn);
      }
    } catch (error) {
      console.error('Error checking clock status:', error);
    }
  }, []);

  // Handle employee clock out
  const handleClockOut = useCallback(async () => {
    if (!employeeSession?.id || isClockingOut) return;

    setIsClockingOut(true);

    try {
      const result = await recordTimeClockEvent(employeeSession?.id, 'clock_out');

      if (result?.success) {
        setIsClockedIn(false);

        // Clear employee session
        sessionStorage.removeItem('employee_session');
        setEmployeeSession(null);

        // Navigate back to login screen
        navigate('/login');
      } else {
        console.error('Clock out failed:', result?.error);
        alert('שגיאה ביציאה מהעבודה. אנא נסה שוב.');
      }
    } catch (error) {
      console.error('Clock out error:', error);
      alert('שגיאה ביציאה מהעבודה. אנא נסה שוב.');
    } finally {
      setIsClockingOut(false);
    }
  }, [employeeSession?.id, isClockingOut, navigate]);

  // Handle end session without clock out (for customer mode or manager override)
  const handleEndSession = useCallback(() => {
    sessionStorage.removeItem('employee_session');
    setEmployeeSession(null);
    setIsClockedIn(false);
    navigate('/login');
  }, [navigate]);



  return (
    <motion.header
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: "easeOut" }}
      className="bg-primary text-primary-foreground shadow-kiosk relative z-20"
    >
      <div className="flex items-center justify-between h-16 px-6">
        {/* Logo Section */}
        <div className="flex items-center">
          <div
            className="flex items-center space-x-3 cursor-pointer"
            onContextMenu={(e) => e.preventDefault()}
            onTouchStart={(e) => {
              const timer = setTimeout(() => {
                const confirmed = window.confirm('האם ברצונך לצאת ולחזור לבחירת מצב?');
                if (confirmed) navigate('/mode-selection');
              }, 3000);
              e.currentTarget.dataset.logoutTimer = timer;
            }}
            onTouchEnd={(e) => {
              clearTimeout(e.currentTarget.dataset.logoutTimer);
            }}
            onMouseDown={(e) => {
              const timer = setTimeout(() => {
                const confirmed = window.confirm('האם ברצונך לצאת ולחזור לבחירת מצב?');
                if (confirmed) navigate('/mode-selection');
              }, 3000);
              e.currentTarget.dataset.logoutTimer = timer;
            }}
            onMouseUp={(e) => {
              clearTimeout(e.currentTarget.dataset.logoutTimer);
            }}
          >
            <motion.div
              whileHover={{ rotate: 10, scale: 1.1 }}
              className="bg-white/10 p-2 rounded-kiosk-sm"
            >
              <Icon name="Utensils" size={24} color="currentColor" />
            </motion.div>
            <motion.div
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.2 }}
            >
              <h1 className="text-xl font-semibold tracking-tight">
                Self Service Kiosk
              </h1>
              <p className="text-xs text-primary-foreground/80">
                Quick & Easy Ordering
              </p>
            </motion.div>
          </div>
        </div>

        {/* Customer Greeting (when customer name is available) */}
        <AnimatePresence>
          {customerName && (
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="flex-1 text-center"
            >
              <div className="text-lg font-semibold text-primary-foreground/90">
                {isEditMode ? `עדכון הזמנה - ${customerName}` : `הזמנה חדשה - ${customerName}`}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Employee Session Info (when logged in) */}
        {employeeSession && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex items-center space-x-4 bg-white/10 rounded-kiosk-md px-4 py-2"
          >
            <div className="flex items-center space-x-2">
              <Icon name="User" size={16} color="currentColor" />
              <div className="text-sm">
                <div className="font-medium">{employeeSession?.name}</div>
                <div className="text-xs text-primary-foreground/80">
                  {employeeSession?.accessLevel} • {isClockedIn ? 'פעיל' : 'לא פעיל'}
                </div>
              </div>
            </div>

            {/* Clock Status Indicator */}
            <motion.div
              animate={isClockedIn ? { scale: [1, 1.2, 1], opacity: [1, 0.8, 1] } : {}}
              transition={isClockedIn ? { repeat: Infinity, duration: 2 } : {}}
              className={`w-2 h-2 rounded-full ${isClockedIn ? 'bg-green-400' : 'bg-red-400'}`}
            />
          </motion.div>
        )}

        {/* Status Indicators */}
        <div className="flex items-center space-x-4">
          {/* Version Display (Requested Feature) */}
          <div className="hidden md:block text-xs text-white/40 font-mono tracking-widest">
            {APP_VERSION}
          </div>

          {/* Time Display */}
          <div className="hidden sm:flex items-center space-x-2 text-sm">
            <Icon name="Clock" size={16} color="currentColor" />
            <span className="font-mono">
              {currentTime?.toLocaleTimeString('he-IL', {
                hour: '2-digit',
                minute: '2-digit'
              })}
            </span>
          </div>

          {/* Employee Actions */}
          {employeeSession && (
            <div className="flex items-center space-x-2">
              {/* Clock Out Button (only show if clocked in) */}
              <AnimatePresence>
                {isClockedIn && (
                  <motion.button
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.8 }}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={handleClockOut}
                    disabled={isClockingOut}
                    className="flex items-center space-x-2 px-3 py-2 rounded-kiosk-sm bg-red-500/80 hover:bg-red-500 transition-colors duration-150 touch-target disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Icon name="LogOut" size={18} color="currentColor" />
                    <span className="hidden sm:inline text-sm font-medium">
                      {isClockingOut ? 'יוצא...' : 'יציאה'}
                    </span>
                  </motion.button>
                )}
              </AnimatePresence>

              {/* End Session Button (for manager override or customer mode) */}
              {(!isClockedIn || employeeSession?.isOverride) && (
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={handleEndSession}
                  className="flex items-center space-x-2 px-3 py-2 rounded-kiosk-sm bg-orange-500/80 hover:bg-orange-500 transition-colors duration-150 touch-target"
                >
                  <Icon name="X" size={18} color="currentColor" />
                  <span className="hidden sm:inline text-sm font-medium">סיום</span>
                </motion.button>
              )}
            </div>
          )}

          {/* Primary Action */}
          {primaryAction && (
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={primaryAction?.onClick}
              className="flex items-center space-x-2 px-3 py-2 rounded-kiosk-sm bg-white/20 hover:bg-white/30 transition-colors duration-150 touch-target"
            >
              {primaryAction?.iconName && (
                <Icon name={primaryAction?.iconName} size={18} color="currentColor" />
              )}
              <span className="hidden sm:inline text-sm font-medium">
                {primaryAction?.label}
              </span>
            </motion.button>
          )}

          {/* Custom Actions (e.g., view toggles) */}
          {customActions && (
            <div className="flex items-center space-x-2 rtl:space-x-reverse">
              {customActions}
            </div>
          )}


          {/* Maya AI Assistant (Only for logged-in employees) */}
          {employeeSession && (
            <motion.button
              whileHover={{ scale: 1.1, rotate: [0, -5, 5, 0] }}
              whileTap={{ scale: 0.95 }}
              className="flex items-center space-x-2 px-3 py-2 rounded-kiosk-sm bg-gradient-to-r from-purple-500/80 to-pink-500/80 hover:from-purple-500 hover:to-pink-500 transition-all duration-150 touch-target shadow-lg relative overflow-hidden"
              onClick={() => {
                navigate('/maya');
              }}
              title="מאיה - העוזרת האישית"
            >
              <motion.span
                className="text-lg relative z-10"
                animate={{ rotate: [0, 10, -10, 0] }}
                transition={{ repeat: Infinity, duration: 2, repeatDelay: 3 }}
              >
                🌸
              </motion.span>
              <span className="hidden sm:inline text-sm font-medium relative z-10">מאיה</span>

              {/* Shine effect */}
              <motion.div
                className="absolute top-0 left-[-100%] w-full h-full bg-white/20 skew-x-[-20deg]"
                animate={{ left: "200%" }}
                transition={{ repeat: Infinity, duration: 3, ease: "easeInOut", repeatDelay: 1 }}
              />
            </motion.button>
          )}

        </div>
      </div>
    </motion.header>
  );
});

export default Header;