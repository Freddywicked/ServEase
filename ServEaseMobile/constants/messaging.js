// Shared values for the Messages / Conversation screens (customer and provider).

// How often an open thread checks for new messages (ms). Replace the polling with a
// realtime subscription (Supabase Realtime / FCM) once that is enabled.
export const POLL_INTERVAL_MS = 5000;

// Values of `sender` returned by GET /conversations/:id/messages.
export const SENDER = {
    CUSTOMER: 'customer',
    PROVIDER: 'provider',
};

// Navigation route names.
export const ROUTES = {
    CONVERSATION_CUSTOMER: 'ConversationCustomer',
    CONVERSATION_PROVIDER: 'ConversationServiceProvider',
};

export const AVATAR_URL_PATTERN = /^https?:\/\//;

export const TEXT = {
    messagesTitle: 'Messages',
    loadMessagesFailed: "Couldn't load messages. Tap to retry.",
    loadConversationsFailed: "Couldn't load your messages. Tap to retry.",
    noMessagesYet: 'No messages yet',
    noMessagesSayHi: 'No messages yet — say hi!',
    messagePlaceholder: 'Type a message...',
    send: 'Send',
    online: 'Online',
    offline: 'Offline',
    defaultProviderName: 'Service provider',
    defaultConversationName: 'Conversation',
    messageNotSentTitle: 'Message not sent',
    messageNotSentFallback: 'Please check your connection and try again.',
    aboutRequest: (requestId) => `About your request ${requestId}`,
};