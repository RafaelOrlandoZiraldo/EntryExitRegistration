# Despliegue en Cloudflare Pages

## Configuracion del proyecto

```text
Framework preset: React (Vite)
Production branch: main
Build command: npm run build
Build output directory: dist
Root directory: /
Node version: 22
```

No configurar Pages Functions, Workers, KV, D1 ni R2 para este MVP.

## Variables de entorno

Configurar en Workers & Pages > proyecto > Settings > Environment variables:

```text
VITE_AUTH_USERNAME
VITE_AUTH_PASSWORD_HASH
VITE_AUTH_PASSWORD_SALT
VITE_AUTH_PASSWORD_ITERATIONS
VITE_SESSION_TIMEOUT_MINUTES
```

Configurar estas variables en **Production** para el dominio productivo. Configurar
tambien valores en **Preview** para despliegues de prueba; pueden ser credenciales
distintas para evitar mezclar accesos y datos de verificacion.

Estas variables no son secretos. Todo valor `VITE_*` queda incorporado al bundle
JavaScript enviado al navegador y puede ser inspeccionado por el usuario. La
autenticacion local del MVP es un bloqueo de acceso casual, no una frontera de
seguridad equivalente a un backend.

## SPA routing

El archivo `public/_redirects` debe llegar a `dist/_redirects`:

```text
/* /index.html 200
```

Permite que Cloudflare entregue `index.html` al acceder directamente a rutas
administradas por React Router.

Rutas que deben funcionar por navegacion directa y refresh:

```text
/login
/transactions
```

`/transactions` es una ruta protegida: sin sesion debe redirigir a `/login` y,
despues de autenticar, debe volver a la pantalla solicitada.

## Headers

`public/_headers` debe llegar a `dist/_headers` y agrega:

- `X-Content-Type-Options`.
- `X-Frame-Options`.
- `Referrer-Policy`.
- `Permissions-Policy`.
- `Cross-Origin-Opener-Policy`.
- Content Security Policy.
- Cache inmutable para `/assets/*`.

La CSP actual solo permite recursos del mismo origen. Se mantiene
`style-src 'self' 'unsafe-inline'` por estilos generados/aplicados por la UI en
cliente. No se habilitan analytics, CDNs, APIs remotas ni imagenes externas.

La cache inmutable se aplica solamente a `/assets/*`, que contiene archivos
fingerprinted generados por Vite. `index.html`, `_redirects` y `_headers` no
reciben cache inmutable para que Cloudflare pueda revalidar la entrada de la SPA.

La CSP debe revisarse si se incorporan analytics, fuentes externas, imagenes
remotas o APIs. No aflojarla sin una dependencia concreta que lo requiera.

## Persistencia por origen

OPFS esta aislado por origen. Cada uno de los siguientes conserva datos distintos:

```text
https://mi-proyecto.pages.dev
https://hash.mi-proyecto.pages.dev
https://finanzas.midominio.com
```

Esto significa que produccion en `pages.dev`, cada preview deployment y cualquier
dominio personalizado no comparten `domestic-finance.json`. Para mover datos entre
origenes hay que exportar JSON en el origen anterior e importarlo manualmente en
el nuevo.

Proceso recomendado para pasar a dominio personalizado:

1. Exportar JSON desde el origen anterior.
2. Abrir la aplicacion en el dominio definitivo.
3. Importar el respaldo.
4. Validar totales y cantidad de movimientos.
5. Utilizar solamente el dominio definitivo en adelante.

## Preview deployments

Los previews deben utilizar datos de prueba. No cargar informacion domestica real
porque cada preview es efimero y tiene almacenamiento independiente.

## Validacion previa al deploy

```bash
npm ci
npm run lint
npm run typecheck
npm run test:run
npm run test:e2e
npm run build
```

Verificar:

```text
dist/index.html
dist/_redirects
dist/_headers
dist/assets/
```

Confirmar despues del build:

```text
dist/_redirects contiene /* /index.html 200
dist/_headers contiene la CSP y la politica Cache-Control solo para /assets/*
```

## Alcance

No usar Pages Functions, Workers, KV, D1 ni R2 en este MVP. Incorporarlos
convertiria la solucion en una aplicacion con componente backend y requeriria
redefinir seguridad, persistencia y arquitectura.
