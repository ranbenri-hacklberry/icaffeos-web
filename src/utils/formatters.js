/**
 * Global Formatters for iCaffeOS
 * Single Source of Truth for LTR/English localized data presentation.
 */

/**
 * Formats a number as USD currency ($ on the left, commas, and decimals).
 * Uses native Intl.NumberFormat for architectural reliability.
 * @param {number|string} amount 
 * @returns {string} Fully formatted currency string
 */
export const formatCurrency = (amount) => {
  const numericAmount = typeof amount === 'string' ? parseFloat(amount) : amount;
  
  if (isNaN(numericAmount)) return '$0.00';

  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(numericAmount);
};

/**
 * Formats a date for the US market (MM/DD/YYYY)
 * @param {Date|string} date 
 * @returns {string} 
 */
export const formatDate = (date) => {
  return new Intl.DateTimeFormat('en-US').format(new Date(date));
};
