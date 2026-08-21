# ⚡ Torneo Ágape 2026 — Sistema de Inscripciones

Web App de inscripción para el **Torneo Ágape 2026** del Ministerio Jahems y Esneth Ordóñez.

- **Voleibol** · Sábado 22 de Agosto de 2026
- **Microfútbol** · Domingo 23 de Agosto de 2026
- **Ubicación:** Carrera 56, Provivienda Oriental, Bogotá
- **Costo:** $10.000 COP / jugador
- **Coordinadores:** Dimas Mendoza & Jefferson Morales

---

## Stack Tecnológico (100% Gratuito)

| Capa | Tecnología |
|---|---|
| Framework | Next.js 16 (App Router) |
| UI | React 19 + Tailwind CSS v4 |
| Base de datos | Firebase Firestore (plan Spark) |
| Almacenamiento | Firebase Storage (plan Spark) |
| Autenticación | Firebase Auth (Email/Contraseña) |
| Formularios | React Hook Form |
| Hosting | Vercel (plan Hobby gratuito) |

---

## Configuración de Firebase

### 1. Crear proyecto en Firebase

1. Ve a [console.firebase.google.com](https://console.firebase.google.com)
2. Crea un proyecto nuevo (ej: `torneo-agape-2026`)
3. En **Configuración del proyecto → Tus apps**, agrega una app **Web**
4. Copia las credenciales al archivo `.env.local`

### 2. Variables de entorno

```bash
cp .env.local.example .env.local
```

Edita `.env.local` con tus credenciales de Firebase.

### 3. Habilitar servicios en Firebase Console

#### Authentication
- Ve a **Authentication → Sign-in method**
- Habilita **Correo electrónico/contraseña**
- Ve a **Authentication → Users → Agregar usuario**
- Crea el usuario administrador (ej: `admin@torneo.com` / `tuContraseñaSegura`)

#### Firestore Database
- Ve a **Firestore Database → Crear base de datos**
- Selecciona modo **Producción**
- Elige la región más cercana (ej: `us-east1`)
- Configura las **reglas de seguridad**:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /inscripciones/{docId} {
      // Cualquiera puede crear una inscripción (registro público)
      allow create: if true;
      // Solo admins autenticados pueden leer, actualizar o eliminar
      allow read, update, delete: if request.auth != null;
    }
  }
}
```

#### Cloudinary (almacenamiento de comprobantes — GRATIS)

> Firebase Storage requiere el plan Blaze (de pago). Usamos Cloudinary en su lugar, que ofrece **25 GB gratis**.

1. Crea una cuenta en [cloudinary.com](https://cloudinary.com) (plan Free)
2. En el **Dashboard** copia tu **Cloud name**
3. Ve a **Settings → Upload → Upload presets → Add upload preset**
   - **Signing mode:** `Unsigned`
   - **Folder:** `torneo-agape-2026/comprobantes`
   - Guarda y copia el **Preset name**
4. Agrega al `.env.local`:
   ```
   NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME=tu_cloud_name
   NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET=torneo_agape
   ```

---

## Desarrollo local

```bash
# Instalar dependencias
npm install

# Iniciar servidor de desarrollo
npm run dev
```

Abre [http://localhost:3000](http://localhost:3000) para el formulario de inscripción.  
Abre [http://localhost:3000/admin](http://localhost:3000/admin) para la mesa de control.

---

## Despliegue en Vercel (gratuito)

1. Sube el repositorio a GitHub
2. Entra a [vercel.com](https://vercel.com) e importa el repositorio
3. En **Environment Variables**, agrega cada variable de `.env.local`
4. Haz clic en **Deploy** — ¡listo!

---

## Estructura del Proyecto

```
├── app/
│   ├── layout.tsx              # Layout raíz con metadata
│   ├── page.tsx                # Página pública de inscripción
│   └── admin/
│       ├── page.tsx            # Dashboard admin (protegido)
│       └── login/
│           └── page.tsx        # Login de administrador
├── components/
│   ├── TournamentForm.tsx      # Formulario de inscripción
│   ├── AdminDashboard.tsx      # Panel admin + tabla + modal
│   └── LoginForm.tsx           # Formulario de login
├── lib/
│   ├── firebase.ts             # Inicialización Firebase
│   └── types.ts                # Interfaces TypeScript
└── .env.local.example          # Variables de entorno (plantilla)
```

---

## Estructura del documento en Firestore (`inscripciones`)

```json
{
  "equipoNombre": "Los Campeones",
  "disciplina": "Voleibol",
  "fechaTorneo": "2026-08-22",
  "capitan": {
    "nombre": "Juan Pérez",
    "documento": "1234567890",
    "telefono": "+573001234567",
    "email": "juan@email.com"
  },
  "jugadores": [
    { "id": "abc123", "nombre": "Juan Pérez", "documento": "1234567890", "esCapitan": true },
    { "id": "def456", "nombre": "María López", "documento": "9876543210", "esCapitan": false }
  ],
  "totalJugadores": 7,
  "totalPagarCOP": 70000,
  "comprobanteUrl": "https://firebasestorage.googleapis.com/...",
  "reglamentoAceptado": true,
  "createdAt": "Timestamp"
}
```

---

## Funcionalidades

### Vista Pública (`/`)
- Selección de disciplina con tarjetas visuales
- Nombre del equipo
- Datos del capitán (nombre, documento, WhatsApp, email)
- Lista dinámica de jugadores con mínimos obligatorios
- Cálculo automático del monto ($10.000 × total jugadores)
- Carga del comprobante de pago (Firebase Storage)
- Aceptación del reglamento de convivencia

### Mesa de Control (`/admin`)
- Login con Firebase Auth (email/contraseña)
- Estadísticas: total equipos, por disciplina, total recaudado esperado
- Tabla con todos los inscritos
- Buscador por equipo o capitán
- Filtro por disciplina
- Modal con lista completa de jugadores por equipo
- Enlace directo al comprobante de pago
- **Exportar a CSV** con todos los datos limpios y ordenados
