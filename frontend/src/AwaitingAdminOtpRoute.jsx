import React from 'react';
import { Navigate } from 'react-router-dom';
import { isAwaitingAdminOtp } from './auth';

export default function AwaitingAdminOtpRoute({ children }) {
  if (!isAwaitingAdminOtp()) return <Navigate to="/admin/login" replace />;
  return children;
}
