// src/VerifyOTP.jsx
import React, { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import api from './api';
import { saveToken, clearPendingEmail, setAwaitingOtp } from './auth';

const RESEND_COOLDOWN_SECONDS = 30; // keep in sync with server

export default function VerifyOTP() {
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [msg, setMsg] = useState('');
  const [resendMsg, setResendMsg] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);

  const [cooldown, setCooldown] = useState(0);
  const timerRef = useRef(null);
  const navigate = useNavigate();

  // tick down cooldown timer
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
    setMsg('Verifying...');
    setIsVerifying(true);
    try {
      const payload = {
        email: email.trim().toLowerCase(),
        otp: otp.trim(),
      };
      const res = await api.post('/verify-otp', payload);
      setMsg(res.data.message || 'Verified');

      if (res.data.token) {
        // ✅ Save JWT for API requests
        saveToken(res.data.token);
        // ✅ Clear temporary flags
        clearPendingEmail();
        setAwaitingOtp(false);
        // ✅ Navigate to dashboard
        navigate('/dashboard');
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
      setResendMsg('Please enter your email first.');
      return;
    }
    if (cooldown > 0) return;

    try {
      const res = await api.post('/resend-otp', { email: norm });
      setResendMsg(res.data.message || 'OTP resent');
      setCooldown(RESEND_COOLDOWN_SECONDS);
    } catch (err) {
      const serverMsg = err.response?.data?.message;
      setResendMsg(serverMsg || 'Failed to resend OTP');
      const waitMatch = serverMsg?.match(/wait\s+(\d+)\s*s/i);
      if (waitMatch) setCooldown(parseInt(waitMatch[1], 10));
    }
  };

  return (
    <div style={{ padding: 20 }}>
      <h3>Verify OTP</h3>
      <form onSubmit={handleVerify}>
        <input
          type="email"
          placeholder="Email"
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
