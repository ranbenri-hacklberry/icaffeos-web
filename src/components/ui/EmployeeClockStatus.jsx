import React, { useState, useEffect } from 'react';
import Icon from '@/components/AppIcon';
import { getEmployeeClockStatus, calculateWorkHours } from '@/services/timeClockService';
import { formatDateTime } from '@/utils';

const EmployeeClockStatus = ({ employeeId, className = '' }) => {
  const [clockStatus, setClockStatus] = useState(null);
  const [workHours, setWorkHours] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  // Load clock status and work hours
  useEffect(() => {
    if (!employeeId) {
      setIsLoading(false);
      return;
    }

    loadClockStatus();
    loadTodayWorkHours();
  }, [employeeId]);

  const loadClockStatus = async () => {
    try {
      const result = await getEmployeeClockStatus(employeeId);
      if (result?.success) {
        setClockStatus(result);
      } else {
        setError(result?.error);
      }
    } catch (err) {
      setError('Failed to load clock status');
      console.error('Clock status error:', err);
    }
  };

  const loadTodayWorkHours = async () => {
    try {
      const today = new Date();
      const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
      const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);

      const result = await calculateWorkHours(
        employeeId,
        startOfDay?.toISOString(),
        endOfDay?.toISOString()
      );

      if (result?.success) {
        setWorkHours(result);
      }
    } catch (err) {
      console.error('Work hours calculation error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className={`flex items-center justify-center p-4 ${className}`}>
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`text-red-500 text-sm p-4 ${className}`}>
        <Icon name="AlertCircle" size={16} className="inline mr-2" />
        {error}
      </div>
    );
  }

  return (
    <div className={`bg-white rounded-lg shadow-sm border p-4 ${className}`}>
      <div className="space-y-3">
        {/* Clock Status */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div className={`w-3 h-3 rounded-full ${
              clockStatus?.isClockedIn ? 'bg-green-500' : 'bg-red-500'
            }`} />
            <span className="font-medium text-gray-900">
              סטטוס נוכחי
            </span>
          </div>
          <span className={`text-sm font-medium ${
            clockStatus?.isClockedIn ? 'text-green-600' : 'text-red-600'
          }`}>
            {clockStatus?.isClockedIn ? 'פעיל' : 'לא פעיל'}
          </span>
        </div>

        {/* Last Event */}
        {clockStatus?.lastEvent && (
          <div className="text-sm text-gray-600">
            <div className="flex items-center justify-between">
              <span>אירוע אחרון:</span>
              <span className="font-medium">
                {clockStatus?.lastEvent?.event_type === 'clock_in' ? 'כניסה' : 'יציאה'}
              </span>
            </div>
            <div className="text-xs text-gray-500 mt-1">
              {formatDateTime(clockStatus?.lastEvent?.event_time)}
            </div>
          </div>
        )}

        {/* Today's Work Hours */}
        {workHours && (
          <div className="border-t pt-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-gray-900">שעות היום:</span>
              <span className="text-sm font-bold text-blue-600">
                {workHours?.totalHours?.toFixed(1)} שעות
              </span>
            </div>
            {workHours?.shifts?.length > 0 && (
              <div className="text-xs text-gray-500 mt-1">
                {workHours?.shifts?.length} משמרות
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default EmployeeClockStatus;