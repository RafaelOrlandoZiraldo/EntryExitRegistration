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

Para sincronizar datos entre computadoras, este proyecto usa Cloudflare Pages
Functions y D1. No configurar Workers, KV, R2 ni Pages Functions separadas del
proyecto Pages.

## Variables de entorno

Configurar en Workers & Pages > proyecto > Settings > Environment variables:

```text
VITE_AUTH_USERNAME
VITE_AUTH_PASSWORD_HASH
VITE_AUTH_PASSWORD_SALT
VITE_AUTH_PASSWORD_ITERATIONS
VITE_SESSION_TIMEOUT_MINUTES
```

Usar `VITE_SESSION_TIMEOUT_MINUTES=60` para cerrar la sesion despues de una hora
sin actividad.

Para usar el backend compartido, configurar ademas:

```text
VITE_DATA_SOURCE=api
```

En modo `api`, las variables `VITE_AUTH_*` ya no validan la contrasena en el
navegador. La validacion la hacen las Functions con estas variables sin prefijo
`VITE_`:

```text
AUTH_USERNAME
AUTH_PASSWORD_HASH
AUTH_PASSWORD_SALT
AUTH_PASSWORD_ITERATIONS
SESSION_TIMEOUT_MINUTES
SESSION_SECRET
```

Configurar estas variables en **Production** para el dominio productivo. Configurar
tambien valores en **Preview** para despliegues de prueba; pueden ser credenciales
distintas para evitar mezclar accesos y datos de verificacion.

Estas variables no son secretos. Todo valor `VITE_*` queda incorporado al bundle
JavaScript enviado al navegador y puede ser inspeccionado por el usuario. La
autenticacion local con OPFS es un bloqueo de acceso casual. Para datos
compartidos usar `VITE_DATA_SOURCE=api` y las variables del backend.

## D1

Crear una base de datos D1 y vincularla al proyecto Pages con el binding:

```text
DB
```

Aplicar la migracion SQL:

```text
migrations/0001_create_transactions.sql
```

La tabla `transactions` guarda los movimientos y `daily_backups` guarda backups
automaticos diarios del documento versionado.

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

OPFS esta aislado por origen. En modo local, cada uno de los siguientes conserva
datos distintos:

```text
https://mi-proyecto.pages.dev
https://hash.mi-proyecto.pages.dev
https://finanzas.midominio.com
```

Esto significa que produccion en `pages.dev`, cada preview deployment y cualquier
dominio personalizado no comparten `domestic-finance.json`. En modo `api`, los
datos viven en D1 y se comparten para todos los navegadores que apunten al mismo
proyecto y binding.

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

El backend es minimo: Cloudflare Pages Functions, cookies HttpOnly firmadas y D1.
No se incorporan Workers independientes, KV, R2 ni servicios externos.
