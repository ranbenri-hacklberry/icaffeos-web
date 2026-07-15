import { supabase } from '@/lib/supabase';

/**
 * Time Clock Service
 * Provides clock-in/clock-out functionality similar to Next.js API route
 * Matches the structure from /api/time-clock/clock-in-out.js
 */

/**
 * Record a time clock event (clock-in or clock-out)
 * @param {string} employeeId - The Employee's UUID
 * @param {string} eventType - 'clock_in' or 'clock_out'
 * @returns {Promise<{success: boolean, message: string, event?: object, error?: string}>}
 */
export const recordTimeClockEvent = async (employeeId, eventType) => {
  // Input validation: The Employee's UUID and the type of event
  if (!employeeId || !eventType || (eventType !== 'clock_in' && eventType !== 'clock_out')) {
    return {
      success: false,
      error: 'Invalid employeeId or eventType (must be clock_in or clock_out).'
    };
  }

  try {
    // 1. Inserting the new event into the time_clock_events table
    const { data, error } = await supabase?.from('time_clock_events')?.insert([
        { 
          employee_id: employeeId, 
          event_type: eventType 
          // event_time is automatically set by the database
        }
      ])?.select();

    if (error) {
      console.error('Database INSERT Error:', error);
      return {
        success: false,
        error: 'Failed to record time event.'
      };
    }

    // 2. Success response
    return {
      success: true,
      message: `${eventType === 'clock_in' ? 'Clock In' : 'Clock Out'} recorded successfully.`,
      event: data?.[0]
    };

  } catch (e) {
    console.error('Service Catch Error:', e);
    return {
      success: false,
      error: 'Internal Service Error.'
    };
  }
};

/**
 * Get the latest time clock event for an employee
 * @param {string} employeeId - The Employee's UUID
 * @returns {Promise<{success: boolean, event?: object, error?: string}>}
 */
export const getLatestTimeClockEvent = async (employeeId) => {
  if (!employeeId) {
    return {
      success: false,
      error: 'Employee ID is required.'
    };
  }

  try {
    const { data, error } = await supabase?.from('time_clock_events')?.select('*')?.eq('employee_id', employeeId)?.order('event_time', { ascending: false })?.limit(1);

    if (error) {
      console.error('Database query error:', error);
      return {
        success: false,
        error: 'Failed to retrieve time event.'
      };
    }

    return {
      success: true,
      event: data?.[0] || null
    };

  } catch (e) {
    console.error('Service error:', e);
    return {
      success: false,
      error: 'Internal Service Error.'
    };
  }
};

/**
 * Get time clock events for an employee within a date range
 * @param {string} employeeId - The Employee's UUID
 * @param {string} startDate - Start date (ISO string)
 * @param {string} endDate - End date (ISO string)
 * @returns {Promise<{success: boolean, events?: array, error?: string}>}
 */
export const getTimeClockEvents = async (employeeId, startDate, endDate) => {
  if (!employeeId) {
    return {
      success: false,
      error: 'Employee ID is required.'
    };
  }

  try {
    let query = supabase?.from('time_clock_events')?.select('*')?.eq('employee_id', employeeId)?.order('event_time', { ascending: false });

    if (startDate) {
      query = query?.gte('event_time', startDate);
    }

    if (endDate) {
      query = query?.lte('event_time', endDate);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Database query error:', error);
      return {
        success: false,
        error: 'Failed to retrieve time events.'
      };
    }

    return {
      success: true,
      events: data || []
    };

  } catch (e) {
    console.error('Service error:', e);
    return {
      success: false,
      error: 'Internal Service Error.'
    };
  }
};

/**
 * Check if employee is currently clocked in
 * @param {string} employeeId - The Employee's UUID
 * @returns {Promise<{success: boolean, isClockedIn: boolean, lastEvent?: object, error?: string}>}
 */
export const getEmployeeClockStatus = async (employeeId) => {
  const result = await getLatestTimeClockEvent(employeeId);
  
  if (!result?.success) {
    return result;
  }

  const lastEvent = result?.event;
  const isClockedIn = lastEvent?.event_type === 'clock_in';

  return {
    success: true,
    isClockedIn,
    lastEvent
  };
};

/**
 * Calculate work hours for an employee within a date range
 * @param {string} employeeId - The Employee's UUID
 * @param {string} startDate - Start date (ISO string)
 * @param {string} endDate - End date (ISO string)
 * @returns {Promise<{success: boolean, totalHours?: number, shifts?: array, error?: string}>}
 */
export const calculateWorkHours = async (employeeId, startDate, endDate) => {
  const result = await getTimeClockEvents(employeeId, startDate, endDate);
  
  if (!result?.success) {
    return result;
  }

  const events = result?.events || [];
  const shifts = [];
  let totalHours = 0;
  let currentClockIn = null;

  // Process events in chronological order
  const sortedEvents = events?.sort((a, b) => new Date(a.event_time) - new Date(b.event_time));

  for (const event of sortedEvents) {
    if (event?.event_type === 'clock_in') {
      currentClockIn = event;
    } else if (event?.event_type === 'clock_out' && currentClockIn) {
      const clockInTime = new Date(currentClockIn.event_time);
      const clockOutTime = new Date(event.event_time);
      const shiftHours = (clockOutTime - clockInTime) / (1000 * 60 * 60); // Convert to hours

      shifts?.push({
        clockIn: currentClockIn,
        clockOut: event,
        hours: shiftHours
      });

      totalHours += shiftHours;
      currentClockIn = null;
    }
  }

  return {
    success: true,
    totalHours: Math.round(totalHours * 100) / 100, // Round to 2 decimal places
    shifts
  };
};

/**
 * Validate employee exists and has access
 * @param {string} employeeId - The Employee's UUID
 * @returns {Promise<{success: boolean, employee?: object, error?: string}>}
 */
export const validateEmployee = async (employeeId) => {
  if (!employeeId) {
    return {
      success: false,
      error: 'Employee ID is required.'
    };
  }

  try {
    const { data, error } = await supabase?.from('employees')?.select('id, name, access_level, created_at')?.eq('id', employeeId)?.limit(1);

    if (error) {
      console.error('Employee validation error:', error);
      return {
        success: false,
        error: 'Failed to validate employee.'
      };
    }

    if (!data || data?.length === 0) {
      return {
        success: false,
        error: 'Employee not found.'
      };
    }

    return {
      success: true,
      employee: data?.[0]
    };

  } catch (e) {
    console.error('Employee validation error:', e);
    return {
      success: false,
      error: 'Internal Service Error.'
    };
  }
};