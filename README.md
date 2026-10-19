# FX KINGS · Trading Journal

Bitácora de trading de FX KINGS (dashboard, bitácora de operaciones, cuentas y perfil).

**Ver en línea:** activa GitHub Pages (Settings → Pages → Branch `main` / root) y abre la URL que te da GitHub.

## Estructura
- `index.html`, `style.css`, `script.js` — la aplicación
- `assets/` — logo FX KINGS
- `data/andru-seed.js` — cuenta ANDRU precargada
- `firebase-config.js` — datos de tu proyecto Firebase
- `cloud.js` — guardado en la nube
- `firestore.rules` — reglas de seguridad para pegar en Firebase

## Guardado de datos
- **Con Firebase configurado** (ver `GUIA-FIREBASE.md`): inicio de sesión con correo y contraseña;
  cada cambio se guarda solo en la nube y se sincroniza en tiempo real entre dispositivos.
  Funciona sin internet y sube los cambios al reconectar.
- **Sin configurar** (`firebase-config.js` vacío): modo local, guarda solo en ese navegador.
- En ambos casos: **Cuentas → Guardar Respaldo** descarga una copia `.json`.
