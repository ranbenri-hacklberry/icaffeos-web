/**
 * Admin Utility: Fix Super Admin Flag
 * Temporary page to update super admin status for user רני
 */

import React, { useState } from 'react';
import { supabase } from '../lib/supabase';

const AdminFixSuperAdmin: React.FC = () => {
  const [status, setStatus] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [currentStatus, setCurrentStatus] = useState<any>(null);

  const checkCurrentStatus = async () => {
    setLoading(true);
    setStatus('🔍 Checking current status...');

    try {
      const { data, error } = await supabase
        .from('employees')
        .select('id, name, is_super_admin, access_level')
        .eq('id', '37044bfe-20ab-4f17-949f-e6660d7c5cc8')
        .single();

      if (error) throw error;

      setCurrentStatus(data);
      setStatus(`✅ Found user: ${data.name}`);
      console.log('📊 Current status:', data);
    } catch (error: any) {
      setStatus(`❌ Error: ${error.message}`);
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const fixSuperAdmin = async () => {
    setLoading(true);
    setStatus('🔧 Updating super admin flag...');

    try {
      // Update the super admin flag
      const { data, error } = await supabase
        .from('employees')
        .update({ is_super_admin: true })
        .eq('id', '37044bfe-20ab-4f17-949f-e6660d7c5cc8')
        .select('id, name, is_super_admin, access_level');

      if (error) throw error;

      setCurrentStatus(data[0]);
      setStatus('✅ Successfully updated! User is now a super admin.');
      console.log('🎉 Updated status:', data[0]);
    } catch (error: any) {
      setStatus(`❌ Error: ${error.message}`);
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const fixClockInValidation = async () => {
    setLoading(true);
    setStatus('🔧 Checking for duplicate clock-in issue...');

    try {
      // Check the check_clocked_in RPC function logic
      const { data, error } = await supabase.rpc('check_clocked_in', {
        p_employee_id: '37044bfe-20ab-4f17-949f-e6660d7c5cc8'
      });

      if (error) throw error;

      console.log('⏰ Clock-in status:', data);
      setStatus(`📊 Clock-in Status: ${JSON.stringify(data, null, 2)}`);
    } catch (error: any) {
      setStatus(`❌ Error: ${error.message}`);
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 p-8" dir="rtl">
      <div className="max-w-2xl mx-auto">
        <div className="bg-white/10 backdrop-blur-md rounded-2xl p-8 border border-white/20">
          <h1 className="text-3xl font-black text-white mb-2">
            🛠️ Admin Utility
          </h1>
          <p className="text-white/60 mb-8">Fix Super Admin & Clock-in Issues</p>

          {/* Status Display */}
          {status && (
            <div className="mb-6 p-4 bg-white/5 rounded-xl border border-white/10">
              <p className="text-white font-mono text-sm whitespace-pre-wrap">
                {status}
              </p>
            </div>
          )}

          {/* Current Status Display */}
          {currentStatus && (
            <div className="mb-6 p-4 bg-indigo-500/20 rounded-xl border border-indigo-400/30">
              <h3 className="text-white font-bold mb-2">📊 Current Status</h3>
              <div className="text-white/80 font-mono text-sm space-y-1">
                <div>Name: {currentStatus.name}</div>
                <div>Access Level: {currentStatus.access_level}</div>
                <div className={currentStatus.is_super_admin ? 'text-green-400' : 'text-red-400'}>
                  Super Admin: {currentStatus.is_super_admin ? '✅ Yes' : '❌ No'}
                </div>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="space-y-4">
            <button
              onClick={checkCurrentStatus}
              disabled={loading}
              className="w-full px-6 py-4 bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 text-white font-bold rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? '⏳ טוען...' : '🔍 בדוק סטטוס נוכחי'}
            </button>

            <button
              onClick={fixSuperAdmin}
              disabled={loading}
              className="w-full px-6 py-4 bg-gradient-to-r from-red-500 to-pink-500 hover:from-red-600 hover:to-pink-600 text-white font-bold rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? '⏳ טוען...' : '🔧 תקן Super Admin'}
            </button>

            <button
              onClick={fixClockInValidation}
              disabled={loading}
              className="w-full px-6 py-4 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-bold rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? '⏳ טוען...' : '⏰ בדוק סטטוס Clock-in'}
            </button>
          </div>

          {/* Instructions */}
          <div className="mt-8 p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-xl">
            <h3 className="text-yellow-300 font-bold mb-2">📋 הוראות שימוש</h3>
            <ol className="text-white/70 text-sm space-y-2" style={{ listStyle: 'decimal', paddingRight: '1.5rem' }}>
              <li>לחץ על "בדוק סטטוס נוכחי" כדי לראות את המצב הנוכחי</li>
              <li>לחץ על "תקן Super Admin" כדי לעדכן את ה-flag ל-true</li>
              <li>רענן את הדף ונסה להתחבר שוב</li>
              <li>אחרי התיקון, תועבר אוטומטית לפורטל Super Admin</li>
            </ol>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminFixSuperAdmin;
