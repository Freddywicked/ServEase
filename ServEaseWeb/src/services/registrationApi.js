// Frontend registration adapter.
// Replace localStorage calls with backend requests when the API is available.

const STORAGE_KEY = "servease_registration";
const DEMO_VERIFICATION_CODE = "123456";

function createEmptyRegistration() {
  return {
    profile: null,
    role: null,
    phoneVerified: false,
    providerApplication: null,
  };
}

function readRegistration() {
  const savedRegistration = localStorage.getItem(STORAGE_KEY);

  return savedRegistration ? JSON.parse(savedRegistration) : null;
}

function saveRegistration(registration) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(registration));
  return registration;
}

function toFileMetadata(file) {
  if (!file) return null;

  return {
    name: file.name,
    mimeType: file.type,
    size: file.size,
  };
}

export const registrationApi = {
  async startRegistration(profile) {
    return saveRegistration({ ...createEmptyRegistration(), profile });
  },

  async verifyPhone(code) {
    if (code !== DEMO_VERIFICATION_CODE) {
      throw new Error("Enter the demo verification code: 123456.");
    }

    const registration = readRegistration() || createEmptyRegistration();
    return saveRegistration({ ...registration, phoneVerified: true });
  },

  async selectRole(role) {
    const registration = readRegistration() || createEmptyRegistration();
    return saveRegistration({ ...registration, role });
  },

  async saveProviderDetails(providerDetails) {
    const registration = readRegistration() || createEmptyRegistration();
    const providerApplication = registration.providerApplication || {};

    return saveRegistration({
      ...registration,
      providerApplication: {
        ...providerApplication,
        ...providerDetails,
      },
    });
  },

  async submitProviderApplication({ documents, agreements }) {
    const registration = readRegistration() || createEmptyRegistration();
    const providerApplication = registration.providerApplication || {};

    return saveRegistration({
      ...registration,
      providerApplication: {
        ...providerApplication,
        documents: {
          validId: toFileMetadata(documents.validId),
          selfie: toFileMetadata(documents.selfie),
          supportingDocument: toFileMetadata(documents.supportingDocument),
        },
        agreements,
        status: "Pending",
        submittedAt: new Date().toISOString(),
      },
    });
  },

  async getRegistration() {
    return readRegistration();
  },
};
