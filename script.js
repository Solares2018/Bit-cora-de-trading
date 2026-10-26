document.addEventListener('DOMContentLoaded', () => {
    // --- constants ---
    const ASSETS = [
        "XAUUSD", "EURUSD", "GBPUSD", "USDJPY", "USDCAD", "AUDUSD", "NZDUSD",
        "USDCHF", "GBPJPY", "CHFJPY", "BTCUSD", "ETHUSD", "US30", "DJ30", "NAS100", "SPX500", "GER30", "OIL"
    ];

    // Avatar por defecto (SVG embebido, no depende de archivos externos)
    const DEFAULT_AVATAR = 'data:image/svg+xml;utf8,' + encodeURIComponent(
        `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120">
            <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0" stop-color="#1b2216"/><stop offset="1" stop-color="#0a0c0b"/></linearGradient></defs>
            <rect width="120" height="120" fill="url(#g)"/>
            <circle cx="60" cy="46" r="22" fill="#A8FF2E" opacity=".85"/>
            <path d="M18 112c6-24 24-36 42-36s36 12 42 36" fill="#D9DEE5" opacity=".7"/>
        </svg>`);

    // --- State Management ---
    function freshData() {
        const id = Date.now();
        return {
            userProfile: { name: "Trader", image: DEFAULT_AVATAR },
            currentAccountId: id,
            accounts: [{ id, name: "Cuenta Principal", initialBalance: 1000, operations: [] }]
        };
    }

    // Normaliza datos (incluye migración del formato antiguo sin "accounts")
    function normalizeData(parsed) {
        let d;
        if (!parsed) d = freshData();
        else if (!parsed.accounts) {
            d = freshData();
            d.accounts[0].name = parsed.profile?.name || "Cuenta Principal";
            d.accounts[0].initialBalance = parsed.profile?.initialBalance || 1000;
            d.accounts[0].operations = parsed.operations || [];
            d.userProfile.name = parsed.profile?.name || "Trader";
            d.userProfile.image = parsed.profile?.image || DEFAULT_AVATAR;
        } else d = parsed;

        if (!d.userProfile) d.userProfile = { name: "Trader", image: DEFAULT_AVATAR };
        if (!d.userProfile.image || d.userProfile.image === 'assets/default-avatar.png') d.userProfile.image = DEFAULT_AVATAR;
        if (!Array.isArray(d.accounts) || d.accounts.length === 0) d.accounts = freshData().accounts;
        if (!d.accounts.find(a => a.id === d.currentAccountId)) d.currentAccountId = d.accounts[0].id;
        return d;
    }

    function loadLocal() {
        try { return JSON.parse(localStorage.getItem('fxkings_data')); } catch (e) { return null; }
    }

    let appData = normalizeData(loadLocal());

    // --- Cuentas precargadas (data/andru-seed.js) ---
    // Se agregan una sola vez; si después borras la cuenta, no vuelve a aparecer.
    function applySeed() {
        const seed = window.FXK_SEED;
        if (!seed || !Array.isArray(seed.accounts)) return false;
        appData.seedApplied = appData.seedApplied || [];
        let added = null, changed = false;
        seed.accounts.forEach(sa => {
            const key = `${sa.seedId}@v${seed.version}`;
            if (appData.seedApplied.includes(key)) return;
            const exists = appData.accounts.some(a => a.seedId === sa.seedId ||
                (a.name === sa.name && a.operations.length >= sa.operations.length));
            if (!exists) {
                const acc = JSON.parse(JSON.stringify(sa));
                if (appData.accounts.some(a => a.id === acc.id)) acc.id = Date.now();
                appData.accounts.push(acc);
                added = acc;
            }
            appData.seedApplied.push(key);
            changed = true;
        });
        if (added) {
            // Quita la cuenta vacía de ejemplo ("Cuenta Principal", $1,000, sin operaciones)
            appData.accounts = appData.accounts.filter(a =>
                a === added || !(a.name === 'Cuenta Principal' && a.operations.length === 0 && Number(a.initialBalance) === 1000));
            const cur = appData.accounts.find(a => a.id === appData.currentAccountId);
            if (!cur || cur.operations.length === 0) appData.currentAccountId = added.id;
        }
        return changed;
    }

    applySeed();
    try { localStorage.setItem('fxkings_data', JSON.stringify(appData)); } catch (e) { }

    function getCurrentAccount() {
        return appData.accounts.find(a => a.id === appData.currentAccountId) || appData.accounts[0];
    }

    // --- DOM Elements ---
    const activeAccountNameEl = document.getElementById('active-account-name');
    const headerUserName = document.getElementById('header-user-name');
    const headerProfilePic = document.getElementById('header-profile-pic');

    const totalBalanceEl = document.getElementById('total-balance');
    const initialBalanceDisplay = document.getElementById('initial-balance-display');
    const winsCountEl = document.getElementById('wins-count');
    const lossesCountEl = document.getElementById('losses-count');
    const netPnlEl = document.getElementById('net-pnl');
    const pnlPctEl = document.getElementById('pnl-pct');
    const winrateEl = document.getElementById('winrate');
    const opsCountEl = document.getElementById('ops-count');
    const periodLabelEl = document.getElementById('period-label');
    const chartSubEl = document.getElementById('chart-sub');

    const operationsTableBody = document.querySelector('#operations-table tbody');
    const operationForm = document.getElementById('operation-form');
    const opAssetSelect = document.getElementById('op-asset');

    const accountsListEl = document.getElementById('accounts-list');
    const btnNewAccount = document.getElementById('btn-new-account');
    const accountModal = document.getElementById('account-modal');
    const closeAccountModal = document.getElementById('close-account-modal');

    const profileForm = document.getElementById('profile-form');
    const profileNameInput = document.getElementById('profile-name');
    const profileAccountNameInput = document.getElementById('profile-account-name');
    const profileInitialBalanceInput = document.getElementById('profile-initial-balance');
    const profilePreviewImg = document.getElementById('profile-preview-img');
    const profilePicInput = document.getElementById('profile-pic-input');

    const navBtns = document.querySelectorAll('.nav-btn[data-target]');
    const sections = document.querySelectorAll('.view-section');

    [headerProfilePic, profilePreviewImg].forEach(img => {
        img.addEventListener('error', () => { if (img.src !== DEFAULT_AVATAR) img.src = DEFAULT_AVATAR; });
    });

    // --- Helpers de fecha (strings YYYY-MM-DD, sin problemas de zona horaria) ---
    const pad = n => String(n).padStart(2, '0');
    const toISO = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    const opKey = op => `${op.date || ''} ${op.time || '00:00'}`;

    function sortOps(ops) {
        return [...ops].sort((a, b) => {
            const ka = opKey(a), kb = opKey(b);
            if (ka !== kb) return ka < kb ? -1 : 1;
            return (a.seq || 0) - (b.seq || 0);
        });
    }

    function inRange(op, start, end) {
        if (start && op.date < start) return false;
        if (end && op.date > end) return false;
        return true;
    }

    // --- Initialization ---
    function init() {
        populateAssetSelect();
        updateGlobalProfileUI();
        initChart();
        refreshAllViews();
        startMarketClock();
        startGoldTicker();
        initCandleCursor();
        initCardGlow();
    }

    function refreshAllViews() {
        updateCustomHeader();
        updateProfileFormValues();
        renderOperationsTable();
        calculateStats();
        renderAccountsList();
        updateChart();
    }

    function populateAssetSelect() {
        opAssetSelect.innerHTML = ASSETS.map(a => `<option value="${a}">${a}</option>`).join('');
    }

    // --- Navigation ---
    navBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            navBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            sections.forEach(s => s.classList.remove('active'));
            const targetId = btn.getAttribute('data-target');
            document.getElementById(targetId).classList.add('active');
            if (targetId === 'dashboard') updateChart();
            if (targetId === 'accounts') renderAccountsList();
        });
    });

    // --- Account Management ---
    function renderAccountsList() {
        accountsListEl.innerHTML = '';
        appData.accounts.forEach(acc => {
            const currentBal = accBalance(acc);
            const wdTotal = getMovs(acc).filter(mv => mv.type !== 'deposit').reduce((s, mv) => s + Number(mv.amount || 0), 0);
            const isActive = acc.id === appData.currentAccountId;

            const card = document.createElement('div');
            card.className = `account-card ${isActive ? 'active' : ''}`;
            card.onclick = (e) => {
                if (e.target.closest('.account-actions')) return;
                switchAccount(acc.id);
            };

            card.innerHTML = `
                <div>
                    <div class="account-name">${escapeHtml(acc.name)}</div>
                    <div class="account-balance-display">${formatCurrency(currentBal)}</div>
                    <div class="account-details">
                        <span>Inicial: ${formatCurrency(acc.initialBalance)}</span>
                        <span>Ops: ${acc.operations.length}</span>
                        ${wdTotal ? `<span class="danger">Retiros: -${formatCurrency(wdTotal)}</span>` : ''}
                    </div>
                </div>
                <div class="account-actions">
                    <button class="btn-card-action btn-edit-account" data-id="${acc.id}" title="Editar"><i class="fas fa-edit"></i></button>
                    ${appData.accounts.length > 1 ? `<button class="btn-card-action btn-delete-account" data-id="${acc.id}" title="Borrar"><i class="fas fa-trash"></i></button>` : ''}
                </div>`;
            accountsListEl.appendChild(card);
        });

        document.querySelectorAll('.btn-delete-account').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const id = Number(btn.getAttribute('data-id'));
                if (confirm('¿Estás seguro de borrar esta cuenta y todos sus datos?')) deleteAccount(id);
            });
        });

        document.querySelectorAll('.btn-edit-account').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                openAccountModal(Number(btn.getAttribute('data-id')));
            });
        });
    }

    function switchAccount(id) {
        appData.currentAccountId = id;
        saveData();
        refreshAllViews();
        showToast('Cuenta activa cambiada');
    }

    function createAccount(name, balance) {
        const newAcc = { id: Date.now(), name, initialBalance: parseFloat(balance), operations: [] };
        appData.accounts.push(newAcc);
        appData.currentAccountId = newAcc.id;
        saveData();
        refreshAllViews();
        accountModal.classList.add('hidden');
        accountForm.reset();
        document.querySelector('[data-target="dashboard"]').click();
    }

    function deleteAccount(id) {
        appData.accounts = appData.accounts.filter(a => a.id !== id);
        if (appData.currentAccountId === id) {
            appData.currentAccountId = appData.accounts.length > 0 ? appData.accounts[0].id : null;
        }
        if (appData.accounts.length === 0) { createAccount("Nueva Cuenta", 1000); return; }
        saveData();
        refreshAllViews();
    }

    const accountForm = document.getElementById('account-form');
    const modalTitle = document.getElementById('account-modal-title');
    const submitBtn = document.getElementById('account-submit-btn');
    const nameInput = document.getElementById('acc-name-input');
    const balInput = document.getElementById('acc-balance-input');
    const editIdInput = document.getElementById('edit-acc-id');

    function openAccountModal(editId = null) {
        if (editId) {
            const acc = appData.accounts.find(a => a.id === editId);
            if (!acc) return;
            modalTitle.textContent = "Editar Cuenta";
            submitBtn.textContent = "Guardar Cambios";
            nameInput.value = acc.name;
            balInput.value = acc.initialBalance;
            editIdInput.value = acc.id;
        } else {
            modalTitle.textContent = "Crear Nueva Cuenta";
            submitBtn.textContent = "Crear Cuenta";
            nameInput.value = "";
            balInput.value = "";
            editIdInput.value = "";
        }
        accountModal.classList.remove('hidden');
    }

    btnNewAccount.addEventListener('click', () => openAccountModal());

    // --- Respaldo JSON ---
    document.getElementById('btn-backup-export').addEventListener('click', () => {
        const blob = new Blob([JSON.stringify(appData, null, 1)], { type: 'application/json' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `fxkings-respaldo-${toISO(new Date())}.json`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(a.href), 1000);
        showToast('Respaldo descargado');
    });

    const backupInput = document.getElementById('backup-file-input');
    document.getElementById('btn-backup-import').addEventListener('click', () => backupInput.click());
    backupInput.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        try {
            const data = JSON.parse(await file.text());
            if (!Array.isArray(data.accounts)) throw new Error('formato');
            if (!confirm(`El respaldo tiene ${data.accounts.length} cuenta(s). ¿Reemplazar los datos actuales de este navegador?`)) return;
            data.ownerUid = appData.ownerUid;
            appData = data;
            if (!appData.userProfile) appData.userProfile = { name: 'Trader', image: DEFAULT_AVATAR };
            if (!appData.accounts.find(a => a.id === appData.currentAccountId)) appData.currentAccountId = appData.accounts[0]?.id;
            saveData();
            updateGlobalProfileUI();
            refreshAllViews();
            showToast('Respaldo cargado');
        } catch (err) {
            alert('❌ El archivo no es un respaldo válido de la bitácora.');
        } finally {
            backupInput.value = '';
        }
    });
    closeAccountModal.addEventListener('click', () => accountModal.classList.add('hidden'));

    accountForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const name = nameInput.value;
        const bal = parseFloat(balInput.value);
        const editId = editIdInput.value ? Number(editIdInput.value) : null;
        if (editId) updateAccount(editId, name, bal);
        else createAccount(name, bal);
    });

    function updateAccount(id, name, balance) {
        const acc = appData.accounts.find(a => a.id === id);
        if (acc) {
            acc.name = name;
            acc.initialBalance = balance;
            saveData();
            refreshAllViews();
            accountModal.classList.add('hidden');
        }
    }

    // --- Profile ---
    function updateGlobalProfileUI() {
        headerUserName.textContent = appData.userProfile.name || 'Trader';
        headerProfilePic.src = appData.userProfile.image || DEFAULT_AVATAR;
        profilePreviewImg.src = appData.userProfile.image || DEFAULT_AVATAR;
    }

    function updateProfileFormValues() {
        const currentAcc = getCurrentAccount();
        profileNameInput.value = appData.userProfile.name || '';
        if (!currentAcc) return;
        profileAccountNameInput.value = currentAcc.name;
        profileInitialBalanceInput.value = currentAcc.initialBalance;
    }

    // Foto de perfil: se recorta a cuadrado y se reduce a 400px para que no pese ni se deforme
    profilePicInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (event) => {
            const img = new Image();
            img.onload = () => {
                const size = 400;
                const side = Math.min(img.width, img.height);
                const sx = (img.width - side) / 2;
                const sy = (img.height - side) / 2;
                const c = document.createElement('canvas');
                c.width = c.height = size;
                c.getContext('2d').drawImage(img, sx, sy, side, side, 0, 0, size, size);
                appData.userProfile.image = c.toDataURL('image/jpeg', 0.88);
                updateGlobalProfileUI();
                saveData();
                showToast('Foto de perfil actualizada');
            };
            img.src = event.target.result;
        };
        reader.readAsDataURL(file);
    });

    profileForm.addEventListener('submit', (e) => {
        e.preventDefault();
        appData.userProfile.name = profileNameInput.value.trim() || 'Trader';
        const currentAcc = getCurrentAccount();
        if (currentAcc) {
            if (profileAccountNameInput.value.trim()) currentAcc.name = profileAccountNameInput.value.trim();
            const bal = parseFloat(profileInitialBalanceInput.value);
            if (!isNaN(bal)) currentAcc.initialBalance = bal;
        }
        saveData();
        updateGlobalProfileUI();
        refreshAllViews();
        showToast('Datos actualizados');
    });

    function updateCustomHeader() {
        const currentAcc = getCurrentAccount();
        activeAccountNameEl.textContent = currentAcc ? currentAcc.name : "Sin Cuenta";
        headerUserName.textContent = appData.userProfile.name || "Trader";
    }

    // --- Operations ---
    const opModal = document.getElementById('operation-modal');
    const btnAddOp = document.getElementById('btn-add-operation');
    const btnCloseOpModal = document.querySelector('#operation-modal .close-modal');

    btnAddOp.addEventListener('click', () => openOperationModal());
    btnCloseOpModal.addEventListener('click', () => opModal.classList.add('hidden'));

    // Cerrar modales al hacer clic fuera
    document.querySelectorAll('.modal').forEach(m => {
        m.addEventListener('click', (e) => { if (e.target === m) m.classList.add('hidden'); });
    });

    function openOperationModal(opId = null) {
        if (opId) {
            const op = getCurrentAccount().operations.find(o => o.id === opId);
            if (!op) return;
            document.getElementById('modal-title').textContent = "Editar Operación";
            document.getElementById('edit-op-id').value = op.id;
            document.getElementById('op-asset').value = op.asset;
            document.getElementById(`radio-${op.type}`).checked = true;
            document.getElementById('op-date').value = op.date;
            document.getElementById('op-time').value = op.time;
            document.getElementById('op-zone-top').value = op.zoneTop || "";
            document.getElementById('op-zone-bottom').value = op.zoneBottom || "";
            document.getElementById('op-entry').value = op.entryPrice;
            document.getElementById('op-lot').value = op.lotSize;
            document.getElementById('op-result').value = op.result;
        } else {
            document.getElementById('modal-title').textContent = "Registrar Operación";
            document.getElementById('edit-op-id').value = "";
            operationForm.reset();
            const now = new Date();
            document.getElementById('op-date').value = toISO(now);
            document.getElementById('op-time').value = now.toTimeString().substring(0, 5);
        }
        opModal.classList.remove('hidden');
    }

    operationForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const currentAcc = getCurrentAccount();
        if (!currentAcc) return;

        const opId = document.getElementById('edit-op-id').value;
        const opData = {
            asset: document.getElementById('op-asset').value,
            type: document.querySelector('input[name="op-type"]:checked').value,
            date: document.getElementById('op-date').value,
            time: document.getElementById('op-time').value,
            zoneTop: parseFloat(document.getElementById('op-zone-top').value) || 0,
            zoneBottom: parseFloat(document.getElementById('op-zone-bottom').value) || 0,
            entryPrice: parseFloat(document.getElementById('op-entry').value),
            lotSize: parseFloat(document.getElementById('op-lot').value),
            result: parseFloat(document.getElementById('op-result').value)
        };

        if (opId) {
            const index = currentAcc.operations.findIndex(o => String(o.id) === String(opId));
            if (index !== -1) currentAcc.operations[index] = { ...currentAcc.operations[index], ...opData };
        } else {
            currentAcc.operations.unshift({ id: Date.now(), ...opData });
        }

        saveData();
        refreshAllViews();
        opModal.classList.add('hidden');
        showToast(opId ? 'Operación actualizada' : 'Operación registrada');
    });

    // --- Tabla + filtro de bitácora ---
    function getTableRange() {
        return {
            start: document.getElementById('filter-date-start').value || null,
            end: document.getElementById('filter-date-end').value || null
        };
    }

    function getTableOps() {
        const acc = getCurrentAccount();
        if (!acc) return [];
        const { start, end } = getTableRange();
        return acc.operations.filter(op => inRange(op, start, end));
    }

    function getTableMovs() {
        const acc = getCurrentAccount();
        if (!acc) return [];
        const { start, end } = getTableRange();
        return getMovs(acc).filter(mv => inRange(mv, start, end));
    }

    // =====================================================
    //  RETIROS Y DEPÓSITOS DE CAPITAL
    // =====================================================
    const movModal = document.getElementById('movement-modal');
    const movForm = document.getElementById('movement-form');
    const movTitle = document.getElementById('movement-modal-title');
    const movSubmit = document.getElementById('movement-submit-btn');

    function setMovType(type) {
        document.getElementById(type === 'deposit' ? 'radio-mov-deposit' : 'radio-mov-withdrawal').checked = true;
        const dep = type === 'deposit';
        movSubmit.innerHTML = dep ? '<i class="fas fa-circle-plus"></i> Guardar Depósito' : '<i class="fas fa-money-bill-transfer"></i> Guardar Retiro';
        movSubmit.classList.toggle('btn-submit-red', !dep);
    }
    document.querySelectorAll('input[name="mov-type"]').forEach(r => r.addEventListener('change', () => setMovType(r.value)));

    function openMovementModal(type = 'withdrawal', movId = null) {
        movForm.reset();
        document.getElementById('edit-mov-id').value = '';
        if (movId) {
            const mv = getMovs(getCurrentAccount()).find(x => x.id === movId);
            if (!mv) return;
            movTitle.textContent = mv.type === 'deposit' ? 'Editar Depósito' : 'Editar Retiro';
            document.getElementById('edit-mov-id').value = mv.id;
            document.getElementById('mov-date').value = mv.date;
            document.getElementById('mov-time').value = mv.time || '';
            document.getElementById('mov-amount').value = mv.amount;
            document.getElementById('mov-note').value = mv.note || '';
            setMovType(mv.type);
        } else {
            movTitle.textContent = type === 'deposit' ? 'Agregar Capital' : 'Registrar Retiro';
            const now = new Date();
            document.getElementById('mov-date').value = toISO(now);
            document.getElementById('mov-time').value = now.toTimeString().substring(0, 5);
            setMovType(type);
        }
        const acc = getCurrentAccount();
        document.getElementById('mov-balance-hint').textContent = `Balance actual de ${acc.name}: ${formatCurrency(accBalance(acc))}`;
        movModal.classList.remove('hidden');
        setTimeout(() => document.getElementById('mov-amount').focus(), 50);
    }

    document.getElementById('btn-add-withdrawal').addEventListener('click', () => openMovementModal('withdrawal'));
    document.getElementById('btn-add-deposit').addEventListener('click', () => openMovementModal('deposit'));
    document.getElementById('close-movement-modal').addEventListener('click', () => movModal.classList.add('hidden'));

    movForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const acc = getCurrentAccount();
        if (!acc) return;
        const amount = Math.abs(parseFloat(document.getElementById('mov-amount').value));
        if (!amount) { alert('Escribe un monto mayor a 0.'); return; }
        const type = document.querySelector('input[name="mov-type"]:checked').value;
        const data = {
            type,
            date: document.getElementById('mov-date').value,
            time: document.getElementById('mov-time').value || '00:00',
            amount,
            note: document.getElementById('mov-note').value.trim()
        };
        if (!Array.isArray(acc.movements)) acc.movements = [];
        const editId = document.getElementById('edit-mov-id').value;
        if (editId) {
            const i = acc.movements.findIndex(m => String(m.id) === String(editId));
            if (i !== -1) acc.movements[i] = { ...acc.movements[i], ...data };
        } else {
            if (type === 'withdrawal' && amount > accBalance(acc) &&
                !confirm(`El retiro (${formatCurrency(amount)}) es mayor al balance actual (${formatCurrency(accBalance(acc))}). ¿Registrarlo de todos modos?`)) return;
            acc.movements.push({ id: Date.now(), ...data });
        }
        saveData();
        refreshAllViews();
        movModal.classList.add('hidden');
        showToast(type === 'deposit' ? 'Depósito de capital registrado' : 'Retiro registrado');
    });

    function renderMovements() {
        const body = document.querySelector('#movements-table tbody');
        const empty = document.getElementById('movements-empty');
        const totalsEl = document.getElementById('movements-totals');
        if (!body) return;
        const movs = [...getTableMovs()].sort((a, b) => opKey(a) < opKey(b) ? 1 : -1);
        body.innerHTML = '';
        let dep = 0, wd = 0;
        movs.forEach(mv => {
            const isDep = mv.type === 'deposit';
            if (isDep) dep += Number(mv.amount); else wd += Number(mv.amount);
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${mv.date} <span style="font-size:0.8em; color:#7d8794">${mv.time || ''}</span></td>
                <td><span class="type-pill ${isDep ? 'deposit' : 'sell'}"><i class="fas fa-${isDep ? 'circle-plus' : 'money-bill-transfer'}"></i>${isDep ? 'DEPÓSITO' : 'RETIRO'}</span></td>
                <td class="${isDep ? 'mov-deposit' : 'profit-negative'}">${isDep ? '+' : '-'}${formatCurrency(mv.amount)}</td>
                <td class="mov-note">${escapeHtml(mv.note || '—')}</td>
                <td>
                    <button class="btn-icon btn-edit-mov" data-id="${mv.id}" title="Editar"><i class="fas fa-edit"></i></button>
                    <button class="btn-icon btn-delete-mov" data-id="${mv.id}" title="Borrar"><i class="fas fa-trash"></i></button>
                </td>`;
            body.appendChild(tr);
        });
        empty.classList.toggle('hidden', movs.length > 0);
        document.getElementById('movements-table').classList.toggle('hidden', movs.length === 0);
        totalsEl.innerHTML = movs.length
            ? `<span class="mov-deposit">Depósitos +${formatCurrency(dep)}</span><span class="danger">Retiros -${formatCurrency(wd)}</span>`
            : '';

        body.querySelectorAll('.btn-edit-mov').forEach(b => b.addEventListener('click', () => openMovementModal(null, Number(b.dataset.id))));
        body.querySelectorAll('.btn-delete-mov').forEach(b => b.addEventListener('click', () => {
            if (!confirm('¿Borrar este movimiento de capital?')) return;
            const acc = getCurrentAccount();
            acc.movements = getMovs(acc).filter(m => m.id !== Number(b.dataset.id));
            saveData();
            refreshAllViews();
        }));
    }

    function renderOperationsTable() {
        operationsTableBody.innerHTML = '';
        const acc = getCurrentAccount();
        if (!acc) return;

        const filteredOps = getTableOps();

        filteredOps.forEach(op => {
            const row = document.createElement('tr');
            const profitClass = op.result >= 0 ? 'profit-positive' : 'profit-negative';
            const isBuy = op.type === 'buy';
            const pill = `<span class="type-pill ${isBuy ? 'buy' : 'sell'}"><i class="fas fa-arrow-${isBuy ? 'up' : 'down'}"></i>${op.type.toUpperCase()}</span>`;

            row.innerHTML = `
                <td><input type="checkbox" class="op-select" data-id="${op.id}"></td>
                <td>${op.date} <span style="font-size:0.8em; color:#7d8794">${op.time || ''}</span></td>
                <td><span class="asset-tag">${escapeHtml(op.asset || 'N/A')}</span></td>
                <td>${pill}</td>
                <td>${op.entryPrice}</td>
                <td>${op.lotSize}</td>
                <td>${op.zoneTop || '-'}</td>
                <td>${op.zoneBottom || '-'}</td>
                <td class="${profitClass}">${op.result >= 0 ? '+' : ''}${formatCurrency(op.result)}</td>
                <td>
                    <button class="btn-icon btn-edit-one" data-id="${op.id}" title="Editar"><i class="fas fa-edit"></i></button>
                    <button class="btn-icon btn-delete-one" data-id="${op.id}" title="Borrar"><i class="fas fa-trash"></i></button>
                </td>`;
            operationsTableBody.appendChild(row);
        });

        document.querySelectorAll('.btn-edit-one').forEach(btn => {
            btn.addEventListener('click', (e) => openOperationModal(Number(e.currentTarget.getAttribute('data-id'))));
        });

        document.querySelectorAll('.btn-delete-one').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const id = Number(e.currentTarget.getAttribute('data-id'));
                if (confirm('¿Borrar esta operación?')) deleteOperation(id);
            });
        });

        document.querySelectorAll('.op-select').forEach(cb => cb.addEventListener('change', updateDeleteButtonState));

        renderMovements();
        renderAnalysis();
    }

    document.getElementById('btn-apply-filter').addEventListener('click', renderOperationsTable);
    document.getElementById('btn-clear-filter').addEventListener('click', () => {
        document.getElementById('filter-date-start').value = '';
        document.getElementById('filter-date-end').value = '';
        renderOperationsTable();
    });

    function deleteOperation(opId) {
        const acc = getCurrentAccount();
        if (!acc) return;
        acc.operations = acc.operations.filter(op => op.id !== opId);
        saveData();
        refreshAllViews();
    }

    const selectAllCb = document.getElementById('select-all');
    const deleteSelectedBtn = document.getElementById('btn-delete-selected');

    selectAllCb.addEventListener('change', (e) => {
        document.querySelectorAll('.op-select').forEach(cb => cb.checked = e.target.checked);
        updateDeleteButtonState();
    });

    deleteSelectedBtn.addEventListener('click', () => {
        const acc = getCurrentAccount();
        if (!acc) return;
        const checked = document.querySelectorAll('.op-select:checked');
        if (checked.length === 0) return;
        if (confirm(`¿Borrar ${checked.length} operaciones seleccionadas?`)) {
            const ids = Array.from(checked).map(cb => Number(cb.getAttribute('data-id')));
            acc.operations = acc.operations.filter(op => !ids.includes(op.id));
            saveData();
            refreshAllViews();
            deleteSelectedBtn.disabled = true;
            selectAllCb.checked = false;
        }
    });

    function updateDeleteButtonState() {
        deleteSelectedBtn.disabled = document.querySelectorAll('.op-select:checked').length === 0;
    }

    // =====================================================
    //  MÉTRICAS / ANÁLISIS
    // =====================================================
    // Balance antes de una fecha (para que la curva y el drawdown del periodo partan del balance real)
    // --- Movimientos de capital (retiros / depósitos) ---
    const getMovs = acc => (acc && Array.isArray(acc.movements)) ? acc.movements : [];
    const movSigned = mv => (mv.type === 'deposit' ? 1 : -1) * (Number(mv.amount) || 0);
    function accBalance(acc) {
        const pnl = acc.operations.reduce((s, op) => s + (Number(op.result) || 0), 0);
        const flows = getMovs(acc).reduce((s, mv) => s + movSigned(mv), 0);
        return Number(acc.initialBalance) + pnl + flows;
    }

    // Línea de tiempo combinada (operaciones + movimientos), ordenada por fecha/hora
    function buildTimeline(ops, movs) {
        const items = [
            ...ops.map(op => ({ kind: 'op', key: opKey(op), seq: op.seq || 0, ref: op })),
            ...movs.map(mv => ({ kind: 'mov', key: opKey(mv), seq: 1e9, ref: mv }))
        ];
        return items.sort((a, b) => a.key !== b.key ? (a.key < b.key ? -1 : 1) : a.seq - b.seq);
    }

    // Balance antes de una fecha (para que la curva y el drawdown del periodo partan del balance real)
    function balanceBefore(acc, start) {
        if (!start) return Number(acc.initialBalance);
        const pnl = acc.operations.reduce((s, op) => op.date < start ? s + op.result : s, 0);
        const flows = getMovs(acc).reduce((s, mv) => mv.date < start ? s + movSigned(mv) : s, 0);
        return Number(acc.initialBalance) + pnl + flows;
    }

    function computeMetrics(ops, startBalance, movs = []) {
        const sorted = sortOps(ops);
        let lots = 0, net = 0, grossWin = 0, grossLoss = 0, wins = 0, losses = 0;
        let best = null, worst = null;
        let equity = startBalance, peak = startBalance, maxDD = 0, maxDDPct = 0;
        let streak = 0, maxLossStreak = 0;
        let deposits = 0, withdrawals = 0, depCount = 0, wdCount = 0;

        buildTimeline(sorted, movs).forEach(item => {
            if (item.kind === 'mov') {
                // Un retiro/depósito mueve el balance pero NO cuenta como drawdown ni como profit
                const f = movSigned(item.ref);
                if (f >= 0) { deposits += f; depCount++; } else { withdrawals += -f; wdCount++; }
                equity += f;
                peak += f;
                if (equity > peak) peak = equity;
                return;
            }
            const op = item.ref;
            const r = Number(op.result) || 0;
            lots += Number(op.lotSize) || 0;
            net += r;
            if (r > 0) { wins++; grossWin += r; streak = 0; }
            else if (r < 0) { losses++; grossLoss += r; streak++; maxLossStreak = Math.max(maxLossStreak, streak); }
            if (best === null || r > best) best = r;
            if (worst === null || r < worst) worst = r;

            equity += r;
            if (equity > peak) peak = equity;
            const dd = peak - equity;
            if (dd > maxDD) {
                maxDD = dd;
                maxDDPct = peak > 0 ? (dd / peak) * 100 : 0;
            }
        });

        const count = sorted.length;
        const decided = wins + losses;
        return {
            count, lots, net, grossWin, grossLoss, wins, losses,
            winRate: decided ? (wins / decided) * 100 : 0,
            profitFactor: grossLoss !== 0 ? grossWin / Math.abs(grossLoss) : (grossWin > 0 ? Infinity : 0),
            best: best ?? 0, worst: worst ?? 0,
            avgWin: wins ? grossWin / wins : 0,
            avgLoss: losses ? grossLoss / losses : 0,
            avgLot: count ? lots / count : 0,
            maxDD, maxDDPct, maxLossStreak,
            startBalance, endBalance: equity,
            deposits, withdrawals, depCount, wdCount,
            netFlows: deposits - withdrawals,
            netPct: (startBalance + deposits) ? (net / (startBalance + deposits)) * 100 : 0
        };
    }

    function buildSummaryText(m) {
        const flowTxt = (m.depCount || m.wdCount)
            ? ` Movimientos de capital: <span class="hl-gold">${m.depCount} depósito(s) por +${formatCurrency(m.deposits)}</span> y <span class="hl-red">${m.wdCount} retiro(s) por -${formatCurrency(m.withdrawals)}</span>; balance final ${formatCurrency(m.endBalance)}.`
            : '';
        if (m.count === 0) return 'No hay operaciones en el rango seleccionado.' + flowTxt;
        const pfTxt = m.profitFactor === Infinity ? '∞' : m.profitFactor.toFixed(2);
        const parts = [];
        parts.push(`Se ejecutaron <strong>${m.count}</strong> operaciones moviendo <strong class="hl-gold">${m.lots.toFixed(2)} lotes</strong> en total (promedio ${m.avgLot.toFixed(2)} por operación).`);
        parts.push(`El resultado neto fue <span class="${m.net >= 0 ? 'hl-green' : 'hl-red'}">${m.net >= 0 ? '+' : ''}${formatCurrency(m.net)}</span> (${m.netPct >= 0 ? '+' : ''}${m.netPct.toFixed(2)}% sobre ${formatCurrency(m.startBalance + m.deposits)}${m.deposits ? ' incl. depósitos' : ''}), con un win rate de <strong>${m.winRate.toFixed(1)}%</strong> y profit factor de <strong>${pfTxt}</strong>.`);
        parts.push(`El máximo drawdown fue de <span class="hl-red">${formatCurrency(m.maxDD)} (${m.maxDDPct.toFixed(2)}%)</span> desde el pico de balance; la racha más larga de pérdidas consecutivas fue de ${m.maxLossStreak}.`);

        let verdict;
        if (m.net > 0 && m.profitFactor >= 1.5 && m.maxDDPct < 10) verdict = '<span class="hl-green">Rendimiento sólido:</span> ganancias consistentes con el riesgo bajo control.';
        else if (m.net > 0 && m.maxDDPct >= 10) verdict = '<span class="hl-gold">Rentable, pero con drawdown elevado:</span> conviene revisar el lotaje o el stop para suavizar la curva.';
        else if (m.net > 0) verdict = '<span class="hl-green">Periodo positivo:</span> el margen es estrecho; mantener la disciplina en la gestión de riesgo.';
        else if (m.avgLoss !== 0 && Math.abs(m.avgLoss) > m.avgWin) verdict = '<span class="hl-red">Periodo negativo:</span> la pérdida promedio supera a la ganancia promedio; revisar la relación riesgo/beneficio.';
        else verdict = '<span class="hl-red">Periodo negativo:</span> revisar entradas y gestión antes de aumentar lotaje.';
        parts.push(verdict);
        return parts.join(' ') + flowTxt;
    }

    function renderAnalysis() {
        const acc = getCurrentAccount();
        if (!acc) return;
        const { start, end } = getTableRange();
        const ops = getTableOps();
        const m = computeMetrics(ops, balanceBefore(acc, start), getTableMovs());

        const set = (id, txt) => { const el = document.getElementById(id); if (el) el.innerHTML = txt; };
        set('analysis-scope', (start || end)
            ? `Rango: ${start ? fmtDate(start) : 'inicio'} → ${end ? fmtDate(end) : 'hoy'} · ${m.count} operaciones`
            : `Todas las operaciones de la cuenta · ${m.count} operaciones`);
        set('an-lots', m.lots.toFixed(2));
        set('an-lots-avg', `Promedio ${m.avgLot.toFixed(2)} / op`);

        const netEl = document.getElementById('an-net');
        netEl.textContent = (m.net >= 0 ? '+' : '') + formatCurrency(m.net);
        netEl.className = 'metric-value ' + (m.net >= 0 ? 'success' : 'danger');
        set('an-net-pct', `${m.netPct >= 0 ? '+' : ''}${m.netPct.toFixed(2)}% de la cuenta`);

        set('an-dd', '-' + formatCurrency(m.maxDD));
        set('an-dd-pct', `${m.maxDDPct.toFixed(2)}% desde el pico`);
        set('an-gross-win', '+' + formatCurrency(m.grossWin));
        set('an-gross-loss', formatCurrency(m.grossLoss));
        set('an-pf', m.profitFactor === Infinity ? '∞' : m.profitFactor.toFixed(2));
        set('an-wr', m.winRate.toFixed(1) + '%');
        set('an-wl', `${m.wins} G / ${m.losses} P`);
        set('an-best', (m.best >= 0 ? '+' : '') + formatCurrency(m.best));
        set('an-worst', formatCurrency(m.worst));
        set('an-avg', `Promedio G ${formatCurrency(m.avgWin)} · P ${formatCurrency(m.avgLoss)}`);
        set('an-wd', '-' + formatCurrency(m.withdrawals));
        set('an-wd-sub', `${m.wdCount} retiro(s)`);
        set('an-dep', '+' + formatCurrency(m.deposits));
        set('an-dep-sub', `${m.depCount} depósito(s)`);
        set('an-capital', formatCurrency(m.startBalance + m.netFlows));
        set('an-capital-sub', `Inicial ${formatCurrency(m.startBalance)} ${m.netFlows >= 0 ? '+' : '-'} ${formatCurrency(Math.abs(m.netFlows))} neto`);
        set('an-end', formatCurrency(m.endBalance));
        set('an-end-sub', `Capital + profit del periodo`);
        set('analysis-summary', buildSummaryText(m));
    }

    // =====================================================
    //  FILTRO DE PERIODO (DASHBOARD)
    // =====================================================
    let dashPeriod = 'all';
    let dashCustom = { start: null, end: null };
    const customRangeEl = document.getElementById('custom-range');

    function getPeriodRange() {
        const now = new Date();
        const today = toISO(now);
        switch (dashPeriod) {
            case 'today':
                return { start: today, end: today, label: 'Hoy' };
            case 'week': {
                const d = new Date(now);
                const day = (d.getDay() + 6) % 7; // lunes = 0
                d.setDate(d.getDate() - day);
                return { start: toISO(d), end: today, label: 'Esta semana' };
            }
            case 'month':
                return { start: `${now.getFullYear()}-${pad(now.getMonth() + 1)}-01`, end: today, label: 'Este mes' };
            case 'year':
                return { start: `${now.getFullYear()}-01-01`, end: today, label: 'Este año' };
            case 'custom':
                return {
                    start: dashCustom.start, end: dashCustom.end,
                    label: `${dashCustom.start ? fmtDate(dashCustom.start) : 'Inicio'} → ${dashCustom.end ? fmtDate(dashCustom.end) : 'Hoy'}`
                };
            default:
                return { start: null, end: null, label: 'Todo el historial' };
        }
    }

    document.querySelectorAll('.period-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.period-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            dashPeriod = btn.dataset.period;
            customRangeEl.classList.toggle('hidden', dashPeriod !== 'custom');
            calculateStats();
            updateChart();
        });
    });

    document.getElementById('btn-dash-range').addEventListener('click', () => {
        dashCustom.start = document.getElementById('dash-date-start').value || null;
        dashCustom.end = document.getElementById('dash-date-end').value || null;
        calculateStats();
        updateChart();
    });

    // --- Estadísticas del dashboard ---
    function calculateStats() {
        const acc = getCurrentAccount();
        if (!acc) return;

        const currentBalance = accBalance(acc);
        const allFlows = computeMetrics([], 0, getMovs(acc));

        const { start, end, label } = getPeriodRange();
        const ops = acc.operations.filter(op => inRange(op, start, end));
        const movs = getMovs(acc).filter(mv => inRange(mv, start, end));
        const m = computeMetrics(ops, balanceBefore(acc, start), movs);

        animateValue(totalBalanceEl, currentBalance, v => formatCurrency(v));
        initialBalanceDisplay.innerHTML = formatCurrency(acc.initialBalance) +
            ((allFlows.deposits || allFlows.withdrawals)
                ? `<br><span class="mov-deposit">+${formatCurrency(allFlows.deposits)}</span> · <span class="danger">-${formatCurrency(allFlows.withdrawals)}</span>`
                : '');
        const wdEl = document.getElementById('cap-withdrawals');
        const depEl = document.getElementById('cap-deposits');
        if (wdEl) wdEl.textContent = '-' + formatCurrency(m.withdrawals);
        if (depEl) depEl.textContent = `Depósitos +${formatCurrency(m.deposits)}`;
        winsCountEl.textContent = m.wins;
        lossesCountEl.textContent = m.losses;
        winrateEl.textContent = m.winRate.toFixed(1) + '%';
        opsCountEl.textContent = m.count;

        animateValue(netPnlEl, m.net, v => (v >= 0 ? '+' : '') + formatCurrency(v));
        netPnlEl.className = 'stat-value ' + (m.net >= 0 ? 'success' : 'danger');
        pnlPctEl.textContent = `${m.netPct >= 0 ? '+' : ''}${m.netPct.toFixed(2)}% sobre balance`;

        periodLabelEl.innerHTML = `Mostrando: <strong>${label}</strong> · ${m.count} operaciones · ${m.lots.toFixed(2)} lotes`;
        chartSubEl.textContent = label;
    }

    // =====================================================
    //  CHART
    // =====================================================
    let performanceChart = null;

    function initChart() {
        const canvas = document.getElementById('performanceChart');
        const ctx = canvas.getContext('2d');

        performanceChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: [],
                datasets: [{
                    label: 'Balance',
                    data: [],
                    borderColor: '#A8FF2E',
                    borderWidth: 2.5,
                    pointRadius: 0,
                    pointHoverRadius: 6,
                    pointHoverBackgroundColor: '#E6C46A',
                    pointHoverBorderColor: '#fff',
                    tension: 0.25,
                    fill: true,
                    backgroundColor: (c) => {
                        const { chart } = c;
                        const { ctx: cx, chartArea } = chart;
                        if (!chartArea) return 'rgba(168,255,46,0.08)';
                        const g = cx.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
                        g.addColorStop(0, 'rgba(168,255,46,0.28)');
                        g.addColorStop(0.6, 'rgba(168,255,46,0.05)');
                        g.addColorStop(1, 'rgba(168,255,46,0)');
                        return g;
                    },
                    segment: {
                        borderColor: s => {
                            const k = (s.chart.data.datasets[0].kinds || [])[s.p1DataIndex];
                            if (k === 'mov') return '#E6C46A';
                            return s.p1.parsed.y < s.p0.parsed.y ? '#FF4D5E' : '#A8FF2E';
                        },
                        borderDash: s => ((s.chart.data.datasets[0].kinds || [])[s.p1DataIndex] === 'mov' ? [5, 4] : undefined)
                    }
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                animation: { duration: 900, easing: 'easeOutQuart' },
                interaction: { intersect: false, mode: 'index' },
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        backgroundColor: 'rgba(10,12,11,0.95)',
                        borderColor: 'rgba(230,196,106,0.5)',
                        borderWidth: 1,
                        titleColor: '#E6C46A',
                        bodyColor: '#F4F6F8',
                        padding: 12,
                        displayColors: false,
                        callbacks: {
                            label: (i) => {
                                const note = (i.dataset.notes || [])[i.dataIndex];
                                return note ? [note, 'Balance: ' + formatCurrency(i.parsed.y)] : 'Balance: ' + formatCurrency(i.parsed.y);
                            }
                        }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: false,
                        grid: { color: 'rgba(217,222,229,0.05)' },
                        border: { display: false },
                        ticks: { color: '#9AA3AE', callback: v => '$' + v.toLocaleString() }
                    },
                    x: {
                        grid: { display: false },
                        ticks: { color: '#9AA3AE', maxRotation: 0, autoSkip: true, maxTicksLimit: 10 }
                    }
                }
            }
        });
    }

    function updateChart() {
        if (!performanceChart) return;
        const acc = getCurrentAccount();
        if (!acc) return;

        const { start, end } = getPeriodRange();
        const sortedOps = sortOps(acc.operations.filter(op => inRange(op, start, end)));
        const movs = getMovs(acc).filter(mv => inRange(mv, start, end));

        let running = balanceBefore(acc, start);
        const labels = [start ? 'Inicio periodo' : 'Inicio'];
        const data = [running];
        const kinds = ['start'];
        const notes = [null];
        buildTimeline(sortedOps, movs).forEach(item => {
            if (item.kind === 'mov') {
                const f = movSigned(item.ref);
                running += f;
                notes.push(`${f >= 0 ? 'Depósito +' : 'Retiro -'}${formatCurrency(Math.abs(f))}`);
            } else {
                running += item.ref.result;
                notes.push(null);
            }
            labels.push(item.ref.date);
            data.push(running);
            kinds.push(item.kind);
        });

        performanceChart.data.labels = labels;
        performanceChart.data.datasets[0].data = data;
        performanceChart.data.datasets[0].kinds = kinds;
        performanceChart.data.datasets[0].notes = notes;
        performanceChart.data.datasets[0].pointRadius = kinds.map(k => k === 'mov' ? 5 : 0);
        performanceChart.data.datasets[0].pointBackgroundColor = '#E6C46A';
        performanceChart.update();
    }

    // --- Reloj ---
    function startMarketClock() {
        const timeEl = document.getElementById('current-time');
        const marketNameEl = document.getElementById('market-name');
        const tick = () => {
            const now = new Date();
            timeEl.textContent = now.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
            const h = now.getUTCHours();
            const markets = [];
            if (h >= 22 || h < 7) markets.push("Sydney");
            if (h >= 0 && h < 9) markets.push("Tokio");
            if (h >= 8 && h < 17) markets.push("Londres");
            if (h >= 13 && h < 22) markets.push("Nueva York");
            if (markets.length > 0) {
                marketNameEl.textContent = "Mercado Abierto: " + markets.join(' / ');
                marketNameEl.style.color = "var(--neon)";
            } else {
                marketNameEl.textContent = "Mercados Cerrados";
                marketNameEl.style.color = "var(--text-secondary)";
            }
        };
        tick();
        setInterval(tick, 1000);
    }

    // =====================================================
    //  PRECIO DEL ORO (tarjeta de cristal)
    // =====================================================
    function startGoldTicker() {
        const priceEl = document.getElementById('gold-price');
        const changeEl = document.getElementById('gold-change');
        const liveEl = document.querySelector('.gold-live');
        const fallbackEl = document.getElementById('gold-fallback');
        let last = null;
        let fails = 0;
        let fallbackOn = false;

        const fmt = n => n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

        async function fetchGold() {
            try {
                const res = await fetch('https://api.gold-api.com/price/XAU', { cache: 'no-store' });
                if (!res.ok) throw new Error(res.status);
                const json = await res.json();
                const price = Number(json.price);
                if (!price) throw new Error('sin precio');
                fails = 0;
                liveEl.classList.remove('off');

                // Referencia diaria: primer precio visto en el día
                const key = 'fxk_gold_ref_' + toISO(new Date());
                let ref = null;
                try { ref = parseFloat(localStorage.getItem(key)); } catch (e) { }
                if (!ref) { ref = price; try { localStorage.setItem(key, price); } catch (e) { } }

                if (last !== null && price !== last) {
                    priceEl.classList.remove('tick-up', 'tick-down');
                    void priceEl.offsetWidth;
                    priceEl.classList.add(price > last ? 'tick-up' : 'tick-down');
                }
                last = price;
                priceEl.textContent = fmt(price);

                const diff = price - ref;
                const pct = (diff / ref) * 100;
                changeEl.textContent = `${diff >= 0 ? '▲ +' : '▼ '}${fmt(diff)} (${pct >= 0 ? '+' : ''}${pct.toFixed(2)}%)`;
                changeEl.className = 'gold-change ' + (diff > 0 ? 'up' : diff < 0 ? 'down' : '');
                changeEl.title = 'Variación desde la primera lectura del día';
            } catch (err) {
                fails++;
                liveEl.classList.add('off');
                if (fails >= 2 && !fallbackOn) enableFallback();
            }
        }

        // Si la API no responde, se muestra el widget de TradingView (transparente) dentro del cristal
        function enableFallback() {
            fallbackOn = true;
            document.querySelector('.gold-glass-body').style.display = 'none';
            fallbackEl.classList.remove('hidden');
            fallbackEl.innerHTML = '<div class="tradingview-widget-container"><div class="tradingview-widget-container__widget"></div></div>';
            const s = document.createElement('script');
            s.src = 'https://s3.tradingview.com/external-embedding/embed-widget-single-quote.js';
            s.async = true;
            s.innerHTML = JSON.stringify({ symbol: 'OANDA:XAUUSD', width: '100%', colorTheme: 'dark', isTransparent: true, locale: 'es' });
            fallbackEl.querySelector('.tradingview-widget-container').appendChild(s);
        }

        fetchGold();
        setInterval(fetchGold, 30000);
    }

    // =====================================================
    //  CURSOR DE VELAS (verde al subir, roja al bajar)
    // =====================================================
    function initCandleCursor() {
        const canvas = document.getElementById('candle-cursor');
        const ctx = canvas.getContext('2d');
        if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

        let dpr = window.devicePixelRatio || 1;
        function resize() {
            dpr = window.devicePixelRatio || 1;
            canvas.width = innerWidth * dpr;
            canvas.height = innerHeight * dpr;
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        }
        resize();
        addEventListener('resize', resize);

        const candles = [];
        let lastX = null, lastY = null, accDist = 0;
        const STEP = 16; // px recorridos por vela

        addEventListener('mousemove', (e) => {
            if (lastX === null) { lastX = e.clientX; lastY = e.clientY; return; }
            const dx = e.clientX - lastX;
            const dy = e.clientY - lastY;
            accDist += Math.hypot(dx, dy);
            if (accDist >= STEP) {
                accDist = 0;
                // dy < 0 → el mouse sube → vela verde
                const bull = dy <= 0;
                const move = Math.min(Math.abs(dy), 40);
                const body = 8 + move * 0.5 + Math.random() * 6;
                candles.push({
                    x: e.clientX,
                    y: e.clientY,
                    bull,
                    body,
                    wickTop: 3 + Math.random() * 8,
                    wickBot: 3 + Math.random() * 8,
                    w: 6,
                    life: 1,
                    vy: bull ? -0.35 : 0.35
                });
                if (candles.length > 40) candles.shift();
            }
            lastX = e.clientX;
            lastY = e.clientY;
        }, { passive: true });

        function draw() {
            ctx.clearRect(0, 0, innerWidth, innerHeight);
            for (let i = candles.length - 1; i >= 0; i--) {
                const c = candles[i];
                c.life -= 0.022;
                c.y += c.vy;
                if (c.life <= 0) { candles.splice(i, 1); continue; }

                const color = c.bull ? '168,255,46' : '255,77,94';
                const a = Math.max(c.life, 0);
                const scale = 0.6 + 0.4 * a;
                const w = c.w * scale;
                const h = c.body * scale;
                const top = c.y - h / 2;

                ctx.save();
                ctx.shadowColor = `rgba(${color},${0.8 * a})`;
                ctx.shadowBlur = 10;
                // mecha
                ctx.strokeStyle = `rgba(${color},${a})`;
                ctx.lineWidth = 1.4;
                ctx.beginPath();
                ctx.moveTo(c.x, top - c.wickTop * scale);
                ctx.lineTo(c.x, top + h + c.wickBot * scale);
                ctx.stroke();
                // cuerpo
                ctx.fillStyle = `rgba(${color},${a})`;
                ctx.fillRect(c.x - w / 2, top, w, h);
                ctx.restore();
            }
            requestAnimationFrame(draw);
        }
        draw();
    }

    // Brillo que sigue al mouse dentro de las tarjetas
    function initCardGlow() {
        document.addEventListener('mousemove', (e) => {
            const card = e.target.closest('.stat-card');
            if (!card) return;
            const r = card.getBoundingClientRect();
            card.style.setProperty('--mx', `${e.clientX - r.left}px`);
            card.style.setProperty('--my', `${e.clientY - r.top}px`);
        }, { passive: true });
    }

    // =====================================================
    //  EXPORTAR PDF (con análisis al final)
    // =====================================================
    document.getElementById('btn-export-pdf').addEventListener('click', () => {
        const acc = getCurrentAccount();
        if (!acc) return;

        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();
        const pageW = doc.internal.pageSize.getWidth();
        const pageH = doc.internal.pageSize.getHeight();
        const { start, end } = getTableRange();
        const ops = sortOps(getTableOps());
        const pdfMovs = [...getTableMovs()].sort((a, b) => opKey(a) < opKey(b) ? -1 : 1);
        const m = computeMetrics(ops, balanceBefore(acc, start), pdfMovs);

        // Encabezado
        doc.setFillColor(8, 10, 9);
        doc.rect(0, 0, pageW, 40, 'F');
        doc.setFillColor(168, 255, 46);
        doc.rect(0, 40, pageW, 1.2, 'F');
        if (window.FXK_LOGO) {
            try { doc.addImage(window.FXK_LOGO, 'PNG', 14, 9, 82, 19); } catch (e) { }
        }
        doc.setFontSize(10);
        doc.setTextColor(217, 222, 229);
        doc.text('REPORTE DE TRADING', pageW - 14, 15, { align: 'right' });
        doc.setTextColor(230, 196, 106);
        doc.text(`Cuenta: ${acc.name}`, pageW - 14, 22, { align: 'right' });
        doc.setTextColor(154, 163, 174);
        doc.text(`Trader: ${appData.userProfile.name}`, pageW - 14, 28, { align: 'right' });
        const rangeTxt = (start || end) ? `${start ? fmtDate(start) : 'Inicio'} - ${end ? fmtDate(end) : 'Hoy'}` : 'Todo el historial';
        doc.text(`Periodo: ${rangeTxt}  ·  Emitido: ${new Date().toLocaleDateString('es-MX')}`, pageW - 14, 34, { align: 'right' });

        const headers = [['Fecha', 'Hora', 'Activo', 'Tipo', 'Precio', 'Lotes', 'Resultado']];
        const data = ops.map(op => [
            op.date, op.time || '', op.asset || '-', op.type.toUpperCase(),
            String(op.entryPrice), String(op.lotSize),
            (op.result >= 0 ? '+' : '') + formatCurrency(op.result)
        ]);

        doc.autoTable({
            head: headers,
            body: data,
            startY: 48,
            theme: 'grid',
            styles: { fontSize: 8.5, cellPadding: 2.4, lineColor: [225, 228, 232] },
            headStyles: { fillColor: [12, 15, 13], textColor: [168, 255, 46], fontStyle: 'bold' },
            alternateRowStyles: { fillColor: [245, 247, 245] },
            didParseCell: (d) => {
                if (d.section === 'body' && d.column.index === 6) {
                    d.cell.styles.textColor = d.cell.raw.startsWith('+') ? [46, 140, 20] : [210, 40, 55];
                    d.cell.styles.fontStyle = 'bold';
                }
            }
        });

        // ---- Movimientos de capital ----
        let y = doc.lastAutoTable.finalY + 12;
        if (pdfMovs.length) {
            if (y > pageH - 50) { doc.addPage(); y = 20; }
            doc.setFillColor(230, 196, 106);
            doc.rect(14, y - 5, 3, 8, 'F');
            doc.setFontSize(14);
            doc.setTextColor(12, 15, 13);
            doc.text('Retiros y Depósitos de Capital', 20, y + 1);
            doc.autoTable({
                startY: y + 6,
                theme: 'grid',
                head: [['Fecha', 'Hora', 'Tipo', 'Monto', 'Nota']],
                body: pdfMovs.map(mv => [mv.date, mv.time || '', mv.type === 'deposit' ? 'DEPÓSITO' : 'RETIRO',
                    (mv.type === 'deposit' ? '+' : '-') + formatCurrency(mv.amount), mv.note || '']),
                styles: { fontSize: 8.5, cellPadding: 2.4, lineColor: [225, 228, 232] },
                headStyles: { fillColor: [12, 15, 13], textColor: [230, 196, 106], fontStyle: 'bold' },
                columnStyles: { 4: { cellWidth: 70 } },
                didParseCell: (d) => {
                    if (d.section === 'body' && d.column.index === 3) {
                        d.cell.styles.textColor = d.cell.raw.startsWith('+') ? [170, 130, 30] : [210, 40, 55];
                        d.cell.styles.fontStyle = 'bold';
                    }
                }
            });
            y = doc.lastAutoTable.finalY + 12;
        }

        // ---- Análisis al final ----
        if (y > pageH - 95) { doc.addPage(); y = 20; }

        doc.setFillColor(168, 255, 46);
        doc.rect(14, y - 5, 3, 8, 'F');
        doc.setFontSize(14);
        doc.setTextColor(12, 15, 13);
        doc.text('Análisis de Rendimiento', 20, y + 1);
        y += 8;

        const pfTxt = m.profitFactor === Infinity ? '—' : m.profitFactor.toFixed(2);
        doc.autoTable({
            startY: y,
            theme: 'plain',
            styles: { fontSize: 10, cellPadding: 3 },
            columnStyles: { 0: { textColor: [100, 108, 118] }, 1: { fontStyle: 'bold' }, 2: { textColor: [100, 108, 118] }, 3: { fontStyle: 'bold' } },
            body: [
                ['Lotes movidos', m.lots.toFixed(2), 'Operaciones', String(m.count)],
                ['Profit total (neto)', (m.net >= 0 ? '+' : '') + formatCurrency(m.net) + ` (${m.netPct.toFixed(2)}%)`, 'Win rate', m.winRate.toFixed(1) + '%'],
                ['Máximo drawdown', '-' + formatCurrency(m.maxDD) + ` (${m.maxDDPct.toFixed(2)}%)`, 'Profit factor', pfTxt],
                ['Ganancia bruta', '+' + formatCurrency(m.grossWin), 'Pérdida bruta', formatCurrency(m.grossLoss)],
                ['Mejor operación', '+' + formatCurrency(m.best), 'Peor operación', formatCurrency(m.worst)],
                ['Retiros', '-' + formatCurrency(m.withdrawals) + ` (${m.wdCount})`, 'Capital agregado', '+' + formatCurrency(m.deposits) + ` (${m.depCount})`],
                ['Balance inicial periodo', formatCurrency(m.startBalance), 'Balance final', formatCurrency(m.endBalance)]
            ],
            didParseCell: (d) => {
                if (d.row.index === 1 && d.column.index === 1) d.cell.styles.textColor = m.net >= 0 ? [46, 140, 20] : [210, 40, 55];
                if (d.row.index === 2 && d.column.index === 1) d.cell.styles.textColor = [210, 40, 55];
                if (d.row.index === 5 && d.column.index === 1 && m.withdrawals) d.cell.styles.textColor = [210, 40, 55];
                if (d.row.index === 5 && d.column.index === 3 && m.deposits) d.cell.styles.textColor = [170, 130, 30];
            },
            alternateRowStyles: { fillColor: [246, 248, 246] }
        });

        y = doc.lastAutoTable.finalY + 8;
        const plain = buildSummaryText(m).replace(/<[^>]+>/g, '').replace(/∞/g, '—');
        const lines = doc.splitTextToSize(plain, pageW - 34);
        const boxH = lines.length * 5 + 8;
        if (y + boxH > pageH - 12) { doc.addPage(); y = 20; }
        doc.setFillColor(252, 248, 234);
        doc.rect(14, y, pageW - 28, boxH, 'F');
        doc.setFillColor(230, 196, 106);
        doc.rect(14, y, 1.5, boxH, 'F');
        doc.setFontSize(9.5);
        doc.setTextColor(40, 44, 48);
        doc.text(lines, 19, y + 6);

        // Pie
        const pages = doc.internal.getNumberOfPages();
        for (let i = 1; i <= pages; i++) {
            doc.setPage(i);
            doc.setFontSize(8);
            doc.setTextColor(150, 156, 164);
            doc.text(`FX KINGS · Trading Journal   |   Página ${i} de ${pages}`, pageW / 2, pageH - 6, { align: 'center' });
        }

        doc.save(`${acc.name}_Reporte.pdf`);
        showToast('Reporte PDF generado');
    });

    // --- Utils ---
    function formatCurrency(num) {
        const n = parseFloat(num) || 0;
        const sign = n < 0 ? '-' : '';
        return sign + '$' + Math.abs(n).toFixed(2).replace(/\d(?=(\d{3})+\.)/g, '$&,');
    }

    function fmtDate(iso) {
        const [y, mo, d] = iso.split('-');
        return `${d}/${mo}/${y}`;
    }

    function escapeHtml(s) {
        return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    }

    function animateValue(el, target, format) {
        const from = parseFloat(el.dataset.v || 0);
        el.dataset.v = target;
        const t0 = performance.now();
        const dur = 700;
        const step = (t) => {
            const p = Math.min((t - t0) / dur, 1);
            const e = 1 - Math.pow(1 - p, 3);
            el.textContent = format(from + (target - from) * e);
            if (p < 1) requestAnimationFrame(step);
        };
        requestAnimationFrame(step);
    }

    let toastTimer = null;
    function showToast(msg) {
        const t = document.getElementById('toast');
        t.innerHTML = `<i class="fas fa-circle-check" style="color:var(--neon);margin-right:8px"></i>${msg}`;
        t.classList.add('show');
        clearTimeout(toastTimer);
        toastTimer = setTimeout(() => t.classList.remove('show'), 2200);
    }

    function saveData() {
        try {
            localStorage.setItem('fxkings_data', JSON.stringify(appData));
        } catch (e) {
            if (!window.FXKCloud?.configured) alert('No se pudo guardar: el almacenamiento del navegador está lleno.');
        }
        // Guardado automático en la nube (si está configurada y hay sesión)
        if (window.FXKCloud?.configured) window.FXKCloud.save(appData);
    }

    // --- PDF Import ---
    const importPdfModal = document.getElementById('import-pdf-modal');
    const btnImportPdf = document.getElementById('btn-import-pdf');
    const btnCloseImportModal = document.getElementById('close-import-modal');
    const pdfFileInput = document.getElementById('pdf-file-input');
    const btnSelectPdf = document.getElementById('btn-select-pdf');
    const pdfDropZone = document.getElementById('pdf-drop-zone');

    if (typeof pdfjsLib !== 'undefined') {
        pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
    }

    btnImportPdf.addEventListener('click', () => importPdfModal.classList.remove('hidden'));
    btnCloseImportModal.addEventListener('click', () => importPdfModal.classList.add('hidden'));
    btnSelectPdf.addEventListener('click', (e) => { e.stopPropagation(); pdfFileInput.click(); });

    pdfDropZone.addEventListener('click', () => pdfFileInput.click());
    pdfDropZone.addEventListener('dragover', (e) => { e.preventDefault(); pdfDropZone.classList.add('drag-over'); });
    pdfDropZone.addEventListener('dragleave', () => pdfDropZone.classList.remove('drag-over'));
    pdfDropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        pdfDropZone.classList.remove('drag-over');
        if (e.dataTransfer.files.length > 0) processPDF(e.dataTransfer.files[0]);
    });

    pdfFileInput.addEventListener('change', (e) => {
        if (e.target.files.length > 0) processPDF(e.target.files[0]);
    });

    async function processPDF(file) {
        try {
            const arrayBuffer = await file.arrayBuffer();
            const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
            let fullText = '';
            for (let i = 1; i <= pdf.numPages; i++) {
                const page = await pdf.getPage(i);
                const textContent = await page.getTextContent();
                fullText += textContent.items.map(item => item.str).join(' ') + '\n';
            }

            const initialBalanceMatch = fullText.match(/Balance\s*inicial\s*periodo\s*\$?([\d,.]+)/i) ||
                fullText.match(/Inicial:\s*\$?([\d,.]+)/i) ||
                fullText.match(/Balance\s*Inicial:\s*\$?([\d,.]+)/i);

            const ops = parseOperationsFromText(fullText);

            if (ops.length > 0) {
                const acc = getCurrentAccount();
                if (acc) {
                    if (initialBalanceMatch) acc.initialBalance = parseFloat(initialBalanceMatch[1].replace(/,/g, ''));
                    if (ops.length > 10 && confirm(`Se detectaron ${ops.length} operaciones. ¿Deseas REEMPLAZAR los datos actuales con este reporte?`)) {
                        acc.operations = ops;
                    } else {
                        acc.operations = [...ops, ...acc.operations];
                    }
                    saveData();
                    refreshAllViews();
                    showToast(`Se cargaron ${ops.length} operaciones`);
                    importPdfModal.classList.add('hidden');
                    pdfFileInput.value = '';
                }
            } else {
                alert('⚠️ No se detectaron operaciones válidas en este reporte. Verifica el formato.');
            }
        } catch (error) {
            console.error('PDF Import error:', error);
            alert('❌ Hubo un error al procesar el PDF.');
        }
    }

    function parseOperationsFromText(text) {
        const operations = [];
        // Acepta ambos formatos de reporte:
        //  v2: Fecha Hora Activo Tipo Precio Lotes ZonaS ZonaI $Resultado
        //  v3: Fecha Hora Activo Tipo Precio Lotes +$Resultado / -$Resultado
        const regex = /(\d{4}-\d{2}-\d{2})\s*(?:(\d{2}:\d{2})\s+)?([A-Z0-9]{3,8})\s+(BUY|SELL)\s+([\d.]+)\s+([\d.]+)\s+(?:([\d.]+)\s+([\d.]+)\s+)?([+\-]?)\s*\$?\s*([+\-]?[\d,]+(?:\.\d+)?)/gi;
        let match;
        const seen = new Set();
        let seq = 0;
        while ((match = regex.exec(text)) !== null) {
            const op = {
                id: Date.now() + Math.random(),
                seq: seq++,
                date: match[1],
                time: match[2] || "00:00",
                asset: match[3].toUpperCase(),
                type: match[4].toLowerCase(),
                entryPrice: parseFloat(match[5]),
                lotSize: parseFloat(match[6]),
                zoneTop: parseFloat(match[7]) || 0,
                zoneBottom: parseFloat(match[8]) || 0,
                result: (match[9] === '-' ? -1 : 1) * parseFloat(match[10].replace(/,/g, ''))
            };
            const sig = `${op.date}|${op.time}|${op.asset}|${op.type}|${op.entryPrice}|${op.result}`;
            if (!seen.has(sig)) { operations.push(op); seen.add(sig); }
        }
        return operations;
    }

    // =====================================================
    //  ARRANQUE: modo local o modo nube
    // =====================================================
    let started = false;
    function startOrRefresh() {
        if (!started) { started = true; init(); }
        else { updateGlobalProfileUI(); refreshAllViews(); }
    }

    // Indicador de guardado
    const syncBadge = document.getElementById('sync-badge');
    const SYNC = {
        local: ['fa-hard-drive', 'Modo local', 'Los datos se guardan solo en este navegador'],
        connecting: ['fa-cloud', 'Conectando…', 'Conectando con la nube'],
        saving: ['fa-rotate', 'Guardando…', 'Guardando en la nube'],
        synced: ['fa-cloud', 'Guardado en la nube', 'Todo está guardado y sincronizado'],
        offline: ['fa-wifi', 'Sin internet', 'Se guardará en la nube al volver la conexión'],
        error: ['fa-triangle-exclamation', 'Error al guardar', 'Revisa la conexión o la configuración de Firebase']
    };
    function paintSync(st) {
        const [icon, txt, tip] = SYNC[st] || SYNC.local;
        syncBadge.className = 'sync-badge ' + st;
        syncBadge.innerHTML = `<i class="fas ${icon}"></i> <span>${txt}</span>`;
        syncBadge.title = tip;
    }

    const Cloud = window.FXKCloud;
    if (Cloud) Cloud.onStatus(paintSync); else paintSync('local');

    if (!Cloud || !Cloud.configured) {
        init();
        started = true;
    } else {
        const authScreen = document.getElementById('auth-screen');
        const loadingScreen = document.getElementById('loading-screen');
        const authForm = document.getElementById('auth-form');
        const authEmail = document.getElementById('auth-email');
        const authPass = document.getElementById('auth-pass');
        const authMsg = document.getElementById('auth-msg');
        const sidebarAccount = document.getElementById('sidebar-account');
        const setMsg = (t, ok) => { authMsg.textContent = t || ''; authMsg.className = 'auth-msg' + (ok ? ' ok' : ''); };
        const busy = (on) => authForm.querySelectorAll('button').forEach(b => b.disabled = on);

        loadingScreen.classList.remove('hidden');

        authForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            setMsg(''); busy(true);
            try { await Cloud.signIn(authEmail.value.trim(), authPass.value); }
            catch (err) { setMsg(err.message); }
            finally { busy(false); }
        });
        document.getElementById('btn-auth-signup').addEventListener('click', async () => {
            if (!authForm.reportValidity()) return;
            setMsg(''); busy(true);
            try { await Cloud.signUp(authEmail.value.trim(), authPass.value); }
            catch (err) { setMsg(err.message); }
            finally { busy(false); }
        });
        document.getElementById('btn-auth-reset').addEventListener('click', async () => {
            if (!authEmail.value.trim()) { setMsg('Escribe tu correo arriba y vuelve a dar clic.'); return; }
            try { await Cloud.reset(authEmail.value.trim()); setMsg('Te enviamos un correo para cambiar tu contraseña.', true); }
            catch (err) { setMsg(err.message); }
        });
        document.getElementById('btn-logout').addEventListener('click', async () => {
            if (!confirm('¿Cerrar sesión en este dispositivo?')) return;
            await Cloud.signOut();
        });

        Cloud.onAuth(async (user) => {
            if (!user) {
                loadingScreen.classList.add('hidden');
                authScreen.classList.remove('hidden');
                sidebarAccount.classList.add('hidden');
                return;
            }
            authScreen.classList.add('hidden');
            loadingScreen.classList.remove('hidden');
            document.getElementById('sidebar-email').textContent = user.email;
            sidebarAccount.classList.remove('hidden');

            try {
                const remote = await Cloud.load();
                if (remote) {
                    appData = normalizeData(remote);
                    if (applySeed()) Cloud.save(appData);
                } else {
                    // Primera vez con este usuario: sube lo que hay en este navegador
                    // (solo si no pertenece a otro usuario; si no, empieza limpio con ANDRU precargada)
                    if (appData.ownerUid && appData.ownerUid !== user.uid) {
                        appData = normalizeData(null);
                        applySeed();
                    }
                    Cloud.save(appData);
                    showToast('Tu bitácora se subió a la nube');
                }
                appData.ownerUid = user.uid;
                try { localStorage.setItem('fxkings_data', JSON.stringify(appData)); } catch (e) { }
            } catch (err) {
                alert('No se pudo cargar desde la nube: ' + err.message + '\nSe mostrarán los datos guardados en este navegador.');
            }

            loadingScreen.classList.add('hidden');
            startOrRefresh();

            // Cambios desde otro dispositivo, en tiempo real
            Cloud.subscribe((data) => {
                appData = normalizeData(data);
                appData.ownerUid = user.uid;
                try { localStorage.setItem('fxkings_data', JSON.stringify(appData)); } catch (e) { }
                updateGlobalProfileUI();
                refreshAllViews();
                showToast('Datos actualizados desde otro dispositivo');
            });
        });
    }
});
