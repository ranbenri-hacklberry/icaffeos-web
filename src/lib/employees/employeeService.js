import { supabase } from '@/lib/supabase';

/**
 * Login employee with phone and PIN
 * @param {string} phone - WhatsApp phone number
 * @param {string} pin - 4 digit PIN
 * @returns {Promise<{success: boolean, employee?: object, message?: string}>}
 */
export async function loginEmployee(phone, pin) {
    try {
        const { data, error } = await supabase.rpc('handle_employee_login', {
            p_phone: phone,
            p_pin: pin
        });

        if (error) throw error;
        return data;
    } catch (error) {
        console.error('Login error:', error);
        return { success: false, message: error.message };
    }
}

/**
 * Clock in/out an employee
 * @param {string} employeeId 
 * @param {'clock_in' | 'clock_out'} eventType 
 * @returns {Promise<{success: boolean, status?: string, message?: string}>}
 */
export async function clockEvent(employeeId, eventType) {
    try {
        const { data, error } = await supabase.rpc('handle_clock_event', {
            p_employee_id: employeeId,
            p_event_type: eventType
        });

        if (error) throw error;
        return data;
    } catch (error) {
        console.error('Clock event error:', error);
        return { success: false, message: error.message };
    }
}

/**
 * Get current shift status for an employee
 * @param {string} employeeId 
 * @returns {Promise<{is_clocked_in: boolean, clock_in_time?: string}>}
 */
export async function getShiftStatus(employeeId) {
    try {
        const { data, error } = await supabase.rpc('get_employee_shift_status', {
            p_employee_id: employeeId
        });

        if (error) throw error;
        return data;
    } catch (error) {
        console.error('Get shift status error:', error);
        return { is_clocked_in: false };
    }
}
