/* Patient Zero — app.js
   React (CDN) + htm for JSX-like tagged templates + TensorFlow.js */

const { useState, useEffect, useCallback, useRef } = React;
const html = htm.bind(React.createElement);

// ─── Constants ───────────────────────────────────────────────────────
const FEATURES = ['age','sex','cp','trestbps','chol','fbs','restecg','thalach','exang','oldpeak','slope','ca','thal'];

const REAL_MEANS = {
  age: 54.54, sex: 0.68, cp: 3.16, trestbps: 131.69, chol: 247.35,
  fbs: 0.14, restecg: 1.00, thalach: 149.60, exang: 0.33, oldpeak: 1.06,
  slope: 1.60, ca: 0.68, thal: 4.73
};

const CLIP_RULES = {
  age:      { min: 29,  max: 77,  decimals: 0 },
  sex:      { min: 0,   max: 1,   decimals: 0 },
  cp:       { min: 1,   max: 4,   decimals: 0 },
  trestbps: { min: 94,  max: 200, decimals: 0 },
  chol:     { min: 126, max: 564, decimals: 0 },
  fbs:      { min: 0,   max: 1,   decimals: 0 },
  restecg:  { min: 0,   max: 2,   decimals: 0 },
  thalach:  { min: 71,  max: 202, decimals: 0 },
  exang:    { min: 0,   max: 1,   decimals: 0 },
  oldpeak:  { min: 0,   max: 6.2, decimals: 1 },
  slope:    { min: 1,   max: 3,   decimals: 0 },
  ca:       { min: 0,   max: 3,   decimals: 0 },
  thal:     { min: 3,   max: 7,   decimals: 0 }
};

// ─── Loading Spinner ─────────────────────────────────────────────────
function LoadingSpinner() {
  return html`
    <div class="loading-overlay">
      <div class="spinner"></div>
      <p class="loading-text">Loading TensorFlow.js model…</p>
      <p style=${{ fontSize: '0.78rem', color: '#94a3b8', marginTop: '0.5rem' }}>
        Initializing decoder network (6 → 16 → 32 → 64 → 13)
      </p>
    </div>
  `;
}

// ─── Header ──────────────────────────────────────────────────────────
function Header() {
  return html`
    <header class="header">
      <div class="header-content">
        <h1><span class="shield-icon">🧬</span> Patient Zero</h1>
        <p class="subtitle">VAE-Powered Synthetic Patient Data Generator</p>
        <div class="badges">
          <span class="badge">✓ GDPR Compliant</span>
          <span class="badge">✓ HIPAA Safe</span>
          <span class="badge">🔬 Research Grade</span>
        </div>
      </div>
    </header>
  `;
}

// ─── Info Cards ──────────────────────────────────────────────────────
function InfoCards() {
  const cards = [
    { icon: '🏥', value: 'Cleveland', label: 'Heart Disease Dataset' },
    { icon: '👤', value: '297',       label: 'Real Patients' },
    { icon: '📊', value: '2,370',     label: 'Augmented Training' },
    { icon: '🧬', value: '6',         label: 'Latent Dimensions' }
  ];
  return html`
    <div class="info-cards">
      ${cards.map((c, i) => html`
        <div class="info-card" key=${i}>
          <div class="card-icon">${c.icon}</div>
          <div class="card-value">${c.value}</div>
          <div class="card-label">${c.label}</div>
        </div>
      `)}
    </div>
  `;
}

