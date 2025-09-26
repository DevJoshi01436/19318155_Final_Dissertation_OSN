// src/AwaitingOtpRoute.jsx
import React from 'react';
import { Navigate } from 'react-router-dom';
import { isAuthenticated, isAwaitingOtp } from './auth';

export default function AwaitingOtpRoute({ children }) {
  // If already authenticated, no need to verify
  if (isAuthenticated()) return <Navigate to="/dashboard" replace />;
  // Only allow when user has just logged in and is awaiting OTP
  if (!isAwaitingOtp()) return <Navigate to="/login" replace />;
  return children;
}
