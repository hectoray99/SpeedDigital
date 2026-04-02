                La Biblia de la Base de Datos
Capítulo 1: Arquitectura General y Multi-tenancy
    Este capítulo describe la estructura a nivel de esquemas de la base de datos y detalla el mecanismo central de aislamiento de datos (Multi-tenancy) que garantiza que cada cliente (organización) acceda únicamente a su propia información.

1.1. Esquemas (Schemas) de la Base de Datos
    El proyecto utiliza la estructura de esquemas estándar de Supabase, separando las responsabilidades de forma clara para mayor seguridad y organización:

public: Es el esquema principal y donde reside toda la lógica de negocio del SaaS. Aquí se encuentran las tablas creadas a medida (organizations, profiles, operations, crm_people, etc.) y donde se aplican las políticas de seguridad de nivel de fila (RLS).

auth: Esquema gestionado por Supabase. Contiene todas las tablas internas para el manejo de identidades, usuarios (auth.users), sesiones, autenticación multifactor (MFA), integraciones OAuth y auditoría. Nota: Nunca se debe insertar o modificar datos directamente aquí desde el frontend.

storage: Esquema gestionado por Supabase para el almacenamiento de archivos. Administra los buckets, objetos (archivos) y metadatos asociados.

extensions: Reservado para las extensiones de PostgreSQL (como la generación de UUIDs, pg_cron, pg_net para peticiones HTTP, y pg_graphql).

1.2. El Motor Multi-tenant (Aislamiento de Datos)
El corazón de la arquitectura SaaS es la capacidad de aislar los datos por "inquilino" (tenant). En este proyecto, el tenant es la Organización.

Para lograr esto, se utiliza una función clave en PostgreSQL que se invoca en todas las políticas de seguridad (RLS) de las tablas operativas.

Función: public.get_auth_orgs()
Propósito: Identificar a qué organizaciones pertenece el usuario que está actualmente autenticado.

Tipo de Retorno: Un array de identificadores (uuid[]).

Nivel de Seguridad: SECURITY DEFINER. Esto es crucial, ya que permite que la función consulte la tabla organization_members evadiendo temporalmente las restricciones RLS, garantizando que el usuario pueda obtener su lista de permisos al iniciar sesión.

Lógica interna:

SQL
CREATE OR REPLACE FUNCTION "public"."get_auth_orgs"() RETURNS "uuid"[]
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'extensions'
    AS $$
BEGIN
  RETURN ARRAY(
    SELECT organization_id 
    FROM organization_members 
    WHERE profile_id = auth.uid() -- Compara contra el ID del usuario logueado en Supabase
  );
END;
$$;
Impacto: Cualquier tabla que tenga una columna organization_id utilizará esta función en sus políticas RLS para validar si el usuario tiene derecho a interactuar con esa fila.

1.3. Flujo Automático de Registro (Onboarding)
El sistema automatiza la creación del entorno de trabajo (tenant) en el momento exacto en que un usuario se registra en la plataforma. Esto se logra mediante la combinación de un Trigger y una Función de Base de Datos.

Trigger: on_auth_user_created
Se dispara de forma automática (AFTER INSERT) cada vez que un nuevo registro es insertado en la tabla auth.users (gestionada por Supabase).

Función: public.handle_new_user()
Cuando el trigger se dispara, ejecuta esta función, que realiza tres operaciones en cascada dentro de una misma transacción:

Creación de la Organización: Inserta un nuevo registro en public.organizations.

Nombre por defecto: Concatena la frase 'Academia de ' con el correo electrónico del usuario.

Estado: Marca setup_completed como FALSE, lo que permite detectar si el usuario aún debe completar el asistente de configuración inicial en el frontend.

Captura el id (UUID) generado para esta nueva organización.

Creación del Perfil Público:
Inserta un registro en public.profiles.

Vincula el ID del usuario (NEW.id) y su correo electrónico (NEW.email).

Extrae el nombre completo desde los metadatos de autenticación (NEW.raw_user_meta_data->>'full_name').

Le asigna automáticamente el organization_id recién creado en el paso 1.

