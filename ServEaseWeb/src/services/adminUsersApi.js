// Temporary data adapter for the Admin UI.
// Replace the storage helpers with HTTP requests when the backend is available.

const STORAGE_KEY = "servease_admin_users";

const demoUsers = [
  {
    id: "usr-001",
    name: "Juan dela Cruz",
    email: "1234@gmail.com",
    address: "Barangay Sakdol",
    phone: "1234567",
    birthdate: "1/1/1999",
    role: "Customer",
    status: "Active",
    registeredAt: "09/25/2026",
  },
  {
    id: "usr-002",
    name: "Juan dela Cruz",
    email: "provider.juan@gmail.com",
    address: "Barangay Sakdol",
    phone: "1234567",
    birthdate: "1/1/1997",
    role: "Service Provider",
    status: "Pending",
    registeredAt: "09/25/2026",
    providerProfile: {
      serviceCategory: "Home Repair",
      yearsOfExperience: 1,
      servicesOffered: [
        "Plumbing",
        "Home Appliance Renovation",
        "Electrician",
      ],
      documents: {
        validId: {
          name: "juan-dela-cruz-valid-id.svg",
          url: "/demo-documents/juan-valid-id.svg",
          mimeType: "image/svg+xml",
        },
        supportingDocument: {
          name: "juan-dela-cruz-certificate.svg",
          url: "/demo-documents/juan-supporting-document.svg",
          mimeType: "image/svg+xml",
        },
        selfie: {
          name: "juan-dela-cruz-selfie.svg",
          url: "/demo-documents/juan-selfie.svg",
          mimeType: "image/svg+xml",
        },
      },
    },
  },
  {
    id: "usr-003",
    name: "Maria Santos",
    email: "maria.santos@gmail.com",
    address: "Naga City",
    phone: "09171234567",
    birthdate: "4/12/1994",
    role: "Customer",
    status: "Active",
    registeredAt: "09/24/2026",
  },
  {
    id: "usr-004",
    name: "Mark Rivera",
    email: "mark.rivera@gmail.com",
    address: "Pili, Camarines Sur",
    phone: "09181234567",
    birthdate: "8/20/1990",
    role: "Service Provider",
    status: "Active",
    registeredAt: "09/23/2026",
    providerProfile: {
      serviceCategory: "Phone Repair",
      yearsOfExperience: 5,
      servicesOffered: ["Screen replacement", "Battery replacement"],
      documents: {
        validId: {
          name: "mark-rivera-valid-id.svg",
          url: "/demo-documents/juan-valid-id.svg",
          mimeType: "image/svg+xml",
        },
        supportingDocument: {
          name: "mark-rivera-certificate.svg",
          url: "/demo-documents/juan-supporting-document.svg",
          mimeType: "image/svg+xml",
        },
        selfie: {
          name: "mark-rivera-selfie.svg",
          url: "/demo-documents/juan-selfie.svg",
          mimeType: "image/svg+xml",
        },
      },
    },
  },
  {
    id: "usr-005",
    name: "Ana Reyes",
    email: "ana.reyes@gmail.com",
    address: "Goa, Camarines Sur",
    phone: "09191234567",
    birthdate: "11/4/1996",
    role: "Customer",
    status: "Active",
    registeredAt: "09/22/2026",
  },
];

function cloneDemoUsers() {
  return JSON.parse(JSON.stringify(demoUsers));
}

function normalizeDocuments(documents = {}) {
  const previewUrls = {
    validId: "/demo-documents/juan-valid-id.svg",
    supportingDocument: "/demo-documents/juan-supporting-document.svg",
    selfie: "/demo-documents/juan-selfie.svg",
  };

  return Object.fromEntries(
    Object.entries(documents).map(([key, document]) => [
      key,
      typeof document === "string"
        ? {
            name: document,
            url: previewUrls[key],
            mimeType: "image/svg+xml",
          }
        : document,
    ]),
  );
}

function normalizeUsers(users) {
  return users.map((user) => {
    if (!user.providerProfile) return user;

    return {
      ...user,
      providerProfile: {
        ...user.providerProfile,
        documents: normalizeDocuments(user.providerProfile.documents),
      },
    };
  });
}

function readUsers() {
  const savedUsers = localStorage.getItem(STORAGE_KEY);

  const users = savedUsers ? JSON.parse(savedUsers) : cloneDemoUsers();

  return normalizeUsers(users);
}

function saveUsers(users) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(users));
}

export const adminUsersApi = {
  async getUsers() {
    return readUsers();
  },

  async updateUserStatus(userId, status, rejectionReason = "") {
    const users = readUsers();
    const updatedUsers = users.map((user) =>
      user.id === userId
        ? { ...user, status, rejectionReason }
        : user,
    );

    saveUsers(updatedUsers);

    return updatedUsers.find((user) => user.id === userId);
  },
};
