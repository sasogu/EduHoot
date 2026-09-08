# Plan: sustituir Google por Authentik en EduHoot

Estado: PENDIENTE (diseñado 2026-09-08). Las fuentes de Google **ya están autoalojadas**.

## Objetivo

Eliminar la dependencia de Google en EduHoot a medio plazo:

- **Google Fonts** → HECHO (2026-09-08): Raleway, Tajawal, Inter y Poppins
  autoalojadas en `public/fonts/` + `public/css/fonts.css`
  (`src/scripts/fetch-fonts.mjs`). 0 referencias a `fonts.googleapis.com`.
- **Google OAuth (login)** → sustituir por **Authentik** (SSO del Commons,
  `id.edutictac.es`), ya desplegado en producción.

## Fases

1. **[HECHO]** Autoalojar Google Fonts.
2. Añadir Authentik como login de EduHoot (espejo del flujo Google actual).
3. *(Opcional, puente de transición)* Configurar Google como "source" dentro de
   Authentik, para que los usuarios de Google sigan pudiendo entrar (vía
   Authentik) sin perder su email.
4. Quitar el login directo de Google en EduHoot → **solo Authentik**.

## Fase 2 — Authentik como login (backend + frontend)

### Authentik (IdP)
- Provider OIDC + application "EduHoot":
  - `client_id`: `eduhoot.edutictac.es`
  - `redirect_uri`: `https://eduhoot.edutictac.es/api/auth/authentik/callback`
  - `grant_types`: `authorization_code` + `refresh_token` (⚠️ GOTCHA: por
    defecto queda vacío al crearlo por shell; hay que setearlo explícito).
  - `client_secret` en `pass edutictac/authentik-eduhoot-client-secret`.

### Backend (`src/server/server.js`) — espejo del flujo Google
- Constantes + endpoints `/api/auth/authentik/start` y
  `/api/auth/authentik/callback`.
- Flujo OIDC **authorization code + PKCE (S256)** con `crypto` + `https` nativo
  (sin dependencias nuevas, coherente con el estilo actual).
- `findOrCreateAuthentikUser(profile)`: busca por `email` (único); si existe →
  añade `authentikId` (sub) y `'authentik'` a `authProviders`; si no → crea
  (primer usuario sin admin = `admin`; resto `editor`).
- `createSession(user)` existente (cookie `sessionId`, sesión en memoria).
- Env: `AUTHENTIK_CLIENT_ID`, `AUTHENTIK_CLIENT_SECRET`, `AUTHENTIK_ISSUER`,
  `AUTHENTIK_REDIRECT_URI`.

### Frontend (`public/create/index.html` + `public/js/create.js`)
- Botón "Entrar con EduTicTac" junto a Google (`#auth-google-hero`).
- `loginWithAuthentik()` → `/api/auth/authentik/start?next=...`.
- Manejo de `?authentik=ok/error`.
- i18n en 3 idiomas (valencià, castellano, inglés).

## Consideraciones

- **Identidad por email** (único): mismo email Google/Authentik se enlaza (no
  duplica). Campo `authProviders` ya preparado para multi-proveedor.
- Sesiones en memoria (se pierden al reiniciar el servidor), igual que con Google.
- Los usuarios Google existentes **no se migran automáticamente**: se enlazan al
  entrar con Authentik usando el mismo email.
- Si se elige la Fase 3 (Google como source en Authentik), el `sub` cambia (Authentik
  genera el suyo), pero el enlace sigue por `email`.

## Alternativa (descartada por ahora)

Centralizar todo en Authentik desde el inicio sin fase puente (quitar Google de
golpe). Más limpio, pero deja sin acceso a los usuarios de Google hasta que
entren por Authentik. La Fase 3 permite una transición sin cortar el acceso.

## Estado de Google en EduHoot (para auditoría)

- Login OAuth: `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET`/`GOOGLE_CALLBACK_URL`
  (endpoints `/api/auth/google/start` y `/api/auth/google/callback`).
- `gsiApi`/`googleOAuth2Id` hardcodeado en el bundle del cliente
  (`public/js/*.js`, id `628119593973-...apps.googleusercontent.com`).
- Google Fonts: eliminado (autoalojado 2026-09-08).
