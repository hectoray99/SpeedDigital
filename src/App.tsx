import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { Toaster } from 'sonner';

// ==========================================
// 1. SEGURIDAD Y LAYOUTS
// ==========================================
import AuthGuard from './components/AuthGuard';
import MainLayout from './components/layout/MainLayout';

// ==========================================
// 2. PÁGINAS PÚBLICAS (Sin sesión requerida)
// ==========================================
import Landing from './pages/public/landing/Landing';
import Login from './pages/public/login/Login';
import AuthCallback from './pages/public/auth/AuthCallback';
import StaffLogin from './pages/public/login/StaffLogin';
import DigitalMenu from './pages/public/menu/DigitalMenu';
import PublicRouter from './pages/public/portal/PublicRouter';
// NOTA: Para más adelante, estos del portal también convendría pasarlos a ClientLogin / ClientPortal
import StudentLogin from './pages/public/portal/StudentLogin';
import StudentPortal from './pages/public/portal/StudentPortal';

// ==========================================
// 3. PÁGINAS PRIVADAS (Solo administradores)
// ==========================================
import Onboarding from './pages/admin/Onboarding'; 
import Dashboard from './pages/admin/dashboard/Dashboard';
import Salon from './pages/admin/salon/Salon';
import Kitchen from './pages/admin/kitchen/Kitchen';
import CashRegister from './pages/admin/finance/CashRegister';
import Products from './pages/admin/products/Products';
import Finance from './pages/admin/finance/Finance';
import Staff from './pages/admin/staff/Staff';
import Settings from './pages/admin/settings/Settings';
import Agenda from './pages/admin/services/Agenda';
import Resources from './pages/admin/services/Resources'; 
import DisciplineManager from './pages/admin/services/DisciplineManager';
import MasterCalendar from './pages/admin/services/MasterCalendar';
import Timeclock from './pages/admin/staff/Timeclock';
import AttendanceReport from './pages/admin/staff/AttendanceReport';
import Payroll from './pages/admin/staff/Payroll';

// --- Cambios de Fase 1 (CRM Híbrido) ---
import Clients from './pages/admin/clients/Clients';
import ClientDetail from './pages/admin/clients/ClientDetail';

// ==========================================
// 4. SUPER ADMIN
// ==========================================
import SuperAdminGuard from './components/SuperAdminGuard';
import SuperAdminLayout from './components/layout/SuperAdminLayout';
import SuperAdminDashboard from './pages/superadmin/SuperAdminDashboard';
import SuperAdminOrganizations from './pages/superadmin/SuperAdminOrganizations';
import SuperAdminSubscriptions from './pages/superadmin/SuperAdminSubscriptions';
import SuperAdminAnnouncements from './pages/superadmin/SuperAdminAnnouncements';
import SuperAdminPromotions from './pages/superadmin/SuperAdminPromotions';

export default function App() {
  return (
    <BrowserRouter>
      {/* Notificaciones Globales de la App */}
      <Toaster position="top-center" richColors />

      <Routes>
        
        {/* =========================================
            ZONA PÚBLICA (Acceso libre)
        ========================================= */}
        <Route path="/" element={<Landing />} />
        <Route path="/login" element={<Login />} />
        <Route path="/auth/callback" element={<AuthCallback />} />
        
        {/* Accesos de clientes y staff basados en el nombre del local (Slug) */}
        <Route path="/m/:slug" element={<DigitalMenu />} />
        <Route path="/staff-login/:slug" element={<StaffLogin />} />
        <Route path="/equipo/:slug" element={<StaffLogin />} />
        <Route path="/p/:slug" element={<PublicRouter />} />

        {/* Portal de Clientes */}
        <Route path="/portal" element={<StudentLogin />} />
        <Route path="/portal/dashboard" element={<StudentPortal />} />


        {/* =========================================
            ZONA PRIVADA (El "Patovica" AuthGuard vigila acá)
        ======================================== */}
        <Route element={<AuthGuard><Outlet /></AuthGuard>}>
          
          <Route path="/onboarding" element={<Onboarding />} />

          <Route element={<MainLayout />}>
            
            <Route path="/admin" element={<Navigate to="/admin/dashboard" replace />} />
            <Route path="/admin/dashboard" element={<Dashboard />} />

            {/* Módulo: Gastronomía / Retail */}
            <Route path="/admin/salon" element={<Salon />} />
            <Route path="/admin/kitchen" element={<Kitchen />} />
            <Route path="/admin/caja" element={<CashRegister />} />
            <Route path="/admin/products" element={<Products />} />

            {/* Módulo: CRM Híbrido (Ex Academias) */}
            <Route path="/admin/clients" element={<Clients />} />
            <Route path="/admin/clients/:id" element={<ClientDetail />} />

            {/* Módulo: Administración General */}
            <Route path="/admin/staff" element={<Staff />} />
            <Route path="/admin/finance" element={<Finance />} />
            <Route path="/admin/timeclock" element={<Timeclock />} />
            <Route path="/admin/attendance" element={<AttendanceReport />} />
            <Route path="/admin/settings" element={<Settings />} />
            <Route path="/admin/payroll" element={<Payroll />} />
            
            
            {/* Módulo: Servicios y Reservas */}
            <Route path="/admin/agenda" element={<Agenda />} />
            <Route path="/admin/resources" element={<Resources />} />
            <Route path="/admin/disciplines" element={<DisciplineManager />} />
            <Route path="/admin/master-calendar" element={<MasterCalendar />} />

          </Route>
        </Route>

        {/* =========================================
            ZONA GOD MODE (SUPER ADMIN)
        ========================================= */}
        <Route element={<SuperAdminGuard />}>
          <Route element={<SuperAdminLayout />}>
            <Route path="/superadmin/dashboard" element={<SuperAdminDashboard />} />
            <Route path="/superadmin/organizations" element={<SuperAdminOrganizations />} />
            <Route path="/superadmin/subscriptions" element={<SuperAdminSubscriptions />} />
            <Route path="/superadmin/promotions" element={<SuperAdminPromotions />} />
            <Route path="/superadmin/announcements" element={<SuperAdminAnnouncements />} />
            {/* Redirección por defecto */}
            <Route path="/superadmin" element={<Navigate to="/superadmin/dashboard" replace />} />
          </Route>
        </Route>

        {/* =========================================
            RUTAS NO ENCONTRADAS (Catch-all)
        ========================================= */}
        <Route path="*" element={<Navigate to="/" replace />} />
        
      </Routes>
    </BrowserRouter>
  );
}