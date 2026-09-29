// Frontend-only provider repository. Replace each public method with a backend
// request later; components only depend on this interface, never localStorage.
const storageKey = "servease_provider_demo";

const demoWorkspace = {
  profile: {
    name: "Sylvia Lee",
    role: "Automotive Repair Service Provider",
    initials: "SL",
    verified: true,
    positiveFeedback: "92% Positive Feedback",
    experience: "5 years experience",
    specialties: "IT and Phone Repair",
    location: "Naga City · 2.5 km away",
    availability: "Mon–Fri, 8AM–6PM",
    insights: ["Professional", "Always on Time"],
  },
  serviceRequests: [
    {
      id: "SR-0000",
      status: "new",
      customer: "Dominic Alcantara",
      date: "Jun 27",
      address: "123 Maple St, QC Manila",
      distance: "1.2 km away",
      concern: "The device is not cooling and makes a humming sound.",
      diagnosis: "Capacitor failure",
      confidence: 82,
      possibleCauses: ["Dirty air filter", "Refrigerant leak", "Compressor issue"],
      quote: null,
      rejectionReason: "",
    },
    {
      id: "SR-0001",
      status: "quoted",
      customer: "Nick Duran",
      date: "Jun 27",
      address: "81 Rizal Street, Naga City",
      distance: "1 km away",
      concern: "The screen has visible cracks and flickers when moved.",
      diagnosis: "Drain panel replacement",
      confidence: 91,
      possibleCauses: ["Damaged display", "Loose connector"],
      quote: { labor: 800, parts: 2000, notes: "Parts ordered; installation follows delivery." },
      rejectionReason: "",
    },
  ],
  jobs: [
    {
      id: "SR-0000",
      customer: "Nikki P.",
      date: "Jun 27",
      status: "In Progress",
      stage: "Repairing",
      diagnosis: "LCD problem",
      confidence: 96,
      notes: "Progress payment of ₱500 already paid by customer.",
      updates: [],
      additionalParts: [],
    },
  ],
  earnings: {
    weekly: 8150,
    pending: 1300,
    transactions: [
      { id: "TX-1042", requestId: "SR-0000", customer: "Nikki P.", amount: 2800, status: "Paid" },
      { id: "TX-1043", requestId: "SR-0003", customer: "Jose Rodolfo", amount: 1300, status: "Pending" },
    ],
  },
  calendar: {
    unavailableSlots: [],
  },
  conversations: [
    {
      id: "nick-duran",
      customer: "Nick Duran",
      service: "Laptop Screen Repair",
      online: true,
      preview: "K lang.",
      messages: [{ id: "m1", from: "customer", text: "Hi! Matatagalan pa to since sa Manila pa kukuning yung screen.", timestamp: "Jun 24 9:12 AM" }],
    },
    {
      id: "gabriela-lim",
      customer: "Gabriela Lim",
      service: "Air Conditioner Repair",
      online: false,
      preview: "Hi Ma'am, sinend ko na po yung quotation.",
      messages: [],
    },
  ],
};

const clone = (value) => JSON.parse(JSON.stringify(value));
const read = () => {
  const saved = localStorage.getItem(storageKey);
  return saved ? JSON.parse(saved) : clone(demoWorkspace);
};
const write = (workspace) => localStorage.setItem(storageKey, JSON.stringify(workspace));
const update = (callback) => {
  const workspace = read();
  callback(workspace);
  write(workspace);
  return workspace;
};

export const providerApi = {
  async get() { return read(); },
  async getProfile() { return read().profile; },
  async getServiceRequests() { return read().serviceRequests; },
  async getRequest(id) { return read().serviceRequests.find((request) => request.id === id); },
  async getJobs() { return read().jobs; },
  async getEarnings() { return read().earnings; },
  async getCalendar() { return read().calendar || { unavailableSlots: [] }; },
  async toggleUnavailableSlot(slot) {
    update((workspace) => {
      const calendar = workspace.calendar || { unavailableSlots: [] };
      calendar.unavailableSlots = calendar.unavailableSlots.includes(slot)
        ? calendar.unavailableSlots.filter((item) => item !== slot)
        : [...calendar.unavailableSlots, slot];
      workspace.calendar = calendar;
    });
  },
  async getConversations() { return read().conversations; },
  async updateRequest(id, patch) {
    update((workspace) => {
      workspace.serviceRequests = workspace.serviceRequests.map((request) =>
        request.id === id ? { ...request, ...patch } : request,
      );
    });
  },
  async sendQuote(id, quote) {
    await this.updateRequest(id, { status: "quoted", quote });
  },
  async declineRequest(id, rejectionReason) {
    await this.updateRequest(id, { status: "declined", rejectionReason });
  },
  async updateJob(id, patch) {
    update((workspace) => {
      workspace.jobs = workspace.jobs.map((job) =>
        job.id === id ? { ...job, ...patch } : job,
      );
    });
  },
  async addJobUpdate(id, updateItem) {
    update((workspace) => {
      workspace.jobs = workspace.jobs.map((job) =>
        job.id === id
          ? { ...job, stage: updateItem.stage, updates: [...job.updates, updateItem] }
          : job,
      );
    });
  },
  async requestAdditionalParts(id, request) {
    update((workspace) => {
      workspace.jobs = workspace.jobs.map((job) =>
        job.id === id ? { ...job, additionalParts: [...job.additionalParts, request] } : job,
      );
    });
  },
  async sendMessage(conversationId, text) {
    update((workspace) => {
      workspace.conversations = workspace.conversations.map((conversation) =>
        conversation.id === conversationId
          ? {
              ...conversation,
              preview: text,
              messages: [...conversation.messages, { id: Date.now(), from: "provider", text, timestamp: "Just now" }],
            }
          : conversation,
      );
    });
  },
};
