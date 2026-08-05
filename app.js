// ===== MORGAN AI - APP CONTROLLER =====

let currentPage = 'dashboard';
let sidebarOpen = false;

// ===== BOOT SEQUENCE =====
function runBootSequence() {
  const statuses = [
    'Initializing core...',
    'Loading memory engine...',
    'Connecting to AI brain...',
    'Calibrating voice module...',
    'Loading trading tools...',
    'Ready'
  ];

  let step = 0;
  const statusEl = document.getElementById('bootStatus');
  const progressEl = document.getElementById('bootProgress');

  const interval = setInterval(() => {
    if (step < statuses.length) {
      if (statusEl) statusEl.textContent = statuses[step];
      if (progressEl) progressEl.style.width = ((step + 1) / statuses.length * 100) + '%';
      step++;
    } else {
      clearInterval(interval);
      setTimeout(() => {
        const boot = document.getElementById('bootScreen');
        const app = document.getElementById('app');
        if (boot) boot.classList.add('hidden');
        if (app) app.classList.remove('hidden');

        // Load saved settings into UI
        loadSettingsUI();
        updateAIStatus();
        Memory.renderActivity();
        renderStrategies();
        renderJournal();
        calculateRisk();
      }, 400);
    }
  }, 350);
}

// ===== NAVIGATION =====
function navigateTo(page) {
  currentPage = page;

  // Hide all pages
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));

  // Show target page
  const target = document.getElementById('page-' + page);
  if (target) target.classList.add('active');

  // Update sidebar
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  const navItem = document.querySelector('.nav-item[onclick*="' + page + '"]');
  if (navItem) navItem.classList.add('active');

  // Close sidebar
  if (sidebarOpen) toggleSidebar();

  // Scroll to top
  window.scrollTo(0, 0);

  // Page-specific init
  if (page === 'memory') renderMemoryList();
  if (page === 'settings') loadSettingsUI();

  // Update FAB
  updateFAB(page);
}

function toggleSidebar() {
  sidebarOpen = !sidebarOpen;
  const sidebar = document.getElementById('sidebar');
  if (sidebar) sidebar.classList.toggle('open', sidebarOpen);
}

function updateFAB(page) {
  const fab = document.getElementById('fab');
  if (!fab) return;

  if (page === 'chat') {
    fab.style.display = 'none';
  } else {
    fab.style.display = 'flex';
  }
}

function quickAction() {
  if (currentPage === 'dashboard') navigateTo('chat');
  else if (currentPage === 'trading') addTradeEntry();
  else if (currentPage === 'memory') document.getElementById('memorySearch')?.focus();
  else if (currentPage === 'voice') toggleVoice();
  else navigateTo('chat');
}

// ===== CHAT =====
function sendMessage() {
  const input = document.getElementById('chatInput');
  const sendBtn = document.getElementById('sendBtn');
  const typing = document.getElementById('chatTyping');
  const messages = document.getElementById('chatMessages');

  const text = input.value.trim();
  if (!text) return;

  // Add user message
  addMessageToChat('user', text);
  input.value = '';
  input.style.height = 'auto';

  // Show typing
  if (typing) typing.style.display = 'block';
  if (sendBtn) sendBtn.disabled = true;
  messages.scrollTop = messages.scrollHeight;

  const modelSelect = document.getElementById('modelSelect');
  const selectedModel = modelSelect ? modelSelect.value : 'auto';

  AI.sendMessage(text, selectedModel)
    .then(res => {
      if (typing) typing.style.display = 'none';
      if (sendBtn) sendBtn.disabled = false;
      addMessageToChat('bot', res.content, res.model);
      messages.scrollTop = messages.scrollHeight;

      // Voice feedback
      const voiceToggle = document.getElementById('voiceFeedbackToggle');
      if (voiceToggle && voiceToggle.classList.contains('on')) {
        speak(res.content.substring(0, 150));
      }
    })
    .catch(err => {
      if (typing) typing.style.display = 'none';
      if (sendBtn) sendBtn.disabled = false;
      addMessageToChat('bot', 'Sorry, I encountered an error: ' + err.message);
      messages.scrollTop = messages.scrollHeight;
    });
}