Asignación de Permisos (Membresía):
Inserta un registro en public.organization_members.

Vincula la nueva organización con el nuevo perfil.

Le otorga automáticamente el rol de 'owner' (propietario) al usuario.

Lógica interna:

SQL
CREATE OR REPLACE FUNCTION "public"."handle_new_user"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER ...
BEGIN
    -- 1. Crea la organización
    INSERT INTO public.organizations (name, setup_completed)
    VALUES ('Academia de ' || NEW.email, FALSE)
    RETURNING id INTO new_org_id;

    -- 2. Crea el perfil
    INSERT INTO public.profiles (id, email, full_name, organization_id)
    VALUES (NEW.id, NEW.email, NEW.raw_user_meta_data->>'full_name', new_org_id);

    -- 3. Asigna el rol de dueño
    INSERT INTO public.organization_members (organization_id, profile_id, role)
    VALUES (new_org_id, NEW.id, 'owner');

    RETURN NEW;
END;



----------------------------------------------
Capítulo 2: Tipos de Datos y Enums (Diccionario de Datos)
Para garantizar la integridad de los datos y evitar errores de tipeo en los estados y clasificaciones de la plataforma, la base de datos utiliza Tipos Enumerados (ENUM). Esto restringe los valores posibles que puede tomar una columna a una lista predefinida estrictamente controlada.

A continuación, se detalla el diccionario de datos separado por esquemas.

2.1. Tipos del Esquema Público (Reglas de Negocio SaaS)
Estos son los pilares sobre los que se construye la lógica de la aplicación. Definen roles, estados de operaciones y tipos de entidades.

user_role (Roles de Usuario)

Uso: Define el nivel de acceso y los permisos de un usuario dentro de una organización específica (tabla organization_members).

Valores permitidos:

'owner': Propietario de la organización (control total).

'admin': Administrador (gestión operativa amplia).

'staff': Empleado/Staff (acceso operativo estándar).

'viewer': Espectador (acceso de solo lectura).

industry_type (Tipos de Industria)

Uso: Clasifica a las organizaciones en el momento del registro o configuración para adaptar la plataforma a su nicho (tabla organizations).

Valores permitidos: 'gym', 'gastronomy', 'retail', 'services', 'accounting', 'automotive', 'health', 'hospitality', 'real_estate', 'beauty', 'education', 'generic'.

crm_person_type (Clasificación de Personas/Contactos)

Uso: Categoriza a las entidades dentro del módulo CRM (tabla crm_people) para segmentar entre clientes, equipo o proveedores.

Valores permitidos:

'client': Cliente final.

'supplier': Proveedor.

'employee': Empleado (para gestión interna).

'lead': Prospecto o cliente potencial.

'staff': Miembro del staff operativo.

catalog_item_type (Tipos de Items del Catálogo)

Uso: Define la naturaleza de lo que la organización vende u ofrece (tabla catalog_items), lo cual impacta en cómo se maneja el stock.

Valores permitidos:

'product': Bien físico (susceptible a control de stock).

'service': Servicio prestado (no requiere stock).

'subscription': Suscripción o cobro recurrente.

operation_status (Estados de Operación Comercial)

Uso: Ciclo de vida de una transacción, factura, pedido o venta (tabla operations).

Valores permitidos:

'draft': Borrador (aún no confirmada).

'pending': Pendiente de pago o procesamiento.

'in_progress': En curso.

'paid': Pagada (impacta en finanzas).

'completed': Finalizada y entregada.

'cancelled': Anulada (revierte movimientos).

finance_type (Tipos de Movimiento Financiero)

Uso: Clasifica el flujo de caja en el libro mayor (tabla finance_ledger).

Valores permitidos:

'income': Ingreso de dinero.

'expense': Egreso o gasto.

appointment_status (Estados de Turnos y Citas)

Uso: Gestiona el ciclo de vida de las reservas en la agenda (tabla appointments).

Valores permitidos:

'pending': Pendiente de confirmación.

'confirmed': Turno confirmado por el cliente/staff.

'attended': El cliente asistió.

'no_show': El cliente no se presentó.

'cancelled': Turno cancelado.

