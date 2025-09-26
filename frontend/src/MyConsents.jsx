import React, { useEffect, useState } from 'react';
import api from './api';

export default function MyConsents() {
  const [rows, setRows] = useState([]);
  const [msg, setMsg] = useState('Loading...');

  useEffect(() => {
    api.get('/consents')
      .then(res => { setRows(res.data); setMsg(''); })
      .catch(err => setMsg(err.response?.data?.message || 'Failed to load consents'));
  }, []);

  return (
    <div style={{ padding: 20 }}>
      <h3>My Consents</h3>
      {msg && <p>{msg}</p>}
      {!msg && rows.length === 0 && <p>No consent records yet.</p>}
      {rows.length > 0 && (
        <table border="1" cellPadding="6" style={{ borderCollapse: 'collapse' }}>
          <thead>
            <tr><th>Time</th><th>Item</th><th>Version</th><th>Action</th></tr>
          </thead>
          <tbody>
            {rows.map(r => (
              <tr key={r.id}>
                <td>{r.ts}</td>
                <td>{r.item}</td>
                <td>{r.version || '-'}</td>
                <td>{r.action}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
