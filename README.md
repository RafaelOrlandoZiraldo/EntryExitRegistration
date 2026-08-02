# Registro domestico de ingresos y egresos

MVP web desarrollado con React, TypeScript y Vite para registrar ingresos y
egresos domesticos. Puede usar OPFS local del navegador o Cloudflare Pages
Functions con D1 para sincronizar datos entre dispositivos.

## Arquitectura

```text
src/app             composicion, router y providers
src/domain          entidades, tipos, reglas y constantes
src/application     puertos y casos de uso
src/infrastructure  OPFS, Web Crypto, sesion y configuracion
src/features        auth, dashboard y transactions
src/shared          UI, errores y utilidades reutilizables
```

Consultar `AGENT.md` para reglas completas.

## Requisitos

- Node.js indicado en `.nvmrc`.
- npm.
- Navegador moderno con soporte de OPFS y Web Crypto.

## Configuracion

Copiar:

```bash
cp .env.example .env.local
```

Variables:

```env
VITE_DATA_SOURCE=opfs
VITE_AUTH_USERNAME=admin
VITE_AUTH_PASSWORD_HASH=
VITE_AUTH_PASSWORD_SALT=
VITE_AUTH_PASSWORD_ITERATIONS=310000
VITE_SESSION_TIMEOUT_MINUTES=60
```

Las variables `VITE_*` se integran al bundle y son visibles para el cliente. Esta
autenticacion es un bloqueo local para el MVP, no una frontera de seguridad
equivalente a un backend.

Con `VITE_DATA_SOURCE=api`, la UI usa `/api/*` y la autenticacion se valida en
Cloudflare Pages Functions. En ese modo, configurar estas variables del backend
sin prefijo `VITE_` en Cloudflare:

```env
AUTH_USERNAME=admin
AUTH_PASSWORD_HASH=
AUTH_PASSWORD_SALT=
AUTH_PASSWORD_ITERATIONS=310000
SESSION_TIMEOUT_MINUTES=60
SESSION_SECRET=
```

`AUTH_PASSWORD_HASH`, `AUTH_PASSWORD_SALT` y `SESSION_SECRET` pueden cargarse
como secretos. `AUTH_USERNAME`, `AUTH_PASSWORD_ITERATIONS` y
`SESSION_TIMEOUT_MINUTES` pueden ser plaintext. Las variables `VITE_*` no son
secretas porque quedan publicadas en los archivos del sitio.

## Generar hash de contrasena

Ejecutar:

```bash
npm run auth:hash -- "MiPassword"
```

Copiar el hash y salt generados a `.env.local` y, para produccion, a las
variables de entorno de Cloudflare Pages.

## Ejecucion local

```bash
npm install
npm run dev
```

## Calidad

```bash
npm run lint
npm run typecheck
npm run test:run
npm run test:e2e
npm run build
```

## Persistencia

En modo local, el documento `domestic-finance.json` se administra mediante OPFS. No es un
archivo visible en una carpeta normal del equipo.

Consecuencias:

- Los datos estan asociados al navegador y al origen.
- Cambiar de dominio crea otro almacenamiento.
- Los previews de Cloudflare Pages no comparten datos con produccion.
- Limpiar datos del sitio puede eliminar el documento.
- No existe sincronizacion entre dispositivos.

Usar exportacion JSON periodica como respaldo.

La aplicacion tambien genera un backup automatico diario en OPFS con nombre:

```text
domestic-finance-backup-YYYY-MM-DD.json
```

El backup se intenta crear al abrir la aplicacion y luego una vez por dia a la
medianoche local mientras la app permanezca abierta. Si la app esta cerrada a
medianoche, el backup faltante del dia se crea al volver a abrirla.

En modo `api`, los movimientos se guardan en Cloudflare D1. Las copias diarias
se registran en la tabla `daily_backups`.

## Cloudflare Pages

Configuracion recomendada:

```text
Framework preset: None
Build command: npm run build
Build output directory: dist
Root directory: /
Production branch: main
```

Si Cloudflare autodetecta otro framework, por ejemplo Hydrogen, ignorar esa
deteccion y usar la configuracion manual anterior.

Variables de entorno:

1. Abrir Workers & Pages.
2. Seleccionar el proyecto.
3. Abrir Settings > Environment variables.
4. Cargar `VITE_DATA_SOURCE=api` para Production.
5. Cargar las variables `AUTH_*`, `SESSION_TIMEOUT_MINUTES` y `SESSION_SECRET`
   para las Functions.
6. Definir valores diferentes para Preview si se requiere probar autenticacion.

Cloudflare ejecuta el build y Vite incorpora solo las variables `VITE_*` en los
assets estaticos.

### Base de datos D1

Crear una base D1 y vincularla al proyecto Pages con el binding:

```text
DB
```

Aplicar la migracion:

```text
migrations/0001_create_transactions.sql
```

No se agregan Workers, KV, R2 ni Pages Functions separadas del proyecto Pages.

### Routing SPA

`public/_redirects` contiene:

```text
/* /index.html 200
```

Esto permite recargar rutas como `/login` o `/transactions`.

### Headers

`public/_headers` agrega headers de seguridad y cache para assets versionados.

Revisar la Content Security Policy al agregar servicios externos, fuentes
remotas, analytics o nuevos origenes.

### Dominio personalizado

Al mover la aplicacion de `*.pages.dev` a un dominio personalizado, OPFS comienza
vacio porque cambia el origen. En modo `api`, los datos compartidos viven en D1
y no dependen del navegador.

## Datos corruptos

La aplicacion no reemplaza silenciosamente un documento invalido. Debe:

1. Mostrar un error.
2. Ofrecer importar un respaldo valido.
3. Mantener el documento corrupto sin sobrescribirlo automaticamente.

## Agregar una funcionalidad

1. Leer `AGENT.md`.
2. Crear o actualizar la feature correspondiente.
3. Definir casos de uso en `application` si existe logica de negocio.
4. Definir puertos cuando se necesite infraestructura.
5. Implementar adaptadores en `infrastructure`.
6. Agregar validacion, errores y pruebas.
7. Ejecutar todos los controles de calidad.
