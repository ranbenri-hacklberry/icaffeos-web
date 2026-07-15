import { useState, useEffect } from 'react';
import { getSessionData, setSessionData } from '@/utils';
import { getEmployeeClockStatus, validateEmployee } from '@/services/timeClockService';

/**
 * Custom hook for managing employee time clock session
 * Provides session management, clock status, and employee validation
 */
export const useTimeClockSession = () => {
  const [employeeSession, setEmployeeSession] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isClockedIn, setIsClockedIn] = useState(false);
  const [lastClockEvent, setLastClockEvent] = useState(null);
  const [error, setError] = useState(null);

  // Initialize session on hook mount
  useEffect(() => {
    initializeSession();
  }, []);

  // Monitor session changes
  useEffect(() => {
    if (employeeSession?.id) {
      checkClockStatus(employeeSession?.id);
    }
  }, [employeeSession]);

  /**
   * Initialize employee session from storage
   */
  const initializeSession = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const sessionData = getSessionData('employee_session');
      
      if (sessionData?.id) {
        // Validate employee still exists and has access
        const validation = await validateEmployee(sessionData?.id);
        
        if (validation?.success) {
          setEmployeeSession(sessionData);
        } else {
          // Clear invalid session
          clearSession();
          setError('Session expired. Please login again.');
        }
      }
    } catch (err) {
      console.error('Session initialization error:', err);
      setError('Failed to initialize session');
      clearSession();
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Check current clock status for employee
   */
  const checkClockStatus = async (employeeId) => {
    try {
      const result = await getEmployeeClockStatus(employeeId);
      
      if (result?.success) {
        setIsClockedIn(result?.isClockedIn);
        setLastClockEvent(result?.lastEvent);
      } else {
        console.error('Clock status check failed:', result?.error);
      }
    } catch (err) {
      console.error('Clock status error:', err);
    }
  };

  /**
   * Update employee session data
   */
  const updateSession = (sessionData) => {
    setEmployeeSession(sessionData);
    setSessionData('employee_session', sessionData);
  };

  /**
   * Clear employee session
   */
  const clearSession = () => {
    setEmployeeSession(null);
    setIsClockedIn(false);
    setLastClockEvent(null);
    setError(null);
    
    try {
      sessionStorage.removeItem('employee_session');
    } catch (err) {
      console.warn('Failed to clear session storage:', err);
    }
  };

  /**
   * Refresh session data
   */
  const refreshSession = async () => {
    if (employeeSession?.id) {
      await checkClockStatus(employeeSession?.id);
    }
  };

  /**
   * Check if employee has specific access level
   */
  const hasAccessLevel = (requiredLevel) => {
    if (!employeeSession?.accessLevel) return false;
    
    const accessLevels = {
      'Worker': 1,
      'Supervisor': 2,
      'Manager': 3,
      'Admin': 4
    };
    
    const currentLevel = accessLevels?.[employeeSession?.accessLevel] || 0;
    const requiredLevelValue = accessLevels?.[requiredLevel] || 0;
    
    return currentLevel >= requiredLevelValue;
  };

  /**
   * Check if session is valid and active
   */
  const isSessionValid = () => {
    if (!employeeSession) return false;
    
    // Check if session is too old (24 hours)
    const loginTime = new Date(employeeSession.loginTime);
    const now = new Date();
    const hoursDiff = (now - loginTime) / (1000 * 60 * 60);
    
    return hoursDiff < 24;
  };

  /**
   * Get session duration
   */
  const getSessionDuration = () => {
    if (!employeeSession?.loginTime) return 0;
    
    const loginTime = new Date(employeeSession.loginTime);
    const now = new Date();
    
    return Math.floor((now - loginTime) / (1000 * 60)); // Return minutes
  };

  return {
    // State
    employeeSession,
    isLoading,
    isClockedIn,
    lastClockEvent,
    error,
    
    // Actions
    updateSession,
    clearSession,
    refreshSession,
    
    // Utilities
    hasAccessLevel,
    isSessionValid,
    getSessionDuration,
    
    // Computed values
    isLoggedIn: !!employeeSession,
    employeeName: employeeSession?.name || '',
    accessLevel: employeeSession?.accessLevel || '',
    isManagerOrAdmin: hasAccessLevel('Manager')
  };
};

export default useTimeClockSession;