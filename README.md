# ServEase

Service marketplace connecting customers with local service providers.

## Repository layout

| Folder | Description |
| --- | --- |
| `ServEaseBackend` | Node.js + Express + Supabase REST API shared by both clients. See its [README](ServEaseBackend/README.md) for setup. |
| `ServEaseMobile` | React Native app (Android/iOS). API client lives in `services/api.js`. |
| `ServEaseWeb` | Web client (consumes the same backend API). |
