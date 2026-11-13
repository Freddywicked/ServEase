// Shared helpers for the "Send OTP" -> "Verify OTP" flow.
// Everything here is derived from what the user typed on SignupScreen, nothing is hard-coded.

export const OTP_CHANNELS = { SMS: 'sms', EMAIL: 'email' };

export const isValidChannel = (channel) => Object.values(OTP_CHANNELS).includes(channel);

// "09171236789" or "+639171236789" -> "*** *** 6789"
export const maskPhone = (phone) => {
    const digits = String(phone || '').replace(/\D/g, '');
    return digits.length >= 4 ? `*** *** ${digits.slice(-4)}` : '';
};

// "marvin.o@gmail.com" -> "m************o@gmail.com"
export const maskEmail = (email) => {
    const [local, domain] = String(email || '').trim().split('@');
    if (!local || !domain) return '';
    if (local.length <= 2) return `${local[0]}*@${domain}`;
    return `${local[0]}${'*'.repeat(12)}${local[local.length - 1]}@${domain}`;
};

// Masked destination for a channel, taken from the signup form.
export const maskedDestination = (channel, form) =>
    channel === OTP_CHANNELS.EMAIL ? maskEmail(form?.email) : maskPhone(form?.phone);