# TDC Marketing · Tablero de Pendientes

Web autónoma (HTML + CSS + JS, sin build) basada en la plataforma TDC. Conecta a
Firebase (Firestore + Auth con Google) en tiempo real.

## Estructura

| Archivo | Contenido |
|---|---|
| `index.html` | Estructura/markup de la app (login, tablero, grabaciones, seguimiento, modales). |
| `styles.css` | Todos los estilos (paleta TDC: rojos + navy). |
| `app.js` | Lógica: auth Google, Firestore en vivo, tablero, calendario y analytics. |

## Secciones

1. **📋 Tablero** — pendientes de marketing en columnas (Pendiente / En Proceso / Completada-Cancelada),
   con filtros por encargado, mes, estado, prioridad y categoría. "Mis tareas" vs "Ver todos".
2. **📅 Grabaciones** — calendario mensual + lista. Al crear una grabación se genera
   automáticamente una tarea en el tablero (categoría Audiovisual).
3. **📊 Seguimiento** — dashboard con la **cantidad de pendientes por persona**, tareas por
   encargado, por categoría, área/persona que más solicita, días para completar y ranking de
   pendientes. Vista global o por persona (admins pueden ver a cualquiera).

## Firebase

Usa el proyecto `tablero-de-pendientes` (mismas credenciales que la referencia). Colecciones:

- `tareas_v2` — tareas del tablero
- `grabaciones` — grabaciones del calendario

> El acceso está restringido al dominio `paraleloinmobiliaria.pe` (login con Google).
> Los emails admin están en `ADMINS` dentro de `app.js`.

## Cómo correr en local

No requiere build. Por los módulos ES y Firebase Auth necesitas servirlo por HTTP
(no abrir el `index.html` con `file://`):

```bash
# desde esta carpeta
npx serve .
# o
python -m http.server 8000
```

Luego abre `http://localhost:8000` (o el puerto que indique).

## Deploy

Sube los 3 archivos a cualquier hosting estático (Vercel, Netlify, Firebase Hosting).
Recuerda autorizar el dominio de producción en **Firebase Console → Authentication →
Settings → Authorized domains** para que funcione el login con Google.

## Notas

- Emails (EmailJS) y recordatorios de vencimiento están configurados con las claves de la
  referencia. Cambia `SVC`, `TPL_NEW`, `TPL_REM` y el `emailjs.init(...)` en `app.js` si usas otra cuenta.
- El equipo y sus correos se definen en `TEAM_EMAILS` / `TEAM_NAMES` en `app.js`.
