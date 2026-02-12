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
import Brokers from "./pages/Brokers";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

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
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
}

function AppRoutes() {
  const { user } = useAuth();

  return (
    <Routes>
      <Route path="/auth" element={
        user ? <Navigate to="/dashboard" replace /> : <Auth />
      } />

      <Route path="/" element={<Navigate to="/dashboard" replace />} />

      <Route path="/dashboard" element={
        <ProtectedRoute>
          {user?.role === 'sales_agent' ? <AgentDashboard /> : <Dashboard />}
        </ProtectedRoute>
      } />

      {/* Leads - All roles can access (filtered by backend) */}
      <Route path="/leads" element={
        <ProtectedRoute>
          <Leads />
        </ProtectedRoute>
      } />

      <Route path="/properties" element={
        <ProtectedRoute>
          <Properties />
        </ProtectedRoute>
      } />

      <Route path="/projects" element={
        <ProtectedRoute>
          <Projects />
        </ProtectedRoute>
      } />

      <Route path="/site-visits" element={
        <ProtectedRoute>
          <SiteVisits />
        </ProtectedRoute>
      } />

      <Route path="/pipeline" element={
        <ProtectedRoute allowedRoles={['admin', 'sales_manager']}>
          <Pipeline />
        </ProtectedRoute>
      } />
      
      <Route path="/deals" element={<Navigate to="/pipeline" replace />} />

      {/* ✅ TELECALLING RESTRICTED TO ADMIN/MANAGER ONLY */}
      <Route path="/telecalling" element={
        <ProtectedRoute allowedRoles={['admin', 'sales_manager']}>
          <Telecalling />
        </ProtectedRoute>
      } />

      <Route path="/marketing" element={
        <ProtectedRoute allowedRoles={['admin', 'sales_manager']}>
          <Marketing />
        </ProtectedRoute>
      } />

      <Route path="/documents" element={
        <ProtectedRoute allowedRoles={['admin', 'sales_manager']}>
          <Documents />
        </ProtectedRoute>
      } />

      <Route path="/payments" element={
        <ProtectedRoute allowedRoles={['admin', 'sales_manager']}>
          <Payments />
        </ProtectedRoute>
      } />

      <Route path="/reports" element={
        <ProtectedRoute allowedRoles={['admin', 'sales_manager']}>
          <Reports />
        </ProtectedRoute>
      } />

      <Route path="/team" element={
        <ProtectedRoute allowedRoles={['admin', 'sales_manager']}>
          <Team />
        </ProtectedRoute>
      } />

      <Route path="/brokers" element={
        <ProtectedRoute allowedRoles={['admin', 'sales_manager']}>
          <Brokers />
        </ProtectedRoute>
      } />

      <Route path="/settings" element={
        <ProtectedRoute>
          <Dashboard />
        </ProtectedRoute>
      } />

      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

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