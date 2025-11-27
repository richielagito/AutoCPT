const dropZone = document.getElementById('drop-zone');
const fileInput = document.getElementById('file-input');
const paramsSection = document.getElementById('parameters-section');
const dashboardSection = document.getElementById('dashboard-section');
const paramsForm = document.getElementById('params-form');

let rawData = [];

dropZone.addEventListener('click', () => fileInput.click());

dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropZone.classList.add('drag-active');
});

dropZone.addEventListener('dragleave', () => {
    dropZone.classList.remove('drag-active');
});

dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.classList.remove('drag-active');
    const files = e.dataTransfer.files;
    if (files.length > 0) {
        handleFile(files[0]);
    }
});

fileInput.addEventListener('change', (e) => {
    if (e.target.files.length > 0) {
        handleFile(e.target.files[0]);
    }
});

document.getElementById('load-sample').addEventListener('click', (e) => {
    e.preventDefault();
    loadSampleData();
});

document.getElementById('reset-btn').addEventListener('click', () => {
    location.reload();
});

function loadSampleData() {
    const dummyData = [];
    for (let z = 0.2; z <= 20; z += 0.2) {
        let qc, fs;
        if (z < 5) {
            qc = 10 + Math.random() * 5; // MPa
            fs = 0.1 + Math.random() * 0.05; // MPa
        } else if (z < 10) {
            qc = 2 + Math.random() * 2;
            fs = 0.15 + Math.random() * 0.05;
        } else if (z < 15) {
            qc = 15 + Math.random() * 5;
            fs = 0.12 + Math.random() * 0.05;
        } else {
            qc = 25 + Math.random() * 5;
            fs = 0.2 + Math.random() * 0.1;
        }
        
        dummyData.push({
            "Depth (m)": z.toFixed(2),
            "qc (MPa)": qc.toFixed(2),
            "fs (MPa)": fs.toFixed(2)
        });
    }
    
    rawData = dummyData;

    document.getElementById('gwl').value = "1.0";
    document.getElementById('mw').value = "7.5";
    document.getElementById('pga').value = "0.4";
    document.getElementById('unit-weight').value = "18.0";

    resetDropZone();
    showParameters();
}

function resetDropZone() {
    dropZone.classList.remove('upload-success');
    dropZone.innerHTML = `
        <div class="upload-icon">📂</div>
        <h3>Drag & Drop File CPT (.csv, .txt)</h3>
        <p>atau klik untuk memilih file</p>
        <div class="file-requirements">
            <small>Format: Kedalaman (m), qc (MPa/kg/cm²), fs (MPa/kg/cm²)</small>
        </div>
    `;
    fileInput.value = '';
}

function handleFile(file) {
    if (!file.name.endsWith('.csv') && !file.name.endsWith('.txt')) {
        alert("Mohon unggah file .csv atau .txt");
        return;
    }

    Papa.parse(file, {
        header: true,
        dynamicTyping: true,
        skipEmptyLines: true,
        complete: function(results) {
            if (validateData(results.data)) {
                rawData = results.data;
                
                dropZone.classList.add('upload-success');
                dropZone.innerHTML = `
                    <div class="upload-icon" style="color: var(--success-color)">✅</div>
                    <h3>File Berhasil Dimuat!</h3>
                    <p>${file.name}</p>
                    <small>Silakan atur parameter di bawah</small>
                `;
                
                showParameters();
            } else {
                alert("Format data tidak sesuai. Pastikan ada kolom: Kedalaman, qc, fs");
            }
        },
        error: function(error) {
            alert("Gagal membaca file.");
        }
    });
}

function validateData(data) {
    if (data.length === 0) return false;
    const firstRow = data[0];
    const keys = Object.keys(firstRow).map(k => k.toLowerCase());
    const hasDepth = keys.some(k => k.includes('depth') || k.includes('kedalaman') || k.includes('z'));
    const hasQc = keys.some(k => k.includes('qc') || k.includes('coneresistance') || k.includes('q_c'));
    const hasFs = keys.some(k => k.includes('fs') || k.includes('sleevefriction') || k.includes('f_s'));
    
    return hasDepth && hasQc && hasFs;
}

function showParameters() {
    paramsSection.classList.remove('hidden');
    paramsSection.scrollIntoView({ behavior: 'smooth' });
}