2.2. Tipos del Esquema de Sistema (Auth y Storage)
Para mantener la exhaustividad técnica, la base de datos también define Enums internos gestionados por Supabase.

Esquema storage (Archivos):

buckettype: Define el comportamiento del contenedor de archivos ('STANDARD', 'ANALYTICS', 'VECTOR').

Esquema auth (Autenticación y Seguridad):

aal_level: Niveles de seguridad ('aal1', 'aal2', 'aal3').

factor_type: Métodos de autenticación 2FA ('totp', 'webauthn', 'phone').

factor_status: Estado del 2FA ('unverified', 'verified').

code_challenge_method: Para flujos PKCE ('s256', 'plain').

oauth_client_type y oauth_registration_type: Configuración de clientes OAuth.

oauth_authorization_status: Estados de autorización OAuth ('pending', 'approved', 'denied', 'expired').

one_time_token_type: Clasifica los tokens mágicos y de recuperación ('confirmation_token', 'reauthentication_token', 'recovery_token', 'email_change_token_new', 'email_change_token_current', 'phone_change_token').


--------------------------------------
Capítulo 3: Tablas Core (Identidad y Organización)
El núcleo del sistema SaaS se basa en tres tablas principales dentro del esquema public. Estas tablas gestionan la identidad de los negocios (organizaciones), los perfiles de los usuarios extendidos (más allá de la autenticación básica) y la relación (membresía) entre ambos.

3.1. Tabla: organizations
Es la tabla principal del sistema multi-tenant. Cada registro representa a un cliente o empresa distinta que utiliza la plataforma. Toda la información del sistema orbita alrededor del id de esta tabla.

Estructura de Columnas:

id (uuid): Clave Primaria (PK). Generada automáticamente usando extensions.uuid_generate_v4().

name (text): Nombre de la organización. Obligatorio (NOT NULL).

slug (text): Identificador único amigable para URLs. Tiene un constraint UNIQUE.

industry (public.industry_type): Clasificación del rubro. Valor por defecto: 'generic'.

logo_url (text): URL de la imagen del logotipo.

brand_colors (jsonb): Almacena los colores corporativos. Valor por defecto: '{"primary": "#3b82f6"}'.

settings (jsonb): Configuraciones específicas del tenant (moneda, zona horaria, preferencias). Valor por defecto: '{ }'.

setup_completed (boolean): Bandera para el onboarding. Valor por defecto: false.

created_at / updated_at (timestamp with time zone): Fechas de auditoría, por defecto now().

3.2. Tabla: profiles
Esta tabla es una extensión de la tabla interna auth.users de Supabase. Mientras que auth.users maneja contraseñas de forma segura, profiles almacena la información pública y operativa del usuario dentro de la plataforma.

Estructura de Columnas:

id (uuid): Clave Primaria (PK). También actúa como Clave Foránea (FK) que apunta directamente a auth.users(id) con ON DELETE CASCADE. Si se borra el usuario en Supabase, se borra su perfil automáticamente.

email (text): Correo electrónico del usuario (copiado desde Auth por conveniencia).

full_name (text): Nombre completo.

avatar_url (text): URL de la foto de perfil.

organization_id (uuid): Clave Foránea (FK) que apunta a organizations(id). Define la organización activa o principal del usuario.

created_at (timestamp with time zone): Fecha de creación, por defecto now().

3.3. Tabla: organization_members
Es la tabla intermedia o "pivot" que resuelve la relación Muchos a Muchos (N:M) entre Usuarios y Organizaciones. Define qué nivel de acceso tiene una persona dentro de una empresa específica.

Estructura de Columnas:

organization_id (uuid): Clave Foránea apuntando a organizations(id) con eliminación en cascada (ON DELETE CASCADE).

profile_id (uuid): Clave Foránea apuntando a profiles(id) con eliminación en cascada (ON DELETE CASCADE).

role (public.user_role): Nivel de permisos. Valor por defecto: 'owner'.

created_at (timestamp with time zone): Fecha de asignación del rol.

Restricciones (Constraints):

