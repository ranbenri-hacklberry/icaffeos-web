// @ts-nocheck
import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

interface LoyaltyPopupProps {
  phone?: string | null;
  onClose: () => void;
}

const TOTAL_REQUIRED = 9;

export default function LoyaltyPopup({ phone, onClose }: LoyaltyPopupProps) {
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchCount = async () => {
      try {
        // Use the new loyalty system via RPC
        const { data, error } = await supabase.rpc('get_loyalty_balance', {
          p_phone: phone
        });

        if (error) {
          console.error('Failed to fetch loyalty count:', error);
          setCount(0);
        } else {
          // get_loyalty_balance returns { balance: number, freeCoffees: number }
          setCount(data?.balance || 0);
        }
      } catch (err) {
        console.error('Unexpected error fetching loyalty count:', err);
        setCount(0);
      } finally {
        setLoading(false);
      }
    };

    if (phone) {
      fetchCount();
    } else {
      setLoading(false);
      setCount(0);
    }
  }, [phone]);

  if (!phone || loading) {
    return null;
  }

  const remaining = Math.max(0, TOTAL_REQUIRED - count);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl p-8 max-w-md w-full text-center">
        <h3 className="text-xl font-bold mb-4">
          {remaining === 0 ? '🎉 הקפה הבא שלך חינם!' : `עוד ${remaining} כוסות והקפה עלינו!`}
        </h3>

        <div className="relative w-32 h-32 mx-auto mb-6">
          <svg className="w-full h-full">
            <circle cx="64" cy="64" r="60" stroke="#f0f0f0" strokeWidth="8" fill="none" />
            <circle
              cx="64" cy="64" r="60"
              stroke="#fbbf24" strokeWidth="8" fill="none"
              strokeDasharray={`${(Math.min(count, TOTAL_REQUIRED) / TOTAL_REQUIRED) * 377} 377`}
              transform="rotate(-90 64 64)"
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-3xl font-bold">{Math.min(count, TOTAL_REQUIRED)}/{TOTAL_REQUIRED}</span>
          </div>
        </div>

        {count === TOTAL_REQUIRED - 1 && (
          <p className="text-green-600 font-medium">עוד כוס אחת ותקבל קפה חינם!</p>
        )}

        <button
          onClick={onClose}
          className="mt-6 w-full bg-primary text-white py-3 rounded-xl font-medium"
        >
          להמשיך
        </button>
      </div>
    </div>
  );
}