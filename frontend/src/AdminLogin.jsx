import React, { useState } from 'react';
import api from './api';
import { useNavigate } from 'react-router-dom';
import { setAwaitingAdminOtp, setPendingAdminEmail } from './auth';

export default function AdminLogin() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    setMsg('Logging in as admin...');
    setBusy(true);
    try {
      await api.post('/admin/login', { email, password });
      setAwaitingAdminOtp(true);
      setPendingAdminEmail(email);
      setMsg('Admin OTP sent. Redirecting to verify…');
      navigate('/admin/verify', { replace: true });
    } catch (err) {
      setMsg(err.response?.data?.message || 'Admin login failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ padding: 20 }}>
      <h3>Admin Login</h3>
      <form onSubmit={handleLogin}>
        <input
          type="email"
          placeholder="Admin Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        /><br /><br />
        <input
          type="password"
          placeholder="Admin Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        /><br /><br />
        <button type="submit" disabled={busy}>{busy ? 'Logging in…' : 'Login'}</button>
      </form>
      <p>{msg}</p>
    </div>
  );
}
