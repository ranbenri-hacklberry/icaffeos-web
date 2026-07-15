// @ts-nocheck
/**
 * Maya Authentication Context
 * ניהול state למערכת הזיהוי הביומטרי
 */

import React, { createContext, useContext, useState, ReactNode } from 'react';

// Types
export type AuthState =
  | 'LOADING'
  | 'SCANNING'
  | 'PIN_FALLBACK'
  | 'MATCHING'
  | 'IDENTIFIED'
  | 'CLOCK_IN_REQUIRED'
  | 'AUTHORIZED'
  | 'ERROR';

export interface Employee {
  id: string;
  name: string;
  accessLevel: string;
  isSuperAdmin: boolean;
  businessId: string;
}

interface MayaAuthContextType {
  // State
  authState: AuthState;
  employee: Employee | null;
  similarity: number;
  isClockedIn: boolean;
  currentRole: string | null;
  error: string | null;
  errorRetryable: boolean;
  currentSessionId: string;

  // Actions
  setAuthState: (state: AuthState) => void;
  setEmployee: (employee: Employee, similarity: number) => void;
  setClockInStatus: (isClockedIn: boolean, role?: string) => void;
  setError: (error: string, retryable: boolean) => void;
  reset: () => void;
}

// Create context
const MayaAuthContext = createContext<MayaAuthContextType | null>(null);

// Provider component
interface MayaAuthProviderProps {
  children: ReactNode;
}

export const MayaAuthProvider: React.FC<MayaAuthProviderProps> = ({ children }) => {
  const [authState, setAuthState] = useState<AuthState>('LOADING');
  const [employee, setEmployeeState] = useState<Employee | null>(null);
  const [similarity, setSimilarity] = useState(0);
  const [isClockedIn, setIsClockedIn] = useState(false);
  const [currentRole, setCurrentRole] = useState<string | null>(null);
  const [error, setErrorState] = useState<string | null>(null);
  const [errorRetryable, setErrorRetryable] = useState(true);
  const [currentSessionId] = useState(`session-${Date.now()}`);

  const setEmployee = (emp: Employee, sim: number) => {
    setEmployeeState(emp);
    setSimilarity(sim);
    setErrorState(null); // Clear error on successful identification
  };

  const setClockInStatus = (clocked: boolean, role?: string) => {
    setIsClockedIn(clocked);
    if (role) {
      setCurrentRole(role);
    }
  };

  const setError = (err: string, retryable: boolean) => {
    setErrorState(err);
    setErrorRetryable(retryable);
    setAuthState('ERROR');
  };

  const reset = () => {
    setAuthState('LOADING');
    setEmployeeState(null);
    setSimilarity(0);
    setIsClockedIn(false);
    setCurrentRole(null);
    setErrorState(null);
    setErrorRetryable(true);
  };

  const value: MayaAuthContextType = {
    authState,
    employee,
    similarity,
    isClockedIn,
    currentRole,
    error,
    errorRetryable,
    currentSessionId,
    setAuthState,
    setEmployee,
    setClockInStatus,
    setError,
    reset
  };

  return (
    <MayaAuthContext.Provider value={value}>
      {children}
    </MayaAuthContext.Provider>
  );
};

// Hook to use the context
export const useMayaAuth = (): MayaAuthContextType => {
  const context = useContext(MayaAuthContext);
  if (!context) {
    throw new Error('useMayaAuth must be used within MayaAuthProvider');
  }
  return context;
};

// Helper functions
export const isFullyAuthorized = (ctx: MayaAuthContextType): boolean => {
  return ctx.authState === 'AUTHORIZED' && ctx.employee !== null;
};

export const canViewFinancialData = (ctx: MayaAuthContextType): boolean => {
  if (!ctx.employee) return false;

  const adminRoles = ['Admin', 'Manager', 'Owner'];
  return adminRoles.includes(ctx.employee.accessLevel) || ctx.employee.isSuperAdmin;
};

export const needsClockIn = (ctx: MayaAuthContextType): boolean => {
  if (!ctx.employee) return false;

  const workerRoles = ['Worker', 'Chef', 'Barista', 'Checker', 'Software Architect'];
  return workerRoles.includes(ctx.employee.accessLevel) && !ctx.employee.isSuperAdmin;
};

export default MayaAuthContext;
