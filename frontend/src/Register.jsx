// src/Register.jsx
import React, { useState } from 'react';
import api from './api';

export default function Register() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('user');       // 🔸 NEW
  const [adminCode, setAdminCode] = useState(''); // 🔸 NEW
  const [msg, setMsg] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMsg('Registering...');
    try {
      const payload = { email, password, role };
      if (role === 'admin') payload.admin_code = adminCode;

      const res = await api.post('/register', payload);
      setMsg(`${res.data.message}${res.data.role ? ` (role=${res.data.role})` : ''}`);
    } catch (err) {
      setMsg(err.response?.data?.message || 'Registration failed');
    }
  };

  return (
    <div style={{ padding: 20 }}>
      <h3>Register</h3>
      <form onSubmit={handleSubmit}>
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        /><br /><br />

        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        /><br /><br />

        {/* 🔸 Role selector */}
        <label>
          Role:&nbsp;
          <select value={role} onChange={(e) => setRole(e.target.value)}>
            <option value="user">User</option>
            <option value="admin">Admin</option>
          </select>
        </label>

        {/* 🔸 Admin invite code (only when role=admin) */}
        {role === 'admin' && (
          <>
            <br /><br />
            <input
              type="text"
              placeholder="Admin invite code"
              value={adminCode}
              onChange={(e) => setAdminCode(e.target.value)}
              required
            />
            <div style={{ fontSize: 12, color: '#555', marginTop: 6 }}>
              * Admin registration requires a valid invite code.
            </div>
          </>
        )}

        <br /><br />
        <button type="submit">Register</button>
      </form>
      <p>{msg}</p>
    </div>
  );
}
