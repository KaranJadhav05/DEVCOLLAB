// Service-Specific API configurations with dedicated service ports
const AUTH_BASE_URL = (import.meta.env.VITE_AUTH_SERVICE_URL || "http://localhost:5001") + "/api";
const PROJECT_BASE_URL = (import.meta.env.VITE_PROJECT_SERVICE_URL || "http://localhost:5002") + "/api";
const MESSAGING_BASE_URL = (import.meta.env.VITE_MESSAGING_SERVICE_URL || "http://localhost:5003") + "/api";
const NOTIFICATION_BASE_URL = (import.meta.env.VITE_NOTIFICATION_SERVICE_URL || "http://localhost:5004") + "/api";
const GATEWAY_BASE_URL = (import.meta.env.VITE_BASE_URL || "http://localhost:5000/api");

const getAuthHeader = () => {
  const token = localStorage.getItem("token");
  return token ? { Authorization: `Bearer ${token}` } : {};
};

const handleResponse = async (res) => {
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || "Something went wrong");
  return data;
};

// ─── Service 1: Authentication & User Management (Port: 5001) ─────────────────
export const authAPI = {
  register: (data) =>
    fetch(`${AUTH_BASE_URL}/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    }).then(handleResponse),

  login: (data) =>
    fetch(`${AUTH_BASE_URL}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    }).then(handleResponse),

  me: () =>
    fetch(`${AUTH_BASE_URL}/auth/me`, {
      headers: { ...getAuthHeader() },
    }).then(handleResponse),
};

export const userAPI = {
  getAll: () =>
    fetch(`${AUTH_BASE_URL}/users`, {
      headers: { ...getAuthHeader() },
    }).then(handleResponse),

  getById: (id) =>
    fetch(`${AUTH_BASE_URL}/users/${id}`, {
      headers: { ...getAuthHeader() },
    }).then(handleResponse),

  updateProfile: (data) =>
    fetch(`${AUTH_BASE_URL}/users/profile`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", ...getAuthHeader() },
      body: JSON.stringify(data),
    }).then(handleResponse),
};

// ─── Service 2: Project & Collaboration Management (Port: 5002) ───────────────
export const projectAPI = {
  getAll: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return fetch(`${PROJECT_BASE_URL}/projects${qs ? `?${qs}` : ""}`, {
      headers: { ...getAuthHeader() },
    }).then(handleResponse);
  },

  getMy: () =>
    fetch(`${PROJECT_BASE_URL}/projects/my`, {
      headers: { ...getAuthHeader() },
    }).then(handleResponse),

  getById: (id) =>
    fetch(`${PROJECT_BASE_URL}/projects/${id}`, {
      headers: { ...getAuthHeader() },
    }).then(handleResponse),

  create: (data) =>
    fetch(`${PROJECT_BASE_URL}/projects`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...getAuthHeader() },
      body: JSON.stringify(data),
    }).then(handleResponse),

  update: (id, data) =>
    fetch(`${PROJECT_BASE_URL}/projects/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", ...getAuthHeader() },
      body: JSON.stringify(data),
    }).then(handleResponse),

  delete: (id) =>
    fetch(`${PROJECT_BASE_URL}/projects/${id}`, {
      method: "DELETE",
      headers: { ...getAuthHeader() },
    }).then(handleResponse),
};

export const requestAPI = {
  send: (data) =>
    fetch(`${PROJECT_BASE_URL}/requests`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...getAuthHeader() },
      body: JSON.stringify(data),
    }).then(handleResponse),

  getIncoming: () =>
    fetch(`${PROJECT_BASE_URL}/requests/incoming`, {
      headers: { ...getAuthHeader() },
    }).then(handleResponse),

  getSent: () =>
    fetch(`${PROJECT_BASE_URL}/requests/sent`, {
      headers: { ...getAuthHeader() },
    }).then(handleResponse),

  handle: (id, action) =>
    fetch(`${PROJECT_BASE_URL}/requests/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", ...getAuthHeader() },
      body: JSON.stringify({ action }),
    }).then(handleResponse),
};

// ─── Service 3: Messaging & WebRTC Stream Service (Port: 5003) ────────────────
export const messageAPI = {
  getConversations: () =>
    fetch(`${MESSAGING_BASE_URL}/messages/conversations`, {
      headers: { ...getAuthHeader() },
    }).then(handleResponse),

  getMessages: (userId) =>
    fetch(`${MESSAGING_BASE_URL}/messages/${userId}`, {
      headers: { ...getAuthHeader() },
    }).then(handleResponse),

  send: (data) =>
    fetch(`${MESSAGING_BASE_URL}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...getAuthHeader() },
      body: JSON.stringify(data),
    }).then(handleResponse),
};

// ─── Service 4: Real-Time Notification Service (Port: 5004) ──────────────────
export const notificationAPI = {
  getAll: () =>
    fetch(`${NOTIFICATION_BASE_URL}/notifications`, {
      headers: { ...getAuthHeader() },
    }).then(handleResponse),

  markAsRead: (id) =>
    fetch(`${NOTIFICATION_BASE_URL}/notifications/${id}/read`, {
      method: "PUT",
      headers: { ...getAuthHeader() },
    }).then(handleResponse),

  markAllAsRead: () =>
    fetch(`${NOTIFICATION_BASE_URL}/notifications/read-all`, {
      method: "PUT",
      headers: { ...getAuthHeader() },
    }).then(handleResponse),
};

// ─── API Gateway: System Health & Cluster Status (Port: 5000) ─────────────────
export const systemAPI = {
  getHealth: () =>
    fetch(`${GATEWAY_BASE_URL}/health`).then(handleResponse),

  getStatus: () =>
    fetch(`${GATEWAY_BASE_URL}/system/status`).then(handleResponse),
};
