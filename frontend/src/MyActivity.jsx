// src/MyActivity.jsx
import React, { useEffect, useState } from 'react';
import api from './api';

export default function MyActivity() {
  const [rows, setRows] = useState([]);
  const [msg, setMsg] = useState('Loading...');
  const [limit, setLimit] = useState(50);

  const load = async () => {
    setMsg('Loading...');
    try {
      const res = await api.get(`/activity?limit=${limit}`);
      setRows(res.data || []);
      setMsg('');
    } catch (e) {
      setMsg(e.response?.data?.message || 'Failed to load activity');
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [limit]);

  return (
    <div style={{ padding: 20 }}>
      <h3>My Activity</h3>

      <div style={{ marginBottom: 12 }}>
        <label htmlFor="limit">Show last&nbsp;</label>
        <select
          id="limit"
          value={limit}
          onChange={(e) => setLimit(Number(e.target.value))}
        >
          <option value={10}>10</option>
          <option value={25}>25</option>
          <option value={50}>50</option>
          <option value={100}>100</option>
          <option value={200}>200</option>
        </select>
        <span>&nbsp;events</span>
        <button style={{ marginLeft: 12 }} onClick={load}>Refresh</button>
      </div>

      {msg && <p>{msg}</p>}

      {rows.length === 0 && !msg && <p>No activity found.</p>}

      {rows.length > 0 && (
        <table border="1" cellPadding="6" style={{ borderCollapse: 'collapse', width: '100%' }}>
          <thead>
            <tr>
              <th style={{ width: 70 }}>ID</th>
              <th style={{ width: 220 }}>Timestamp</th>
              <th style={{ width: 220 }}>Event</th>
              <th>Meta</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td>{r.id}</td>
                <td>{r.ts}</td>
                <td>{r.event}</td>
                <td>
                  <pre style={{ margin: 0, whiteSpace: 'pre-wrap' }}>
                    {JSON.stringify(r.meta || {}, null, 2)}
                  </pre>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
