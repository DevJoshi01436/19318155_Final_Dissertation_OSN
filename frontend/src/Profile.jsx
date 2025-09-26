import React, { useEffect, useState } from 'react';
import api from './api';

export default function Profile() {
  const [phone, setPhone] = useState('');
  const [msg, setMsg] = useState('Loading…');

  useEffect(() => {
    api.get('/profile')
      .then(res => { setPhone(res.data.phone || ''); setMsg(''); })
      .catch(err => setMsg(err.response?.data?.message || 'Failed to load profile'));
  }, []);

  const save = async () => {
    setMsg('Saving…');
    try {
      await api.put('/profile', { phone });
      setMsg('Saved');
    } catch (e) {
      setMsg(e.response?.data?.message || 'Save failed');
    }
  };

  return (
    <div style={{ padding: 20 }}>
      <h3>Profile (Encrypted)</h3>
      <input
        type="text"
        placeholder="Phone number"
        value={phone}
        onChange={e => setPhone(e.target.value)}
      />
      <button onClick={save} style={{ marginLeft: 8 }}>Save</button>
      <p>{msg}</p>
    </div>
  );
}
