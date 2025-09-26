// src/AdminRoute.jsx
import React, { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import api from './api';
import { isAuthenticated } from './auth';

export default function AdminRoute({ children }) {
  const authed = isAuthenticated();
  const [checking, setChecking] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    let mounted = true;
    if (!authed) {
      setChecking(false);
      setIsAdmin(false);
      return;
    }
    api.get('/me')
      .then((res) => {
        if (!mounted) return;
        setIsAdmin(res.data.role === 'admin');
        setChecking(false);
      })
      .catch(() => {
        if (!mounted) return;
        setIsAdmin(false);
        setChecking(false);
      });
    return () => { mounted = false; };
  }, [authed]);

  if (!authed) return <Navigate to="/login" replace />;
  if (checking) return <p>Checking admin…</p>;
  if (!isAdmin) return <Navigate to="/dashboard" replace />;

  return children;
}
