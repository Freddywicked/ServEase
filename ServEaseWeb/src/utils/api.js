// API service - ready for NodeJS/Express backend integration
const API_BASE_URL =
  process.env.REACT_APP_API_URL || "http://localhost:5000/api";

export const api = {
  // Auth endpoints
  auth: {
    signin: (credentials) =>
      fetch(`${API_BASE_URL}/auth/signin`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(credentials),
      }).then((res) => res.json()),

    signup: (userData) =>
      fetch(`${API_BASE_URL}/auth/signup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(userData),
      }).then((res) => res.json()),
  },

  // Provider endpoints
  provider: {
    apply: (data) =>
      fetch(`${API_BASE_URL}/providers/apply`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }).then((res) => res.json()),
  },
};
