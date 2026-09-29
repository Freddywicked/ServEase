// Temporary customer-workspace repository.
// Replace localStorage reads and writes with backend endpoints later.

const STORAGE_KEY = "servease_customer_workspace";

const initialWorkspace = {
  selectedRequestId: "SR-0001",
  requests: [
    { id: "SR-0000", providerName: "Mark Rivera", status: "Sent", cause: "Liquid damage to charging circuit", confidence: 82 },
    { id: "SR-0001", providerName: "Micco Dominic", status: "Approved", quote: { labor: 850, total: 850, description: "This quotation covers the initial service assessment and labor." } },
    { id: "SR-0002", providerName: "Jose Rodolfo", status: "On-going", additionalPayment: { amount: 3000, reason: "Additional parts are required to complete the repair." }, timeline: ["Request received", "Quotation approved", "Service Provider is on the way", "Completed"] },
    { id: "SR-0005", providerName: "Jose Rodolfo", status: "On-going", timeline: ["Request received", "Quotation approved", "Service Provider is on the way", "Completed"] },
    { id: "SR-0006", providerName: "Mark Rivera", status: "Declined", cause: "Liquid damage to charging circuit", confidence: 82 },
    { id: "SR-0003", providerName: "Jose Rodolfo", status: "Done", timeline: ["Request received", "Quotation approved", "Service Provider is on the way", "Completed"] },
  ],
  conversations: [
    { id: "conversation-nick", participant: "Nick Duran", service: "Laptop Screen Repair", online: true, preview: "Hi! Matatagalan pa to since sa Manila pa kukuning yung screen.", messages: [{ id: "message-1", from: "provider", text: "Hi! Matatagalan pa to since sa Manila pa kukuning yung screen.", sentAt: "Jun 24 9:12 AM" }] },
    { id: "conversation-gabriela", participant: "Gabriela Lim", service: "Home Repair", online: false, preview: "Hi Ma’am, send ko na po yung quotation.", messages: [] },
  ],
  history: [],
};

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function addMissingDemoCards(workspace) {
  const missingCards = initialWorkspace.requests.filter(
    (sample) => !workspace.requests.some((request) => request.id === sample.id),
  );

  return missingCards.length
    ? { ...workspace, requests: [...workspace.requests, ...clone(missingCards)] }
    : workspace;
}

function readWorkspace() {
  const storedWorkspace = localStorage.getItem(STORAGE_KEY);
  const workspace = storedWorkspace ? JSON.parse(storedWorkspace) : clone(initialWorkspace);
  const withoutRetiredScheduleDemo = {
    ...workspace,
    requests: workspace.requests.filter((request) => request.id !== "SR-0004"),
  };

  return storedWorkspace
    ? addMissingDemoCards(withoutRetiredScheduleDemo)
    : clone(initialWorkspace);
}

function saveWorkspace(workspace) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(workspace));
  return workspace;
}

function updateRequest(workspace, requestId, changes) {
  return {
    ...workspace,
    requests: workspace.requests.map((request) =>
      request.id === requestId ? { ...request, ...changes } : request,
    ),
  };
}

export const customerWorkspaceApi = {
  async getRequests() {
    return readWorkspace().requests;
  },

  async selectRequest(requestId) {
    const workspace = readWorkspace();
    saveWorkspace({ ...workspace, selectedRequestId: requestId });
  },

  async getSelectedRequest() {
    const workspace = readWorkspace();
    return workspace.requests.find((request) => request.id === workspace.selectedRequestId) || null;
  },

  async updateRequestStatus(requestId, status, changes = {}) {
    const workspace = updateRequest(readWorkspace(), requestId, { status, ...changes });
    saveWorkspace(workspace);
    return workspace.requests.find((request) => request.id === requestId);
  },

  async recordPayment(requestId, method, amount) {
    const workspace = readWorkspace();
    const paidAt = new Date().toISOString();
    const updatedWorkspace = updateRequest(workspace, requestId, {
      payment: { method, amount, paidAt },
      status: "On-going",
    });
    updatedWorkspace.history.unshift({ id: `payment-${paidAt}`, type: "Transaction", requestId, amount, method, createdAt: paidAt });
    saveWorkspace(updatedWorkspace);
    return updatedWorkspace.requests.find((request) => request.id === requestId);
  },

  async getConversations() {
    return readWorkspace().conversations;
  },

  async sendMessage(conversationId, text) {
    const workspace = readWorkspace();
    const message = { id: `message-${Date.now()}`, from: "customer", text, sentAt: "Just now" };
    const updatedWorkspace = {
      ...workspace,
      conversations: workspace.conversations.map((conversation) =>
        conversation.id === conversationId
          ? { ...conversation, preview: text, messages: [...conversation.messages, message] }
          : conversation,
      ),
    };
    saveWorkspace(updatedWorkspace);
    return message;
  },

  async getHistory() {
    return readWorkspace().history;
  },

  async submitReview(requestId, rating, comment) {
    const workspace = readWorkspace();
    const reviewedAt = new Date().toISOString();
    const updatedWorkspace = updateRequest(workspace, requestId, {
      review: { rating, comment, reviewedAt },
    });
    updatedWorkspace.history.unshift({ id: `review-${reviewedAt}`, type: "Repair", requestId, createdAt: reviewedAt });
    saveWorkspace(updatedWorkspace);
  },
};