Clave Primaria Compuesta: PRIMARY KEY (organization_id, profile_id). Esto garantiza que un usuario no pueda ser insertado dos veces en la misma organización.

3.4. Relaciones Core (Diagrama Mental)
Un Usuario de Supabase (auth.users) tiene exactamente un Perfil (profiles). Relación 1:1.

Una Organización (organizations) puede tener muchos Miembros (organization_members).

Un Perfil (profiles) puede pertenecer a muchas Membresías (organization_members), lo que le permite a un mismo usuario cambiar de contexto y administrar varios negocios si fuera necesario.

--------------------------------

Capítulo 4: Módulo CRM, Recursos y Catálogo
Estas tablas almacenan las entidades maestras que cada organización gestiona. Todas están fuertemente vinculadas a la tabla organizations mediante un organization_id para mantener el aislamiento de datos (Multi-tenancy).

4.1. Tabla: crm_people (Directorio / CRM)
Almacena toda la información de las personas que interactúan con la organización: clientes, proveedores, leads y staff.

Estructura de Columnas:

id (uuid): Clave Primaria (PK), generada por uuid_generate_v4().

organization_id (uuid): Clave Foránea (FK). Apunta a organizations(id) con ON DELETE CASCADE. Si la organización se elimina, sus contactos también.

full_name (text): Nombre completo. Obligatorio (NOT NULL).

identifier (text): DNI, CUIL, RUT, o número de identificación fiscal.

email (text): Correo electrónico de contacto.

phone (text): Teléfono de contacto.

type (public.crm_person_type): Define el rol de la persona. Valor por defecto: 'client'.

tags (text[]): Arreglo de strings para etiquetar y segmentar contactos (ej: ['vip', 'moroso']).

details (jsonb): Campo flexible para guardar datos extra (fecha de nacimiento, dirección, notas médicas). Valor por defecto: '{ }'.

is_active (boolean): Borrado lógico. Valor por defecto: true.

portal_password (text): Contraseña para un posible portal de autogestión de clientes.

created_at / updated_at (timestamp with time zone): Auditoría.

Índices Clave:

idx_crm_people_org: B-Tree sobre organization_id para búsquedas rápidas por tenant.

idx_crm_people_details: Índice GIN sobre el campo details para permitir búsquedas eficientes dentro del JSON (por ejemplo, buscar todos los clientes de una ciudad específica guardada en el JSON).

4.2. Tabla: resources (Recursos y Espacios)
Gestiona los recursos físicos o virtuales que pueden ser reservados, agendados o asignados (ej. consultorios, canchas, máquinas, profesores).

Estructura de Columnas:

id (uuid): Clave Primaria (PK).

organization_id (uuid): Clave Foránea (FK). Apunta a organizations(id) con ON DELETE CASCADE.

name (text): Nombre del recurso (ej. "Cancha 1", "Consultorio A"). Obligatorio (NOT NULL).

description (text): Detalle interno sobre el recurso.

capacity (integer): Cuántas personas u operaciones soporta en simultáneo. Valor por defecto: 1.

color (text): Código de color (HEX) para renderizar en calendarios. Valor por defecto: '#3b82f6'.

availability_rules (jsonb): Motor de disponibilidad. Guarda los horarios de apertura, días de descanso o bloqueos en formato JSON. Valor por defecto: '{ }'.

is_active (boolean): Permite deshabilitar un recurso sin borrar su historial. Valor por defecto: true.

created_at (timestamp with time zone).

Índices Clave:

idx_resources_org: B-Tree sobre organization_id para aislar rápidamente los recursos del tenant.

4.3. Tabla: catalog_items (Productos y Servicios)
Es el inventario de lo que la empresa vende, ya sean productos físicos, servicios o suscripciones.

