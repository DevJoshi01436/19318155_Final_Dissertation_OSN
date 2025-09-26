// src/AdminVerifyOTP.jsx
import React, { useEffect, useRef, useState } from 'react';
import api from './api';
import { useNavigate } from 'react-router-dom';
import {
  saveToken,
  getPendingAdminEmail,
  setAwaitingAdminOtp,
  clearPendingAdminEmail,
} from './auth';

const RESEND_COOLDOWN_SECONDS = 30;

export default function AdminVerifyOTP() {
  const [email, setEmail] = useState(getPendingAdminEmail());
  const [otp, setOtp] = useState('');
  const [msg, setMsg] = useState('');
  const [resendMsg, setResendMsg] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const timerRef = useRef(null);
  const navigate = useNavigate();

  // cooldown ticker
  useEffect(() => {
    if (cooldown > 0 && !timerRef.current) {
      timerRef.current = setInterval(() => {
        setCooldown((s) => {
          if (s <= 1) {
            clearInterval(timerRef.current);
            timerRef.current = null;
            return 0;
          }
          return s - 1;
        });
      }, 1000);
    }
    return () => {
      if (timerRef.current && cooldown === 0) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [cooldown]);

  const handleVerify = async (e) => {
    e.preventDefault();
    setMsg('Verifying admin OTP...');
    setIsVerifying(true);
    try {
      const payload = { email: email.trim().toLowerCase(), otp: otp.trim() };
      const res = await api.post('/admin/verify-otp', payload);
      setMsg(res.data.message || 'Verified');

      if (res.data.token) {
        saveToken(res.data.token);
        setAwaitingAdminOtp(false);
        clearPendingAdminEmail();
        navigate('/admin/users', { replace: true });
      }
    } catch (err) {
      setMsg(err.response?.data?.message || 'OTP verification failed');
    } finally {
      setIsVerifying(false);
    }
  };

  const handleResend = async () => {
    setResendMsg('');
    const norm = email.trim().toLowerCase();
    if (!norm) {
      setResendMsg('Please enter admin email first.');
      return;
    }
    if (cooldown > 0) return;

    try {
      const res = await api.post('/admin/resend-otp', { email: norm });
      setResendMsg(res.data.message || 'Admin OTP resent');
      setCooldown(RESEND_COOLDOWN_SECONDS);
    } catch (err) {
      const serverMsg = err.response?.data?.message;
      setResendMsg(serverMsg || 'Failed to resend OTP');

      // If backend returns "Please wait 18s..." sync the cooldown
      const waitMatch = serverMsg?.match(/wait\s+(\d+)\s*s/i);
      if (waitMatch) setCooldown(parseInt(waitMatch[1], 10));
    }
  };

  return (
    <div style={{ padding: 20 }}>
      <h3>Admin Verify OTP</h3>
      <form onSubmit={handleVerify}>
        <input
          type="email"
          placeholder="Admin Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        /><br /><br />
        <input
          type="text"
          placeholder="Enter OTP"
          value={otp}
          onChange={(e) => setOtp(e.target.value)}
          required
        /><br /><br />
        <button type="submit" disabled={isVerifying}>
          {isVerifying ? 'Verifying…' : 'Verify'}
        </button>
      </form>

      <div style={{ marginTop: 12 }}>
        <button onClick={handleResend} disabled={!email.trim() || cooldown > 0}>
          {cooldown > 0 ? `Resend OTP (${cooldown}s)` : 'Resend OTP'}
        </button>
        {resendMsg && <p style={{ marginTop: 8 }}>{resendMsg}</p>}
      </div>

      <p style={{ marginTop: 12 }}>{msg}</p>
    </div>
  );
}
