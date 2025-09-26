// src/App.js
import React, { useEffect, useState } from 'react';
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Link,
  Navigate,
  useNavigate,
} from 'react-router-dom';

import Register from './Register';
import Login from './Login';
import VerifyOTP from './VerifyOTP';
import Dashboard from './Dashboard';
import ProtectedRoute from './ProtectedRoute';
import PrivacySettings from './PrivacySettings';
import MyActivity from './MyActivity';
import MyConsents from './MyConsents';
import AwaitingOtpRoute from './AwaitingOtpRoute';

import AdminRoute from './AdminRoute';
import AdminUsers from './AdminUsers';
import AdminAudit from './AdminAudit';

import AdminLogin from './AdminLogin';
import AdminVerifyOTP from './AdminVerifyOTP';
import AwaitingAdminOtpRoute from './AwaitingAdminOtpRoute';

import Account from './Account'; // NEW

import { isAuthenticated, logout } from './auth';
import api from './api';

function Nav() {
  const authed = isAuthenticated();
  const [isAdmin, setIsAdmin] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    let mounted = true;
    if (!authed) {
      setIsAdmin(false);
      return;
    }
    api.get('/me')
      .then((res) => {
        if (!mounted) return;
        setIsAdmin(res.data?.role === 'admin');
      })
      .catch(() => {
        if (!mounted) return;
        setIsAdmin(false);
      });
    return () => { mounted = false; };
  }, [authed]);

  const doLogout = async () => {
    try {
      await logout();
    } finally {
      navigate('/login', { replace: true });
    }
  };

  return (
    <nav style={{ marginBottom: 16 }}>
      {!authed ? (
        <>
          <Link to="/register">Register</Link> &nbsp;|&nbsp;
          <Link to="/login">User Login</Link> &nbsp;|&nbsp;
          <Link to="/admin/login">Admin Login</Link>
        </>
      ) : (
        <>
          <Link to="/dashboard">Dashboard</Link> &nbsp;|&nbsp;
          <Link to="/privacy">Privacy</Link> &nbsp;|&nbsp;
          <Link to="/activity">Activity</Link> &nbsp;|&nbsp;
          <Link to="/consents">Consents</Link> &nbsp;|&nbsp;
          <Link to="/account">Account</Link> {/* NEW */}
          {isAdmin && (
            <>
              &nbsp;|&nbsp; <Link to="/admin/users">Admin Users</Link>
              &nbsp;|&nbsp; <Link to="/admin/audit">Admin Audit</Link>
            </>
          )}
          &nbsp;|&nbsp;
          <button onClick={doLogout} style={{ cursor: 'pointer' }}>
            Logout
          </button>
        </>
      )}
    </nav>
  );
}

export default function App() {
  return (
    <Router>
      <div style={{ padding: '20px' }}>
        <h2>Privacy Framework - User Login</h2>
        <Nav />

        <Routes>
          {/* Default -> Register */}
          <Route path="/" element={<Navigate to="/register" replace />} />

          {/* Public (pre-auth) */}
          <Route path="/register" element={<Register />} />
          <Route path="/login" element={<Login />} />

          {/* User OTP (immediately after user login) */}
          <Route
            path="/verify"
            element={
              <AwaitingOtpRoute>
                <VerifyOTP />
              </AwaitingOtpRoute>
            }
          />

          {/* Admin login + admin OTP */}
          <Route path="/admin/login" element={<AdminLogin />} />
          <Route
            path="/admin/verify"
            element={
              <AwaitingAdminOtpRoute>
                <AdminVerifyOTP />
              </AwaitingAdminOtpRoute>
            }
          />

          {/* Authenticated only */}
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <Dashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/privacy"
            element={
              <ProtectedRoute>
                <PrivacySettings />
              </ProtectedRoute>
            }
          />
          <Route
            path="/activity"
            element={
              <ProtectedRoute>
                <MyActivity />
              </ProtectedRoute>
            }
          />
          <Route
            path="/consents"
            element={
              <ProtectedRoute>
                <MyConsents />
              </ProtectedRoute>
            }
          />
          <Route
            path="/account"
            element={
              <ProtectedRoute>
                <Account />
              </ProtectedRoute>
            }
          />

          {/* Admin-only area */}
          <Route
            path="/admin/users"
            element={
              <AdminRoute>
                <AdminUsers />
              </AdminRoute>
            }
          />
          <Route
            path="/admin/audit"
            element={
              <AdminRoute>
                <AdminAudit />
              </AdminRoute>
            }
          />

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>
    </Router>
  );
}
