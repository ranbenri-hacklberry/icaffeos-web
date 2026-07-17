import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '../utils/supabase';

const SimpleAuthContext = createContext(null);

export function SimpleAuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  // Restore session from localStorage on mount
  useEffect(() => {
    const checkSavedUser = async () => {
      try {
        const saved = localStorage.getItem('icaffe_loyalty_user');
        if (saved) {
          const parsed = JSON.parse(saved);
          
          // Re-fetch fresh employee and business data to get the latest status
          if (parsed.id) {
            const { data: employee } = await supabase
              .from('employees')
              .select('*')
              .eq('id', parsed.id)
              .single();

            if (employee) {
              const { data: business } = await supabase
                .from('businesses')
                .select('*')
                .eq('id', employee.business_id)
                .single();

              if (business) {
                const enriched = { ...employee, business };
                setCurrentUser(enriched);
                localStorage.setItem('icaffe_loyalty_user', JSON.stringify(enriched));
              } else {
                setCurrentUser({ ...employee, business: null });
              }
            }
          }
        }
      } catch (err) {
        console.error('Failed to restore auth session:', err);
      } finally {
        setIsLoading(false);
      }
    };

    checkSavedUser();
  }, []);

  const login = async (phone, pin) => {
    setIsLoading(true);
    try {
      // Normalize phone number (strip all non-digit chars)
      const cleanPhone = phone.replace(/\D/g, '');
      
      // Try to find employee by phone and PIN
      const { data: employee, error } = await supabase
        .from('employees')
        .select('*')
        .eq('phone', cleanPhone)
        .eq('pin_code', pin)
        .maybeSingle();

      if (error) throw error;
      if (!employee) {
        // Try without phone normalization just in case
        const { data: employeeRaw, error: errRaw } = await supabase
          .from('employees')
          .select('*')
          .eq('phone', phone)
          .eq('pin_code', pin)
          .maybeSingle();

        if (errRaw) throw errRaw;
        if (!employeeRaw) {
          throw new Error('מספר טלפון או קוד PIN שגויים');
        }
        return await enrichAndSetUser(employeeRaw);
      }

      return await enrichAndSetUser(employee);
    } catch (err) {
      setIsLoading(false);
      throw err;
    }
  };

  const enrichAndSetUser = async (employee) => {
    let business = null;
    if (employee.business_id) {
      const { data } = await supabase
        .from('businesses')
        .select('*')
        .eq('id', employee.business_id)
        .single();
      business = data;
    }

    const enriched = { ...employee, business };
    setCurrentUser(enriched);
    localStorage.setItem('icaffe_loyalty_user', JSON.stringify(enriched));
    setIsLoading(false);
    return enriched;
  };

  const logout = () => {
    setCurrentUser(null);
    localStorage.removeItem('icaffe_loyalty_user');
  };

  const value = {
    currentUser,
    isLoading,
    login,
    logout,
    // Add compatibility properties so other pages don't break if they reference getSupabase or similar
    supabase
  };

  return (
    <SimpleAuthContext.Provider value={value}>
      {children}
    </SimpleAuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(SimpleAuthContext);
  if (!context) {
    throw new Error('useAuth must be used within a SimpleAuthProvider');
  }
  return context;
}