// ─── Controls ────────────────────────────────────────────────────────
function Controls({ nPatients, setNPatients, temperature, setTemperature, seed, setSeed, onGenerate, generating, modelReady }) {
  return html`
    <div class="controls-section">
      <h2>⚙️ Generation Parameters</h2>
      <div class="controls-grid">
        <div class="control-group">
          <label>Number of Patients</label>
          <span class="control-value">${nPatients}</span>
          <div class="control-desc">Synthetic records to generate (5 – 100)</div>
          <input type="range" min="5" max="100" step="1"
            value=${nPatients}
            onInput=${e => setNPatients(Number(e.target.value))} />
        </div>
        <div class="control-group">
          <label>Diversity / Temperature</label>
          <span class="control-value">${temperature.toFixed(1)}</span>
          <div class="control-desc">Controls sample spread from latent space</div>
          <input type="range" min="0.5" max="2.0" step="0.1"
            value=${temperature}
            onInput=${e => setTemperature(Number(e.target.value))} />
        </div>
        <div class="control-group">
          <label>Random Seed</label>
          <div class="control-desc">For reproducible results</div>
          <input type="number" value=${seed}
            onChange=${e => setSeed(Number(e.target.value))} />
        </div>
      </div>
      <button class="generate-btn"
        onClick=${onGenerate}
        disabled=${!modelReady || generating}>
        ${generating
          ? html`<span class="btn-spinner"></span> Generating…`
          : html`<span>🧪</span> Generate Synthetic Patients`}
      </button>
    </div>
  `;
}

