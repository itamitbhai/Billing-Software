import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './store/auth.store';

// Auth Pages
import LoginPage from './pages/auth/LoginPage';
import RegisterPage from './pages/auth/RegisterPage';

// Layout
import AppShell from './components/layout/AppShell';

// Main Pages
import GatewayPage from './pages/GatewayPage';
import AccountsPage from './pages/accounts/AccountsPage';
import MastersPage from './pages/masters/MastersPage';
import VouchersPage from './pages/vouchers/VouchersPage';
import VoucherForm from './pages/vouchers/VoucherForm';
import BankingPage from './pages/banking/BankingPage';
import BalanceSheetPage from './pages/reports/BalanceSheetPage';
import ProfitLossPage from './pages/reports/ProfitLossPage';
import StockSummaryPage from './pages/reports/StockSummaryPage';
import DayBookPage from './pages/reports/DayBookPage';
import MoreReportsPage from './pages/reports/MoreReportsPage';
import UtilitiesPage from './pages/utilities/UtilitiesPage';

// Route Guards
function ProtectedRoute({ children }) {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  return isAuthenticated ? children : <Navigate to="/login" replace />;
}

function PublicRoute({ children }) {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  return !isAuthenticated ? children : <Navigate to="/" replace />;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public Routes */}
        <Route path="/login" element={
          <PublicRoute>
            <LoginPage />
          </PublicRoute>
        } />
        <Route path="/register" element={
          <PublicRoute>
            <RegisterPage />
          </PublicRoute>
        } />

        {/* Protected Gateway Routes */}
        <Route path="/" element={
          <ProtectedRoute>
            <AppShell>
              <GatewayPage />
            </AppShell>
          </ProtectedRoute>
        } />
        <Route path="/accounts" element={
          <ProtectedRoute>
            <AppShell>
              <AccountsPage />
            </AppShell>
          </ProtectedRoute>
        } />
        <Route path="/masters" element={
          <ProtectedRoute>
            <AppShell>
              <MastersPage />
            </AppShell>
          </ProtectedRoute>
        } />
        
        {/* Vouchers Routing */}
        <Route path="/vouchers" element={
          <ProtectedRoute>
            <AppShell>
              <VouchersPage />
            </AppShell>
          </ProtectedRoute>
        } />
        <Route path="/vouchers/new" element={
          <ProtectedRoute>
            <AppShell>
              <VoucherForm />
            </AppShell>
          </ProtectedRoute>
        } />

        <Route path="/banking" element={
          <ProtectedRoute>
            <AppShell>
              <BankingPage />
            </AppShell>
          </ProtectedRoute>
        } />

        {/* Display Reports Routing */}
        <Route path="/reports/balance-sheet" element={
          <ProtectedRoute>
            <AppShell>
              <BalanceSheetPage />
            </AppShell>
          </ProtectedRoute>
        } />
        <Route path="/reports/profit-loss" element={
          <ProtectedRoute>
            <AppShell>
              <ProfitLossPage />
            </AppShell>
          </ProtectedRoute>
        } />
        <Route path="/reports/stock-summary" element={
          <ProtectedRoute>
            <AppShell>
              <StockSummaryPage />
            </AppShell>
          </ProtectedRoute>
        } />
        <Route path="/reports/day-book" element={
          <ProtectedRoute>
            <AppShell>
              <DayBookPage />
            </AppShell>
          </ProtectedRoute>
        } />
        <Route path="/reports" element={
          <ProtectedRoute>
            <AppShell>
              <MoreReportsPage />
            </AppShell>
          </ProtectedRoute>
        } />

        {/* Utilities Settings Routing */}
        <Route path="/utilities" element={
          <ProtectedRoute>
            <AppShell>
              <UtilitiesPage />
            </AppShell>
          </ProtectedRoute>
        } />

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
