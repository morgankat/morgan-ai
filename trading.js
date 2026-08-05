// ===== MORGAN AI - TRADING ENGINE =====

function switchTradingTab(tab) {
  document.querySelectorAll('.trading-tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.trading-panel').forEach(p => p.classList.remove('active'));

  event.target.classList.add('active');
  document.getElementById('trading-' + tab).classList.add('active');
}

// ===== CHART ANALYSIS =====
function analyzeChart() {
  const input = document.getElementById('analysisInput');
  const result = document.getElementById('analysisResult');
  const text = input.value.trim();

  if (!text) {
    showToast('Please describe the chart first', 'error');
    return;
  }

  result.innerHTML = '<div style="color:var(--text-muted)">Analyzing with Morgan...</div>';
  result.classList.add('show');

  AI.analyzeChart(text)
    .then(res => {
      result.innerHTML = formatAnalysis(res.content);
      Memory.addInsight('Chart Analysis', text + '\n\n' + res.content, 'trading');
    })
    .catch(err => {
      result.innerHTML = '<div style="color:var(--accent-red)">Error: ' + escapeHtml(err.message) + '</div>';
    });
}

function handleChartUpload(event) {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = function(e) {
    const result = document.getElementById('analysisResult');
    result.innerHTML = '<div style="color:var(--text-muted)">Analyzing image with Morgan...</div>';
    result.classList.add('show');

    AI.analyzeChart('Chart screenshot uploaded', e.target.result)
      .then(res => {
        result.innerHTML = '<img src="' + e.target.result + '" style="max-width:100%;border-radius:8px;margin-bottom:12px;">' + formatAnalysis(res.content);
      })
      .catch(err => {
        result.innerHTML = '<div style="color:var(--accent-red)">Error: ' + escapeHtml(err.message) + '</div>';
      });
  };
  reader.readAsDataURL(file);
}

