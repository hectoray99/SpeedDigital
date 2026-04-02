Estructura y Arquitectura del Proyecto (Frontend)
Speed-Digital SaaS
Este documento detalla la organización de los archivos, la arquitectura de carpetas y los patrones de diseño utilizados en el frontend de la plataforma.

1. Stack Tecnológico
Core: React 19 + TypeScript.

Build Tool: Vite (Ultra rápido, con soporte para HMR).

Enrutamiento: React Router DOM v7 (Manejo de rutas públicas, privadas y dinámicas por slug).

Estilos y UI: Tailwind CSS, Headless UI (para accesibilidad en modales) y Lucide React (íconos).

Animaciones: Framer Motion.

Backend as a Service (BaaS): Supabase (Auth, Base de datos, Storage).

Manejo de Archivos Externo: Cloudinary.

2. Arquitectura de Carpetas (/src)
El código fuente está organizado siguiendo un patrón de agrupación por características (Feature-based) y responsabilidad.

📂 /src/pages (Vistas y Pantallas)
Aquí reside el núcleo de la navegación. Se divide estrictamente en dos dominios:

/admin (Zona Privada - El SaaS):
Pantallas exclusivas para los dueños de las organizaciones (protegidas por AuthGuard).

/dashboard: Panel principal con métricas financieras y accesos rápidos (Dashboard.tsx).

/finance: Control de caja y listado del libro mayor (Finance.tsx).

/products: Catálogo de ítems, planes o servicios según el rubro (Products.tsx).

/settings: Configuración del tenant, logo y URL pública (slug) (Settings.tsx).

/staff: Gestión de empleados y profesores (Staff.tsx).

/students: Gestión del CRM, clientes o alumnos (Students.tsx, StudentDetail.tsx).

/public (Zona Pública):
Accesible para cualquier usuario de internet o cliente final.

/landing: Landing page promocional del producto SaaS (Landing.tsx).

/login: Flujo de autenticación mixto (Email/Password y Google OAuth) (Login.tsx).

/auth: Callback para capturar la sesión post-redirección de OAuth (AuthCallback.tsx).

/portal: Experiencia del cliente final (Multi-tenant dinámico). Incluye el enrutador público por slug (PublicRouter.tsx), el login con DNI (StudentLogin.tsx) y el dashboard del cliente (StudentPortal.tsx / GymAttendancePublic.tsx).

📂 /src/components (Componentes de UI y Lógica Compartida)
Contiene elementos reutilizables y modales pesados que encapsulan gran parte de la lógica transaccional.

Modales Transaccionales: Formularios flotantes encargados de la creación y edición de datos (ej: CreateOperationModal.tsx, GymOnboardingModal.tsx, RegisterPaymentModal.tsx). Nota arquitectónica: Actualmente, estos modales manejan su propio estado y las llamadas directas a Supabase.

Componentes de Seguridad y Layout:

AuthGuard.tsx: Componente de orden superior (HOC) que verifica la sesión activa antes de renderizar la zona /admin.

MainLayout.tsx: Estructura base del panel de administración (Sidebar, Navbar responsivo) que se adapta dinámicamente según el rubro de la organización.

Componentes Funcionales: Wizards de configuración inicial (OnboardingWizard.tsx) y alertas (DebtorsListModal.tsx).

📂 /src/lib y 📂 /src/services (Infraestructura)
lib/supabase.ts: Inicialización del cliente de Supabase usando variables de entorno.

services/cloudinary.ts: Servicio aislado para la carga de imágenes a Cloudinary (avatares, logos, comprobantes).

3. Patrones de Diseño Detectados (El "Cómo" funciona)
Enrutamiento Protegido: El archivo App.tsx define las rutas. La zona de administración está envuelta en <AuthGuard><MainLayout /></AuthGuard>, garantizando que nadie sin sesión entre al sistema, y proveyendo un layout consistente.

Multi-tenancy en Frontend (Adaptabilidad): El código utiliza diccionarios de configuración (ej: industryConfig en varias pantallas) para cambiar los textos, botones e íconos dependiendo del rubro de la organización (Gym, Gastronomía, Genérico).

Data Fetching: Actualmente, el patrón utilizado es llamar a Supabase directamente dentro de useEffect en cada componente, manejando estados locales de loading, data y error.

Manejo de Formularios y Feedback: Se utiliza fuertemente la librería sonner para dar feedback visual rápido al usuario tras cada transacción (éxitos o errores).

¡Mapa completado!
Ya tenemos la foto desde arriba. Viendo el código, el proyecto es sólido, pero hay varias áreas de optimización crítica que podemos aplicar en la Fase 2 (La Auditoría) para que escale mejor y sea más fácil de mantener:

Los Modales están muy "pesados": Archivos como GymOnboardingModal.tsx tienen muchísima lógica de negocio y llamadas complejas a la base de datos mezcladas con el HTML.

Consultas repetitivas: En varias pantallas (como en los modales) estás buscando el organization_id del usuario logueado en Supabase. Eso genera peticiones extra que podríamos optimizar.

Manejo de errores y tipado: Podemos reforzar TypeScript para evitar que aparezcan errores en producción si cambia alguna tabla.