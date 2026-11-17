import React from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { ToastProvider } from './context/ToastContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ParkingProvider } from './context/ParkingContext';
import { Layout } from './components/common/Layout';
import { FullPageLoader } from './components/common/Feedback';
import { pages } from './pages/registry';

import { LandingPage } from './pages/LandingPage';
import { LoginPage } from './pages/LoginPage';
import { RegisterPage } from './pages/RegisterPage';
import { NotFoundPage } from './pages/NotFoundPage';

const homeFor = (isAdmin) => (isAdmin ? '/admin' : '/dashboard');

// Signed-in users only. Remembers where they were headed (including ?query) so QR deep links survive login.
const ProtectedRoute = ({ children }) => {
  const { isAuthenticated, status } = useAuth();
  const location = useLocation();
  if (status === 'loading') return <FullPageLoader label="Restoring your session…" />;
  if (!isAuthenticated) return <Navigate to="/login" state={{ from: `${location.pathname}${location.search}` }} replace />;
  return children;
};

// Login / register are for guests; signed-in users go straight to where they were going.
const GuestRoute = ({ children }) => {
  const { isAuthenticated, isAdmin, status } = useAuth();
  const location = useLocation();
  if (status === 'loading') return <FullPageLoader label="Restoring your session…" />;
  if (isAuthenticated) return <Navigate to={location.state?.from || homeFor(isAdmin)} replace />;
  return children;
};

const RoleRoute = ({ role, children }) => {
  const { isAdmin } = useAuth();
  if (role === 'admin' && !isAdmin) return <Navigate to="/dashboard" replace />;
  if (role === 'driver' && isAdmin) return <Navigate to="/admin" replace />;
  return children;
};

export default function App() {
  const Dashboard = pages.dashboard;
  const QR = pages.qr;
  const Nearby = pages.nearby;
  const Report = pages.report;
  const Admin = pages.admin;
  const Placards = pages.placards;

  return (
    <BrowserRouter>
      <ToastProvider>
        <AuthProvider>
          <ParkingProvider>
            <Routes>
              <Route path="/" element={<LandingPage />} />
              <Route path="/login" element={<GuestRoute><LoginPage /></GuestRoute>} />
              <Route path="/register" element={<GuestRoute><RegisterPage /></GuestRoute>} />

              <Route element={<ProtectedRoute><Layout /></ProtectedRoute>}>
                <Route path="/dashboard" element={<RoleRoute role="driver"><Dashboard /></RoleRoute>} />
                <Route path="/qr-parking" element={<RoleRoute role="driver"><QR /></RoleRoute>} />
                <Route path="/nearby" element={<Nearby />} />
                <Route path="/report-violation" element={<Report />} />
                <Route path="/admin" element={<RoleRoute role="admin"><Admin /></RoleRoute>} />
                <Route path="/admin/placards" element={<RoleRoute role="admin"><Placards /></RoleRoute>} />
              </Route>

              <Route path="*" element={<NotFoundPage />} />
            </Routes>
          </ParkingProvider>
        </AuthProvider>
      </ToastProvider>
    </BrowserRouter>
  );
}
