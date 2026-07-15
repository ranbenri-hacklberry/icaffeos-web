// @ts-nocheck
/**
 * ClockInModalInline Component - Compact Role Selection
 *
 * Embedded version for use within Maya chat window
 * Smaller, more compact than the full modal version
 */

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { supabase } from '@/lib/supabase';
import {
  Terminal,
  Utensils,
  Coffee,
  Banknote,
  ClipboardCheck,
  Loader2,
  Star,
  TrendingUp
} from 'lucide-react';

interface Employee {
  id: string;
  name: string;
  accessLevel: string;
  businessId: string;
}

interface ClockInModalInlineProps {
  employee: Employee;
  onClockInSuccess: (role: string, eventId: string) => void;
  onError: (error: string) => void;
}

const ROLES = [
  {
    id: 'Cashier',
    label: 'קופאי',
    icon: Banknote,
    gradient: 'from-cyan-500 to-blue-500',
  },
  {
    id: 'Kitchen',
    label: 'מטבח',
    icon: Utensils,
    gradient: 'from-orange-500 to-red-500',
  },
  {
    id: 'Barista',
    label: 'בריסטה',
    icon: Coffee,
    gradient: 'from-purple-500 to-pink-500',
  },
  {
    id: 'Checker',
    label: 'צ׳קר',
    icon: ClipboardCheck,
    gradient: 'from-green-500 to-emerald-500',
  }
];

export const ClockInModalInline: React.FC<ClockInModalInlineProps> = ({
  employee,
  onClockInSuccess,
  onError
}) => {
  const [selectedRole, setSelectedRole] = useState<string | null>(null);
  const [lastUsedRole, setLastUsedRole] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isClockingIn, setIsClockingIn] = useState(false);

  // Fetch last used role
  useEffect(() => {
    const fetchLastRole = async () => {
      try {
        // Query clock_events table for last clock-in event
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
        console.error('Error fetching last role:', err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchLastRole();
  }, [employee.id]);

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
        onError(error.message || 'Failed to clock in');
        setSelectedRole(null);
        setIsClockingIn(false);
        return;
      }

      if (data && data.success) {
        console.log('✅ Clocked in successfully:', data);
        onClockInSuccess(roleId, data.eventId);
      } else {
        console.error('❌ Clock-in failed:', data);
        onError(data?.message || 'Failed to clock in');
        setSelectedRole(null);
        setIsClockingIn(false);
      }
    } catch (err) {
      console.error('❌ Clock-in error:', err);
      onError('Network error during clock-in');
      setSelectedRole(null);
      setIsClockingIn(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-8">
        <Loader2 className="w-8 h-8 text-cyan-400 animate-spin mb-2" />
        <p className="text-white/60 text-sm">טוען...</p>
      </div>
    );
  }

  if (isClockingIn) {
    return (
      <div className="flex flex-col items-center justify-center py-8">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
          className="w-12 h-12 border-4 border-cyan-400/30 border-t-cyan-400 rounded-full mb-3"
        />
        <p className="text-white font-medium">נרשם למשמרת...</p>
        <p className="text-white/60 text-sm">
          {ROLES.find(r => r.id === selectedRole)?.label}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4 py-2">
      {/* Compact Header */}
      <div className="text-center">
        <h3 className="text-base font-bold text-white mb-1">
          שלום {employee.name}! 👋
        </h3>
        <p className="text-xs text-white/60">בחר את התפקיד שלך למשמרת</p>
      </div>

      {/* 2x2 Grid */}
      <div className="grid grid-cols-2 gap-2">
        {ROLES.map((role) => {
          const Icon = role.icon;
          const isRecommended = role.id === lastUsedRole;

          return (
            <motion.button
              key={role.id}
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              onClick={() => handleRoleSelect(role.id)}
              disabled={selectedRole !== null}
              className={`
                relative p-3 rounded-xl
                bg-slate-800/40 backdrop-blur-sm
                border
                ${isRecommended
                  ? 'border-cyan-400/60 shadow-lg shadow-cyan-500/20'
                  : 'border-cyan-400/20'
                }
                hover:border-cyan-400/60
                disabled:opacity-50
                transition-all duration-200
                group
              `}
            >
              {/* Recommended Badge */}
              {isRecommended && (
                <div className="absolute top-1 right-1 flex items-center gap-0.5 bg-gradient-to-r from-amber-500 to-orange-500 px-1.5 py-0.5 rounded-md">
                  <Star size={8} className="text-white fill-white" />
                  <span className="text-[8px] font-bold text-white">מומלץ</span>
                </div>
              )}

              {/* Icon */}
              <div className={`
                w-10 h-10 mx-auto mb-2
                bg-gradient-to-br ${role.gradient}
                rounded-xl
                flex items-center justify-center
                shadow-lg
                group-hover:scale-110
                transition-transform duration-200
              `}>
                <Icon className="w-5 h-5 text-white" />
              </div>

              {/* Label */}
              <p className="text-xs font-bold text-white text-center">
                {role.label}
              </p>

              {/* Last Used Indicator */}
              {isRecommended && (
                <div className="flex items-center justify-center gap-0.5 mt-1">
                  <TrendingUp size={8} className="text-white/30" />
                  <span className="text-[9px] text-white/30">שימוש אחרון</span>
                </div>
              )}
            </motion.button>
          );
        })}
      </div>
    </div>
  );
};

export default ClockInModalInline;
