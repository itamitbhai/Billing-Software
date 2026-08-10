import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './store/auth.store';

// Auth Pages
import LoginPage from './pages/auth/LoginPage';
// RegisterPage is intentionally unrouted — public self-registration is
// disabled, see backend/src/core/auth/auth.module.js.

// Layout
import AppShell from './components/layout/AppShell';

// Main Pages
import GatewayPage from './pages/GatewayPage';
import AccountsPage from './pages/accounts/AccountsPage';
import MastersPage from './pages/masters/MastersPage';
import VouchersPage from './pages/vouchers/VouchersPage';
import VoucherForm from './pages/vouchers/VoucherForm';
import SalesPage from './pages/sales/SalesPage';
import SaleForm from './pages/sales/SaleForm';
import InvoicePrint from './pages/sales/InvoicePrint';
import PurchasesPage from './pages/purchases/PurchasesPage';
import PurchaseForm from './pages/purchases/PurchaseForm';
import PaymentsPage from './pages/payments/PaymentsPage';
import BankingPage from './pages/banking/BankingPage';
import BalanceSheetPage from './pages/reports/BalanceSheetPage';
import ProfitLossPage from './pages/reports/ProfitLossPage';
import StockSummaryPage from './pages/reports/StockSummaryPage';
import DayBookPage from './pages/reports/DayBookPage';
import MoreReportsPage from './pages/reports/MoreReportsPage';
import GstReportsPage from './pages/reports/GstReportsPage';
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
        
        {/* Sales & GST Invoice Routing */}
        <Route path="/sales" element={
          <ProtectedRoute>
            <AppShell>
              <SalesPage />
            </AppShell>
          </ProtectedRoute>
        } />
        <Route path="/sales/new" element={
          <ProtectedRoute>
            <AppShell>
              <SaleForm />
            </AppShell>
          </ProtectedRoute>
        } />
        {/* Standalone print sheet — deliberately outside AppShell so the sidebar/header never print */}
        <Route path="/sales/:id/invoice" element={
          <ProtectedRoute>
            <InvoicePrint />
          </ProtectedRoute>
        } />

        {/* Purchases Routing */}
        <Route path="/purchases" element={
          <ProtectedRoute>
            <AppShell>
              <PurchasesPage />
            </AppShell>
          </ProtectedRoute>
        } />
        <Route path="/purchases/new" element={
          <ProtectedRoute>
            <AppShell>
              <PurchaseForm />
            </AppShell>
          </ProtectedRoute>
        } />

        {/* Payments Routing */}
        <Route path="/payments" element={
          <ProtectedRoute>
            <AppShell>
              <PaymentsPage />
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
        <Route path="/vouchers/:id/edit" element={
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
        <Route path="/reports/gst" element={
          <ProtectedRoute>
            <AppShell>
              <GstReportsPage />
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