Estructura de Columnas:

    id (uuid): Clave Primaria (PK).

    organization_id (uuid): Clave Foránea (FK). Apunta a organizations(id) con ON DELETE CASCADE.

    name (text): Nombre del producto/servicio. Obligatorio (NOT NULL).

    sku (text): Código único de referencia (Stock Keeping Unit).

    type (public.catalog_item_type): Define si es producto, servicio o suscripción. Valor por defecto: 'product'.

    price (numeric(10,2)): Precio de venta al público. Soporta hasta 99 millones con 2 decimales. Valor por defecto: 0.

    cost (numeric(10,2)): Costo interno para calcular márgenes de ganancia. Valor por defecto: 0.

    track_stock (boolean): Bandera que indica si el sistema debe descontar inventario al vender. Valor por defecto: false.

    stock_current (numeric(10,2)): Cantidad actual en inventario. Valor por defecto: 0.

    properties (jsonb): Atributos dinámicos del ítem (talle, color, marca, peso). Valor por defecto: '{ }'.

    is_active (boolean): Si el ítem está disponible para la venta. Valor por defecto: true.

    created_at (timestamp with time zone).

Índices Clave:

    idx_catalog_items_org: B-Tree sobre organization_id.

    idx_catalog_items_properties: Índice GIN sobre properties para filtrar rápidamente el catálogo por atributos específicos (ej. buscar todos los ítems talla "M").



----------------------------

Capítulo 5: Módulo Operativo e Inventario
Este módulo es el responsable de registrar cada transacción comercial, el detalle de lo vendido o reservado, las variaciones de stock físico y la agenda de turnos. Todo está fuertemente interconectado.

5.1. Tabla: operations (Operaciones / Facturación)
Es la cabecera de cualquier transacción comercial (una venta, un pedido, un presupuesto o una factura). Agrupa la información general de la operación.

Estructura de Columnas:

id (uuid): Clave Primaria (PK).

organization_id (uuid): Clave Foránea (FK) a organizations(id) con ON DELETE CASCADE.

person_id (uuid): Clave Foránea (FK) a crm_people(id). Si el cliente se borra, este campo queda en NULL (ON DELETE SET NULL) para no perder el registro histórico de la venta.

number (integer): Número correlativo de la operación. Se genera automáticamente mediante la secuencia de PostgreSQL public.operations_number_seq. Obligatorio (NOT NULL).

status (public.operation_status): Estado actual de la transacción. Valor por defecto: 'pending'.

total_amount (numeric(15,2)): Monto total de la operación. Soporta números gigantes. Valor por defecto: 0.

balance (numeric(15,2)): Saldo pendiente de pago (ideal para cuentas corrientes). Valor por defecto: 0.

metadata (jsonb): Campo flexible para guardar datos extra de la operación (ej: comprobante AFIP, método de envío, notas). Valor por defecto: '{ }'.

created_at / updated_at (timestamp with time zone).

Índices Clave:

idx_operations_org: B-Tree sobre organization_id.

idx_operations_person: B-Tree sobre person_id para ver rápido el historial de un cliente.

idx_operations_metadata: Índice GIN sobre metadata para búsquedas profundas.

5.2. Tabla: operation_lines (Líneas de Operación / Detalle)
Contiene el detalle fila por fila de cada ítem (producto o servicio) incluido dentro de una operación.

Estructura de Columnas:

id (uuid): Clave Primaria (PK).

organization_id (uuid): Clave Foránea (FK) a organizations(id) con ON DELETE CASCADE.

operation_id (uuid): Clave Foránea (FK) a operations(id). Si se borra la operación cabecera, se borran sus líneas (ON DELETE CASCADE). Obligatorio (NOT NULL).

item_id (uuid): Clave Foránea (FK) al producto/servicio en catalog_items(id).

quantity (numeric(10,2)): Cantidad vendida (soporta decimales por si vendés por kilo o litro). Valor por defecto: 1.

unit_price (numeric(15,2)): Precio unitario al momento de la venta. Valor por defecto: 0.

subtotal (numeric(15,2)): ¡Columna Calculada! (GENERATED ALWAYS AS (quantity * unit_price) STORED). La base de datos calcula automáticamente este valor y lo guarda físicamente, evitando errores de cálculo desde el backend.

notes (text): Aclaraciones específicas para esta línea (ej: "Sin sal").

created_at (timestamp with time zone).

Índices Clave:

idx_lines_org, idx_lines_operation, idx_lines_item: Índices B-Tree para optimizar los reportes de ventas cruzadas.

