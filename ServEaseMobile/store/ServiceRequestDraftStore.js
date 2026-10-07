import { create } from 'zustand';

// Shared draft for the 5-screen "Create Service Request" flow:
// CreateServiceRequest -> AIDiagnosis -> AIResult -> RecommendServiceProvider -> SubmitServiceRequest
// Every screen reads/writes this store instead of passing ever-growing route.params.

// Used as the Idempotency-Key / clientRequestId so a double tap or a retry after a
// network drop can't create two SERVICE_REQUEST rows for the same draft.
const newClientRequestId = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

const emptyDraft = () => ({
    clientRequestId: newClientRequestId(),
    categoryKey: null,        // matches SERVICE_REQUEST.category (key from GET /categories)
    description: '',
    photoUri: null,           // local file URI, for preview only
    photoPath: null,          // Storage path returned by the upload (the bucket is private, like the provider
                              // documents, so the backend signs short-lived URLs on read) -> SERVICE_REQUEST_ATTACHMENT.file_url
    location: null,           // { latitude, longitude, address, mapImageUri }
    preferredDate: null,      // 'YYYY-MM-DD' -> SERVICE_REQUEST.preferred_date
    preferredTime: null,      // 'HH:mm' (slot value from the backend) -> SERVICE_REQUEST.preferred_time
    aiDiagnosis: null,        // { probableCause, confidence, tags[], troubleshootingSteps[] }
    providerId: null,
    providerName: null,       // display only (confirmation screen)
    submittedRequestId: null, // request_id returned by POST /service-requests
});

export const useServiceRequestDraftStore = create((set) => ({
    ...emptyDraft(),
    setDraft: (partial) => set(partial),
    resetDraft: () => set(emptyDraft()),
}));