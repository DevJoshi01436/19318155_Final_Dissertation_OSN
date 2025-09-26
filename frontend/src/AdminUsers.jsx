// src/AdminUsers.jsx
import React, { useEffect, useState } from 'react';
import api from './api';

export default function AdminUsers() {
  const [rows, setRows] = useState([]);
  const [msg, setMsg] = useState('Loading...');
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({
    email: '',
    password: '',
    role: 'user',
    justification: '',
  });

  const load = () => {
    setMsg('Loading...');
    api.get('/admin/users')
      .then((res) => {
        setRows(res.data);
        setMsg('');
      })
      .catch((err) => {
        setMsg(err.response?.data?.message || 'Failed to load users');
      });
  };

  useEffect(() => {
    load();
  }, []);

  const changeRole = async (id, nextRole) => {
    const justification = window.prompt('Please provide a brief justification (min 5 chars):', '');
    if (!justification || justification.trim().length < 5) {
      alert('Justification is required and must be at least 5 characters.');
      return;
    }
    setMsg('Updating role...');
    try {
      await api.post(`/admin/users/${id}/role`, { role: nextRole, justification });
      setMsg('Role updated');
      load();
    } catch (e) {
      setMsg(e.response?.data?.message || 'Failed to update role');
    }
  };

  const onCreate = async (e) => {
    e.preventDefault();
    if (creating) return;
    if (!form.email || !form.password || !form.justification) {
      alert('Email, password, and justification are required.');
      return;
    }
    setCreating(true);
    setMsg('Creating user...');
    try {
      await api.post('/admin/users', {
        email: form.email,
        password: form.password,
        role: form.role,
        justification: form.justification,
      });
      setMsg('User created');
      setForm({ email: '', password: '', role: 'user', justification: '' });
      load();
    } catch (e) {
      setMsg(e.response?.data?.message || 'Failed to create user');
    } finally {
      setCreating(false);
    }
  };

  const onDelete = async (id, email) => {
    const justification = window.prompt(
      `Type a justification to anonymize/delete user ${email} (min 5 chars):`,
      ''
    );
    if (!justification || justification.trim().length < 5) {
      alert('Justification is required and must be at least 5 characters.');
      return;
    }
    if (!window.confirm(`Are you sure you want to anonymize/delete user "${email}"?`)) {
      return;
    }
    setMsg('Deleting user...');
    try {
      await api.delete(`/admin/users/${id}`, { data: { justification } });
      setMsg('User deleted (anonymized).');
      load();
    } catch (e) {
      setMsg(e.response?.data?.message || 'Failed to delete user');
    }
  };

  return (
    <div style={{ padding: 20 }}>
      <h3>Admin • Users</h3>
      {msg && <p>{msg}</p>}

      {/* Create new user */}
      <div style={{ border: '1px solid #ddd', padding: 12, borderRadius: 8, marginBottom: 16 }}>
        <h4 style={{ marginTop: 0 }}>Add New User</h4>
        <form onSubmit={onCreate}>
          <div style={{ marginBottom: 8 }}>
            <label style={{ width: 120, display: 'inline-block' }}>Email:</label>
            <input
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              required
              style={{ width: 280 }}
            />
          </div>
          <div style={{ marginBottom: 8 }}>
            <label style={{ width: 120, display: 'inline-block' }}>Password:</label>
            <input
              type="password"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              required
              style={{ width: 280 }}
            />
          </div>
          <div style={{ marginBottom: 8 }}>
            <label style={{ width: 120, display: 'inline-block' }}>Role:</label>
            <select
              value={form.role}
              onChange={(e) => setForm({ ...form, role: e.target.value })}
              style={{ width: 160 }}
            >
              <option value="user">user</option>
              <option value="admin">admin</option>
            </select>
          </div>
          <div style={{ marginBottom: 8 }}>
            <label style={{ width: 120, display: 'inline-block' }}>Justification:</label>
            <input
              type="text"
              value={form.justification}
              onChange={(e) => setForm({ ...form, justification: e.target.value })}
              placeholder="Why are you creating this account?"
              required
              style={{ width: 420 }}
            />
          </div>
          <button type="submit" disabled={creating}>
            {creating ? 'Creating…' : 'Create User'}
          </button>
        </form>
      </div>

      {/* User table */}
      {rows.length > 0 ? (
        <table border="1" cellPadding="6" style={{ borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th>ID</th>
              <th>Email</th>
              <th>Role</th>
              <th>Last OTP At</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((u) => (
              <tr key={u.id}>
                <td>{u.id}</td>
                <td>{u.email}</td>
                <td>{u.role}</td>
                <td>{u.last_otp_at || '-'}</td>
                <td>
                  {u.role === 'admin' ? (
                    <button onClick={() => changeRole(u.id, 'user')}>Demote to user</button>
                  ) : (
                    <button onClick={() => changeRole(u.id, 'admin')}>Promote to admin</button>
                  )}
                  &nbsp;|&nbsp;
                  <button
                    onClick={() => onDelete(u.id, u.email)}
                    style={{ color: 'crimson' }}
                    title="Anonymize/Delete user"
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : !msg ? (
        <p>No users found.</p>
      ) : null}
    </div>
  );
}