paramsForm.addEventListener('submit', (e) => {
    e.preventDefault();
    runAnalysis();
});

function runAnalysis() {
    
    const gwl = parseFloat(document.getElementById('gwl').value);
    const mw = parseFloat(document.getElementById('mw').value);
    const pga = parseFloat(document.getElementById('pga').value);
    const unitWeight = parseFloat(document.getElementById('unit-weight').value);
    const inputUnit = document.getElementById('input-unit').value;

    const processedData = processCPTData(rawData, gwl, mw, pga, unitWeight, inputUnit);
    
    renderCharts(processedData);
    
    generateRecommendations(processedData);

    dashboardSection.classList.remove('hidden');
    dashboardSection.scrollIntoView({ behavior: 'smooth' });
}

function processCPTData(data, gwl, mw, pga, unitWeight, inputUnit) {
    const results = [];
    const Pa = 100; 
    let MSF = 6.9 * Math.exp(-mw / 4) - 0.058; 
    if (MSF > 1.8) MSF = 1.8;

    let sigma_v = 0; 
    let sigma_v_eff = 0; 
    let prevDepth = 0;

    data.forEach((row, index) => {
        const keys = Object.keys(row);
        const depthKey = keys.find(k => k.toLowerCase().includes('depth') || k.toLowerCase().includes('kedalaman'));
        const qcKey = keys.find(k => k.toLowerCase().includes('qc') || k.toLowerCase().includes('cone'));
        const fsKey = keys.find(k => k.toLowerCase().includes('fs') || k.toLowerCase().includes('sleeve'));

        if (!depthKey || !qcKey || !fsKey) return;

        const z = parseFloat(row[depthKey]);
        let qc = parseFloat(row[qcKey]); 
        let fs = parseFloat(row[fsKey]); 

        if (isNaN(z) || isNaN(qc) || isNaN(fs)) return;

        let qc_kPa, fs_kPa;
        if (inputUnit === 'kgcm2') {
            qc_kPa = qc * 98.1;
            fs_kPa = fs * 98.1;
        } else {
            qc_kPa = qc * 1000;
            fs_kPa = fs * 1000;
        }

        const dz = z - prevDepth;
        const gamma = unitWeight; 
        sigma_v += gamma * dz;
        
        let u = 0; 
        if (z > gwl) {
            u = (z - gwl) * 9.81; 
        }
        sigma_v_eff = sigma_v - u;
        if (sigma_v_eff <= 0) sigma_v_eff = 1; 

        // --- SBT (Robertson 1990/2010) ---
        const n = 1.0;  
        const Cn = Math.pow((Pa / sigma_v_eff), n);
        const Qtn = ((qc_kPa - sigma_v) / Pa) * Cn;

        const Fr = (fs_kPa / (qc_kPa - sigma_v)) * 100;

        const Ic = Math.sqrt(Math.pow(3.47 - Math.log10(Qtn), 2) + Math.pow(1.22 + Math.log10(Fr), 2));
        
        let sbtZone = "Unknown";
        if (Ic > 3.60) sbtZone = "Peat"; 
        else if (Ic > 2.95) sbtZone = "Clays"; // Zone 3
        else if (Ic > 2.60) sbtZone = "Silt Mixtures"; // Zone 4
        else if (Ic > 2.05) sbtZone = "Sand Mixtures"; // Zone 5
        else if (Ic > 1.31) sbtZone = "Sands"; // Zone 6
        else sbtZone = "Gravelly Sand"; // Zone 7

        // --- Liquefaction (Idriss & Boulanger) ---
        
        const alpha = -1.012 - 1.126 * Math.sin((z / 11.73) + 5.133);
        const beta = 0.106 + 0.118 * Math.sin((z / 11.28) + 5.142);
        const rd = Math.exp(alpha + beta * mw);
        
        const CSR = 0.65 * pga * (sigma_v / sigma_v_eff) * rd / MSF; 
        const CSR_field = 0.65 * pga * (sigma_v / sigma_v_eff) * rd;

        let Cn_liq = Math.min(1.7, Math.pow((Pa / sigma_v_eff), 0.5)); 
        const qc1N = Cn_liq * (qc_kPa / Pa);

        let FC = 0;
        if (Ic < 1.26) FC = 0;
        else if (Ic >= 1.26 && Ic <= 3.5) FC = 1.75 * Math.pow(Ic, 3.25) - 3.7;
        else FC = 100;
        if (FC < 0) FC = 0; if (FC > 100) FC = 100;

        const d_qc1N = (11.9 + qc1N / 14.6) * Math.exp(1.63 - 9.7 / (FC + 0.1)) - Math.pow(15.7 / (FC + 0.1), 2);
        const qc1N_cs = qc1N + d_qc1N;

        // Idriss & Boulanger 2008
        const CRR_75 = Math.exp((qc1N_cs / 540) + Math.pow(qc1N_cs / 67, 2) - Math.pow(qc1N_cs / 80, 3) + Math.pow(qc1N_cs / 114, 4) - 3);

        const CRR_field = CRR_75 * MSF;

        let FS = CRR_field / CSR_field;
        if (FS > 2) FS = 2; 
        if (sbtZone === "Clays" || sbtZone === "Peat") FS = 5; 

        results.push({
            depth: z,
            qc: qc,
            fs: fs,
            Fr: Fr,
            Ic: Ic,
            sbt: sbtZone,
            FS: FS,
            CSR: CSR_field,
            CRR: CRR_field
        });

        prevDepth = z;
    });

    return results;
}

