import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/lib/auth-context";
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import AgentDashboard from "./pages/AgentDashboard";
import Leads from "./pages/Leads";
import Properties from "./pages/Properties";
import Projects from "./pages/Projects";
import SiteVisits from "./pages/SiteVisits";
import Pipeline from "./pages/Pipeline";
import Telecalling from "./pages/Telecalling";
import Marketing from "./pages/Marketing";
import Documents from "./pages/Documents";
import Payments from "./pages/Payments";
import Reports from "./pages/Reports";
import Team from "./pages/Team";
import Brokers from "./pages/Brokers"; // ✅ NEW IMPORT
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

// ✅ Protected Route Component
function ProtectedRoute({
  children,
  allowedRoles
}: {
  children: React.ReactNode;
  allowedRoles?: ('admin' | 'sales_manager' | 'sales_agent')[]
}) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    // If user role is not allowed, redirect to their dashboard
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
}

// ✅ Route Configuration Component
function AppRoutes() {
  const { user } = useAuth();

  return (
    <Routes>
      {/* Auth Route */}
      <Route path="/auth" element={
        user ? <Navigate to="/dashboard" replace /> : <Auth />
      } />

      {/* Root redirect */}
      <Route path="/" element={<Navigate to="/dashboard" replace />} />

      {/* Dashboard - Different for Agents vs Admin/Manager */}
      <Route path="/dashboard" element={
        <ProtectedRoute>
          {user?.role === 'sales_agent' ? <AgentDashboard /> : <Dashboard />}
        </ProtectedRoute>
      } />

      {/* Leads - Admin & Manager Only (Agents usually see limited view, but page access is allowed if logic inside handles permissions) */}
      <Route path="/leads" element={
        <ProtectedRoute>
          <Leads />
        </ProtectedRoute>
      } />

      {/* Properties - All Roles */}
      <Route path="/properties" element={
        <ProtectedRoute>
          <Properties />
        </ProtectedRoute>
      } />

      {/* Projects - Admin & Manager Only (Agents usually view only) */}
      <Route path="/projects" element={
        <ProtectedRoute>
          <Projects />
        </ProtectedRoute>
      } />

      {/* Site Visits - All Roles */}
      <Route path="/site-visits" element={
        <ProtectedRoute>
          <SiteVisits />
        </ProtectedRoute>
      } />

      {/* Pipeline/Deals - Admin & Manager Only */}
      <Route path="/pipeline" element={
        <ProtectedRoute allowedRoles={['admin', 'sales_manager']}>
          <Pipeline />
        </ProtectedRoute>
      } />
      
      {/* Legacy route redirect */}
      <Route path="/deals" element={<Navigate to="/pipeline" replace />} />

      {/* Telecalling - All Roles */}
      <Route path="/telecalling" element={
        <ProtectedRoute>
          <Telecalling />
        </ProtectedRoute>
      } />

      {/* Marketing - Admin & Manager Only */}
      <Route path="/marketing" element={
        <ProtectedRoute allowedRoles={['admin', 'sales_manager']}>
          <Marketing />
        </ProtectedRoute>
      } />

      {/* Documents - Admin & Manager Only */}
      <Route path="/documents" element={
        <ProtectedRoute allowedRoles={['admin', 'sales_manager']}>
          <Documents />
        </ProtectedRoute>
      } />

      {/* Payments - Admin & Manager Only */}
      <Route path="/payments" element={
        <ProtectedRoute allowedRoles={['admin', 'sales_manager']}>
          <Payments />
        </ProtectedRoute>
      } />

      {/* Reports - Admin & Manager Only */}
      <Route path="/reports" element={
        <ProtectedRoute allowedRoles={['admin', 'sales_manager']}>
          <Reports />
        </ProtectedRoute>
      } />

      {/* Team - Admin & Manager Only */}
      <Route path="/team" element={
        <ProtectedRoute allowedRoles={['admin', 'sales_manager']}>
          <Team />
        </ProtectedRoute>
      } />

      {/* ✅ NEW: Brokers - Admin & Manager Only */}
      <Route path="/brokers" element={
        <ProtectedRoute allowedRoles={['admin', 'sales_manager']}>
          <Brokers />
        </ProtectedRoute>
      } />

      {/* Settings - All Roles */}
      <Route path="/settings" element={
        <ProtectedRoute>
          <Dashboard />
        </ProtectedRoute>
      } />

      {/* 404 Not Found */}
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

// ✅ Main App Component
const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <AppRoutes />
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;