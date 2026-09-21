// Temporary frontend repository. Replace each async method with backend calls when the API is ready.
const storageKey = "servease_customer_demo";
const seed = {
  requests: [
    {
      id: "SR-0000",
      status: "sent",
      category: "Phone Device",
      problem: "Screen cracked",
      provider: "Mark Rivera",
      confidence: 82,
    },
  ],
  messages: [
    {
      id: 1,
      from: "Nick Duran",
      text: "Hi! Matatagalang pa to since sa Manila pa kukuning yung screen.",
      sentAt: "Jun 24 9:12 AM",
    },
  ],
};
const load = () =>
  JSON.parse(localStorage.getItem(storageKey) || JSON.stringify(seed));
const save = (value) => localStorage.setItem(storageKey, JSON.stringify(value));
export const customerApi = {
  async createRequest(payload) {
    const data = load();
    const request = {
      id: `SR-${String(data.requests.length + 1).padStart(4, "0")}`,
      status: "sent",
      confidence: 82,
      ...payload,
    };
    data.requests.unshift(request);
    save(data);
    return request;
  },
  async getRequests() {
    return load().requests;
  },
  async updateRequest(id, patch) {
    const data = load();
    data.requests = data.requests.map((request) =>
      request.id === id ? { ...request, ...patch } : request,
    );
    save(data);
    return data.requests.find((request) => request.id === id);
  },
  async getMessages() {
    return load().messages;
  },
  async sendMessage(message) {
    const data = load();
    const item = {
      id: Date.now(),
      from: "You",
      text: message,
      sentAt: "Just now",
    };
    data.messages.push(item);
    save(data);
    return item;
  },
};
