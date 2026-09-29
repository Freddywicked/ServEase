// Frontend data adapter for the customer request flow.
// Replace these localStorage helpers with backend requests when available.

const STORAGE_KEY = "servease_customer_flow";

const demoProviders = [
  {
    id: "provider-sylvia-lee",
    name: "Sylvia Lee",
    serviceType: "Automotive Repair",
    categories: ["Automotive"],
    location: "Panganiban Drive, Naga City",
    distance: "2.5 km away",
    rating: 4.8,
    reviewCount: 95,
    yearsOfExperience: 5,
    verified: true,
    available: true,
    schedule: "Mon–Fri, 8AM–6PM",
    positiveFeedback: "92% Positive Feedback",
    specialties: ["IT and Phone Repair"],
    insights: ["Professional", "Always on Time"],
    reviews: [
      {
        author: "N**** O*ea",
        service: "Engine Repair",
        comment: "The technician was on time. They did a great job providing their service.",
      },
      {
        author: "N**** O*ea",
        service: "Engine Repair",
        comment: "The technician was on time. They did a great job providing their service.",
      },
    ],
  },
  {
    id: "provider-mark-rivera",
    name: "Mark Rivera",
    serviceType: "Phone Repair",
    categories: ["Phone Device", "IT-Related Devices"],
    location: "Naga City",
    distance: "1.8 km away",
    rating: 4.8,
    reviewCount: 95,
    yearsOfExperience: 5,
    verified: true,
    available: true,
    schedule: "Mon–Fri, 8AM–6PM",
    positiveFeedback: "95% Positive Feedback",
    specialties: ["IT and Phone Repair"],
    insights: ["Fast response", "Professional"],
    reviews: [],
  },
  {
    id: "provider-jason-tatum",
    name: "Jason Tatum",
    serviceType: "Phone Repair",
    categories: ["Phone Device"],
    location: "Naga City",
    distance: "2.1 km away",
    rating: 4.8,
    reviewCount: 95,
    yearsOfExperience: 5,
    verified: true,
    available: true,
    schedule: "Mon–Fri, 8AM–6PM",
    positiveFeedback: "90% Positive Feedback",
    specialties: ["IT and Phone Repair"],
    insights: ["Always on Time"],
    reviews: [],
  },
  {
    id: "provider-john-doe",
    name: "John Doe",
    serviceType: "Home Repair",
    categories: ["Home Repair"],
    location: "Naga City",
    distance: "3.2 km away",
    rating: 4.7,
    reviewCount: 77,
    yearsOfExperience: 4,
    verified: true,
    available: true,
    schedule: "Mon–Sat, 9AM–5PM",
    positiveFeedback: "88% Positive Feedback",
    specialties: ["Home Repair"],
    insights: ["Detail oriented"],
    reviews: [],
  },
];

const initialState = {
  draftRequest: null,
  requests: [],
  providers: demoProviders,
};

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function readState() {
  const savedState = localStorage.getItem(STORAGE_KEY);
  return savedState ? JSON.parse(savedState) : clone(initialState);
}

function saveState(state) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  return state;
}

function getCustomerName() {
  const registration = JSON.parse(
    localStorage.getItem("servease_registration") || "null",
  );

  return registration?.profile?.fullName || "Juan";
}

function getStartOfToday() {
  const today = new Date();

  return new Date(today.getFullYear(), today.getMonth(), today.getDate());
}

function getAvailableDays(year, month) {
  const today = getStartOfToday();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const availableDays = [];

  for (let day = 1; day <= daysInMonth; day += 1) {
    const date = new Date(year, month, day);
    const weekday = date.getDay();
    const isWeekday = weekday >= 1 && weekday <= 5;
    const isWithinBookingWindow = date >= today && date <= new Date(
      today.getFullYear(),
      today.getMonth() + 3,
      today.getDate(),
    );

    if (isWeekday && isWithinBookingWindow) availableDays.push(day);
  }

  return availableDays;
}

export const customerFlowApi = {
  async getDashboard() {
    const state = readState();
    const activeRequest = state.requests.find(
      (request) => request.status === "Accepted" || request.status === "In Progress",
    );

    return {
      customerName: getCustomerName(),
      notifications: [],
      activeRequest: activeRequest || null,
    };
  },

  async getRequestSetup() {
    return {
      categories: [
        "Home Repair",
        "Automotive",
        "IT-Related Devices",
        "Phone Device",
      ],
    };
  },

  async getAppointmentAvailability({ year, month }) {
    return {
      year,
      month,
      availableDays: getAvailableDays(year, month),
      timeSlots: ["9:00 AM", "10:00 AM", "11:00 AM", "1:00 PM", "2:00 PM"],
    };
  },

  async saveDraftRequest(draftRequest) {
    const state = readState();
    return saveState({ ...state, draftRequest });
  },

  async getDraftRequest() {
    return readState().draftRequest;
  },

  async getDiagnosis(draftRequest) {
    const diagnosisByCategory = {
      "Phone Device": {
        cause: "Liquid damage to charging circuit",
        confidence: 82,
        checks: ["Power jack", "Motherboard Check", "Safety test"],
      },
      "IT-Related Devices": {
        cause: "Potential power-delivery fault",
        confidence: 78,
        checks: ["Power adapter", "Battery health", "Port inspection"],
      },
      Automotive: {
        cause: "Possible electrical-system issue",
        confidence: 75,
        checks: ["Battery check", "Fuse inspection", "Diagnostic scan"],
      },
      "Home Repair": {
        cause: "Likely component wear or connection issue",
        confidence: 71,
        checks: ["Visual inspection", "Safety test", "Part assessment"],
      },
    };

    return diagnosisByCategory[draftRequest.category] || diagnosisByCategory["Home Repair"];
  },

  async getProviders({ category, query = "" } = {}) {
    const normalizedQuery = query.trim().toLowerCase();

    return readState().providers.filter((provider) => {
      const matchesCategory = !category || provider.categories.includes(category);
      const searchableText = [
        provider.name,
        provider.serviceType,
        ...provider.specialties,
        ...provider.categories,
      ]
        .join(" ")
        .toLowerCase();

      return matchesCategory && searchableText.includes(normalizedQuery);
    });
  },

  async getProvider(providerId) {
    return readState().providers.find((provider) => provider.id === providerId) || null;
  },

  async chooseProvider(providerId) {
    const state = readState();
    const provider = state.providers.find((item) => item.id === providerId);

    if (!provider || !state.draftRequest) return null;

    const request = {
      ...state.draftRequest,
      id: `SR-${String(state.requests.length + 1).padStart(4, "0")}`,
      providerId,
      providerName: provider.name,
      status: "Sent",
      createdAt: new Date().toISOString(),
    };

    saveState({
      ...state,
      draftRequest: null,
      requests: [request, ...state.requests],
    });

    return request;
  },
};
