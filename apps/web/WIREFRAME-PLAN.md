# Wireframe — Plan de Ajustes Pendientes

**Archivo de trabajo:** `apps/web/wireframe.html`
**Contexto:** Este documento resume el análisis hecho contra las specs (`docs/00-15`) sobre qué falta o debe ajustarse en el wireframe HTML/CSS/JS actual. Úsalo como punto de partida en un chat nuevo — no repitas el análisis, solo continúa desde aquí.

---

## 0. Estado actual (lo que YA está construido)

El wireframe cubre, con datos mock y sin conexión real a `apps/api` todavía:

- **Shell**: activity bar (íconos), top bar (breadcrumb + selector de portfolio), status bar (indicador realtime), layout tipo "paneles con gap" inspirado en VS Code (bordes redondeados de 8px, gap de 8px entre regiones).
- **Dashboard**: métricas primarias (valor, cambio diario, retorno, riesgo), allocation por asset, actividad reciente.
- **Portfolios**: tabla + formulario inline de creación.
- **Transactions**: tabla con filtros funcionales (asset/type), formulario inline de creación, paginación visual.
- **Analytics**: chart SVG de valor de portfolio (rangos 1M/3M/1Y), allocation con toggle de agrupación (asset/type/currency), tabla de attribution.
- **Activity**: timeline de eventos con severidad (info/success/warning/critical).
- **Estados**: loading (skeleton) y error (con botón "Simulate error" + Retry) en 7 paneles distintos; empty state distinguido de "sin resultados de filtro" en Transactions.
- **Responsive**: tablas con scroll horizontal (`.table-scroll`), toolbars que colapsan en mobile, grids que bajan de 4→2→1 columnas.

**Lo que NO está:** conexión real a la API (todo es mock), Login, Settings, Positions/Assets/Watchlist como vistas propias, Decision Center, Notifications.

---

## 1. Gaps identificados contra las specs de producto

### 1.1 Login (prioridad alta — bloqueante conceptual)

**Fuente:** `docs/12-demo-mode-spec.md` §55, `docs/09-security-spec.md`, comparar contra `apps/api/src/routes/auth.routes.ts` (ya implementado y funcional en el backend).

- El modo **real** (producción/desarrollo) requiere login de verdad — JWT ya construido en el backend (`POST /auth/login`, rate limiting incluido).
- El modo **demo público** NO requiere login — flujo `Enter Demo → sesión automática → usuario demo`, sin credenciales reales (§55 del spec).
- **Decisión de diseño ya tomada en la conversación anterior:** el login (o el "Enter Demo") debe ser un **gate completo antes del shell** — pantalla separada, sin activity bar/topbar/statusbar — no una versión degradada de vistas dentro de la app.
- **Tarea concreta:** agregar una vista `#view-login` (o una página separada `login.html` si se prefiere) con formulario email/password, estados de validación y error (reutilizando `.error-state` ya existente), y lógica JS simple que oculte el gate y muestre el `.app-shell` al "loguear" (mock, sin backend real todavía).

### 1.2 Settings / Perfil (prioridad alta — gap confirmado, ya se me había pasado)

**Fuente:** `docs/01-product-spec.md` §4 (dominios del producto), `docs/11-ui-ux-spec.md` §7 (navegación esperada: _Dashboard, Portfolios, Transactions, Analytics, Activity, **Settings**_).

- Falta un 6to ítem en la activity bar para Settings.
- Contenido esperado: perfil de usuario, preferencias de cuenta, moneda base por defecto, indicador de modo demo (§65 de `12-demo-mode-spec.md`).

### 1.3 Positions como vista propia (prioridad media)

**Fuente:** `docs/01-product-spec.md` §7, `apps/api/src/routes/positions.routes.ts` (ya expone `GET /portfolios/:id/positions`).

- Hoy `positions` solo existe implícito en el backend, sin vista dedicada en el wireframe.
- Debe mostrar: asset, cantidad, precio promedio de entrada, precio actual, valor actual, P/L no realizado, % de allocation.

### 1.4 Assets (prioridad media)

**Fuente:** `docs/01-product-spec.md` §9, `apps/api/src/routes/assets.routes.ts` (ya expone búsqueda/filtro de assets).

- Vista de catálogo de activos con búsqueda/filtro — probablemente un panel/modal accesible desde el formulario de Transactions más que una vista de primer nivel en la nav.

### 1.5 Watchlist (prioridad baja-media)

