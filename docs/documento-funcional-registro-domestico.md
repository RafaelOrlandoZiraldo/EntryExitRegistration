# Documento funcional — Registro doméstico de ingresos y egresos

## 1. Propósito

Construir una aplicación web para registrar y analizar ingresos y egresos domésticos de un único usuario. El producto será un MVP, pero debe mantener una base técnica escalable.

## 2. Alcance

La aplicación permitirá:

- Iniciar y cerrar sesión.
- Registrar ingresos y egresos.
- Consultar movimientos.
- Filtrar y ordenar resultados.
- Editar movimientos.
- Eliminar movimientos físicamente.
- Visualizar indicadores financieros del período.
- Exportar e importar los datos en JSON.

## 3. Exclusiones del MVP

- Backend o API.
- Base de datos.
- Sincronización entre dispositivos.
- Multiusuario.
- Roles y permisos.
- Presupuestos mensuales.
- Movimientos recurrentes automáticos.
- Integración bancaria.
- Conversión de moneda.
- Recuperación remota de contraseña.

## 4. Usuario

Existe un único usuario local configurado por variables de entorno durante el build.

La autenticación restringe el acceso casual, pero no debe considerarse una solución segura frente a un usuario que pueda inspeccionar el bundle del navegador.

## 5. Pantallas

### 5.1 Inicio de sesión

Elementos:

- Usuario.
- Contraseña.
- Acción “Ingresar”.
- Mensaje de credenciales inválidas.
- Mensaje de configuración inválida.

Comportamiento:

- Al autenticar correctamente, redirigir al dashboard.
- Si existe una sesión vigente, no mostrar nuevamente el login.
- La sesión expira por inactividad.

### 5.2 Dashboard principal

Debe incluir:

- Total de ingresos del período.
- Total de egresos del período.
- Balance del período.
- Cantidad de movimientos.
- Gráfico de egresos por categoría.
- Filtros activos.
- Grilla o listado de movimientos.
- Acción para agregar movimiento.
- Acciones de exportar e importar JSON.

### 5.3 Modal de alta y edición

Campos:

```text
Tipo
Fecha
Importe
Categoría
Descripción
Medio de pago
Observaciones
```

En alta:

- El modal se abre vacío con fecha actual como valor inicial razonable.
- El usuario selecciona ingreso o egreso.
- Las categorías se filtran por tipo.
- Al guardar correctamente, cerrar modal y actualizar dashboard y listado.

En edición:

- Precargar los datos existentes.
- Mantener el identificador y la fecha de creación.
- Actualizar `updatedAt` al guardar.

### 5.4 Confirmación de eliminación

Debe mostrar:

- Tipo.
- Descripción.
- Fecha.
- Importe.
- Advertencia de que la acción no se puede deshacer.

Al confirmar:

- Eliminar físicamente el movimiento del documento JSON.
- Actualizar indicadores y listado.

## 6. Modelo de movimiento

```text
id: UUID
 type: income | expense
 date: ISO date
 amount: decimal positivo
 category: clave de categoría
 description: texto obligatorio
 paymentMethod: clave de medio de pago
 notes: texto opcional
 createdAt: ISO date-time
 updatedAt: ISO date-time
```

## 7. Categorías

### 7.1 Ingresos

- Sueldo.
- Ingresos adicionales.
- Venta.
- Reintegro.
- Intereses.
- Regalo.
- Otro ingreso.

### 7.2 Egresos

- Alquiler.
- Servicios.
- Supermercado.
- Transporte.
- Salud.
- Educación.
- Entretenimiento.
- Indumentaria.
- Impuestos.
- Deudas.
- Mantenimiento.
- Mascotas.
- Otro egreso.

Las categorías son fijas en el MVP.

## 8. Medios de pago

- Efectivo.
- Débito.
- Crédito.
- Transferencia.
- Billetera virtual.
- Otro.

## 9. Filtros

Filtros combinables:

- Fecha desde.
- Fecha hasta.
- Tipo.
- Categoría.
- Medio de pago.
- Texto libre sobre descripción y observaciones.
- Importe mínimo.
- Importe máximo.

Ordenamiento:

- Fecha ascendente o descendente.
- Importe ascendente o descendente.
- Categoría ascendente o descendente.

Reglas:

- Los filtros se combinan con lógica AND.
- Debe existir una acción para limpiar filtros.
- El dashboard refleja el conjunto filtrado.
- Un rango inválido debe mostrar validación y no ejecutar el filtro.

## 10. Persistencia

La aplicación guarda los datos en un documento JSON dentro de OPFS.

```json
{
  "schemaVersion": 1,
  "lastUpdatedAt": "2026-08-01T15:30:00.000Z",
  "transactions": []
}
```

Reglas:

- Crear el archivo al iniciar si no existe.
- Validar estructura y versión.
- No reemplazar automáticamente datos corruptos.
- Serializar operaciones de escritura.
- Mostrar un error recuperable si OPFS no está disponible.
- Permitir exportar una copia JSON.
- Permitir importar un JSON válido con confirmación previa.

## 11. Importación y exportación

### Exportación

- Descargar el documento actual como JSON.
- Usar un nombre con fecha, por ejemplo `domestic-finance-2026-08-01.json`.
- No modificar el estado de la aplicación.

### Importación

- Seleccionar un archivo JSON.
- Validarlo completamente.
- Informar cantidad de movimientos a importar.
- Solicitar confirmación antes de reemplazar datos.
- No modificar el archivo actual ante validación fallida.
- Después de importar, recalcular indicadores.

## 12. Reglas de validación

- Tipo obligatorio.
- Fecha obligatoria y válida.
- Importe mayor que cero.
- Categoría obligatoria y compatible con el tipo.
- Descripción obligatoria, sin aceptar solo espacios.
- Medio de pago obligatorio.
- Observaciones opcionales.
- Importe mínimo no puede superar importe máximo.
- Fecha desde no puede superar fecha hasta.

## 13. Reglas de dashboard

```text
Total ingresos = suma de amount donde type = income
Total egresos = suma de amount donde type = expense
Balance = total ingresos - total egresos
Cantidad de movimientos = cantidad del conjunto visible
```

El gráfico agrupa egresos por categoría y muestra importe y proporción.

## 14. Estados de interfaz

- Cargando almacenamiento.
- Sin movimientos.
- Sin resultados para los filtros.
- Error de lectura.
- Error de escritura.
- Datos corruptos.
- Operación exitosa.
- Importación inválida.

## 15. Responsive

- Mobile-first.
- Dashboard en una columna en pantallas pequeñas.
- Tarjetas reorganizables según ancho.
- Filtros colapsables en móvil.
- Tabla con scroll horizontal controlado o representación móvil equivalente.
- Modales adaptados al alto disponible.

## 16. Accesibilidad

- Labels explícitos.
- Mensajes de error asociados a campos.
- Navegación por teclado.
- Foco controlado en modales.
- Contraste suficiente.
- Iconos acompañados por texto o etiquetas accesibles.

## 17. Criterios de aceptación

- El usuario puede iniciar sesión con la configuración válida.
- El usuario puede crear, editar y eliminar movimientos.
- Los datos persisten al recargar la página en el mismo origen y navegador.
- Los filtros y ordenamientos funcionan combinados.
- Los indicadores se recalculan correctamente.
- La importación inválida no destruye datos existentes.
- La aplicación funciona en móvil y escritorio.
- Las rutas funcionan al recargar desde Cloudflare Pages.
