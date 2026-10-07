const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// 1500 -> '₱1,500', 950.5 -> '₱950.50'. Returns '–' when there is no value.
export const formatPeso = (value) => {
    const amount = Number(value);
    if (value === null || value === undefined || value === '' || Number.isNaN(amount)) return '–';
    const [whole, decimals] = amount.toFixed(2).split('.');
    const withCommas = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    return `₱${withCommas}${decimals === '00' ? '' : `.${decimals}`}`;
};

// ISO string -> 'Jun 27'
export const formatShortDate = (value) => {
    const date = new Date(value);
    if (!value || Number.isNaN(date.getTime())) return '';
    return `${MONTHS[date.getMonth()]} ${date.getDate()}`;
};

// ISO string -> 'Jun 24 9:12 AM'
export const formatDateTime = (value) => {
    const date = new Date(value);
    if (!value || Number.isNaN(date.getTime())) return '';
    const hours = date.getHours();
    const suffix = hours >= 12 ? 'PM' : 'AM';
    const hour12 = hours % 12 === 0 ? 12 : hours % 12;
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${formatShortDate(value)} ${hour12}:${minutes} ${suffix}`;
};