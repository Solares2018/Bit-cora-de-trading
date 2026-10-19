
// --- PDF Import ---
const importPdfModal = document.getElementById('import-pdf-modal');
const btnImportPdf = document.getElementById('btn-import-pdf');
const btnCloseImportModal = document.getElementById('close-import-modal');
const pdfFileInput = document.getElementById('pdf-file-input');
const btnSelectPdf = document.getElementById('btn-select-pdf');
const pdfDropZone = document.getElementById('pdf-drop-zone');
const pdfPreview = document.getElementById('pdf-preview');
const detectedOpsList = document.getElementById('detected-operations-list');
const btnConfirmImport = document.getElementById('btn-confirm-import');
const btnCancelImport = document.getElementById('btn-cancel-import');
const importCountSpan = document.getElementById('import-count');

let detectedOperations = [];

// Configure PDF.js worker
if (typeof pdfjsLib !== 'undefined') {
    pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
}

btnImportPdf.addEventListener('click', () => {
    importPdfModal.classList.remove('hidden');
    pdfPreview.classList.add('hidden');
    detectedOperations = [];
});

btnCloseImportModal.addEventListener('click', () => {
    importPdfModal.classList.add('hidden');
    pdfFileInput.value = '';
});

btnSelectPdf.addEventListener('click', () => {
    pdfFileInput.click();
});

pdfDropZone.addEventListener('click', () => {
    pdfFileInput.click();
});

// Drag and drop
pdfDropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    pdfDropZone.classList.add('drag-over');
});

pdfDropZone.addEventListener('dragleave', () => {
    pdfDropZone.classList.remove('drag-over');
});

pdfDropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    pdfDropZone.classList.remove('drag-over');
    const files = e.dataTransfer.files;
    if (files.length > 0 && files[0].type === 'application/pdf') {
        processPDF(files[0]);
    }
});

pdfFileInput.addEventListener('change', (e) => {
    if (e.target.files.length > 0) {
        processPDF(e.target.files[0]);
    }
});

async function processPDF(file) {
    // Show processing indicator
    detectedOpsList.innerHTML = '<div class="processing-indicator"><i class="fas fa-spinner"></i><p>Procesando PDF...</p></div>';
    pdfPreview.classList.remove('hidden');

    try {
        const arrayBuffer = await file.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

        let fullText = '';

        // Extract text from all pages
        for (let i = 1; i <= pdf.numPages; i++) {
            const page = await pdf.getPage(i);
            const textContent = await page.getTextContent();
            const pageText = textContent.items.map(item => item.str).join(' ');
            fullText += pageText + '\n';
        }

        // Parse operations from text
        detectedOperations = parseOperationsFromText(fullText);

        if (detectedOperations.length > 0) {
            displayDetectedOperations();
        } else {
            detectedOpsList.innerHTML = '<div class="processing-indicator"><i class="fas fa-exclamation-circle"></i><p>No se detectaron operaciones en el PDF. Verifica que el formato sea compatible.</p></div>';
        }

    } catch (error) {
        console.error('Error processing PDF:', error);
        detectedOpsList.innerHTML = '<div class="processing-indicator"><i class="fas fa-times-circle" style="color:var(--danger)"></i><p>Error al procesar el PDF. Intenta con otro archivo.</p></div>';
    }
}

