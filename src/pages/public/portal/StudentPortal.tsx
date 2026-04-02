import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '../../../lib/supabase';
import { usePortalStore } from '../../../store/portalStore';
import { motion } from 'framer-motion';
import { 
    LogOut, Calendar, User, 
    Loader2, Receipt, Clock, FileText 
} from 'lucide-react';
import { toast } from 'sonner';

// Definimos los tipos para TypeScript basados en tu BD
interface StudentData {
    full_name: string;
    email: string;
    identifier: string;
}

export default function StudentPortal() {
    const { slug } = useParams();
    const navigate = useNavigate();
    
    // Traemos el cerebro de la sesión pública
    const { studentId, orgSlug, logoutStudent } = usePortalStore();

    const [student, setStudent] = useState<StudentData | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'turnos' | 'finanzas'>('turnos');

    useEffect(() => {
        // 🔒 CANDADO DE SEGURIDAD: Si no hay sesión o quisieron cambiar la URL
        if (!studentId || orgSlug !== slug) {
            logoutStudent(); // Destruimos cualquier dato residual
            navigate(`/portal/${slug}/login`, { replace: true });
            return;
        }

        // Si la sesión es válida, traemos sus datos
        fetchStudentData();
    }, [studentId, orgSlug, slug, navigate]);

    const fetchStudentData = async () => {
        setIsLoading(true);
        try {
            // Consultamos los datos básicos del alumno
            const { data, error } = await supabase
                .from('crm_people')
                .select('full_name, email, identifier')
                .eq('id', studentId)
                .single();

            if (error) throw error;
            setStudent(data);

            // ACA PODÉS AGREGAR LAS LLAMADAS A TUS OTRAS TABLAS:
            // Ejemplo: fetchAppointments(), fetchOperations()...

        } catch (error) {
            console.error('Error al cargar el portal:', error);
            toast.error('Hubo un problema al cargar tu información');
        } finally {
            setIsLoading(false);
        }
    };

    const handleLogout = () => {
        logoutStudent();
        toast.success('Sesión cerrada correctamente');
        navigate(`/portal/${slug}/login`, { replace: true });
    };

    // Pantalla de carga mientras se verifica la seguridad
    if (isLoading || !student) {
        return (
            <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center">
                <Loader2 className="w-10 h-10 animate-spin text-brand-500 mb-4" />
                <p className="text-slate-500 font-medium animate-pulse">Cargando tu portal...</p>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-50">
            {/* Navbar del Portal */}
            <nav className="bg-white shadow-sm border-b border-slate-200 sticky top-0 z-50">
                <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex justify-between items-center h-16">
                        <div className="flex items-center gap-3">
                            <div className="bg-brand-100 p-2 rounded-lg text-brand-600">
                                <User className="w-5 h-5" />
                            </div>
                            <div>
                                <h1 className="text-lg font-bold text-slate-900 leading-tight">
                                    Mi Portal
                                </h1>
                                <p className="text-xs text-slate-500 font-medium">
                                    {slug?.toUpperCase()}
                                </p>
                            </div>
                        </div>
                        <button 
                            onClick={handleLogout}
                            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        >
                            <LogOut className="w-4 h-4" />
                            <span className="hidden sm:inline">Cerrar Sesión</span>
                        </button>
                    </div>
                </div>
            </nav>

            {/* Contenido Principal */}
            <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                
                {/* Cabecera de Bienvenida */}
                <motion.div 
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-gradient-to-br from-brand-600 to-indigo-700 rounded-3xl p-8 text-white shadow-xl shadow-indigo-900/10 mb-8 relative overflow-hidden"
                >
                    <div className="relative z-10">
                        <h2 className="text-3xl font-bold mb-2">
                            ¡Hola, {student.full_name.split(' ')[0]}! 👋
                        </h2>
                        <p className="text-white/80 text-lg">
                            DNI: {student.identifier} • {student.email}
                        </p>
                    </div>
                    {/* Elemento decorativo de fondo */}
                    <div className="absolute -right-10 -top-10 w-64 h-64 bg-white/10 rounded-full blur-3xl"></div>
                </motion.div>

                {/* Navegación por Pestañas */}
                <div className="flex gap-4 mb-6 border-b border-slate-200">
                    <button
                        onClick={() => setActiveTab('turnos')}
                        className={`pb-4 px-4 font-bold text-sm transition-all flex items-center gap-2 border-b-2 ${
                            activeTab === 'turnos' 
                                ? 'border-brand-500 text-brand-600' 
                                : 'border-transparent text-slate-500 hover:text-slate-700'
                        }`}
                    >
                        <Calendar className="w-4 h-4" /> Mis Turnos
                    </button>
                    <button
                        onClick={() => setActiveTab('finanzas')}
                        className={`pb-4 px-4 font-bold text-sm transition-all flex items-center gap-2 border-b-2 ${
                            activeTab === 'finanzas' 
                                ? 'border-brand-500 text-brand-600' 
                                : 'border-transparent text-slate-500 hover:text-slate-700'
                        }`}
                    >
                        <Receipt className="w-4 h-4" /> Estado de Cuenta
                    </button>
                </div>

                {/* Área dinámica según la pestaña seleccionada */}
                <motion.div 
                    key={activeTab}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.3 }}
                >
                    {activeTab === 'turnos' ? (
                        <div className="bg-white rounded-2xl p-8 border border-slate-100 shadow-sm text-center">
                            <Clock className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                            <h3 className="text-lg font-bold text-slate-700">No hay próximos turnos</h3>
                            <p className="text-slate-500 mt-2">Aún no tenés reservas activas en tu agenda.</p>
                            {/* Acá podés mapear tus turnos reales en el futuro */}
                        </div>
                    ) : (
                        <div className="bg-white rounded-2xl p-8 border border-slate-100 shadow-sm text-center">
                            <FileText className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                            <h3 className="text-lg font-bold text-slate-700">Al día</h3>
                            <p className="text-slate-500 mt-2">No registramos deuda en tu estado de cuenta.</p>
                            {/* Acá podés mapear tus operations/finance reales en el futuro */}
                        </div>
                    )}
                </motion.div>

            </main>
        </div>
    );
}