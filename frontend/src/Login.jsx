// src/Login.jsx
import React, { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import api from './api';
import {
  setAwaitingOtp,
  setPendingEmail,
  isAuthenticated,
  isAwaitingOtp,
} from './auth';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();

  // If already logged in, go to dashboard.
  // If already in OTP flow, go to verify screen.
  useEffect(() => {
    if (isAuthenticated()) {
      navigate('/dashboard', { replace: true });
      return;
    }
    if (isAwaitingOtp()) {
      navigate('/verify', { replace: true });
    }
  }, [navigate]);

  const handleLogin = async (e) => {
    e.preventDefault();
    if (busy) return;

    const normEmail = (email || '').trim().toLowerCase();
    const pwd = (password || '').trim();

    if (!normEmail || !pwd) {
      setMsg('Email and password are required');
      return;
    }

    setMsg('Logging in...');
    setBusy(true);

    try {
      await api.post('/login', { email: normEmail, password: pwd });
      // Mark client as awaiting OTP and remember email for verify step
      setAwaitingOtp(true);
      setPendingEmail(normEmail);
      setMsg('OTP sent. Redirecting to Verify…');
      navigate('/verify', { replace: true });
    } catch (err) {
      setMsg(err.response?.data?.message || 'Login failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ padding: 20 }}>
      <h3>Login</h3>
      <form onSubmit={handleLogin}>
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="username"
          required
        /><br /><br />
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
          required
        /><br /><br />
        <button type="submit" disabled={busy}>
          {busy ? 'Logging in…' : 'Login'}
        </button>
      </form>

      {msg && <p style={{ marginTop: 12 }}>{msg}</p>}

      <p style={{ marginTop: 16 }}>
        New here? <Link to="/">Register</Link>
      </p>
    </div>
  );
}
