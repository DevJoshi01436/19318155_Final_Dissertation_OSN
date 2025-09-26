// src/api.js
import axios from 'axios';

// Create axios instance (use the same host form in your browser: 127.0.0.1:3000)
const api = axios.create({
  baseURL: 'http://127.0.0.1:5000',
  withCredentials: true, // allow cookies (refresh token)
});

// Attach access token (JWT) to every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// ---- Auto-refresh logic ----
let isRefreshing = false;
let pendingRequests = [];

function processQueue(error, token = null) {
  pendingRequests.forEach(({ resolve, reject }) => {
    if (error) reject(error);
    else resolve(token);
  });
  pendingRequests = [];
}

api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const originalRequest = error.config;

    // If unauthorized and we haven't retried yet, try to refresh
    if (error.response?.status === 401 && !originalRequest._retry) {
      if (isRefreshing) {
        // Queue this request until refresh finishes
        return new Promise((resolve, reject) => {
          pendingRequests.push({
            resolve: (token) => {
              originalRequest.headers.Authorization = `Bearer ${token}`;
              resolve(api(originalRequest));
            },
            reject,
          });
        });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        // Ask backend for a fresh access token (cookie carries refresh token)
        const r = await axios.post(
          'http://127.0.0.1:5000/refresh',
          {},
          { withCredentials: true }
        );
        const newToken = r.data.token;

        if (!newToken) throw new Error('No token returned from refresh');

        // Save and retry original request
        localStorage.setItem('token', newToken);
        api.defaults.headers.Authorization = `Bearer ${newToken}`;
        processQueue(null, newToken);
        return api(originalRequest);
      } catch (err) {
        // Refresh failed — clear state and send user to login
        processQueue(err, null);
        localStorage.removeItem('token');
        window.location.href = '/login';
        return Promise.reject(err);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);

export default api;
