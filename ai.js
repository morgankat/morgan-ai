// ===== MORGAN AI - AI ENGINE =====
// BazaarLink API integration with smart model routing

const AI = {
  baseUrl: localStorage.getItem('morgan_baseUrl') || 'https://bazaarlink.ai/api/v1',
  apiKey: localStorage.getItem('morgan_apiKey') || '',

  models: {
    'openai/gpt-5.1': {
      name: 'GPT-5.1',
      strengths: ['reasoning', 'coding', 'planning', 'general'],
      temperature: 0.7
    },
    'anthropic/claude-sonnet-4': {
      name: 'Claude Sonnet',
      strengths: ['code', 'analysis', 'long_docs'],
      temperature: 0.5
    },
    'google/gemini-2.5-pro': {
      name: 'Gemini Pro',
      strengths: ['vision', 'multimodal', 'documents'],
      temperature: 0.6
    },
    'deepseek/deepseek-r1': {
      name: 'DeepSeek R1',
      strengths: ['math', 'technical', 'reasoning'],
      temperature: 0.3
    },
    'meta/llama-4': {
      name: 'Llama 4',
      strengths: ['fast', 'general'],
      temperature: 0.8
    }
  },

  // Smart routing based on query content
  routeModel(message, hasImage) {
    const m = message.toLowerCase();

    if (hasImage) return 'google/gemini-2.5-pro';

    if (/\b(code|program|function|script|bug|error|debug|python|javascript|java|cpp|c\+\+|html|css|sql|api)\b/.test(m)) {
      return 'anthropic/claude-sonnet-4';
    }

    if (/\b(math|calculate|equation|formula|algebra|geometry|statistics|probability)\b/.test(m)) {
      return 'deepseek/deepseek-r1';
    }

    if (/\b(chart|image|screenshot|photo|picture|analyze.*image|describe.*image)\b/.test(m)) {
      return 'google/gemini-2.5-pro';
    }

    if (/\b(hello|hi|hey|how are you|what.*up|quick|fast)\b/.test(m) && message.length < 50) {
      return 'meta/llama-4';
    }

    return 'openai/gpt-5.1';
  },

  async sendMessage(message, modelOverride, imageData) {
    const model = modelOverride === 'auto' || !modelOverride 
      ? this.routeModel(message, !!imageData)
      : modelOverride;

    const settings = this.loadSettings();
    const temperature = parseFloat(settings.temperature) || 0.7;
    const maxTokens = parseInt(settings.maxTokens) || 4096;

    const body = {
      model: model,
      messages: [
        {
          role: 'system',
          content: `You are Morgan, a personal AI assistant specialized in trading analysis, coding, and general intelligence. You provide clear, actionable advice. When discussing trading, always emphasize risk management. Current time: ${new Date().toLocaleString()}`
        },
        ...this.buildContext(),
        {
          role: 'user',
          content: imageData 
            ? [{ type: 'text', text: message }, { type: 'image_url', image_url: { url: imageData } }]
            : message
        }
      ],
      temperature: temperature,
      max_tokens: maxTokens,
      stream: false
    };

    try {
      const response = await fetch(this.baseUrl + '/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + this.apiKey
        },
        body: JSON.stringify(body)
      });

      if (!response.ok) {
        const err = await response.text();
        throw new Error('API Error: ' + response.status + ' - ' + err);
      }

      const data = await response.json();
      const content = data.choices?.[0]?.message?.content || 'No response received.';

      // Save to memory
      Memory.addConversation('user', message, model);
      Memory.addConversation('assistant', content, model);

      return { content, model };
    } catch (error) {
      console.error('AI Error:', error);
      throw error;
    }
  },

  buildContext() {
    const convs = Memory.getConversations(10);
    const context = [];
    for (let i = 0; i < convs.length; i += 2) {
      if (convs[i]) context.push({ role: convs[i].role, content: convs[i].content });
      if (convs[i+1]) context.push({ role: convs[i+1].role, content: convs[i+1].content });
    }
    return context;
  },

  async analyzeChart(description, imageData) {
    const prompt = `Analyze this trading chart/scenario. Provide: 1) Key levels (support/resistance), 2) Trend direction, 3) Potential entry points, 4) Risk management suggestions, 5) Overall bias (bullish/bearish/neutral).\n\nChart info: ${description}`;
    return this.sendMessage(prompt, 'google/gemini-2.5-pro', imageData);
  },

  async summarizeNews(newsText) {
    const prompt = `Summarize this market news and provide trading implications. Format: 1) Key Points (bullet list), 2) Market Impact, 3) Trading Implications, 4) Risk Considerations.\n\nNews: ${newsText}`;
    return this.sendMessage(prompt, 'openai/gpt-5.1');
  },

  async analyzeStrategy(strategy) {
    const prompt = `Review this trading strategy and provide feedback on: 1) Strengths, 2) Weaknesses, 3) Risk management gaps, 4) Suggested improvements.\n\nStrategy: ${JSON.stringify(strategy)}`;
    return this.sendMessage(prompt, 'anthropic/claude-sonnet-4');
  },

  loadSettings() {
    return {
      temperature: localStorage.getItem('morgan_temperature') || '0.7',
      maxTokens: localStorage.getItem('morgan_maxTokens') || '4096',
      smartRouting: localStorage.getItem('morgan_smartRouting') !== 'false'
    };
  },

  testConnection() {
    return new Promise((resolve) => {
      if (!this.apiKey) {
        resolve(false);
        return;
      }

      fetch(this.baseUrl + '/models', {
        headers: { 'Authorization': 'Bearer ' + this.apiKey }
      })
      .then(r => resolve(r.ok))
      .catch(() => resolve(false));
    });
  }
};

// Update AI status indicator
async function updateAIStatus() {
  const dot = document.getElementById('aiIndicator');
  const text = document.getElementById('aiStatusText');
  const pill = document.getElementById('connectionPill');
  const connDot = document.getElementById('connDot');
  const connText = document.getElementById('connText');

  if (dot) dot.className = 'status-indicator';
  if (text) text.textContent = 'Checking...';
  if (connDot) connDot.className = 'conn-dot connecting';
  if (connText) connText.textContent = 'Connecting...';

  const isConnected = await AI.testConnection();

  if (isConnected) {
    if (dot) dot.className = 'status-indicator active';
    if (text) text.textContent = 'Online';
    if (connDot) connDot.className = 'conn-dot online';
    if (connText) connText.textContent = 'Online';
  } else {
    if (dot) dot.className = 'status-indicator error';
    if (text) text.textContent = 'No Key';
    if (connDot) connDot.className = 'conn-dot';
    if (connText) connText.textContent = 'Offline';
  }
}