5.3. Tabla: inventory_movements (Movimientos de Inventario)
Registra el historial inmutable de entradas y salidas de stock para llevar la trazabilidad del catálogo.

Estructura de Columnas:

id (uuid): Clave Primaria (PK).

organization_id (uuid): Clave Foránea (FK) a organizations(id) con ON DELETE CASCADE.

item_id (uuid): Clave Foránea (FK) a catalog_items(id) con ON DELETE CASCADE. Obligatorio (NOT NULL).

quantity (numeric(10,2)): Cantidad que se suma (positivo) o se resta (negativo) al stock. Obligatorio (NOT NULL).

reason (text): Motivo del movimiento (ej: "Venta #123", "Ajuste por rotura", "Ingreso de proveedor").

created_at (timestamp with time zone).

Índices Clave:

idx_inventory_org y idx_inventory_item: Índices B-Tree para calcular rápidamente el stock histórico de un producto.

5.4. Tabla: appointments (Turnos y Citas)
Gestiona la agenda, conectando un recurso físico, un cliente y el espacio temporal. Es clave para negocios orientados a servicios (canchas, consultorios, salones).

Estructura de Columnas:

id (uuid): Clave Primaria (PK).

organization_id (uuid): Clave Foránea (FK) a organizations(id) con ON DELETE CASCADE.

resource_id (uuid): Clave Foránea (FK) al espacio agendado en resources(id).

person_id (uuid): Clave Foránea (FK) al cliente en crm_people(id). Si se borra la persona, queda NULL (ON DELETE SET NULL) para no romper la estadística de ocupación del recurso.

operation_id (uuid): Clave Foránea (FK) a operations(id). Vincula directamente el turno con su factura o cobro (ON DELETE SET NULL).

start_time (timestamp with time zone): Inicio del turno. Obligatorio (NOT NULL).

end_time (timestamp with time zone): Fin del turno. Obligatorio (NOT NULL).

status (public.appointment_status): Estado del turno. Valor por defecto: 'pending'.

notes (text): Notas para el turno (ej: "Llegará 5 min tarde").

created_at / updated_at (timestamp with time zone).

Índices Clave:

idx_appointments_dates: Índice B-Tree compuesto sobre (start_time, end_time) para que la validación de solapamiento de turnos en la agenda vuele.

idx_appointments_org, idx_appointments_resource, idx_appointments_person, idx_appointments_operation: Índices sobre todas las claves foráneas.


------------------------

Capítulo 6: Módulo Financiero
Este módulo actúa como el libro de caja o "Ledger" (Libro Mayor) de cada organización. Su diseño inmutable y relacional permite tener una trazabilidad financiera perfecta, indispensable para auditorías, reportes de ingresos/egresos y conciliaciones bancarias.

6.1. Tabla: finance_ledger (Libro Mayor / Caja)
Registra cada movimiento de dinero real (entradas y salidas). A diferencia de las "operaciones" (que pueden estar pendientes o en borrador), el ledger documenta el flujo de caja efectivo.

Estructura de Columnas:

id (uuid): Clave Primaria (PK), generada por uuid_generate_v4().

organization_id (uuid): Clave Foránea (FK) a organizations(id) con eliminación en cascada (ON DELETE CASCADE). Obligatorio (NOT NULL). Aísla los movimientos financieros por tenant.

operation_id (uuid): Clave Foránea (FK) a la factura/venta en operations(id). Si la operación se elimina (algo raro en finanzas, pero posible), este campo queda en NULL (ON DELETE SET NULL) para que la caja no pierda el registro del dinero que ya entró o salió.

person_id (uuid): Clave Foránea (FK) a crm_people(id). Identifica quién pagó o a quién se le pagó (cliente, proveedor o empleado).

type (public.finance_type): Define si el movimiento es un ingreso ('income') o un egreso ('expense'). Obligatorio (NOT NULL).

amount (numeric(15,2)): Monto exacto del movimiento monetario. Soporta hasta 15 dígitos con 2 decimales para precisión contable. Obligatorio (NOT NULL).

payment_method (text): Método de pago utilizado (ej: "Efectivo", "Transferencia", "Tarjeta de Crédito", "MercadoPago").

