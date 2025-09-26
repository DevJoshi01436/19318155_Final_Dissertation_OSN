// src/Dashboard.jsx
import React, { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import api from './api';
import { logout } from './auth';

export default function Dashboard() {
  const [me, setMe] = useState(null);
  const [privacy, setPrivacy] = useState(null);
  const [recent, setRecent] = useState([]);
  const [msg, setMsg] = useState('Loading...');
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    let mounted = true;

    const fetchAll = async () => {
      try {
        const [meRes, privRes, actRes] = await Promise.all([
          api.get('/me'),
          api.get('/privacy-settings'),
          api.get('/activity?limit=5'),
        ]);
        if (!mounted) return;
        setMe(meRes.data);
        setPrivacy(privRes.data);
        setRecent(actRes.data || []);
        setMsg('');
      } catch (e) {
        if (!mounted) return;
        setMsg(e.response?.data?.message || 'Failed to load dashboard');
      }
    };

    fetchAll();
    return () => { mounted = false; };
  }, []);

  const handleLogout = async () => {
    if (isLoggingOut) return;
    setIsLoggingOut(true);
    setMsg('Logging out...');
    try {
      await logout();
    } finally {
      setIsLoggingOut(false);
      navigate('/login', { replace: true });
    }
  };

  return (
    <div style={{ padding: 20 }}>
      <h2>Dashboard</h2>
      {msg && <p>{msg}</p>}

      {me && (
        <div style={{ marginBottom: 16 }}>
          <p><b>User ID:</b> {me.id}</p>
          <p><b>Email:</b> {me.email}</p>
        </div>
      )}

      <div style={{ marginBottom: 16 }}>
        <Link to="/privacy">Privacy</Link> &nbsp;|&nbsp;
        <Link to="/activity">Activity</Link> &nbsp;|&nbsp;
        <Link to="/consents">Consents</Link>
      </div>

      {privacy && (
        <div style={{ border: '1px solid #ddd', padding: 12, borderRadius: 8, marginBottom: 16 }}>
          <h4 style={{ marginTop: 0 }}>Privacy snapshot</h4>
          <ul>
            <li>Profile public: <b>{String(privacy.profile_public)}</b></li>
            <li>Share usage: <b>{String(privacy.share_usage)}</b></li>
            <li>Ad personalization: <b>{String(privacy.ad_personalization)}</b></li>
            <li>Show last seen: <b>{String(privacy.show_last_seen)}</b></li>
          </ul>
          <small>Updated: {privacy.updated_at || '-'}</small>
        </div>
      )}

      <div style={{ border: '1px solid #ddd', padding: 12, borderRadius: 8, marginBottom: 16 }}>
        <h4 style={{ marginTop: 0 }}>Recent activity</h4>
        {recent.length === 0 ? (
          <p>No recent events.</p>
        ) : (
          <table border="1" cellPadding="6" style={{ borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th>ID</th>
                <th>TS</th>
                <th>Event</th>
                <th>Meta</th>
              </tr>
            </thead>
            <tbody>
              {recent.map((r) => (
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

      <button onClick={handleLogout} disabled={isLoggingOut}>
        {isLoggingOut ? 'Logging out…' : 'Logout'}
      </button>
    </div>
  );
}
