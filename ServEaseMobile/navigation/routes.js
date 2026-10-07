// Single source of truth for screen names used by the service-request flow.
// Every value here MUST match the name the screen is registered under in your
// navigator (Stack.Screen name="..."). Previously the screens disagreed
// ('CustomerHome' vs 'CustomerDashboard', 'Find' vs 'RecommendServiceProvider',
// 'CreateServiceRequestStepTwo' vs 'AIDiagnosis'), so some buttons navigated
// to screens that were never registered.
export const ROUTES = {
    // App.js registers this screen as 'CustomerDashboard' — the value must match the
    // Stack.Screen name exactly, or navigate() throws "was not handled by any navigator".
    CUSTOMER_HOME: 'CustomerDashboard',
    NOTIFICATIONS: 'Notifications',
    TRACK: 'Track',
    REQUEST_DETAILS: 'RequestDetails',
    CONVERSATION: 'Conversation',
    PAYMENT: 'Payment',
    CREATE_SERVICE_REQUEST: 'CreateServiceRequest',
    AI_DIAGNOSIS: 'AIDiagnosis',
    AI_RESULT: 'AIResult',
    RECOMMEND_SERVICE_PROVIDER: 'RecommendServiceProvider',
    SUBMIT_SERVICE_REQUEST: 'SubmitServiceRequest',

    // Service Provider app
    SERVICE_PROVIDER_DASHBOARD: 'ServiceProviderDashboard',
    INCOMING_SERVICE_REQUEST: 'IncomingServiceRequest',
    VIEW_SERVICE_REQUEST: 'ViewServiceRequest',
    MANAGE_CALENDAR: 'ManageCalendar',
};