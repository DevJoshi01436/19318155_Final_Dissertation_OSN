// src/Account.jsx
import React, { useEffect, useState } from 'react';
import api from './api';

export default function Account() {
  const [me, setMe] = useState(null);

  // email form
  const [newEmail, setNewEmail] = useState('');
  const [emailPw, setEmailPw] = useState('');
  const [emailMsg, setEmailMsg] = useState('');

  // password form
  const [curPw, setCurPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [newPw2, setNewPw2] = useState('');
  const [pwMsg, setPwMsg] = useState('');

  useEffect(() => {
    let mounted = true;
    api.get('/me')
      .then((res) => {
        if (!mounted) return;
        setMe(res.data);
        setNewEmail(res.data?.email || '');
      })
      .catch((e) => {
        setMe(null);
      });
    return () => { mounted = false; };
  }, []);

  const submitEmail = async (e) => {
    e.preventDefault();
    setEmailMsg('Updating email...');
    try {
      const res = await api.put('/me/email', {
        new_email: newEmail,
        current_password: emailPw,
      });
      setEmailMsg(res.data?.message || 'Email updated');
      setEmailPw('');
    } catch (e) {
      setEmailMsg(e.response?.data?.message || 'Failed to update email');
    }
  };

  const submitPassword = async (e) => {
    e.preventDefault();
    if (newPw !== newPw2) {
      setPwMsg('New passwords do not match');
      return;
    }
    setPwMsg('Updating password...');
    try {
      const res = await api.put('/me/password', {
        current_password: curPw,
        new_password: newPw,
      });
      setPwMsg(res.data?.message || 'Password updated. Please log in again.');
      setCurPw('');
      setNewPw('');
      setNewPw2('');
      // Note: backend clears refresh cookie; you may want to redirect to /login
    } catch (e2) {
      setPwMsg(e2.response?.data?.message || 'Failed to update password');
    }
  };

  return (
    <div style={{ padding: 20 }}>
      <h3>My Account</h3>

      {me && (
        <div style={{ marginBottom: 16, color: '#444' }}>
          <div><b>User ID:</b> {me.id}</div>
          <div><b>Current Email:</b> {me.email}</div>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 20, maxWidth: 520 }}>
        {/* Update Email */}
        <form onSubmit={submitEmail} style={{ border: '1px solid #ddd', padding: 12, borderRadius: 8 }}>
          <h4 style={{ marginTop: 0 }}>Update Email</h4>
          <div style={{ marginBottom: 8 }}>
            <label style={{ display: 'block', fontSize: 12, marginBottom: 4 }}>New email</label>
            <input
              type="email"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              required
              style={{ width: '100%' }}
            />
          </div>
          <div style={{ marginBottom: 8 }}>
            <label style={{ display: 'block', fontSize: 12, marginBottom: 4 }}>Current password</label>
            <input
              type="password"
              value={emailPw}
              onChange={(e) => setEmailPw(e.target.value)}
              required
              style={{ width: '100%' }}
            />
          </div>
          <button type="submit">Save email</button>
          {emailMsg && <p style={{ marginTop: 8 }}>{emailMsg}</p>}
        </form>

        {/* Change Password */}
        <form onSubmit={submitPassword} style={{ border: '1px solid #ddd', padding: 12, borderRadius: 8 }}>
          <h4 style={{ marginTop: 0 }}>Change Password</h4>
          <div style={{ marginBottom: 8 }}>
            <label style={{ display: 'block', fontSize: 12, marginBottom: 4 }}>Current password</label>
            <input
              type="password"
              value={curPw}
              onChange={(e) => setCurPw(e.target.value)}
              required
              style={{ width: '100%' }}
            />
          </div>
          <div style={{ marginBottom: 8 }}>
            <label style={{ display: 'block', fontSize: 12, marginBottom: 4 }}>New password (min 8 chars)</label>
            <input
              type="password"
              value={newPw}
              onChange={(e) => setNewPw(e.target.value)}
              minLength={8}
              required
              style={{ width: '100%' }}
            />
          </div>
          <div style={{ marginBottom: 8 }}>
            <label style={{ display: 'block', fontSize: 12, marginBottom: 4 }}>Confirm new password</label>
            <input
              type="password"
              value={newPw2}
              onChange={(e) => setNewPw2(e.target.value)}
              minLength={8}
              required
              style={{ width: '100%' }}
            />
          </div>
          <button type="submit">Save password</button>
          {pwMsg && <p style={{ marginTop: 8 }}>{pwMsg}</p>}
        </form>
      </div>
    </div>
  );
}
