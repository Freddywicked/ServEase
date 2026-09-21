// Frontend-only provider repository. Replace these methods with backend calls later.
const key = "servease_provider_demo";
const seed = {
  requests: [
    {
      id: "SR-0000",
      customer: "Dominic Alcantara",
      status: "new",
      concern: "Device is not cooling and makes a humming sound.",
      distance: "1.2 km away",
      diagnosis: "AI suggests capacitor failure (82% confidence)",
    },
  ],
  jobs: [
    {
      id: "SR-0000",
      customer: "Nikki P.",
      status: "Repairing",
      notes: "Progress Payment 500 already paid by customer",
    },
  ],
  messages: [],
};
const read = () =>
  JSON.parse(localStorage.getItem(key) || JSON.stringify(seed));
const write = (data) => localStorage.setItem(key, JSON.stringify(data));
export const providerApi = {
  async get() {
    return read();
  },
  async updateRequest(id, patch) {
    const data = read();
    data.requests = data.requests.map((x) =>
      x.id === id ? { ...x, ...patch } : x,
    );
    write(data);
  },
  async updateJob(id, patch) {
    const data = read();
    data.jobs = data.jobs.map((x) => (x.id === id ? { ...x, ...patch } : x));
    write(data);
  },
  async sendMessage(text) {
    const data = read();
    data.messages.push({ id: Date.now(), text, from: "You" });
    write(data);
  },
};
