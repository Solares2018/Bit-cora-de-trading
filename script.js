document.addEventListener('DOMContentLoaded', () => {
    // --- constants ---
    const ASSETS = [
        "XAUUSD", "EURUSD", "GBPUSD", "USDJPY", "USDCAD", "AUDUSD", "NZDUSD",
        "USDCHF", "BTCUSD", "ETHUSD", "US30", "NAS100", "SPX500", "GER30", "OIL"
    ];

    // --- State Management ---
    let appData = {
        userProfile: {
            name: "Trader",
            image: "assets/default-avatar.png"
        },
        currentAccountId: null,
        accounts: []
    };

    // Load Data & Migration
    const savedData = localStorage.getItem('fxkings_data');
    if (savedData) {
        const parsed = JSON.parse(savedData);
        // Migration Check: If old structure (no accounts array)
        if (!parsed.accounts) {
            console.log("Migrating data to multi-account structure...");
            const defaultAccount = {
                id: Date.now(),
                name: parsed.profile?.name || "Cuenta Principal",
                initialBalance: parsed.profile?.initialBalance || 1000,
                operations: parsed.operations || []
            };
            appData.userProfile.name = parsed.profile?.name || "Trader";
            appData.userProfile.image = parsed.profile?.image || "assets/default-avatar.png";
            appData.accounts = [defaultAccount];
            appData.currentAccountId = defaultAccount.id;
        } else {
            appData = parsed;
        }
    } else {
        // Init default data if completely new
        const defaultId = Date.now();
        appData.accounts = [{
            id: defaultId,
            name: "Cuenta Principal",
            initialBalance: 1000,
            operations: []
        }];
        appData.currentAccountId = defaultId;
    }

    // Ensure one account is selected
    if (!appData.currentAccountId && appData.accounts.length > 0) {
        appData.currentAccountId = appData.accounts[0].id;
    }

    // Helper: Get Current Account
    function getCurrentAccount() {
        return appData.accounts.find(a => a.id === appData.currentAccountId) || appData.accounts[0];
    }

    // --- DOM Elements ---
    // Header
    const activeAccountNameEl = document.getElementById('active-account-name');
    const headerUserName = document.getElementById('header-user-name');
    const headerProfilePic = document.getElementById('header-profile-pic');

    // Dashboard
    const totalBalanceEl = document.getElementById('total-balance');
    const initialBalanceDisplay = document.getElementById('initial-balance-display');
    const winsCountEl = document.getElementById('wins-count');
    const lossesCountEl = document.getElementById('losses-count');
    const netPnlEl = document.getElementById('net-pnl');
    const zonesCountEl = document.getElementById('zones-count'); // New element

    // Operations
    const operationsTableBody = document.querySelector('#operations-table tbody');
    const operationForm = document.getElementById('operation-form');
    const opAssetSelect = document.getElementById('op-asset');

    // Accounts
    const accountsListEl = document.getElementById('accounts-list');
    const btnNewAccount = document.getElementById('btn-new-account');
    const accountModal = document.getElementById('account-modal');
    // const newAccountForm = document.getElementById('new-account-form'); // Removed in favor of account-form
    const closeAccountModal = document.getElementById('close-account-modal');

    // Profile
    const profileForm = document.getElementById('profile-form');
    const profileNameInput = document.getElementById('profile-name');
    const profileInitialBalanceInput = document.getElementById('profile-initial-balance');
    const profilePreviewImg = document.getElementById('profile-preview-img');
    const profilePicInput = document.getElementById('profile-pic-input');

    // Navigation
    const navBtns = document.querySelectorAll('.nav-btn');
    const sections = document.querySelectorAll('.view-section');

    // --- Initialization ---
    function init() {
        populateAssetSelect();
        updateGlobalProfileUI();
        initChart(); // Chart must be ready before refreshing views
        refreshAllViews();
        startMarketClock();
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

    // --- Navigation Logic ---
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
            let totalPnl = 0;
            acc.operations.forEach(op => totalPnl += op.result);
            const currentBal = acc.initialBalance + totalPnl;
            const isActive = acc.id === appData.currentAccountId;

            const card = document.createElement('div');
            card.className = `account-card ${isActive ? 'active' : ''}`;
            card.onclick = (e) => {
                // Prevent switch if clicking action buttons
                if (e.target.closest('.account-actions')) return;
                switchAccount(acc.id);
            };

            const actions = `
                <div class="account-actions">
                    <button class="btn-card-action btn-edit-account" data-id="${acc.id}" title="Editar">
                        <i class="fas fa-edit"></i>
                    </button>
                    ${appData.accounts.length > 1 ? `
                    <button class="btn-card-action btn-delete-account" data-id="${acc.id}" title="Borrar">
                        <i class="fas fa-trash"></i>
                    </button>` : ''}
                </div>
            `;

            card.innerHTML = `
                <div>
                    <div class="account-name">${acc.name}</div>
                    <div class="account-balance-display">${formatCurrency(currentBal)}</div>
                    <div class="account-details">
                        <span>Inicial: ${formatCurrency(acc.initialBalance)}</span>
                        <span>Ops: ${acc.operations.length}</span>
                    </div>
                </div>
                ${actions}
            `;
            accountsListEl.appendChild(card);
        });

        // Delete handlers
        document.querySelectorAll('.btn-delete-account').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const id = Number(btn.getAttribute('data-id'));
                if (confirm('¿Estás seguro de borrar esta cuenta y todos sus datos?')) {
                    deleteAccount(id);
                }
            });
        });

        // Edit handlers
        document.querySelectorAll('.btn-edit-account').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const id = Number(btn.getAttribute('data-id'));
                openAccountModal(id);
            });
        });
    }

    function switchAccount(id) {
        appData.currentAccountId = id;
        saveData();
        refreshAllViews();
        // Visual feedback
        renderAccountsList();
    }

    function createAccount(name, balance) {
        const newAcc = {
            id: Date.now(),
            name: name,
            initialBalance: parseFloat(balance),
            operations: []
        };
        appData.accounts.push(newAcc);
        appData.currentAccountId = newAcc.id; // Switch to new account
        saveData();
        refreshAllViews();
        accountModal.classList.add('hidden');
        accountForm.reset();
        // Go to dashboard
        document.querySelector('[data-target="dashboard"]').click();
    }

    function deleteAccount(id) {
        appData.accounts = appData.accounts.filter(a => a.id !== id);
        // If we deleted the active account, switch to another
        if (appData.currentAccountId === id) {
            appData.currentAccountId = appData.accounts.length > 0 ? appData.accounts[0].id : null;
        }

        if (appData.accounts.length === 0) {
            // Force create a default one if all deleted
            createAccount("Nueva Cuenta", 1000);
            return;
        }

        saveData();
        refreshAllViews();
    }

    // Account Modal Logic
    const accountForm = document.getElementById('account-form');
    // Elements updated to match new HTML IDs
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
    closeAccountModal.addEventListener('click', () => accountModal.classList.add('hidden'));

    accountForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const name = nameInput.value;
        const bal = parseFloat(balInput.value);
        const editId = editIdInput.value ? Number(editIdInput.value) : null;

        if (editId) {
            updateAccount(editId, name, bal);
        } else {
            createAccount(name, bal);
        }
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

    // --- Profile Logic ---
    function updateGlobalProfileUI() {
        headerUserName.textContent = appData.userProfile.name;
        headerProfilePic.src = appData.userProfile.image;
        profilePreviewImg.src = appData.userProfile.image; // Also update in form
    }

    function updateProfileFormValues() {
        const currentAcc = getCurrentAccount();
        if (!currentAcc) return;

        profileNameInput.value = currentAcc.name;
        profileInitialBalanceInput.value = currentAcc.initialBalance;
    }

    // Profile Picture
    profilePicInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = function (event) {
                appData.userProfile.image = event.target.result;
                updateGlobalProfileUI();
                saveData();
            };
            reader.readAsDataURL(file);
        }
    });

    profileForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const currentAcc = getCurrentAccount();
        if (currentAcc) {
            currentAcc.name = profileNameInput.value;
            currentAcc.initialBalance = parseFloat(profileInitialBalanceInput.value);
            saveData();
            refreshAllViews();
            alert('Datos actualizados');
        }
    });

    function updateCustomHeader() {
        const currentAcc = getCurrentAccount();
        if (currentAcc) {
            activeAccountNameEl.textContent = currentAcc.name;
        } else {
            activeAccountNameEl.textContent = "Sin Cuenta";
        }
        headerUserName.textContent = appData.userProfile.name || "Trader";
    }

    // --- Operations Logic ---
    const opModal = document.getElementById('operation-modal');
    const btnAddOp = document.getElementById('btn-add-operation');
    const btnCloseOpModal = document.querySelector('#operation-modal .close-modal');

    btnAddOp.addEventListener('click', () => openOperationModal());

    btnCloseOpModal.addEventListener('click', () => opModal.classList.add('hidden'));

    function openOperationModal(opId = null) {
        if (opId) {
            const currentAcc = getCurrentAccount();
            const op = currentAcc.operations.find(o => o.id === opId);
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
            document.getElementById('op-date').valueAsDate = now;
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
            // Edit existing
            const index = currentAcc.operations.findIndex(o => o.id === Number(opId));
            if (index !== -1) {
                currentAcc.operations[index] = { ...currentAcc.operations[index], ...opData };
            }
        } else {
            // Create new
            currentAcc.operations.unshift({
                id: Date.now(),
                ...opData
            });
        }

        saveData();
        refreshAllViews();
        opModal.classList.add('hidden');
    });

    // --- Table Rendering ---
    function renderOperationsTable() {
        operationsTableBody.innerHTML = '';
        const currentAcc = getCurrentAccount();
        if (!currentAcc) return;

        const filterStart = document.getElementById('filter-date-start').value;
        const filterEnd = document.getElementById('filter-date-end').value;

        const filteredOps = currentAcc.operations.filter(op => {
            if (!filterStart && !filterEnd) return true;
            const opDate = new Date(op.date);
            const start = filterStart ? new Date(filterStart) : new Date('1970-01-01');
            const end = filterEnd ? new Date(filterEnd) : new Date('2099-12-31');
            return opDate >= start && opDate <= end;
        });

        filteredOps.forEach(op => {
            const row = document.createElement('tr');
            const profitClass = op.result >= 0 ? 'profit-positive' : 'profit-negative';
            const icon = op.type === 'buy' ? '<i class="fas fa-arrow-up success"></i>' : '<i class="fas fa-arrow-down danger"></i>';
            const assetName = op.asset || 'N/A';

            row.innerHTML = `
                <td><input type="checkbox" class="op-select" data-id="${op.id}"></td>
                <td>${op.date} <span style="font-size:0.8em; color:#888">${op.time}</span></td>
                <td><span style="color:var(--primary-gold); font-weight:bold">${assetName}</span></td>
                <td>${icon} ${op.type.toUpperCase()}</td>
                <td>${op.entryPrice}</td>
                <td>${op.lotSize}</td>
                <td>${op.zoneTop || '-'}</td>
                <td>${op.zoneBottom || '-'}</td>
                <td class="${profitClass}">$${op.result.toFixed(2)}</td>
                <td>
                    <button class="btn-icon btn-edit-one" data-id="${op.id}" style="color:var(--primary-gold); background:none; border:none; cursor:pointer;" title="Editar">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="btn-icon btn-delete-one" data-id="${op.id}" style="color:#e74c3c; background:none; border:none; cursor:pointer;" title="Borrar">
                        <i class="fas fa-trash"></i>
                    </button>
                </td>
            `;
            operationsTableBody.appendChild(row);
        });

        // Re-attach listeners
        document.querySelectorAll('.btn-edit-one').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const id = Number(e.currentTarget.getAttribute('data-id'));
                openOperationModal(id);
            });
        });

        document.querySelectorAll('.btn-delete-one').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const id = Number(e.currentTarget.getAttribute('data-id'));
                if (confirm('¿Borrar esta operación?')) {
                    deleteOperation(id);
                }
            });
        });

        document.querySelectorAll('.op-select').forEach(cb => {
            cb.addEventListener('change', updateDeleteButtonState);
        });
    }

    // Filter Apply
    document.getElementById('btn-apply-filter').addEventListener('click', renderOperationsTable);

    function deleteOperation(opId) {
        const currentAcc = getCurrentAccount();
        if (!currentAcc) return;
        currentAcc.operations = currentAcc.operations.filter(op => op.id !== opId);
        saveData();
        refreshAllViews();
    }

    const selectAllCb = document.getElementById('select-all');
    const deleteSelectedBtn = document.getElementById('btn-delete-selected');

    if (selectAllCb) {
        selectAllCb.addEventListener('change', (e) => {
            const checkboxes = document.querySelectorAll('.op-select');
            checkboxes.forEach(cb => cb.checked = e.target.checked);
            updateDeleteButtonState();
        });
    }

    if (deleteSelectedBtn) {
        deleteSelectedBtn.addEventListener('click', () => {
            const currentAcc = getCurrentAccount();
            if (!currentAcc) return;
            const checked = document.querySelectorAll('.op-select:checked');
            if (checked.length === 0) return;

            if (confirm(`¿Borrar ${checked.length} operaciones seleccionadas?`)) {
                const idsToDelete = Array.from(checked).map(cb => Number(cb.getAttribute('data-id')));
                currentAcc.operations = currentAcc.operations.filter(op => !idsToDelete.includes(op.id));
                saveData();
                refreshAllViews();
                deleteSelectedBtn.disabled = true;
                if (selectAllCb) selectAllCb.checked = false;
            }
        });
    }

    function updateDeleteButtonState() {
        const checked = document.querySelectorAll('.op-select:checked');
        if (deleteSelectedBtn) deleteSelectedBtn.disabled = checked.length === 0;
    }

    // --- Statistics ---
    function calculateStats() {
        const currentAcc = getCurrentAccount();
        if (!currentAcc) return;

        let totalPnl = 0;
        let wins = 0;
        let losses = 0;

        currentAcc.operations.forEach(op => {
            totalPnl += op.result;
            if (op.result > 0) wins++;
            else if (op.result < 0) losses++;
        });

        const currentBalance = currentAcc.initialBalance + totalPnl;

        // Calculate Zones Operated (unique intervals)
        const uniqueZones = new Set();
        currentAcc.operations.forEach(op => {
            const hasTop = op.zoneTop && parseFloat(op.zoneTop) > 0;
            const hasBottom = op.zoneBottom && parseFloat(op.zoneBottom) > 0;
            if (hasTop || hasBottom) {
                // Formatting to handle precision and make comparison stable
                const topVal = hasTop ? parseFloat(op.zoneTop).toFixed(5) : '0';
                const botVal = hasBottom ? parseFloat(op.zoneBottom).toFixed(5) : '0';
                uniqueZones.add(`${topVal}_${botVal}`);
            }
        });
        const zonesOperated = uniqueZones.size;

        totalBalanceEl.textContent = formatCurrency(currentBalance);
        initialBalanceDisplay.textContent = formatCurrency(currentAcc.initialBalance);
        winsCountEl.textContent = wins;
        lossesCountEl.textContent = losses;
        if (zonesCountEl) zonesCountEl.textContent = zonesOperated;

        const pnlFormatted = formatCurrency(totalPnl);
        netPnlEl.textContent = (totalPnl >= 0 ? '+' : '') + pnlFormatted;
        netPnlEl.className = 'stat-value ' + (totalPnl >= 0 ? 'success' : 'danger');
    }

    // --- Chart ---
    let performanceChart = null;

    function initChart() {
        const ctx = document.getElementById('performanceChart').getContext('2d');
        performanceChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: [],
                datasets: [{
                    label: 'Balance Total',
                    data: [],
                    borderColor: '#D4AF37',
                    borderWidth: 3,
                    pointRadius: 0,
                    pointHoverRadius: 6,
                    backgroundColor: 'rgba(212, 175, 55, 0.05)',
                    tension: 0.2, // Smoother but maintains the spikes
                    fill: true
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: {
                    intersect: false,
                    mode: 'index',
                },
                plugins: {
                    legend: { display: false } // Cleaner look
                },
                scales: {
                    y: {
                        beginAtZero: false,
                        grid: { color: 'rgba(255,255,255,0.03)' },
                        ticks: {
                            color: '#888',
                            callback: function (value) { return '$' + value.toLocaleString(); }
                        }
                    },
                    x: {
                        grid: { display: false },
                        ticks: {
                            color: '#888',
                            maxRotation: 0,
                            autoSkip: true,
                            maxTicksLimit: 10
                        }
                    }
                }
            }
        });
    }

    function updateChart() {
        if (!performanceChart) return;
        const currentAcc = getCurrentAccount();
        if (!currentAcc) return;

        // Important: Sort for the chart ascending by date/time
        // We use a secondary sort key to maintain relative order of same-timestamp ops
        const sortedOps = [...currentAcc.operations].sort((a, b) => {
            const dtA = new Date(`${a.date} ${a.time || '00:00'}`);
            const dtB = new Date(`${b.date} ${b.time || '00:00'}`);
            if (dtA - dtB !== 0) return dtA - dtB;
            // If timestamps same, use documented order (seq or id)
            return (a.seq || 0) - (b.seq || 0);
        });

        let runningBalance = currentAcc.initialBalance;
        const labels = ['Inicio'];
        const data = [runningBalance];

        sortedOps.forEach(op => {
            runningBalance += op.result;
            // Short label to avoid clutter
            labels.push(op.date);
            data.push(runningBalance);
        });

        performanceChart.data.labels = labels;
        performanceChart.data.datasets[0].data = data;
        performanceChart.update();
    }

    // --- Clock ---
    function startMarketClock() {
        const timeEl = document.getElementById('current-time');
        const marketNameEl = document.getElementById('market-name');

        setInterval(() => {
            const now = new Date();
            timeEl.textContent = now.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

            const utcHour = now.getUTCHours();

            let activeMarkets = [];
            if (utcHour >= 22 || utcHour < 7) activeMarkets.push("Sydney");
            if (utcHour >= 0 && utcHour < 9) activeMarkets.push("Tokio");
            if (utcHour >= 8 && utcHour < 17) activeMarkets.push("Londres");
            if (utcHour >= 13 && utcHour < 22) activeMarkets.push("Nueva York");

            if (activeMarkets.length > 0) {
                marketNameEl.textContent = "Mercado Abierto: " + activeMarkets.join(' / ');
                marketNameEl.style.color = "var(--success)";
            } else {
                marketNameEl.textContent = "Mercados Cerrados";
                marketNameEl.style.color = "var(--text-secondary)";
            }
        }, 1000);
    }

    // --- PDF Export ---
    document.getElementById('btn-export-pdf').addEventListener('click', () => {
        const currentAcc = getCurrentAccount();
        if (!currentAcc) return;

        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();

        doc.setFontSize(22);
        doc.setTextColor(212, 175, 55);
        doc.text("Reporte de Trading - FXKINGS", 14, 20);

        doc.setFontSize(12);
        doc.setTextColor(0, 0, 0);
        doc.text(`Cuenta: ${currentAcc.name}`, 14, 30);
        doc.text(`Trader: ${appData.userProfile.name}`, 14, 36);
        doc.text(`Fecha: ${new Date().toLocaleDateString()}`, 14, 42);

        const headers = [['Fecha', 'Activo', 'Tipo', 'Precio', 'Lotes', 'Result']];
        const data = currentAcc.operations.map(op => [
            op.date,
            op.asset || '-',
            op.type.toUpperCase(),
            op.entryPrice.toString(),
            op.lotSize.toString(),
            '$' + op.result.toFixed(2)
        ]);

        doc.autoTable({
            head: headers,
            body: data,
            startY: 50,
            theme: 'grid',
            headStyles: { fillColor: [0, 0, 0], textColor: [212, 175, 55] },
            alternateRowStyles: { fillColor: [240, 240, 240] }
        });

        doc.save(`${currentAcc.name}_Reporte.pdf`);
    });

    // --- Utils ---
    function formatCurrency(num) {
        return '$' + parseFloat(num).toFixed(2).replace(/\d(?=(\d{3})+\.)/g, '$&,');
    }

    function saveData() {
        localStorage.setItem('fxkings_data', JSON.stringify(appData));
    }

    // --- PDF Import (Automatic) ---
    const importPdfModal = document.getElementById('import-pdf-modal');
    const btnImportPdf = document.getElementById('btn-import-pdf');
    const btnCloseImportModal = document.getElementById('close-import-modal');
    const pdfFileInput = document.getElementById('pdf-file-input');
    const btnSelectPdf = document.getElementById('btn-select-pdf');
    const pdfDropZone = document.getElementById('pdf-drop-zone');

    if (typeof pdfjsLib !== 'undefined') {
        pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
    }

    if (btnImportPdf) {
        btnImportPdf.addEventListener('click', () => {
            importPdfModal.classList.remove('hidden');
        });
    }

    if (btnCloseImportModal) {
        btnCloseImportModal.addEventListener('click', () => {
            importPdfModal.classList.add('hidden');
        });
    }

    if (btnSelectPdf) {
        btnSelectPdf.addEventListener('click', () => pdfFileInput.click());
    }

    if (pdfDropZone) {
        pdfDropZone.addEventListener('click', () => pdfFileInput.click());
        pdfDropZone.addEventListener('dragover', (e) => {
            e.preventDefault();
            pdfDropZone.classList.add('drag-over');
        });
        pdfDropZone.addEventListener('dragleave', () => pdfDropZone.classList.remove('drag-over'));
        pdfDropZone.addEventListener('drop', (e) => {
            e.preventDefault();
            pdfDropZone.classList.remove('drag-over');
            if (e.dataTransfer.files.length > 0) processPDF(e.dataTransfer.files[0]);
        });
    }

    if (pdfFileInput) {
        pdfFileInput.addEventListener('change', (e) => {
            if (e.target.files.length > 0) processPDF(e.target.files[0]);
        });
    }


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

            // Detect Initial Balance
            const initialBalanceMatch = fullText.match(/Inicial:\s*\$?([\d,.]+)/i) ||
                fullText.match(/Balance\s*Inicial:\s*\$?([\d,.]+)/i);

            const ops = parseOperationsFromText(fullText);

            if (ops.length > 0) {
                const currentAcc = getCurrentAccount();
                if (currentAcc) {
                    // Update initial balance if found
                    if (initialBalanceMatch) {
                        currentAcc.initialBalance = parseFloat(initialBalanceMatch[1].replace(/,/g, ''));
                    }

                    // Reset or Prepend? Usually user wants to replace or add.
                    // To match the specific case, we'll replace if the count matches a full report
                    if (ops.length > 10 && confirm(`Se detectaron ${ops.length} operaciones. ¿Deseas REEMPLAZAR los datos actuales con este reporte?`)) {
                        currentAcc.operations = ops;
                    } else {
                        currentAcc.operations = [...ops, ...currentAcc.operations];
                    }

                    saveData();
                    refreshAllViews();
                    alert(`✅ ¡Éxito! Se cargaron ${ops.length} operaciones y se ajustó el balance inicial.`);
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
        // Regex for: Date (Time?) Asset Type Price Lots ZoneS ZoneI Result
        // Example: 2026-02-16 09:05 XAUUSD BUY 4975.78 0.05 4874 4874 $6.45
        // Groups: 1:Date, 2:Time, 3:Asset, 4:Type, 5:Price, 6:Lots, 7:ZoneS, 8:ZoneI, 9:Result
        const regex = /(\d{4}-\d{2}-\d{2})\s*(?:(\d{2}:\d{2})\s+)?([A-Z]{3,8})\s+(BUY|SELL)\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)\s+[\$\s]*([\+\-]?[\d.]+)/gi;

        let match;
        const seen = new Set();

        let seq = 0;
        while ((match = regex.exec(text)) !== null) {
            const op = {
                id: Date.now() + Math.random(),
                seq: seq++, // Preserve documented order
                date: match[1],
                time: match[2] || "00:00",
                asset: match[3],
                type: match[4].toLowerCase(),
                entryPrice: parseFloat(match[5]),
                lotSize: parseFloat(match[6]),
                zoneTop: parseFloat(match[7]),
                zoneBottom: parseFloat(match[8]),
                result: parseFloat(match[9].replace(/,/g, ''))
            };

            // Unique signature includes time to avoid skipping multiple entries at same price/day
            const sig = `${op.date}|${op.time}|${op.asset}|${op.type}|${op.entryPrice}|${op.result}`;
            if (!seen.has(sig)) {
                operations.push(op);
                seen.add(sig);
            }
        }
        return operations;
    }

    init();
});