**Fuente:** `docs/01-product-spec.md` §10.

- No tiene endpoint en `apps/api` todavía (dominio no expuesto en el backend).
- Agregar/quitar assets, ver precios mock, navegar a detalle.

### 1.6 Decision Center — Decision Replay + Scenario Lab (prioridad alta conceptual, esfuerzo alto)

**Fuente:** `docs/01-product-spec.md` §13-15, §29 (sección "Product Identity" — es la feature diferenciadora **principal** del producto, no una vista secundaria).

- **Decision Replay:** reconstruir la evolución de una decisión de trading (contexto de mercado → tesis → entrada → evolución → salida → resultado), con controles tipo play/pause/timeline.
- **Scenario Lab:** modificar variables hipotéticas y ver el impacto calculado sin tocar el portfolio real (baseline vs escenario, comparación A/B).
- No tiene endpoints en `apps/api` todavía, pero el domain layer ya tiene las entidades (`decision`, `decision-event`, `scenario` en `packages/domain`).
- **Nota:** esto es significativamente más grande que las otras vistas — probablemente merece su propia sesión de trabajo dedicada, no un ajuste rápido.

### 1.7 Notifications (prioridad media)

**Fuente:** `docs/01-product-spec.md` §18, `packages/domain/src/entities/notification.ts` (ya existe la entidad).

- Panel/dropdown de notificaciones (no necesariamente una vista de nav completa) — transacción completada, alerta disparada, error de operación, etc.

### 1.8 Aclaración sobre roles (no es una tarea, es contexto)

**Fuente:** `packages/domain/src/entities/enums.ts` (`UserRole.ADMIN`), `docs/12-demo-mode-spec.md` §56-57.

- El producto **no** tiene una vista admin/cliente separada — es una herramienta personal de un solo usuario (`docs/01-product-spec.md` §3).
- `ADMIN` existe como posible rol para demostrar RBAC en el modo demo (controlar quién ve los "Demo Controls" del §62-65), no como un panel de administración del producto.
- **No crear una vista "Admin" separada.** Si acaso, un control condicional dentro de Settings o un panel de "Demo Controls" aparte (ver más abajo).

### 1.9 Demo Controls (opcional, bajo impacto en esta etapa)

**Fuente:** `docs/12-demo-mode-spec.md` §62-65.

- Panel de controles de simulación (pausar mercado, forzar error, desconectar realtime, reset del demo) — visualmente distinto de los controles reales del producto.
- Solo relevante si se decide construir el wireframe pensando ya en el modo demo público. Se puede posponer sin problema.

---

## 2. Ajustes de rediseño puntual (mencionados, pendientes de definir)

El usuario indicó que quiere buscar referencias/inspiración antes de tocar esto — **no iniciar sin su input**. Se deja como recordatorio:

- Revisión visual de componentes existentes (paneles, badges, formularios) — sin dirección concreta todavía.

---

## 3. Orden sugerido de trabajo (propuesta, no definitiva)

1. **Login/gate** — es conceptualmente bloqueante (todo lo demás vive "detrás" del login).
2. **Settings** — rápido, cierra un gap ya confirmado, reutiliza componentes existentes (`.pane`, `.form-group`).
3. **Positions** — rápido, ya hay datos de API reales para basarse (`apps/api/src/services/position.service.ts`), reutiliza `.data-table`.
4. **Notifications** (panel, no vista completa) — reutiliza `.timeline-row`/`.badge` ya existentes.
5. **Assets + Watchlist** — medianos, decidir si son vistas de nav o paneles secundarios antes de construir.
6. **Decision Center** — esfuerzo grande, merece su propia sesión de diseño (Decision Replay tiene controles de reproducción y timeline que no existen en el wireframe todavía).
7. **Rediseño puntual de componentes** — cuando el usuario traiga referencias.
8. **Demo Controls** — opcional, evaluar si aplica.

---

## 4. Cómo retomar en el chat nuevo

1. Pega este archivo completo como primer mensaje, o súbelo.
2. Indica con cuál punto de la sección 3 quieres empezar.
3. El archivo de trabajo sigue siendo `apps/web/wireframe.html` — se sigue iterando sobre el mismo archivo, no se crean archivos nuevos por vista (a menos que decidan separar en múltiples archivos por tamaño, ver la guía original de iteración).
4. Metodología ya establecida: pasos chicos, un dominio/vista a la vez, confirmar visualmente antes de seguir.