function parseOperationsFromText(text) {
    const operations = [];
    const lines = text.split('\n');

    // Common patterns for MT4/MT5 reports
    const patterns = {
        // Pattern for: 2024.02.15 14:30 buy 0.10 XAUUSD 2025.50 2030.00 +50.00
        standard: /(\d{4}[.\-\/]\d{2}[.\-\/]\d{2})\s+(\d{2}:\d{2})\s+(buy|sell)\s+([\d.]+)\s+([A-Z]{6})\s+([\d.]+)\s+([\d.]+)\s+([\+\-]?[\d.]+)/gi,
        // Pattern for tabular data
        tabular: /(\d{4}[.\-\/]\d{2}[.\-\/]\d{2}).*?(buy|sell).*?([A-Z]{6}).*?([\d.]+).*?([\d.]+).*?([\+\-][\d.]+)/gi
    };

    // Try standard pattern first
    let match;
    while ((match = patterns.standard.exec(text)) !== null) {
        operations.push({
            date: match[1].replace(/\./g, '-'),
            time: match[2],
            type: match[3].toLowerCase(),
            lotSize: parseFloat(match[4]),
            asset: match[5],
            entryPrice: parseFloat(match[6]),
            exitPrice: parseFloat(match[7]),
            result: parseFloat(match[8]),
            zoneTop: 0,
            zoneBottom: 0
        });
    }

    // If no matches, try to find individual components
    if (operations.length === 0) {
        const dates = text.match(/\d{4}[.\-\/]\d{2}[.\-\/]\d{2}/g) || [];
        const times = text.match(/\d{2}:\d{2}/g) || [];
        const types = text.match(/\b(buy|sell)\b/gi) || [];
        const assets = text.match(/\b(XAUUSD|EURUSD|GBPUSD|USDJPY|BTCUSD)\b/gi) || [];
        const prices = text.match(/\b\d{3,5}\.\d{2,5}\b/g) || [];
        const results = text.match(/[\+\-]\s?\$?\s?[\d,]+\.?\d*/g) || [];

        const minLength = Math.min(dates.length, types.length, assets.length);

        for (let i = 0; i < minLength; i++) {
            const resultMatch = results[i] ? parseFloat(results[i].replace(/[^\d.\-]/g, '')) : 0;
            operations.push({
                date: dates[i].replace(/\./g, '-'),
                time: times[i] || '00:00',
                type: types[i].toLowerCase(),
                lotSize: 0.01,
                asset: assets[i],
                entryPrice: prices[i * 2] ? parseFloat(prices[i * 2]) : 0,
                exitPrice: prices[i * 2 + 1] ? parseFloat(prices[i * 2 + 1]) : 0,
                result: resultMatch,
                zoneTop: 0,
                zoneBottom: 0
            });
        }
    }

    return operations;
}

function displayDetectedOperations() {
    detectedOpsList.innerHTML = '';
    importCountSpan.textContent = detectedOperations.length;

    detectedOperations.forEach((op, index) => {
        const opItem = document.createElement('div');
        opItem.className = 'detected-op-item';

        const resultClass = op.result >= 0 ? 'positive' : 'negative';
        const icon = op.type === 'buy' ? '<i class="fas fa-arrow-up success"></i>' : '<i class="fas fa-arrow-down danger"></i>';

        opItem.innerHTML = `
                <div class="detected-op-info">
                    <strong>${op.date}</strong>
                    <span>${icon} ${op.type.toUpperCase()}</span>
                    <span>${op.asset}</span>
                    <span>${op.lotSize} lotes</span>
                    <span>@ ${op.entryPrice}</span>
                </div>
                <div class="detected-op-result ${resultClass}">
                    ${op.result >= 0 ? '+' : ''}$${op.result.toFixed(2)}
                </div>
            `;

        detectedOpsList.appendChild(opItem);
    });
}

btnConfirmImport.addEventListener('click', () => {
    const currentAcc = getCurrentAccount();
    if (!currentAcc || detectedOperations.length === 0) return;

    detectedOperations.forEach(op => {
        currentAcc.operations.unshift({
            id: Date.now() + Math.random(),
            ...op
        });
    });

    saveData();
    refreshAllViews();
    importPdfModal.classList.add('hidden');
    pdfFileInput.value = '';

    alert(`✅ Se importaron ${detectedOperations.length} operaciones exitosamente!`);
});

btnCancelImport.addEventListener('click', () => {
    importPdfModal.classList.add('hidden');
    pdfFileInput.value = '';
    detectedOperations = [];
});