function renderCharts(data) {
    const ctxCPT = document.getElementById('chart-cpt').getContext('2d');
    const ctxFR = document.getElementById('chart-fr').getContext('2d');
    const ctxSBT = document.getElementById('chart-sbt').getContext('2d');
    const ctxLiq = document.getElementById('chart-liq').getContext('2d');

    if (window.chartCPT instanceof Chart) window.chartCPT.destroy();
    if (window.chartFR instanceof Chart) window.chartFR.destroy();
    if (window.chartSBT instanceof Chart) window.chartSBT.destroy();
    if (window.chartLiq instanceof Chart) window.chartLiq.destroy();

    const depths = data.map(d => d.depth);

    window.chartCPT = new Chart(ctxCPT, {
        type: 'line',
        data: {
            labels: depths,
            datasets: [
                {
                    label: 'qc (MPa)',
                    data: data.map(d => d.qc),
                    borderColor: '#0ea5e9',
                    yAxisID: 'y',
                    xAxisID: 'x',
                },
                {
                    label: 'fs (MPa)',
                    data: data.map(d => d.fs),
                    borderColor: '#f59e0b',
                    yAxisID: 'y',
                    xAxisID: 'x1', 
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            indexAxis: 'y', 
            scales: {
                y: { reverse: true, title: { display: true, text: 'Kedalaman (m)' } },
                x: { position: 'bottom', title: { display: true, text: 'qc (MPa)' } },
                x1: { position: 'top', title: { display: true, text: 'fs (MPa)' }, grid: { drawOnChartArea: false } }
            }
        }
    });

    window.chartFR = new Chart(ctxFR, {
        type: 'line',
        data: {
            labels: depths,
            datasets: [{
                label: 'Friction Ratio (%)',
                data: data.map(d => d.Fr),
                borderColor: '#8b5cf6', 
                fill: false
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            indexAxis: 'y',
            scales: {
                y: { reverse: true, title: { display: true, text: 'Kedalaman (m)' } },
                x: { position: 'top', title: { display: true, text: 'Fr (%)' } }
            }
        }
    });

    window.chartSBT = new Chart(ctxSBT, {
        type: 'line',
        data: {
            labels: depths,
            datasets: [{
                label: 'SBT Index (Ic)',
                data: data.map(d => d.Ic),
                borderColor: '#10b981',
                fill: false
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            indexAxis: 'y',
            scales: {
                y: { reverse: true, title: { display: true, text: 'Kedalaman (m)' } },
                x: { position: 'top', title: { display: true, text: 'Ic (SBT Index)' } }
            },
            plugins: {
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            const idx = context.dataIndex;
                            return `Ic: ${context.raw.toFixed(2)} (${data[idx].sbt})`;
                        }
                    }
                }
            }
        }
    });

    window.chartLiq = new Chart(ctxLiq, {
        type: 'line',
        data: {
            labels: depths,
            datasets: [{
                label: 'Faktor Keamanan (FS)',
                data: data.map(d => d.FS),
                borderColor: '#ef4444',
                backgroundColor: 'rgba(239, 68, 68, 0.1)',
                fill: {
                    target: {value: 1.0},
                    below: 'rgba(239, 68, 68, 0.5)',
                    above: 'rgba(16, 185, 129, 0.2)'
                }
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            indexAxis: 'y',
            scales: {
                y: { reverse: true, title: { display: true, text: 'Kedalaman (m)' } },
                x: { 
                    position: 'top', 
                    title: { display: true, text: 'FS' },
                    min: 0,
                    max: 2.5,
                    grid: {
                        color: (ctx) => ctx.tick.value === 1 ? '#ef4444' : '#e2e8f0',
                        lineWidth: (ctx) => ctx.tick.value === 1 ? 2 : 1
                    }
                }
            }
        }
    });
}

function generateRecommendations(data) {
    const recDiv = document.getElementById('recommendation-text');
    let issues = []; 

    let liqZones = [];
    let start = null;
    
    data.forEach((d, i) => {
        const isLiquefiableSoil = d.sbt !== "Clays" && d.sbt !== "Peat";
        
        if (d.FS < 1.0 && isLiquefiableSoil) {
            if (start === null) start = d.depth;
        } else {
            if (start !== null) {
                liqZones.push({ start: start, end: data[i-1].depth });
                start = null;
            }
        }
    });
    if (start !== null) liqZones.push({ start: start, end: data[data.length-1].depth });

    if (liqZones.length > 0) {
        let text = `<div class="rec-alert">
            <strong>⚠️ Potensi Likuifaksi Terdeteksi</strong>
            <ul class="rec-list">`;
        
        let methods = new Set();

        liqZones.forEach(z => {
            text += `<li>Kedalaman <strong>${z.start.toFixed(1)}m - ${z.end.toFixed(1)}m</strong></li>`;
            
            if (z.end <= 5.0) {
                methods.add("Gali & Ganti Tanah (Excavation & Replacement)");
                methods.add("Dynamic Compaction (Pemadatan Dinamis)");
            } else {
                methods.add("Vibro Compaction / Vibroflotation (Pemadatan Getar)");
                methods.add("Stone Columns (Kolom Batu)");
            }
        });
        text += `</ul>`;
        
        text += `<p><strong>Saran Perbaikan:</strong>${Array.from(methods).join('<br> ')}</p>
        </div>`;
        issues.push(text);
    }

    let softSoilDetected = false;
    let minQc = 100; 
    
    data.forEach(d => {
        if ((d.sbt === "Clays" || d.sbt === "Silt Mixtures") && d.qc < 1.0) {
            softSoilDetected = true;
            if (d.qc < minQc) minQc = d.qc;
        }
    });

    if (softSoilDetected) {
        let text = `<div class="rec-alert" style="border-color: #f59e0b; background-color: #fffbeb;">
            <strong style="color: #b45309;">⚠️ Tanah Lunak (Soft Clay) Terdeteksi</strong>`;
        text += `<p>Ditemukan lapisan lempung lunak dengan qc min ${minQc.toFixed(2)} MPa.</p>`;
        text += `<p><strong>Saran Perbaikan:</strong></p>`;
        text += `PVD (Prefabricated Vertical Drain) + Preloading untuk mempercepat konsolidasi.<br>`;
        text += `Deep Soil Mixing (DSM) jika butuh peningkatan daya dukung cepat.</p>
        </div>`;
        issues.push(text);
    }

    const peatFound = data.some(d => d.sbt === "Peat");
    if (peatFound) {
        issues.push(`<div class="rec-alert" style="border-color: #713f12; background-color: #fef3c7;">
            <strong style="color: #713f12;">⚠️ Lapisan Gambut (Peat) Terdeteksi</strong>
            <p>Tanah organik sangat kompresibel. Disarankan: <br> Pemindahan lokasi <br> Penggantian tanah <br> Pondasi Tiang (Pile Foundation)</p>
        </div>`);
    }

    if (issues.length === 0) {
        recDiv.innerHTML = `<div class="rec-success">
            <strong>✅ Kondisi Tanah Relatif Baik</strong>
            <p>Tidak ditemukan potensi likuifaksi (FS < 1.0).</p>
        </div>`;
    } else {
        recDiv.innerHTML = issues.join('<hr class="rec-divider">');
    }
}
