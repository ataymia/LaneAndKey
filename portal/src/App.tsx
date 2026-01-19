import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts';
import { ProtectedRoute } from './components/auth';
import { AdminLayout, TenantLayout, ApplicantLayout } from './components/layout';

// Public pages
import { LoginPage, SignupPage } from './pages/public';

// Admin pages
import {
  AdminDashboard,
  PropertiesPage,
  TenantsPage,
  ApplicationsPage,
  PaymentsPage,
  InvoicesPage,
  MaintenancePage,
  MessagesPage,
  AlertsPage,
  DocumentsPage,
  SettingsPage,
  UsersPage,
} from './pages/admin';

// Tenant pages
import {
  TenantDashboard,
  TenantLeasePage,
  TenantPaymentsPage,
  PaymentSuccessPage,
  TenantMaintenancePage,
  TenantDocumentsPage,
  TenantMessagesPage,
  TenantAlertsPage,
  TenantSettingsPage,
} from './pages/tenant';

// Applicant pages
import {
  ApplicantDashboard,
  ApplicantApplicationsPage,
  ApplicantDocumentsPage,
  ApplicantMessagesPage,
  ApplicantSettingsPage,
} from './pages/applicant';

// Home redirect based on role
function HomeRedirect() {
  const { userProfile, loading } = useAuth();
  
  if (loading) {
    return <div className="loading">Loading...</div>;
  }
  
  if (!userProfile) {
    return <Navigate to="/login" replace />;
  }
  
  switch (userProfile.role) {
    case 'admin':
      return <Navigate to="/admin" replace />;
    case 'tenant':
      return <Navigate to="/tenant" replace />;
    case 'applicant':
      return <Navigate to="/applicant" replace />;
    default:
      return <Navigate to="/login" replace />;
  }
}

function App() {
  return (
    <BrowserRouter basename="/portal">
      <AuthProvider>
        <Routes>
          {/* Public Routes */}
          <Route path="/login" element={<LoginPage />} />
          <Route path="/signup" element={<SignupPage />} />
          
          {/* Home redirect */}
          <Route path="/" element={<HomeRedirect />} />
          
          {/* Admin Routes */}
          <Route
            path="/admin"
            element={
              <ProtectedRoute allowedRoles={['admin']}>
                <AdminLayout />
              </ProtectedRoute>
            }
          >
            <Route index element={<AdminDashboard />} />
            <Route path="properties" element={<PropertiesPage />} />
            <Route path="tenants" element={<TenantsPage />} />
            <Route path="applications" element={<ApplicationsPage />} />
            <Route path="payments" element={<PaymentsPage />} />
            <Route path="invoices" element={<InvoicesPage />} />
            <Route path="maintenance" element={<MaintenancePage />} />
            <Route path="messages" element={<MessagesPage />} />
            <Route path="alerts" element={<AlertsPage />} />
            <Route path="documents" element={<DocumentsPage />} />
            <Route path="users" element={<UsersPage />} />
            <Route path="settings" element={<SettingsPage />} />
          </Route>
          
          {/* Tenant Routes */}
          <Route
            path="/tenant"
            element={
              <ProtectedRoute allowedRoles={['tenant']}>
                <TenantLayout />
              </ProtectedRoute>
            }
          >
            <Route index element={<TenantDashboard />} />
            <Route path="lease" element={<TenantLeasePage />} />
            <Route path="payments" element={<TenantPaymentsPage />} />
            <Route path="payments/success" element={<PaymentSuccessPage />} />
            <Route path="maintenance" element={<TenantMaintenancePage />} />
            <Route path="documents" element={<TenantDocumentsPage />} />
            <Route path="messages" element={<TenantMessagesPage />} />
            <Route path="alerts" element={<TenantAlertsPage />} />
            <Route path="settings" element={<TenantSettingsPage />} />
          </Route>
          
          {/* Applicant Routes */}
          <Route
            path="/applicant"
            element={
              <ProtectedRoute allowedRoles={['applicant']}>
                <ApplicantLayout />
              </ProtectedRoute>
            }
          >
            <Route index element={<ApplicantDashboard />} />
            <Route path="applications" element={<ApplicantApplicationsPage />} />
            <Route path="documents" element={<ApplicantDocumentsPage />} />
            <Route path="messages" element={<ApplicantMessagesPage />} />
            <Route path="settings" element={<ApplicantSettingsPage />} />
          </Route>
          
          {/* Catch all - redirect to home */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