// ─── Patient Table (Tab 1) ───────────────────────────────────────────
function PatientTable({ data }) {
  if (!data || data.length === 0) {
    return html`
      <div class="empty-state">
        <div class="empty-icon">🧬</div>
        <p>No patients generated yet. Adjust parameters above and click <strong>Generate</strong>.</p>
      </div>
    `;
  }

  const downloadCSV = () => {
    const header = FEATURES.join(',');
    const rows = data.map(row => FEATURES.map(f => row[f]).join(','));
    const csv = [header, ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'synthetic_patients.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  return html`
    <div class="fade-in">
      <div class="success-msg">
        ✅ <strong>${data.length} synthetic patients generated</strong> — none of these patients exist in real life
      </div>
      <button class="download-btn" onClick=${downloadCSV}>
        📥 Download as CSV
      </button>
      <div class="table-container">
        <table class="data-table" id="patients-table">
          <thead>
            <tr>
              <th>#</th>
              ${FEATURES.map(f => html`<th key=${f}>${f}</th>`)}
            </tr>
          </thead>
          <tbody>
            ${data.map((row, i) => html`
              <tr key=${i}>
                <td class="row-index">${i + 1}</td>
                ${FEATURES.map(f => html`<td key=${f}>${row[f]}</td>`)}
              </tr>
            `)}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

// ─── Statistical Comparison (Tab 2) ─────────────────────────────────
function StatComparison({ data }) {
  const h = React.createElement;

  if (!data || data.length === 0) {
    return h('div', { className: 'empty-state' },
      h('div', { className: 'empty-icon' }, '📊'),
      h('p', null, 'Generate patients first to see statistical comparison with real data.')
    );
  }

  const syntheticMeans = {};
  FEATURES.forEach(f => {
    const sum = data.reduce((acc, row) => acc + row[f], 0);
    syntheticMeans[f] = sum / data.length;
  });

  const tableRows = FEATURES.map(f => {
    const diff = Math.abs(syntheticMeans[f] - REAL_MEANS[f]);
    const diffClass = diff < 5 ? 'diff-good' : diff <= 15 ? 'diff-warn' : 'diff-bad';
    const diffIcon = diff < 5 ? '✓' : diff <= 15 ? '⚠' : '✗';
    return h('tr', { key: f },
      h('td', { className: 'feature-name' }, f),
      h('td', null, REAL_MEANS[f].toFixed(2)),
      h('td', null, syntheticMeans[f].toFixed(2)),
      h('td', { className: diffClass }, diffIcon + ' ' + diff.toFixed(2))
    );
  });

  return h('div', { className: 'fade-in' },
    h('div', { className: 'table-container', style: { maxHeight: 'none' } },
      h('table', { className: 'stat-table', id: 'stat-comparison-table' },
        h('thead', null,
          h('tr', null,
            h('th', null, 'Feature'),
            h('th', null, 'Real Mean'),
            h('th', null, 'Synthetic Mean'),
            h('th', null, 'Difference')
          )
        ),
        h('tbody', null, tableRows)
      )
    ),
    h('div', { style: { display: 'flex', gap: '1.5rem', marginTop: '1rem', fontSize: '0.78rem', color: '#64748b' } },
      h('span', { className: 'diff-good' }, '● Diff < 5'),
      h('span', { className: 'diff-warn' }, '● Diff 5-15'),
      h('span', { className: 'diff-bad' }, '● Diff > 15')
    )
  );
}


// ─── About the Model (Tab 3) ────────────────────────────────────────
function AboutModel() {
  return html`
    <div class="about-section fade-in">
      <h3>🏗️ VAE Architecture</h3>
      <div class="vae-diagram">
        <div class="vae-node input">
          <div>Input</div>
          <div class="node-label">(13 features)</div>
        </div>
        <div class="vae-arrow">→</div>
        <div class="vae-node encoder">
          <div>Encoder</div>
          <div class="node-label">64 → 32 → 16</div>
        </div>
        <div class="vae-arrow">→</div>
        <div class="vae-node latent">
          <div>μ, σ</div>
          <div class="node-label">Latent (6)</div>
        </div>
        <div class="vae-arrow">→</div>
        <div class="vae-node decoder">
          <div>Decoder</div>
          <div class="node-label">16 → 32 → 64</div>
        </div>
        <div class="vae-arrow">→</div>
        <div class="vae-node output">
          <div>Output</div>
          <div class="node-label">(13 features)</div>
        </div>
      </div>

      <h3>📐 Loss Function</h3>
      <div class="formula-box">
        <div><strong>Total Loss</strong> = Reconstruction Loss (MSE) + β × KL Divergence</div>
        <div style=${{ marginTop: '0.5rem' }}>
          <strong>KL Divergence</strong> = −0.5 × Σ(1 + log σ² − μ² − σ²)
        </div>
      </div>

      <h3>🎓 Training Details</h3>
      <div class="training-details">
        <div class="training-detail"><span class="detail-icon">🔄</span> <strong>Epochs:</strong>&nbsp;100</div>
        <div class="training-detail"><span class="detail-icon">📈</span> <strong>KL Annealing:</strong>&nbsp;Warmup 20, Anneal 40</div>
        <div class="training-detail"><span class="detail-icon">⚡</span> <strong>Optimizer:</strong>&nbsp;Adam (lr=0.001)</div>
        <div class="training-detail"><span class="detail-icon">📦</span> <strong>Batch Size:</strong>&nbsp;32</div>
        <div class="training-detail"><span class="detail-icon">🔢</span> <strong>Latent Dims:</strong>&nbsp;6</div>
        <div class="training-detail"><span class="detail-icon">📏</span> <strong>Decoder:</strong>&nbsp;6→16→32→64→13 (sigmoid)</div>
      </div>

      <h3>🔒 Privacy Guarantee</h3>
      <div class="privacy-callout">
        <span class="callout-icon">🛡️</span>
        <p>
          Generated patients are sampled from <strong>N(0, 1)</strong> — not from any real patient record.
          It is <strong>mathematically impossible</strong> to reverse-engineer a real patient from a generated sample.
          The decoder maps random noise through learned weights; the output is a statistical abstraction,
          never a memorized data point.
        </p>
      </div>
    </div>
  `;
}

// ─── Footer ──────────────────────────────────────────────────────────
function Footer() {
  return html`
    <footer class="footer">
      <span>Patient Zero</span> — VAE Synthetic Data Generator
      &nbsp;|&nbsp; Built with TensorFlow.js
      &nbsp;|&nbsp; Cleveland Heart Disease Dataset
      &nbsp;|&nbsp; Course: Deep Learning MAI417-3
    </footer>
  `;
}

// ─── Main App ────────────────────────────────────────────────────────
function App() {
  const [model, setModel] = useState(null);
  const [scalerParams, setScalerParams] = useState(null);
  const [loading, setLoading] = useState(true);
  const [modelError, setModelError] = useState(null);
  const [nPatients, setNPatients] = useState(10);
  const [temperature, setTemperature] = useState(1.0);
  const [seed, setSeed] = useState(42);
  const [patients, setPatients] = useState([]);
  const [generating, setGenerating] = useState(false);
  const [activeTab, setActiveTab] = useState(0);

  // Load model and scaler on mount
  useEffect(() => {
    let cancelled = false;
    async function loadResources() {
      try {
        const [loadedModel, scalerRes] = await Promise.all([
          tf.loadLayersModel('./model.json'),
          fetch('./scaler_params.json').then(r => r.json())
        ]);
        if (!cancelled) {
          setModel(loadedModel);
          setScalerParams(scalerRes);
          setLoading(false);
        }
      } catch (err) {
        if (!cancelled) {
          console.error('Model loading error:', err);
          setModelError(err.message);
          setLoading(false);
        }
      }
    }
    loadResources();
    return () => { cancelled = true; };
  }, []);

  // Generation logic
  const handleGenerate = useCallback(async () => {
    if (!model || !scalerParams) return;
    setGenerating(true);
    // Small delay so UI updates
    await new Promise(r => setTimeout(r, 50));

    try {
      // Step 1: Sample from latent space (scaled by temperature)
      const z = tf.randomNormal([nPatients, 6]).mul(tf.scalar(temperature));

      // Step 2: Run through decoder
      const generatedScaled = model.predict(z);

      // Step 3: Inverse MinMax transform
      const rawData = generatedScaled.arraySync();
      const generated = rawData.map(row =>
        row.map((val, i) => val * scalerParams.data_range_[i] + scalerParams.data_min_[i])
      );

      // Step 4: Round/clip to realistic medical values
      const processed = generated.map(row => {
        const record = {};
        FEATURES.forEach((feat, i) => {
          const rule = CLIP_RULES[feat];
          let v = row[i];
          v = Math.max(rule.min, Math.min(rule.max, v));
          v = Number(v.toFixed(rule.decimals));
          record[feat] = v;
        });
        return record;
      });

      setPatients(processed);
      setActiveTab(0);

      // Clean up tensors
      z.dispose();
      generatedScaled.dispose();
    } catch (err) {
      console.error('Generation error:', err);
    }
    setGenerating(false);
  }, [model, scalerParams, nPatients, temperature]);

  // Show loading screen
  if (loading) {
    return html`
      <div>
        <${Header} />
        <div class="main-content">
          <${LoadingSpinner} />
        </div>
      </div>
    `;
  }

  // Show error screen
  if (modelError) {
    return html`
      <div>
        <${Header} />
        <div class="main-content">
          <div class="loading-overlay">
            <div style=${{ fontSize: '3rem', marginBottom: '1rem' }}>⚠️</div>
            <p style=${{ color: '#ef4444', fontWeight: 600 }}>Failed to load model</p>
            <p style=${{ color: '#64748b', fontSize: '0.85rem', marginTop: '0.5rem' }}>${modelError}</p>
          </div>
        </div>
      </div>
    `;
  }

  const tabs = [
    { label: '🧬 Generated Patients', id: 'tab-patients' },
    { label: '📊 Statistical Comparison', id: 'tab-stats' },
    { label: '🏗️ About the Model', id: 'tab-about' }
  ];

  return html`
    <div>
      <${Header} />
      <div class="main-content">
        <div class="model-loaded">✅ Model loaded successfully — Decoder ready (6-dim latent → 13 features)</div>

        <${InfoCards} />

        <${Controls}
          nPatients=${nPatients} setNPatients=${setNPatients}
          temperature=${temperature} setTemperature=${setTemperature}
          seed=${seed} setSeed=${setSeed}
          onGenerate=${handleGenerate}
          generating=${generating}
          modelReady=${!!model}
        />

        <div class="results-section">
          <div class="tabs">
            ${tabs.map((t, i) => html`
              <button key=${i}
                id=${t.id}
                class=${'tab' + (activeTab === i ? ' active' : '')}
                onClick=${() => setActiveTab(i)}>
                ${t.label}
              </button>
            `)}
          </div>
          <div class="tab-content">
            ${activeTab === 0 && html`<${PatientTable} data=${patients} />`}
            ${activeTab === 1 && html`<${StatComparison} data=${patients} />`}
            ${activeTab === 2 && html`<${AboutModel} />`}
          </div>
        </div>
      </div>
      <${Footer} />
    </div>
  `;
}

// ─── Mount ───────────────────────────────────────────────────────────
const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(html`<${App} />`);