function addMessageToChat(role, text, model) {
  const messages = document.getElementById('chatMessages');
  if (!messages) return;

  const div = document.createElement('div');
  div.className = 'message ' + (role === 'user' ? 'user' : 'bot');

  const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const modelTag = model && role === 'bot' ? `<span style="font-size:10px;color:var(--text-muted);display:block;margin-top:4px;">via ${model.split('/').pop()}</span>` : '';

  div.innerHTML = `
    <div class="message-avatar">${role === 'user' ? '&#128100;' : '&#129504;'}</div>
    <div class="message-content">
      <div class="message-text">${formatMessage(text)}</div>
      <div class="message-time">${time}</div>
      ${modelTag}
    </div>
  `;

  messages.appendChild(div);
}

function formatMessage(text) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/#{1,6}\s*(.+)/g, '<strong style="color:var(--accent-cyan)">$1</strong>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/`{3}([\s\S]*?)`{3}/g, '<pre style="background:var(--bg-primary);padding:10px;border-radius:6px;overflow-x:auto;font-size:12px;margin:8px 0;"><code>$1</code></pre>')
    .replace(/`(.+?)`/g, '<code style="background:var(--bg-primary);padding:2px 6px;border-radius:4px;font-size:12px;">$1</code>')
    .replace(/\n/g, '<br>');
}

function clearChat() {
  const messages = document.getElementById('chatMessages');
  if (messages) {
    messages.innerHTML = `
      <div class="message bot">
        <div class="message-avatar">&#129504;</div>
        <div class="message-content">
          <div class="message-text">Chat cleared. How can I help you?</div>
          <div class="message-time">Now</div>
        </div>
      </div>
    `;
  }
  Memory.clearConversations();
  showToast('Chat cleared', 'info');
}

