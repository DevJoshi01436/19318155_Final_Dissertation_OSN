// src/PrivacySettings.jsx
import React, { useEffect, useState } from 'react';
import api from './api';

export default function PrivacySettings() {
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState('');
  const [form, setForm] = useState({
    profile_public: false,
    share_usage: false,
    ad_personalization: false,
    show_last_seen: false,
  });

  useEffect(() => {
    api.get('/privacy-settings')
      .then(res => { setForm(res.data); setLoading(false); })
      .catch(err => { setMsg(err.response?.data?.message || 'Failed to load'); setLoading(false); });
  }, []);

  const toggle = (k) => setForm(prev => ({ ...prev, [k]: !prev[k] }));

  const save = async () => {
    setMsg('Saving...');
    try {
      const payload = {
        profile_public: form.profile_public,
        share_usage: form.share_usage,
        ad_personalization: form.ad_personalization,
        show_last_seen: form.show_last_seen,
      };
      const res = await api.put('/privacy-settings', payload);

      // Build a readable summary of changes, if present
      let changedSummary = '';
      if (res.data?.changed && typeof res.data.changed === 'object') {
        const parts = Object.entries(res.data.changed).map(([key, v]) => {
          const from = String(v.old);
          const to = String(v.new);
          return `${key}: ${from} → ${to}`;
        });
        if (parts.length) changedSummary = ` (${parts.join(', ')})`;
      }

      setMsg((res.data.message || 'Saved') + changedSummary);
    } catch (e) {
      setMsg(e.response?.data?.message || 'Save failed');
    }
  };

  if (loading) return <p>Loading privacy settings…</p>;

  return (
    <div style={{ padding: 20 }}>
      <h3>Privacy Settings</h3>
      <label>
        <input type="checkbox" checked={form.profile_public} onChange={() => toggle('profile_public')} />
        &nbsp;<b>Public profile</b> — if on, some profile info may be visible to others.
      </label><br />
      <label>
        <input type="checkbox" checked={form.share_usage} onChange={() => toggle('share_usage')} />
        &nbsp;<b>Share usage analytics</b> — helps us improve; kept minimal.
      </label><br />
      <label>
        <input type="checkbox" checked={form.ad_personalization} onChange={() => toggle('ad_personalization')} />
        &nbsp;<b>Ad personalization</b> — personalize messages (demo toggle).
      </label><br />
      <label>
        <input type="checkbox" checked={form.show_last_seen} onChange={() => toggle('show_last_seen')} />
        &nbsp;<b>Show last seen</b> — show your online status to others (demo toggle).
      </label><br /><br />
      <button onClick={save}>Save</button>
      <p style={{ marginTop: 10 }}>{msg}</p>
    </div>
  );
}