external_reference (text): ID de transacción de pasarelas de pago externas (ej: el número de comprobante del banco o el ID de Stripe/MercadoPago) para conciliación.

proof_url (text): URL a un archivo adjunto (ej: un ticket escaneado, una factura PDF en el Storage).

notes (text): Observaciones adicionales sobre el pago o gasto.

processed_at (timestamp with time zone): Fecha y hora en la que el dinero efectivamente se movió (puede diferir de la fecha de creación de la operación). Valor por defecto: now().

Índices Clave para Rendimiento Financiero:
Para asegurar que los reportes de ganancias y balances carguen al instante, la tabla cuenta con los siguientes índices B-Tree:

idx_finance_org: Búsquedas por organización (Crucial para reportes del tenant).

idx_finance_date: Sobre la columna processed_at, optimizado para filtros de fechas (ej: "Ingresos de este mes").

idx_finance_operation: Búsqueda de todos los pagos asociados a una misma venta.

idx_finance_person: Para armar el "Estado de Cuenta" o "Cuenta Corriente" de un cliente o proveedor específico.



------------------------------------



Capítulo 7: Políticas de Seguridad (Row Level Security - RLS)
En una arquitectura Multi-tenant con esquema compartido (todas las organizaciones conviven en las mismas tablas), la seguridad a nivel de fila (RLS) es la barrera absoluta para evitar fugas de datos.

Todas las tablas del esquema public tienen la directiva ENABLE ROW LEVEL SECURITY;. Esto significa que, por defecto, nadie puede leer ni escribir nada a menos que una política explícita se lo permita.

7.1. El Motor de las Políticas
La inmensa mayoría de las reglas de seguridad utilizan la función public.get_auth_orgs() (documentada en el Capítulo 1) para comparar el identificador de la fila contra los permisos del usuario activo.

La lógica fundamental es: organization_id = ANY (public.get_auth_orgs()). Si el ID de la organización de la fila que se intenta leer/modificar está dentro del array de organizaciones a las que pertenece el usuario, la operación se aprueba.

7.2. Políticas por Grupos de Tablas
Para mantener el código limpio y auditable, las políticas se han agrupado según la naturaleza de los datos:

A. Tablas Operativas Estándar
(Aplica a: appointments, catalog_items, crm_people, finance_ledger, operation_lines, operations, resources)

Estas tablas comparten un set completo (CRUD) de 4 políticas idénticas en su estructura para garantizar el control total por parte del tenant:

Lectura (SELECT): Ver [entidad] de mi org

Condición (USING): (organization_id = ANY (public.get_auth_orgs()))

Creación (INSERT): Crear [entidad] en mi org

Validación (WITH CHECK): (organization_id = ANY (public.get_auth_orgs())). (Evita que un usuario malintencionado intente inyectar un registro asignándolo al ID de otra organización).

Actualización (UPDATE): Editar/Modificar [entidad] de mi org

Condición (USING): (organization_id = ANY (public.get_auth_orgs()))

Eliminación (DELETE): Borrar [entidad] de mi org

Condición (USING): (organization_id = ANY (public.get_auth_orgs()))

B. Tabla de Movimientos Inmutables (inventory_movements)
Aquí hay una decisión de diseño arquitectónico excelente orientada a la auditoría. Esta tabla no tiene políticas de UPDATE ni DELETE.

Lectura: Ver inventario de mi org (A través de organization_id).

Creación: Mover inventario en mi org (A través de organization_id).

Restricción: Al no existir políticas de edición o borrado, el historial de stock se vuelve inmutable por diseño a nivel de base de datos. Si hay un error de stock, se debe insertar un movimiento compensatorio (ajuste), nunca borrar el anterior.

C. Tablas de Identidad y Membresía (organizations, profiles, organization_members)
Estas tablas no usan organization_id de la misma forma, ya que representan a la persona y a la empresa en sí.

organizations:

Lectura: Ver mi propia organizacion -> (id = ANY (public.get_auth_orgs()))

