// src/auth.js
import api from './api';

// ===== Common (user or admin) =====
export const getToken = () => localStorage.getItem('token');
export const isAuthenticated = () => Boolean(getToken());
export const saveToken = (jwt) => localStorage.setItem('token', jwt);

// optional: store role (from /me)
export const getRole = () => localStorage.getItem('role') || '';
export const setRole = (role) => {
  if (role) localStorage.setItem('role', role);
};
export const clearRole = () => localStorage.removeItem('role');

// ===== User flow =====
export const getPendingEmail = () =>
  localStorage.getItem('pendingEmail') || '';

export const setPendingEmail = (email) => {
  if (email) localStorage.setItem('pendingEmail', email);
};

export const clearPendingEmail = () =>
  localStorage.removeItem('pendingEmail');

export const setAwaitingOtp = (flag) => {
  if (flag) localStorage.setItem('awaitingOtp', '1');
  else localStorage.removeItem('awaitingOtp');
};

export const isAwaitingOtp = () =>
  localStorage.getItem('awaitingOtp') === '1';

// ===== Admin flow =====
const ADMIN_PENDING_EMAIL_KEY = 'pendingAdminEmail';
const ADMIN_AWAITING_OTP_KEY = 'awaitingAdminOtp';

export const getPendingAdminEmail = () =>
  localStorage.getItem(ADMIN_PENDING_EMAIL_KEY) || '';

export const setPendingAdminEmail = (email) => {
  if (email) localStorage.setItem(ADMIN_PENDING_EMAIL_KEY, email);
};

export const clearPendingAdminEmail = () =>
  localStorage.removeItem(ADMIN_PENDING_EMAIL_KEY);

export const setAwaitingAdminOtp = (flag) => {
  if (flag) localStorage.setItem(ADMIN_AWAITING_OTP_KEY, '1');
  else localStorage.removeItem(ADMIN_AWAITING_OTP_KEY);
};

export const isAwaitingAdminOtp = () =>
  localStorage.getItem(ADMIN_AWAITING_OTP_KEY) === '1';

// ===== Utilities =====
export const clearAllAuth = () => {
  localStorage.removeItem('token');
  clearRole();

  // user
  clearPendingEmail();
  setAwaitingOtp(false);

  // admin
  clearPendingAdminEmail();
  setAwaitingAdminOtp(false);
};

// ===== Logout =====
export const logout = async () => {
  try {
    await api.post('/logout'); // revoke refresh + clear cookie on server
  } catch (e) {
    console.warn('Logout API failed:', e);
  } finally {
    clearAllAuth();
  }
};
