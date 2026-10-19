# MEMORIA DEL PROYECTO - TRADING DASHBOARD (FXKINGS)

Este archivo registra el progreso, las funcionalidades implementadas y la estructura actual del proyecto para asegurar la continuidad del desarrollo.

## Estado Actual del Proyecto
**Fecha de última actualización:** 15 de Febrero de 2026
**Versión:** 2.1 (Multi-Cuenta + Gold Ticker)

## Estructura de Archivos
- `index.html`: Estructura principal, contiene el dashboard, modales de gestión y navegación.
- `style.css`: Estilos visuales con tema "Black & Gold", diseño responsivo y efectos glassmorphism.
- `script.js`: Lógica de la aplicación, manejo de estado (`appData`), persistencia en `localStorage`, gestión de cuentas, operaciones y gráficos.

## Funcionalidades Implementadas

### 1. Gestión de Cuentas (Multi-Account)
- **Creación**: Permite crear múltiples cuentas de trading con nombres personalizados y balances iniciales independientes.
- **Edición**: Capacidad de modificar el nombre y capital inicial de cualquier cuenta existente.
- **Eliminación**: Opción para borrar cuentas (con confirmación de seguridad).
- **Conmutación**: Cambio rápido entre cuentas activas desde el menú lateral; el dashboard se actualiza instantáneamente para mostrar los datos de la cuenta seleccionada.
- **Persistencia**: Todos los datos de las cuentas se guardan automáticamente en el navegador.

### 2. Registro de Operaciones
- **Selección de Activo**: Dropdown con lista predefinida de pares Forex y Commodities, priorizando **XAUUSD**.
- **Bitácora Completa**: Registro de Fecha, Hora, Tipo (Buy/Sell), Lotes, Precio de Entrada y Resultado.
- **Cálculo Automático**: Estadísticas de ganancia/pérdida y actualización del balance en tiempo real.

### 3. Visualización y Monitoreo (Dashboard)
- **Gold Ticker (XAUUSD)**: Widget compacto de TradingView integrado en el encabezado, mostrando el precio del Oro en tiempo real.
- **Gráfico de Rendimiento**: Curva de balance interactiva usando Chart.js.
- **Indicadores Clave**: Tarjetas de Balance Total, Operaciones Ganadas/Perdidas y P/L Neto.
- **Reloj de Mercados**: Indicador de sesiones de mercado activas (Sydney, Tokio, Londres, NY).

### 4. Diseño (UI/UX)
- Tema oscuro premium (Negro/Dorado).
- Modales interactivos para formularios.
- Tablas con estilos de ganancias (verde) y pérdidas (rojo).
- Diseño responsivo para adaptación a diferentes pantallas.

## Notas para el Futuro
- **Seguridad de Datos**: Actualmente los datos residen en `localStorage`. Para mayor seguridad, considerar exportación/importación de JSON backup.
- **API Real**: El precio es visual; para usar precios en cálculos automáticos se requeriría una API de datos de mercado backend.

---
*Este documento debe actualizarse con cada nueva funcionalidad mayor agregada.*