function formatAnalysis(text) {
  return text
    .replace(/#{1,6}\s*(.+)/g, '<h4 style="color:var(--accent-cyan);margin:12px 0 6px;font-size:14px;">$1</h4>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/`{3}([\s\S]*?)`{3}/g, '<pre style="background:var(--bg-primary);padding:10px;border-radius:6px;overflow-x:auto;font-size:12px;"><code>$1</code></pre>')
    .replace(/`(.+?)`/g, '<code style="background:var(--bg-primary);padding:2px 6px;border-radius:4px;font-size:12px;">$1</code>')
    .replace(/\n/g, '<br>');
}

// ===== STRATEGY BUILDER =====
function saveStrategy() {
  const name = document.getElementById('strategyName').value.trim();
  const entry = document.getElementById('strategyEntry').value.trim();
  const exit = document.getElementById('strategyExit').value.trim();
  const risk = document.getElementById('strategyRisk').value;

  if (!name || !entry) {
    showToast('Please fill in strategy name and entry rules', 'error');
    return;
  }

  const strategy = { name, entry, exit, risk };
  Memory.addStrategy(strategy);
  renderStrategies();

  document.getElementById('strategyName').value = '';
  document.getElementById('strategyEntry').value = '';
  document.getElementById('strategyExit').value = '';

  showToast('Strategy saved', 'success');
}

function renderStrategies() {
  const list = document.getElementById('strategyList');
  const strategies = Memory.getStrategies();

  if (strategies.length === 0) {
    list.innerHTML = '<div class="strategy-empty">No strategies saved yet</div>';
    return;
  }

  list.innerHTML = strategies.map(s => `
    <div class="strategy-item" style="padding:12px;background:var(--bg-secondary);border:1px solid var(--border);border-radius:var(--radius-sm);margin-bottom:8px;">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
        <strong style="color:var(--accent-cyan);">${escapeHtml(s.name)}</strong>
        <button onclick="deleteStrategy(${s.id})" style="background:none;border:none;color:var(--accent-red);cursor:pointer;font-size:12px;">Delete</button>
      </div>
      <div style="font-size:12px;color:var(--text-secondary);margin-bottom:4px;"><strong>Entry:</strong> ${escapeHtml(s.entry)}</div>
      ${s.exit ? `<div style="font-size:12px;color:var(--text-secondary);margin-bottom:4px;"><strong>Exit:</strong> ${escapeHtml(s.exit)}</div>` : ''}
      <div style="font-size:11px;color:var(--text-muted);">Risk: ${s.risk}%</div>
    </div>
  `).join('');
}

function deleteStrategy(id) {
  Memory.deleteStrategy(id);
  renderStrategies();
  showToast('Strategy deleted', 'info');
}

// ===== TRADE JOURNAL =====
function addTradeEntry() {
  document.getElementById('journalForm').style.display = 'block';
}

function cancelTradeEntry() {
  document.getElementById('journalForm').style.display = 'none';
}

function saveTradeEntry() {
  const entry = {
    pair: document.getElementById('journalPair').value.trim(),
    direction: document.getElementById('journalDirection').value,
    entryPrice: document.getElementById('journalEntry').value,
    exitPrice: document.getElementById('journalExit').value,
    stopLoss: document.getElementById('journalSL').value,
    takeProfit: document.getElementById('journalTP').value,
    notes: document.getElementById('journalNotes').value.trim()
  };

  if (!entry.pair) {
    showToast('Please enter a pair/symbol', 'error');
    return;
  }

  Memory.addJournalEntry(entry);
  renderJournal();
  cancelTradeEntry();
  showToast('Trade entry saved', 'success');
}

function renderJournal() {
  const list = document.getElementById('journalList');
  const entries = Memory.getJournal();

  if (entries.length === 0) {
    list.innerHTML = '<div class="journal-empty">No trade entries yet</div>';
    return;
  }

  list.innerHTML = entries.map(e => {
    const date = new Date(e.timestamp).toLocaleDateString();
    const pnl = e.exitPrice && e.entryPrice 
      ? ((parseFloat(e.exitPrice) - parseFloat(e.entryPrice)) * (e.direction === 'buy' ? 1 : -1)).toFixed(5)
      : null;
    const pnlColor = pnl > 0 ? 'var(--accent-green)' : pnl < 0 ? 'var(--accent-red)' : 'var(--text-muted)';

    return `
      <div class="journal-item" style="padding:12px;background:var(--bg-secondary);border:1px solid var(--border);border-radius:var(--radius-sm);margin-bottom:8px;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
          <strong style="color:var(--accent-cyan);">${escapeHtml(e.pair)}</strong>
          <span style="font-size:11px;color:var(--text-muted);">${date}</span>
        </div>
        <div style="font-size:12px;color:var(--text-secondary);margin-bottom:4px;">
          <span style="color:${e.direction === 'buy' ? 'var(--accent-green)' : 'var(--accent-red)'};font-weight:600;">${e.direction.toUpperCase()}</span>
          ${e.entryPrice ? ` | Entry: ${e.entryPrice}` : ''}
          ${e.exitPrice ? ` | Exit: ${e.exitPrice}` : ''}
        </div>
        ${pnl !== null ? `<div style="font-size:13px;font-weight:700;color:${pnlColor};margin-bottom:4px;">P&L: ${pnl > 0 ? '+' : ''}${pnl}</div>` : ''}
        ${e.notes ? `<div style="font-size:11px;color:var(--text-muted);">${escapeHtml(e.notes)}</div>` : ''}
      </div>
    `;
  }).join('');
}

// ===== RISK CALCULATOR =====
function calculateRisk() {
  const balance = parseFloat(document.getElementById('riskBalance').value) || 0;
  const percent = parseFloat(document.getElementById('riskPercent').value) || 0;
  const entry = parseFloat(document.getElementById('riskEntry').value) || 0;
  const stop = parseFloat(document.getElementById('riskStop').value) || 0;
  const target = parseFloat(document.getElementById('riskTarget').value) || 0;

  if (!balance || !entry || !stop) return;

  const riskAmount = balance * (percent / 100);
  const pipsRisk = Math.abs(entry - stop);
  const pipsReward = target ? Math.abs(target - entry) : 0;
  const positionSize = pipsRisk > 0 ? riskAmount / pipsRisk : 0;
  const rr = pipsReward > 0 && pipsRisk > 0 ? (pipsReward / pipsRisk).toFixed(1) : '0';

  document.getElementById('riskAmount').textContent = '$' + riskAmount.toFixed(2);
  document.getElementById('positionSize').textContent = positionSize > 0 
    ? positionSize.toLocaleString(undefined, {maximumFractionDigits: 0}) + ' units' 
    : '---';
  document.getElementById('riskReward').textContent = '1:' + rr;
  document.getElementById('pipsRisk').textContent = pipsRisk.toFixed(5);
}

// ===== NEWS SUMMARY =====
function summarizeNews() {
  const input = document.getElementById('newsInput');
  const result = document.getElementById('newsResult');
  const text = input.value.trim();

  if (!text) {
    showToast('Please paste some news first', 'error');
    return;
  }

  result.innerHTML = '<div style="color:var(--text-muted)">Summarizing with Morgan...</div>';
  result.classList.add('show');

  AI.summarizeNews(text)
    .then(res => {
      result.innerHTML = formatAnalysis(res.content);
      Memory.addInsight('News Summary', text.substring(0, 200) + '...\n\n' + res.content, 'trading');
    })
    .catch(err => {
      result.innerHTML = '<div style="color:var(--accent-red)">Error: ' + escapeHtml(err.message) + '</div>';
    });
}

// Init
setTimeout(() => {
  renderStrategies();
  renderJournal();
  calculateRisk();
}, 500);
