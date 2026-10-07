const SHORT_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// "5 min ago", "3 hr ago", "2 days ago" from an ISO timestamp.
export const formatTimeAgo = (isoTimestamp) => {
    const minutes = Math.max(0, Math.floor((Date.now() - new Date(isoTimestamp).getTime()) / 60000));
    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes} min ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours} hr ago`;
    const days = Math.floor(hours / 24);
    return `${days} ${days === 1 ? 'day' : 'days'} ago`;
};

// "Jun 27" from an ISO timestamp.
export const formatShortDate = (isoTimestamp) => {
    const date = new Date(isoTimestamp);
    return `${SHORT_MONTHS[date.getMonth()]} ${date.getDate()}`;
};

// "AI suggests capacitor failure (82% confidence)" — built from the same ai_diagnosis the
// customer saw, so the provider reads the identical diagnosis.
export const formatAiSuggestion = (aiDiagnosis) =>
    aiDiagnosis?.probableCause
        ? `AI suggests ${aiDiagnosis.probableCause.toLowerCase()} (${aiDiagnosis.confidence}% confidence)`
        : null;

// "Jun 24 9:12 AM" from an ISO timestamp.
export const formatDateTime = (isoTimestamp) => {
    const date = new Date(isoTimestamp);
    const hours = date.getHours();
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${SHORT_MONTHS[date.getMonth()]} ${date.getDate()} ${hours % 12 || 12}:${minutes} ${hours >= 12 ? 'PM' : 'AM'}`;
};