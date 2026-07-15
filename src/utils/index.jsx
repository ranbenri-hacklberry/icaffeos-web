const errorHandler = (error, message = 'An error occurred') => {
    console.error(message, error);
    
    if (error?.message) {
        throw new Error(error.message);
    }
    
    throw new Error(message);
};

/**
 * Utility function to format display names
 * @param {string} name - Name to format
 * @returns {string} - Formatted name
 */
const formatDisplayName = (name) => {
    if (!name) return '';
    
    return name?.toLowerCase()?.split(' ')?.map(word => word?.charAt(0)?.toUpperCase() + word?.slice(1))?.join(' ');
};

/**
 * Utility function to format currency
 * @param {number} amount - Amount to format
 * @param {string} currency - Currency symbol (default ₪)
 * @returns {string} - Formatted currency string
 */
const formatCurrency = (amount, currency = '₪') => {
    if (typeof amount !== 'number') return `0 ${currency}`;
    
    return `${amount?.toFixed(2)} ${currency}`;
};

/**
 * Utility function to format date/time
 * @param {Date|string} date - Date to format
 * @param {string} locale - Locale for formatting (default 'he-IL')
 * @returns {string} - Formatted date string
 */
const formatDateTime = (date, locale = 'he-IL') => {
    if (!date) return '';
    
    const dateObj = date instanceof Date ? date : new Date(date);
    
    return dateObj?.toLocaleString(locale, {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
    });
};

/**
 * Utility function to format time only
 * @param {Date|string} date - Date to format
 * @param {string} locale - Locale for formatting (default 'he-IL')
 * @returns {string} - Formatted time string
 */
const formatTime = (date, locale = 'he-IL') => {
    if (!date) return '';
    
    const dateObj = date instanceof Date ? date : new Date(date);
    
    return dateObj?.toLocaleTimeString(locale, {
        hour: '2-digit',
        minute: '2-digit'
    });
};

/**
 * Utility function to format date only
 * @param {Date|string} date - Date to format
 * @param {string} locale - Locale for formatting (default 'he-IL')
 * @returns {string} - Formatted date string
 */
const formatDate = (date, locale = 'he-IL') => {
    if (!date) return '';
    
    const dateObj = date instanceof Date ? date : new Date(date);
    
    return dateObj?.toLocaleDateString(locale, {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    });
};

/**
 * Utility function to calculate duration between two dates
 * @param {Date|string} startDate - Start date
 * @param {Date|string} endDate - End date
 * @returns {object} - Duration in hours, minutes, and formatted string
 */
const calculateDuration = (startDate, endDate) => {
    if (!startDate || !endDate) return { hours: 0, minutes: 0, formatted: '0:00' };
    
    const start = startDate instanceof Date ? startDate : new Date(startDate);
    const end = endDate instanceof Date ? endDate : new Date(endDate);
    
    const diffMs = end - start;
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffMinutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    
    const formatted = `${diffHours}:${diffMinutes?.toString()?.padStart(2, '0')}`;
    
    return {
        hours: diffHours,
        minutes: diffMinutes,
        formatted,
        totalHours: diffHours + diffMinutes / 60
    };
};

/**
 * Utility function to generate unique IDs
 * @returns {string} - Unique ID
 */
const generateId = () => {
    return Date.now()?.toString(36) + Math.random()?.toString(36)?.substr(2);
};

/**
 * Utility function to validate email format
 * @param {string} email - Email to validate
 * @returns {boolean} - Whether email is valid
 */
const isValidEmail = (email) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex?.test(email);
};

/**
 * Utility function to debounce function calls
 * @param {Function} func - Function to debounce
 * @param {number} wait - Wait time in milliseconds
 * @returns {Function} - Debounced function
 */
const debounce = (func, wait) => {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
};

/**
 * Utility function to safely parse JSON
 * @param {string} jsonString - JSON string to parse
 * @param {any} fallback - Fallback value if parsing fails
 * @returns {any} - Parsed JSON or fallback
 */
const safeJsonParse = (jsonString, fallback = null) => {
    try {
        return JSON.parse(jsonString);
    } catch (error) {
        console.warn('Failed to parse JSON:', error);
        return fallback;
    }
};

/**
 * Utility function to safely stringify JSON
 * @param {any} data - Data to stringify
 * @param {string} fallback - Fallback value if stringify fails
 * @returns {string} - JSON string or fallback
 */
const safeJsonStringify = (data, fallback = '{}') => {
    try {
        return JSON.stringify(data);
    } catch (error) {
        console.warn('Failed to stringify JSON:', error);
        return fallback;
    }
};

/**
 * Utility function to capitalize first letter
 * @param {string} str - String to capitalize
 * @returns {string} - Capitalized string
 */
const capitalize = (str) => {
    if (!str) return '';
    return str?.charAt(0)?.toUpperCase() + str?.slice(1);
};

/**
 * Utility function to truncate text
 * @param {string} text - Text to truncate
 * @param {number} maxLength - Maximum length
 * @returns {string} - Truncated text
 */
const truncateText = (text, maxLength = 100) => {
    if (!text || text?.length <= maxLength) return text;
    return text?.slice(0, maxLength) + '...';
};

/**
 * Utility function to get session storage data safely
 * @param {string} key - Storage key
 * @param {any} fallback - Fallback value
 * @returns {any} - Parsed data or fallback
 */
const getSessionData = (key, fallback = null) => {
    try {
        const data = sessionStorage.getItem(key);
        return data ? safeJsonParse(data, fallback) : fallback;
    } catch (error) {
        console.warn('Failed to get session data:', error);
        return fallback;
    }
};

/**
 * Utility function to set session storage data safely
 * @param {string} key - Storage key
 * @param {any} data - Data to store
 * @returns {boolean} - Success status
 */
const setSessionData = (key, data) => {
    try {
        sessionStorage.setItem(key, safeJsonStringify(data));
        return true;
    } catch (error) {
        console.warn('Failed to set session data:', error);
        return false;
    }
};

export {
    errorHandler,
    formatDisplayName,
    formatCurrency,
    formatDateTime,
    formatTime,
    formatDate,
    calculateDuration,
    generateId,
    isValidEmail,
    debounce,
    safeJsonParse,
    safeJsonStringify,
    capitalize,
    truncateText,
    getSessionData,
    setSessionData
};