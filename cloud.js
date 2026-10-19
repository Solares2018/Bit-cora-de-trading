// =====================================================================
//  FXKCloud — guardado en la nube con Firebase (Auth + Firestore)
//  Cada usuario tiene un documento: bitacoras/{uid} = { json, updatedAt, device }
// =====================================================================
(function () {
    const cfg = window.FXK_FIREBASE_CONFIG || {};
    const configured = !!(cfg.apiKey && cfg.projectId && typeof firebase !== 'undefined');

    const statusListeners = [];
    let status = configured ? 'connecting' : 'local';
    function setStatus(s) {
        status = s;
        statusListeners.forEach(fn => { try { fn(s); } catch (e) { } });
    }

    if (!configured) {
        window.FXKCloud = {
            configured: false,
            onStatus(fn) { statusListeners.push(fn); fn(status); },
            save() { }
        };
        return;
    }

    firebase.initializeApp(cfg);
    const auth = firebase.auth();
    const db = firebase.firestore();
    // Caché offline: si no hay internet, guarda y sincroniza cuando vuelva
    db.enablePersistence({ synchronizeTabs: true }).catch(() => { });

    const DEVICE = Math.random().toString(36).slice(2, 10);
    let uid = null;
    let saveTimer = null;
    let pendingJson = null;
    let unsub = null;

    const ERRORS = {
        'auth/invalid-email': 'El correo no es válido.',
        'auth/user-not-found': 'No existe una cuenta con ese correo.',
        'auth/wrong-password': 'Contraseña incorrecta.',
        'auth/invalid-credential': 'Correo o contraseña incorrectos.',
        'auth/invalid-login-credentials': 'Correo o contraseña incorrectos.',
        'auth/email-already-in-use': 'Ya existe una cuenta con ese correo. Usa "Entrar".',
        'auth/weak-password': 'La contraseña debe tener al menos 6 caracteres.',
        'auth/too-many-requests': 'Demasiados intentos. Espera unos minutos.',
        'auth/network-request-failed': 'Sin conexión a internet.',
        'auth/unauthorized-domain': 'Este dominio no está autorizado en Firebase (Authentication → Configuración → Dominios autorizados).',
        'auth/operation-not-allowed': 'Activa "Correo electrónico/contraseña" en Firebase Authentication.',
        'permission-denied': 'Firestore rechazó el acceso: revisa las reglas de seguridad.'
    };
    const msg = (e) => ERRORS[e && e.code] || (e && e.message) || 'Error desconocido.';

    function docRef() { return db.collection('bitacoras').doc(uid); }

    async function flush() {
        if (!uid || pendingJson === null) return;
        const json = pendingJson;
        pendingJson = null;
        setStatus('saving');
        try {
            await docRef().set({
                json,
                device: DEVICE,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            setStatus(navigator.onLine ? 'synced' : 'offline');
        } catch (e) {
            console.error('Cloud save error', e);
            pendingJson = pendingJson ?? json; // reintentar luego
            setStatus('error');
        }
    }

    addEventListener('online', () => { if (uid) { setStatus('saving'); flush().then(() => setStatus('synced')); } });
    addEventListener('offline', () => { if (uid) setStatus('offline'); });
    addEventListener('beforeunload', () => { if (pendingJson !== null) flush(); });

    window.FXKCloud = {
        configured: true,
        onStatus(fn) { statusListeners.push(fn); fn(status); },
        onAuth(fn) { auth.onAuthStateChanged(u => { uid = u ? u.uid : null; fn(u); }); },
        signIn: (email, pass) => auth.signInWithEmailAndPassword(email, pass).catch(e => { throw new Error(msg(e)); }),
        signUp: (email, pass) => auth.createUserWithEmailAndPassword(email, pass).catch(e => { throw new Error(msg(e)); }),
        reset: (email) => auth.sendPasswordResetEmail(email).catch(e => { throw new Error(msg(e)); }),
        signOut: async () => { await flush(); if (unsub) unsub(); unsub = null; return auth.signOut(); },
        user: () => auth.currentUser,

        // Carga los datos del usuario (null si todavía no tiene)
        async load() {
            try {
                const snap = await docRef().get();
                setStatus('synced');
                return snap.exists ? JSON.parse(snap.data().json) : null;
            } catch (e) {
                setStatus('error');
                throw new Error(msg(e));
            }
        },

        // Guardado automático (agrupa cambios rápidos en uno solo)
        save(data) {
            if (!uid) return;
            pendingJson = JSON.stringify(data);
            setStatus('saving');
            clearTimeout(saveTimer);
            saveTimer = setTimeout(flush, 700);
        },

        // Cambios hechos desde otro dispositivo, en tiempo real
        subscribe(fn) {
            if (unsub) unsub();
            unsub = docRef().onSnapshot(snap => {
                if (!snap.exists || snap.metadata.hasPendingWrites) return;
                const d = snap.data();
                if (d.device === DEVICE || pendingJson !== null) return;
                try { fn(JSON.parse(d.json)); } catch (e) { }
            }, e => { console.error(e); setStatus('error'); });
        }
    };
})();
