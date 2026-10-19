# Activar el guardado en la nube (Firebase) — 10 minutos, una sola vez

1. **Crear el proyecto**
   - Entra a https://console.firebase.google.com con tu cuenta de Google.
   - "Crear un proyecto" → nombre: `fxkings-bitacora` → puedes desactivar Google Analytics → Crear.

2. **Activar el inicio de sesión**
   - Menú izquierdo: **Compilación → Authentication → Comenzar**.
   - Pestaña "Método de acceso" → **Correo electrónico/contraseña** → Habilitar → Guardar.
   - Pestaña **Configuración → Dominios autorizados → Agregar dominio** → escribe `TUUSUARIO.github.io` (el dominio de tu página de GitHub Pages).

3. **Crear la base de datos**
   - Menú: **Compilación → Firestore Database → Crear base de datos**.
   - Ubicación: la que sugiera (ej. `nam5`) → "Comenzar en **modo de producción**" → Crear.
   - Pestaña **Reglas**: borra todo, pega el contenido del archivo `firestore.rules` de esta carpeta → **Publicar**.

4. **Copiar la configuración**
   - Engrane ⚙️ (arriba a la izquierda) → **Configuración del proyecto** → baja a "Tus apps" → ícono **Web `</>`**.
   - Apodo: `bitacora` → Registrar app (NO marques Hosting).
   - Te muestra un bloque `const firebaseConfig = { apiKey: "...", ... }`.
   - Copia esos 6 valores dentro de `firebase-config.js` (o mándamelos y yo lo dejo listo).

5. **Subir a GitHub** el `firebase-config.js` actualizado y abrir tu página.
   - Aparece la pantalla de acceso → **Crear cuenta nueva** con tu correo y una contraseña.
   - La primera vez, lo que tenías en ese navegador (incluida la cuenta ANDRU) se sube a la nube.
   - Desde cualquier otro dispositivo: **Entrar** con el mismo correo y contraseña.

Nota: el plan gratuito de Firebase (Spark) alcanza de sobra para esta bitácora.