Actualización: Editar mi propia organizacion -> (id = ANY (public.get_auth_orgs())) (Permite cambiar el logo, colores, etc.).

profiles:

Lectura: Ver mi propio perfil -> (id = (SELECT auth.uid() AS uid))

Actualización: Editar mi propio perfil -> (id = (SELECT auth.uid() AS uid))

Nota: Nadie puede borrar su propio perfil directamente desde la tabla pública; la baja debe gestionarse desde Auth.

organization_members:

Lectura: Ver mis propias membresias -> (profile_id = (SELECT auth.uid() AS uid)) (Solo podés ver las organizaciones a las que fuiste invitado o creaste).



------------------------------


Capítulo 8: Storage (Almacenamiento de Archivos)
El esquema storage está completamente aislado del esquema public y se encarga de gestionar la infraestructura de archivos estáticos. En lugar de guardar imágenes o PDFs directamente en base de datos (lo cual arruinaría el rendimiento), se guarda el archivo en el Storage y la base de datos solo guarda la URL o la referencia.

8.1. Tabla: buckets (Contenedores Principales)
Los "Buckets" son las carpetas raíz o contenedores principales. Por lo general, se crea un bucket para cada propósito (ej: avatars, product_images, invoices).

Estructura y Tipos:

id / name (text): El identificador y nombre único del contenedor.

public (boolean): Define si los archivos de este bucket se pueden ver libremente por internet (ej: el logo de la empresa) o si requieren un token de autenticación (ej: un comprobante financiero).

file_size_limit (bigint): Límite de peso por archivo.

allowed_mime_types (text[]): Restricción de formatos permitidos (ej: ['image/png', 'image/jpeg']).

type (storage.buckettype): Clasificación del contenedor. Los valores posibles son:

'STANDARD': Archivos regulares (el más usado).

'ANALYTICS': Contenedores optimizados para logs y analítica (formato Iceberg).

'VECTOR': Contenedores especiales para índices vectoriales (Inteligencia Artificial).

8.2. Tabla: objects (Archivos y Metadatos)
Representa cada archivo individual que se sube a un bucket.

Estructura de Columnas:

id (uuid): Identificador único del archivo.

bucket_id (text): A qué contenedor pertenece. Relación (FK) con buckets(id).

name (text): La ruta y el nombre exacto del archivo (ej: org_123/facturas/ticket_001.pdf).

owner_id (text): Quién subió el archivo (vinculado a la autenticación).

metadata (jsonb): Información extra generada automáticamente (peso exacto, tipo MIME, dimensiones si es imagen).

path_tokens (text[]): ¡Columna calculada! GENERATED ALWAYS AS (string_to_array(name, '/')). Parte la ruta del archivo automáticamente para facilitar la búsqueda en subcarpetas.

8.3. Tablas de "Multipart Uploads" (S3)
Para archivos muy pesados (ej: videos largos o backups gigantes), la base de datos utiliza el estándar S3 para partir la subida en pedazos.

s3_multipart_uploads: Controla el inicio y estado de una subida pesada.

s3_multipart_uploads_parts: Registra cada "pedacito" (chunk) del archivo a medida que va llegando al servidor, permitiendo pausar y reanudar subidas sin perder progreso.

8.4. Triggers de Protección Inquebrantables
Para proteger la integridad de los archivos, el esquema implementa funciones de protección (Triggers) a nivel de servidor:

protect_buckets_delete y protect_objects_delete:

Función: storage.protect_delete()

Propósito: Bloquean absolutamente cualquier intento de hacer un DELETE FROM storage.objects o storage.buckets directamente mediante consultas SQL.

Motivo: Evitar que un usuario o un error de código borre el registro en la base de datos dejando el archivo físico "huérfano" y ocupando espacio fantasma en el disco. Exige que los borrados se hagan sí o sí a través de la API oficial de Storage de Supabase.

enforce_bucket_name_length_trigger:

Impide que nadie cree un bucket con un nombre superior a 100 caracteres, evitando vulnerabilidades o errores en el sistema de archivos del servidor.

update_objects_updated_at:

Actualiza automáticamente la columna updated_at cada vez que se reemplaza o modifica un archivo.