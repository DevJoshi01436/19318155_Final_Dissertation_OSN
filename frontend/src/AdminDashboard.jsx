// src/AdminDashboard.jsx
import React, { useEffect, useState } from 'react';
import api from './api';

export default function AdminDashboard() {
  const [stats, setStats] = useState(null);
  const [msg, setMsg] = useState('Loading...');

  useEffect(() => {
    api.get('/admin/stats')
      .then((res) => { setStats(res.data); setMsg(''); })
      .catch((e) => setMsg(e.response?.data?.message || 'Failed to load stats'));
  }, []);

  return (
    <div style={{ padding: 20 }}>
      <h3>Admin • Dashboard</h3>
      {msg && <p>{msg}</p>}
      {stats && (
        <>
          <div style={{ display: 'flex', gap: 16, marginBottom: 16 }}>
            <Card title="Total Users" value={stats.totals.users} />
            <Card title="Total Admins" value={stats.totals.admins} />
          </div>

          <h4>Recent Admin Actions</h4>
          <table border="1" cellPadding="6" style={{ borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th>ID</th>
                <th>TS</th>
                <th>Admin ID</th>
                <th>Action</th>
                <th>Target</th>
              </tr>
            </thead>
            <tbody>
              {(stats.recent_actions || []).map((r) => (
                <tr key={r.id}>
                  <td>{r.id}</td>
                  <td>{r.ts}</td>
                  <td>{r.admin_id}</td>
                  <td>{r.action}</td>
                  <td>{[r.target_type || '-', r.target_id || '-'].join(' / ')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </div>
  );
}

function Card({ title, value }) {
  return (
    <div style={{ border: '1px solid #ddd', padding: 16, borderRadius: 8, minWidth: 160 }}>
      <div style={{ color: '#666', fontSize: 13 }}>{title}</div>
      <div style={{ fontSize: 28, fontWeight: 700 }}>{value}</div>
    </div>
  );
}
