// ===== MORGAN AI - MEMORY ENGINE =====
// Handles all localStorage persistence, conversation history, and insights

const Memory = {
  DB_KEY: 'morgan_memory_v1',
  MAX_ENTRIES: 1000,

  data: {
    conversations: [],
    insights: [],
    strategies: [],
    journal: [],
    settings: {},
    activity: []
  },

  init() {
    this.load();
    this.updateStats();
  },

  load() {
    try {
      const raw = localStorage.getItem(this.DB_KEY);
      if (raw) {
        this.data = JSON.parse(raw);
      }
    } catch (e) {
      console.error('Memory load error:', e);
    }
  },

  save() {
    try {
      localStorage.setItem(this.DB_KEY, JSON.stringify(this.data));
      this.updateStats();
    } catch (e) {
      console.error('Memory save error:', e);
      showToast('Memory full. Export & clear old data.', 'error');
    }
  },

  addConversation(role, content, model) {
    const entry = {
      id: Date.now() + Math.random(),
      type: 'chat',
      role: role,
      content: content,
      model: model || 'auto',
      timestamp: Date.now()
    };
    this.data.conversations.push(entry);
    this.trim();
    this.save();
    this.addActivity(role === 'user' ? 'Sent message' : 'AI response', 'chat');
  },

  getConversations(limit) {
    const convs = this.data.conversations;
    return limit ? convs.slice(-limit) : convs;
  },

  clearConversations() {
    this.data.conversations = [];
    this.save();
  },

  addInsight(title, content, category) {
    const entry = {
      id: Date.now(),
      type: 'insight',
      title: title,
      content: content,
      category: category || 'general',
      timestamp: Date.now()
    };
    this.data.insights.push(entry);
    this.trim();
    this.save();
  },

  addStrategy(strategy) {
    strategy.id = Date.now();
    strategy.type = 'strategy';
    strategy.timestamp = Date.now();
    this.data.strategies.push(strategy);
    this.save();
    this.addActivity('Saved strategy: ' + strategy.name, 'trading');
  },

  getStrategies() {
    return this.data.strategies;
  },

  deleteStrategy(id) {
    this.data.strategies = this.data.strategies.filter(s => s.id !== id);
    this.save();
  },

  addJournalEntry(entry) {
    entry.id = Date.now();
    entry.type = 'journal';
    entry.timestamp = Date.now();
    this.data.journal.push(entry);
    this.save();
    this.addActivity('Added journal entry: ' + entry.pair, 'trading');
  },

  getJournal() {
    return this.data.journal.sort((a, b) => b.timestamp - a.timestamp);
  },

  deleteJournalEntry(id) {
    this.data.journal = this.data.journal.filter(j => j.id !== id);
    this.save();
  },

  addActivity(action, category) {
    const entry = {
      id: Date.now(),
      action: action,
      category: category || 'general',
      timestamp: Date.now()
    };
    this.data.activity.unshift(entry);
    if (this.data.activity.length > 50) {
      this.data.activity = this.data.activity.slice(0, 50);
    }
    this.save();
    this.renderActivity();
  },

  getActivity() {
    return this.data.activity;
  },

  clearActivity() {
    this.data.activity = [];
    this.save();
    this.renderActivity();
  },

  renderActivity() {
    const list = document.getElementById('activityList');
    if (!list) return;

    const activities = this.getActivity();
    if (activities.length === 0) {
      list.innerHTML = '<div class="activity-empty">No recent activity</div>';
      return;
    }

    list.innerHTML = activities.slice(0, 10).map(a => {
      const time = new Date(a.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      return `<div class="activity-item">
        <span class="activity-time">${time}</span>
        <span class="activity-text">${escapeHtml(a.action)}</span>
      </div>`;
    }).join('');
  },

  search(query, filter) {
    const results = [];
    const q = query.toLowerCase();

    if (!filter || filter === 'all' || filter === 'chat') {
      this.data.conversations.forEach(c => {
        if (c.content.toLowerCase().includes(q)) {
          results.push({ ...c, source: 'Chat' });
        }
      });
    }

    if (!filter || filter === 'all' || filter === 'insight') {
      this.data.insights.forEach(i => {
        if (i.title.toLowerCase().includes(q) || i.content.toLowerCase().includes(q)) {
          results.push({ ...i, source: 'Insight' });
        }
      });
    }

    if (!filter || filter === 'all' || filter === 'trading') {
      this.data.strategies.forEach(s => {
        if (s.name.toLowerCase().includes(q)) {
          results.push({ ...s, source: 'Strategy' });
        }
      });
      this.data.journal.forEach(j => {
        if (j.pair && j.pair.toLowerCase().includes(q)) {
          results.push({ ...j, source: 'Journal' });
        }
      });
    }

    return results.sort((a, b) => b.timestamp - a.timestamp);
  },

  getSize() {
    const raw = localStorage.getItem(this.DB_KEY) || '';
    return raw.length;
  },

  updateStats() {
    const total = this.data.conversations.length + this.data.insights.length + 
                  this.data.strategies.length + this.data.journal.length;
    const sizeKB = (this.getSize() / 1024).toFixed(1);

    const elTotal = document.getElementById('memoryTotal');
    const elConvs = document.getElementById('memoryConversations');
    const elInsights = document.getElementById('memoryInsights');
    const elSize = document.getElementById('memorySize');
    const elFill = document.getElementById('memoryFill');
    const elText = document.getElementById('memoryText');

    if (elTotal) elTotal.textContent = total;
    if (elConvs) elConvs.textContent = this.data.conversations.length;
    if (elInsights) elInsights.textContent = this.data.insights.length;
    if (elSize) elSize.textContent = sizeKB + ' KB';

    const pct = Math.min((total / this.MAX_ENTRIES) * 100, 100);
    if (elFill) elFill.style.width = pct + '%';
    if (elText) elText.textContent = total + ' / ' + this.MAX_ENTRIES + ' entries';
  },

  trim() {
    const total = this.data.conversations.length + this.data.insights.length;
    if (total > this.MAX_ENTRIES) {
      const excess = total - this.MAX_ENTRIES;
      this.data.conversations = this.data.conversations.slice(Math.floor(excess / 2));
      this.data.insights = this.data.insights.slice(Math.floor(excess / 2));
    }
  },

  exportAll() {
    const data = {
      exportDate: new Date().toISOString(),
      version: '1.0.0',
      ...this.data
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'morgan_ai_backup_' + Date.now() + '.json';
    a.click();
    URL.revokeObjectURL(url);
    showToast('Data exported successfully', 'success');
  },

  clearAll() {
    this.data = {
      conversations: [],
      insights: [],
      strategies: [],
      journal: [],
      settings: {},
      activity: []
    };
    this.save();
    showToast('All memory cleared', 'info');
  }
};

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Init memory on load
Memory.init();