function exportChat() {
  const convs = Memory.getConversations();
  if (convs.length === 0) {
    showToast('No messages to export', 'error');
    return;
  }

  let text = '# Morgan AI Chat Export\n\n';
  convs.forEach(c => {
    const role = c.role === 'user' ? 'You' : 'Morgan';
    const time = new Date(c.timestamp).toLocaleString();
    text += `## ${role} (${time})\n${c.content}\n\n`;
  });

  const blob = new Blob([text], { type: 'text/markdown' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'morgan_chat_' + Date.now() + '.md';
  a.click();
  URL.revokeObjectURL(url);
  showToast('Chat exported', 'success');
}

function attachFile() {
  showToast('File attach coming in v1.1', 'info');
}

// Auto-resize textarea
function initChatInput() {
  const input = document.getElementById('chatInput');
  if (!input) return;

  input.addEventListener('input', function() {
    this.style.height = 'auto';
    this.style.height = Math.min(this.scrollHeight, 120) + 'px';
  });

  input.addEventListener('keydown', function(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  });
}

// ===== MEMORY =====
function renderMemoryList() {
  const list = document.getElementById('memoryList');
  const search = document.getElementById('memorySearch');
  if (!list) return;

  const query = search ? search.value.trim() : '';
  const filter = document.querySelector('.memory-filter.active')?.textContent.toLowerCase() || 'all';

  let entries = [];
  if (query) {
    entries = Memory.search(query, filter === 'all' ? null : filter);
  } else {
    entries = [
      ...Memory.data.conversations.map(c => ({ ...c, source: 'Chat' })),
      ...Memory.data.insights.map(i => ({ ...i, source: 'Insight' })),
      ...Memory.data.strategies.map(s => ({ ...s, source: 'Strategy' })),
      ...Memory.data.journal.map(j => ({ ...j, source: 'Journal' }))
    ].sort((a, b) => b.timestamp - a.timestamp);

    if (filter !== 'all') {
      entries = entries.filter(e => e.type === filter || e.source.toLowerCase() === filter);
    }
  }

  if (entries.length === 0) {
    list.innerHTML = '<div class="memory-empty">No entries found</div>';
    return;
  }

  list.innerHTML = entries.slice(0, 50).map(e => {
    const time = new Date(e.timestamp).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    const title = e.name || e.title || e.pair || (e.content ? e.content.substring(0, 60) + '...' : 'Entry');

    return `
      <div style="padding:12px;background:var(--bg-secondary);border:1px solid var(--border);border-radius:var(--radius-sm);margin-bottom:8px;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;">
          <span style="font-size:11px;color:var(--accent-cyan);font-weight:600;">${e.source}</span>
          <span style="font-size:10px;color:var(--text-muted);">${time}</span>
        </div>
        <div style="font-size:13px;color:var(--text-primary);">${escapeHtml(title)}</div>
      </div>
    `;
  }).join('');
}

function searchMemory() {
  renderMemoryList();
}

function filterMemory(type) {
  document.querySelectorAll('.memory-filter').forEach(f => f.classList.remove('active'));
  event.target.classList.add('active');
  renderMemoryList();
}

function clearActivity() {
  Memory.clearActivity();
}

// ===== SETTINGS =====
function loadSettingsUI() {
  const apiKey = localStorage.getItem('morgan_apiKey') || '';
  const baseUrl = localStorage.getItem('morgan_baseUrl') || 'https://bazaarlink.ai/api/v1';
  const defaultModel = localStorage.getItem('morgan_defaultModel') || 'openai/gpt-5.1';
  const temperature = localStorage.getItem('morgan_temperature') || '0.7';
  const maxTokens = localStorage.getItem('morgan_maxTokens') || '4096';

  const elKey = document.getElementById('bazaarKey');
  const elUrl = document.getElementById('baseUrl');
  const elModel = document.getElementById('defaultModel');
  const elTemp = document.getElementById('temperature');
  const elTempVal = document.getElementById('tempValue');
  const elTokens = document.getElementById('maxTokens');

  if (elKey) elKey.value = apiKey;
  if (elUrl) elUrl.value = baseUrl;
  if (elModel) elModel.value = defaultModel;
  if (elTemp) elTemp.value = temperature;
  if (elTempVal) elTempVal.textContent = temperature;
  if (elTokens) elTokens.value = maxTokens;

  // Temperature slider listener
  if (elTemp) {
    elTemp.oninput = function() {
      if (elTempVal) elTempVal.textContent = this.value;
    };
  }
}

function saveApiKey(provider) {
  const key = document.getElementById('bazaarKey').value.trim();
  if (!key) {
    showToast('Please enter an API key', 'error');
    return;
  }
  localStorage.setItem('morgan_apiKey', key);
  AI.apiKey = key;
  showToast('API key saved', 'success');
  updateAIStatus();
}

function saveBaseUrl() {
  const url = document.getElementById('baseUrl').value.trim();
  if (!url) {
    showToast('Please enter a base URL', 'error');
    return;
  }
  localStorage.setItem('morgan_baseUrl', url);
  AI.baseUrl = url;
  showToast('Base URL saved', 'success');
}

function clearAllMemory() {
  if (!confirm('Are you sure? This will delete ALL your data.')) return;
  Memory.clearAll();
  showToast('All data cleared', 'info');
}

function exportAllData() {
  Memory.exportAll();
}

// ===== TOAST =====
function showToast(message, type) {
  const container = document.getElementById('toastContainer');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = 'toast ' + (type || 'info');
  toast.textContent = message;
  container.appendChild(toast);

  setTimeout(() => {
    toast.remove();
  }, 3000);
}

// ===== INIT =====
document.addEventListener('DOMContentLoaded', () => {
  runBootSequence();
  initChatInput();

  // Save settings on change
  document.getElementById('defaultModel')?.addEventListener('change', (e) => {
    localStorage.setItem('morgan_defaultModel', e.target.value);
  });

  document.getElementById('temperature')?.addEventListener('change', (e) => {
    localStorage.setItem('morgan_temperature', e.target.value);
  });

  document.getElementById('maxTokens')?.addEventListener('change', (e) => {
    localStorage.setItem('morgan_maxTokens', e.target.value);
  });
});

// Prevent zoom on double-tap
let lastTouchEnd = 0;
document.addEventListener('touchend', (e) => {
  const now = Date.now();
  if (now - lastTouchEnd <= 300) {
    e.preventDefault();
  }
  lastTouchEnd = now;
}, false);

// Register service worker
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
