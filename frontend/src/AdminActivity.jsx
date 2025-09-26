// src/AdminActivity.jsx
import React, { useEffect, useMemo, useState } from 'react';
import api from './api';

const PAGE_SIZE = 20;

export default function AdminActivity() {
  const [rows, setRows] = useState([]);
  const [msg, setMsg] = useState('Loading...');
  const [verifying, setVerifying] = useState(false);
  const [verifyResult, setVerifyResult] = useState(null);

  // filters
  const [action, setAction] = useState('');           // free text, matches action startswith/contains (server-side)
  const [fromDate, setFromDate] = useState('');       // yyyy-mm-dd
  const [toDate, setToDate] = useState('');           // yyyy-mm-dd

  // pagination
  const [offset, setOffset] = useState(0);
  const [limit, setLimit] = useState(PAGE_SIZE);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);

  const canPrev = offset > 0;
  const canNext = offset + limit < total;

  const params = useMemo(() => {
    const p = { limit, offset };
    if (action.trim()) p.action = action.trim();
    if (fromDate) p.from = fromDate; // ISO date (yyyy-mm-dd)
    if (toDate) p.to = toDate;       // ISO date (yyyy-mm-dd)
    return p;
  }, [limit, offset, action, fromDate, toDate]);

  const load = async () => {
    setLoading(true);
    setMsg('');
    try {
      const res = await api.get('/admin/activity', { params });
      setRows(res.data.items || []);
      setTotal(res.data.total ?? (res.data.items?.length || 0));
      if ((res.data.items || []).length === 0 && (res.data.total ?? 0) === 0) {
        setMsg('No admin activity found.');
      }
    } catch (e) {
      setRows([]);
      setMsg(e.response?.data?.message || 'Failed to load admin activity');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params]); // reload on filter or paging change

  const verifyChain = async () => {
    setVerifying(true);
    setVerifyResult(null);
    try {
      const res = await api.get('/admin/activity/verify-chain');
      setVerifyResult({
        ok: Boolean(res.data.ok),
        detail: res.data.ok
          ? `Events checked: ${res.data.count}`
          : (res.data.reason ? `Break at id=${res.data.id}: ${res.data.reason}` : 'Mismatch')
      });
    } catch (err) {
      const data = err.response?.data || {};
      setVerifyResult({
        ok: false,
        detail: data.reason
          ? `Break at id=${data.id}: ${data.reason}`
          : (data.message || 'Verification failed')
      });
    } finally {
      setVerifying(false);
    }
  };

  const applyFilters = (e) => {
    e.preventDefault();
    // reset to first page on new filters
    setOffset(0);
    load();
  };

  const clearFilters = () => {
    setAction('');
    setFromDate('');
    setToDate('');
    setOffset(0);
  };

  return (
    <div style={{ padding: 20 }}>
      <h3>Admin Activity</h3>

      {/* Filters */}
      <form onSubmit={applyFilters} style={{ marginBottom: 12, display: 'grid', gap: 8, maxWidth: 900 }}>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
          <div>
            <label style={{ fontWeight: 600 }}>Action:&nbsp;</label>
            <input
              value={action}
              onChange={(e) => setAction(e.target.value)}
              placeholder="e.g. ADMIN_ROLE_CHANGED"
              style={{ width: 220 }}
            />
          </div>

          <div>
            <label style={{ fontWeight: 600 }}>From:&nbsp;</label>
            <input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
            />
          </div>

          <div>
            <label style={{ fontWeight: 600 }}>To:&nbsp;</label>
            <input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
            />
          </div>

          <div>
            <label style={{ fontWeight: 600 }}>Page size:&nbsp;</label>
            <select value={limit} onChange={(e) => { setOffset(0); setLimit(Number(e.target.value)); }}>
              <option value={10}>10</option>
              <option value={20}>20</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
          </div>

          <div style={{ display: 'flex', gap: 8 }}>
            <button type="submit" disabled={loading}>Apply</button>
            <button type="button" disabled={loading} onClick={clearFilters}>Clear</button>
          </div>

          <div style={{ marginLeft: 'auto' }}>
            <button onClick={verifyChain} type="button" disabled={verifying}>
              {verifying ? 'Verifying…' : 'Verify Chain'}
            </button>
            {verifyResult && (
              <span style={{ marginLeft: 10 }}>
                {verifyResult.ok ? '✅ Chain OK' : '❌ Chain Mismatch'}
                {verifyResult.detail ? ` — ${verifyResult.detail}` : null}
              </span>
            )}
          </div>
        </div>
      </form>

      {/* Table */}
      {msg && <p>{msg}</p>}
      {!msg && rows.length === 0 && <p>No rows.</p>}

      {rows.length > 0 && (
        <>
          <table border="1" cellPadding="6" style={{ borderCollapse: 'collapse', width: '100%', maxWidth: 1100 }}>
            <thead>
              <tr>
                <th width="160">Time (UTC)</th>
                <th>Action</th>
                <th>Target</th>
                <th>Meta</th>
                <th>Justification</th>
                <th>Prev Hash</th>
                <th>Row Hash</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(r => (
                <tr key={r.id}>
                  <td>{r.ts}</td>
                  <td><code>{r.action}</code></td>
                  <td>
                    <div><b>type:</b> {r.target_type || '-'}</div>
                    <div><b>id:</b> {String(r.target_id ?? '') || '-'}</div>
                  </td>
                  <td>
                    <code style={{ whiteSpace: 'pre-wrap' }}>
                      {typeof r.meta === 'string' ? r.meta : JSON.stringify(r.meta || {}, null, 2)}
                    </code>
                  </td>
                  <td>
                    <code style={{ whiteSpace: 'pre-wrap' }}>
                      {r.justification || ''}
                    </code>
                  </td>
                  <td><code style={{ wordBreak: 'break-all' }}>{r.prev_hash || ''}</code></td>
                  <td><code style={{ wordBreak: 'break-all' }}>{r.row_hash || ''}</code></td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Pagination */}
          <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 12 }}>
            <button disabled={!canPrev || loading} onClick={() => setOffset(Math.max(0, offset - limit))}>
              ◀ Prev
            </button>
            <button disabled={!canNext || loading} onClick={() => setOffset(offset + limit)}>
              Next ▶
            </button>
            <span>
              Showing <b>{rows.length}</b> of <b>{total}</b> — page{' '}
              <b>{Math.floor(offset / limit) + 1}</b>
            </span>
          </div>
        </>
      )}
    </div>
  );
}
