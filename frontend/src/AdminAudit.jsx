// src/AdminAudit.jsx
import React, { useEffect, useMemo, useState } from 'react';
import api from './api';

const DEFAULT_LIMIT = 20;

const ACTION_PRESETS = [
  { label: '— any —', value: '' },
  { label: 'Admin login success', value: 'ADMIN_LOGIN_OK' },
  { label: 'Listed users', value: 'ADMIN_LIST_USERS' },
  { label: 'User created', value: 'ADMIN_USER_CREATED' },   // NEW
  { label: 'User deleted', value: 'ADMIN_USER_DELETED' },   // NEW
  { label: 'Role changed', value: 'ADMIN_ROLE_CHANGED' },   // (existing)
];

export default function AdminAudit() {
  // Filters / Controls
  const [action, setAction] = useState('');
  const [targetType, setTargetType] = useState('');
  const [targetId, setTargetId] = useState('');
  const [since, setSince] = useState(''); // YYYY-MM-DD
  const [until, setUntil] = useState(''); // YYYY-MM-DD
  const [sortBy, setSortBy] = useState('id');
  const [sortDir, setSortDir] = useState('desc');
  const [limit, setLimit] = useState(DEFAULT_LIMIT);
  const [offset, setOffset] = useState(0);

  // Data state
  const [rows, setRows] = useState([]);
  const [count, setCount] = useState(0);
  const [msg, setMsg] = useState('Loading...');
  const [loading, setLoading] = useState(false);

  // Optional small header stats block
  const [stats, setStats] = useState(null);

  const page = useMemo(() => Math.floor(offset / limit) + 1, [offset, limit]);
  const totalPages = useMemo(
    () => (count === 0 ? 1 : Math.max(1, Math.ceil(count / limit))),
    [count, limit]
  );

  // Load header stats (optional)
  useEffect(() => {
    let mounted = true;
    api
      .get('/admin/stats')
      .then((res) => {
        if (!mounted) return;
        setStats(res.data?.totals || null);
      })
      .catch(() => {
        // non-fatal
      });
    return () => {
      mounted = false;
    };
  }, []);

  const buildParams = () => {
    const params = {
      limit,
      offset,
      sort_by: sortBy,
      sort_dir: sortDir,
    };
    if (action) params.action = action;
    if (targetType) params.target_type = targetType;
    if (targetId) params.target_id = targetId;
    if (since) params.since = since;
    if (until) params.until = until;
    return params;
  };

  const load = async () => {
    setLoading(true);
    setMsg('Loading...');
    try {
      const res = await api.get('/admin/activity', { params: buildParams() });
      setRows(res.data?.items || []);
      setCount(res.data?.count || 0);
      setMsg('');
    } catch (e) {
      setRows([]);
      setCount(0);
      setMsg(e.response?.data?.message || 'Failed to load admin activity');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [action, targetType, targetId, since, until, sortBy, sortDir, limit, offset]);

  const applyPreset = (val) => {
    setAction(val);
    setOffset(0);
  };

  const clearFilters = () => {
    setAction('');
    setTargetType('');
    setTargetId('');
    setSince('');
    setUntil('');
    setOffset(0);
  };

  const setQuickRange = (days) => {
    const end = new Date();
    const start = new Date();
    start.setDate(end.getDate() - (days - 1));
    const toISODate = (d) => d.toISOString().slice(0, 10);
    setSince(toISODate(start));
    setUntil(toISODate(end));
    setOffset(0);
  };

  const exportCsv = async () => {
    try {
      const params = { ...buildParams(), format: 'csv' };
      const res = await api.get('/admin/activity', {
        params,
        responseType: 'blob',
      });
      const blob = new Blob([res.data], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'admin_audit.csv';
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (e) {
      alert(e.response?.data?.message || 'CSV export failed');
    }
  };

  const exportJson = async () => {
    try {
      const body = {
        filters: {
          action,
          target_type: targetType,
          target_id: targetId,
          since,
          until,
          sort_by: sortBy,
          sort_dir: sortDir,
        },
      };
      const res = await api.post('/admin/activity/export', body, {
        responseType: 'blob',
      });
      const blob = new Blob([res.data], { type: 'application/json' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'admin_activity.json';
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (e) {
      alert(e.response?.data?.message || 'JSON export failed');
    }
  };

  const prevPage = () => {
    if (offset === 0) return;
    setOffset(Math.max(0, offset - limit));
  };

  const nextPage = () => {
    if (offset + limit >= count) return;
    setOffset(offset + limit);
  };

  const changeLimit = (newLimit) => {
    setLimit(newLimit);
    setOffset(0);
  };

  return (
    <div style={{ padding: 20 }}>
      <h3>Admin • Audit</h3>

      {stats && (
        <div style={{ marginBottom: 12, fontSize: 13, color: '#444' }}>
          <b>Totals:</b> Users={stats.users} &nbsp;|&nbsp; Admins={stats.admins}
        </div>
      )}

      {/* Controls */}
      <div
        style={{
          border: '1px solid #ddd',
          padding: 12,
          borderRadius: 8,
          marginBottom: 12,
        }}
      >
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 8 }}>
          {/* Action preset */}
          <div>
            <label style={{ display: 'block', fontSize: 12, marginBottom: 4 }}>
              Action preset
            </label>
            <select
              value={action}
              onChange={(e) => applyPreset(e.target.value)}
              style={{ minWidth: 200 }}
            >
              {ACTION_PRESETS.map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label}
                </option>
              ))}
            </select>
          </div>

          {/* Free-form filters */}
          <div>
            <label style={{ display: 'block', fontSize: 12, marginBottom: 4 }}>
              Target type
            </label>
            <input
              value={targetType}
              onChange={(e) => setTargetType(e.target.value)}
              placeholder="e.g., user/self"
              style={{ width: 160 }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: 12, marginBottom: 4 }}>
              Target ID
            </label>
            <input
              value={targetId}
              onChange={(e) => setTargetId(e.target.value)}
              placeholder="e.g., user id"
              style={{ width: 120 }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: 12, marginBottom: 4 }}>
              Since
            </label>
            <input
              type="date"
              value={since}
              onChange={(e) => setSince(e.target.value)}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: 12, marginBottom: 4 }}>
              Until
            </label>
            <input
              type="date"
              value={until}
              onChange={(e) => setUntil(e.target.value)}
            />
          </div>

          {/* Sorting */}
          <div>
            <label style={{ display: 'block', fontSize: 12, marginBottom: 4 }}>
              Sort by
            </label>
            <select value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
              <option value="id">id</option>
              <option value="ts">ts</option>
              <option value="action">action</option>
              <option value="target_type">target_type</option>
              <option value="target_id">target_id</option>
            </select>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: 12, marginBottom: 4 }}>
              Direction
            </label>
            <select value={sortDir} onChange={(e) => setSortDir(e.target.value)}>
              <option value="desc">desc</option>
              <option value="asc">asc</option>
            </select>
          </div>

          {/* Page size */}
          <div>
            <label style={{ display: 'block', fontSize: 12, marginBottom: 4 }}>
              Page size
            </label>
            <select value={limit} onChange={(e) => changeLimit(Number(e.target.value))}>
              <option value={10}>10</option>
              <option value={20}>20</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
          </div>
        </div>

        {/* Quick actions row */}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button onClick={() => setQuickRange(1)}>Today</button>
          <button onClick={() => setQuickRange(7)}>Last 7 days</button>
          <button onClick={() => setQuickRange(30)}>Last 30 days</button>
          <button onClick={clearFilters}>Clear filters</button>
          <span style={{ flex: 1 }} />
          <button onClick={exportCsv} title="Download CSV">
            Export CSV
          </button>
          <button onClick={exportJson} title="Download JSON (all matching)">
            Export JSON
          </button>
        </div>
      </div>

      {/* Results */}
      {msg && <p>{msg}</p>}

      {!msg && rows.length === 0 && <p>No results.</p>}

      {rows.length > 0 && (
        <>
          <table border="1" cellPadding="6" style={{ borderCollapse: 'collapse', width: '100%' }}>
            <thead>
              <tr>
                <th>ID</th>
                <th>TS</th>
                <th>Action</th>
                <th>Target</th>
                <th>Meta</th>
                <th>Justification</th>
                <th>Row Hash</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td>{r.id}</td>
                  <td style={{ whiteSpace: 'nowrap' }}>{r.ts}</td>
                  <td>{r.action}</td>
                  <td>
                    <div>
                      <div><b>type:</b> {r.target_type || '-'}</div>
                      <div><b>id:</b> {r.target_id || '-'}</div>
                    </div>
                  </td>
                  <td style={{ maxWidth: 360 }}>
                    <pre style={{ margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                      {JSON.stringify(r.meta || {}, null, 2)}
                    </pre>
                  </td>
                  <td style={{ maxWidth: 260, whiteSpace: 'pre-wrap' }}>
                    {r.justification || '-'}
                  </td>
                  <td style={{ fontFamily: 'monospace' }}>{r.row_hash?.slice(0, 10)}…</td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Pagination */}
          <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 12 }}>
            <button onClick={prevPage} disabled={offset === 0 || loading}>
              ◀ Prev
            </button>
            <span>
              Page <b>{page}</b> of <b>{totalPages}</b> &nbsp;|&nbsp; total <b>{count}</b>
            </span>
            <button
              onClick={nextPage}
              disabled={offset + limit >= count || loading}
            >
              Next ▶
            </button>
          </div>
        </>
      )}
    </div>
  );
}
