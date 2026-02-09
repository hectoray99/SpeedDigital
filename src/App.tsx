import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'sonner';

// Páginas Públicas
import Landing from './pages/public/landing/Landing';
import Login from './pages/public/login/Login';
import AuthCallback from './pages/public/auth/AuthCallback';
import StudentLogin from './pages/public/portal/StudentLogin';
import StudentPortal from './pages/public/portal/StudentPortal';

// Páginas Privadas (Admin)
import Dashboard from './pages/admin/dashboard/Dashboard';
import Students from './pages/admin/students/Students';
import StudentDetail from './pages/admin/students/StudentDetail';
import Products from './pages/admin/products/Products';
import Finance from './pages/admin/finance/Finance';
import Settings from './pages/admin/settings/Settings';

// Seguridad y Layout
import AuthGuard from './components/AuthGuard';
import MainLayout from './components/layout/MainLayout';

function App() {
  return (
    <BrowserRouter>
      {/* Notificaciones Globales */}
      <Toaster position="top-center" richColors />

      <Routes>
        {/* --- ZONA PÚBLICA --- */}
        <Route path="/" element={<Landing />} />
        <Route path="/login" element={<Login />} />
        <Route path="/auth/callback" element={<AuthCallback />} />

        {/* PORTAL ALUMNOS */}
        <Route path="/portal" element={<StudentLogin />} />
        <Route path="/portal/dashboard" element={<StudentPortal />} />

        {/* --- ZONA PRIVADA (Protegida por AuthGuard) --- */}
        <Route element={<AuthGuard><MainLayout /></AuthGuard>}>
          <Route path="/admin/dashboard" element={<Dashboard />} />

          {/* Rutas de Alumnos */}
          <Route path="/admin/students" element={<Students />} />
          <Route path="/admin/students/:id" element={<StudentDetail />} />

          {/* Rutas de Gestión */}
          <Route path="/admin/products" element={<Products />} />
          <Route path="/admin/finance" element={<Finance />} />
          <Route path="/admin/settings" element={<Settings />} />
        </Route>

        {/* Cualquier ruta desconocida te manda a la Home */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;