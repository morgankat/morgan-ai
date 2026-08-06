// ===== MORGAN AI - AI ENGINE =====
// Routes through morgan-ai-proxy (Cloudflare Worker) so API keys stay hidden
// and requests aren't blocked by CORS.
// Default provider: Groq (fast, generous free tier).

const AI = {
  proxyUrl: 'https://morgan-ai-proxy.morgankaterega30.workers.dev',

  provider: localStorage.getItem('morgan_provider') || 'groq',

  models: {
    'llama-3.3-70b-versatile': {
      name: 'Llama 3.3 70B',
      provider: 'groq',
      strengths: ['reasoning', 'coding', 'planning', 'general'],
      temperature: 0.7
    },
    'llama-3.1-8b-instant': {
      name: 'Llama 3.1 8B (Fast)',
      provider: 'groq',
      strengths: ['fast', 'general'],
      temperature: 0.8
    },
    'deepseek-r1-distill-llama-70b': {
      name: 'DeepSeek R1 Distill',
      provider: 'groq',
      strengths: ['math', 'technical', 'reasoning'],
      temperature: 0.3
    },
    'gemma2-9b-it': {
      name: 'Gemma 2 9B',
      provider: 'groq',
      strengths: ['fast', 'general'],
      temperature: 0.7
    },
    'gemini-flash-latest': {
      name: 'Gemini Flash (vision)',
      provider: 'gemini',
      strengths: ['vision', 'multimodal', 'documents'],
      temperature: 0.6
    },
    'openai/gpt-5.1': {
      name: 'GPT-5.1 (BazaarLink)',
      provider: 'bazaarlink',
      strengths: ['reasoning', 'coding', 'planning', 'general'],
      temperature: 0.7
    }
  },

  // Smart routing based on query content — all default routes use Groq now
  routeModel(message, hasImage) {
    const m = message.toLowerCase();

    if (hasImage) return 'gemini-flash-latest';

    if (/\b(code|program|function|script|bug|error|debug|python|javascript|java|cpp|c\+\+|html|css|sql|api)\b/.test(m)) {
      return 'llama-3.3-70b-versatile';
    }

    if (/\b(math|calculate|equation|formula|algebra|geometry|statistics|probability)\b/.test(m)) {
      return 'deepseek-r1-distill-llama-70b';
    }

    if (/\b(chart|image|screenshot|photo|picture|analyze.*image|describe.*image)\b/.test(m)) {
      return 'gemini-flash-latest';
    }

    if (/\b(hello|hi|hey|how are you|what.*up|quick|fast)\b/.test(m) && message.length < 50) {
      return 'llama-3.1-8b-instant';
    }

    return 'llama-3.3-70b-versatile';
  },

  async sendMessage(message, modelOverride, imageData) {
    const model = modelOverride === 'auto' || !modelOverride
      ? this.routeModel(message, !!imageData)
      : modelOverride;

    const modelInfo = this.models[model];
    const provider = modelInfo ? modelInfo.provider : 'groq';

    const settings = this.loadSettings();
    const temperature = parseFloat(settings.temperature) || 0.7;
    const maxTokens = parseInt(settings.maxTokens) || 4096;

    const body = {
      provider: provider,
      model: model,
      messages: [
        {
          role: 'system',
          content: `You are Morgan — a sharp, warm, direct personal AI assistant with real personality. Talk like a knowledgeable friend, not a stiff corporate bot: show genuine reasoning, a bit of personality and humor where it fits, and skip generic AI hedging and disclaimers.

When analyzing charts or markets: read price action, candle patterns, structure, support/resistance, momentum and volume like an experienced trader would. Commit to a clear call — BUY, SELL, or WAIT, never "it could go either way." Always give concrete numbers: Entry, Stop Loss, and 1-2 Take Profit targets, plus a rough confidence read (e.g. "strong setup" vs "lower-confidence, wait for confirmation"). No trade call is ever 100% certain, so end with exactly ONE short risk-management line — not a paragraph of caveats.

For coding, planning, or anything else — be equally direct and useful. Current time: ${new Date().toLocaleString()}`
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

    const RETRYABLE_STATUSES = [429, 500, 502, 503, 504];
    const MAX_RETRIES = 3;

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        const response = await fetch(this.proxyUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(body)
        });

        if (!response.ok) {
          const errText = await response.text();

          // Don't retry permanent errors like "insufficient credits" or bad auth
          if (!RETRYABLE_STATUSES.includes(response.status) || attempt === MAX_RETRIES) {
            throw new Error('API Error: ' + response.status + ' - ' + errText);
          }

          // Wait longer each retry (1s, 2.5s, 5s), then try again
          await new Promise(r => setTimeout(r, [1000, 2500, 5000][attempt] || 5000));
          continue;
        }

        const data = await response.json();
        const content = data.choices?.[0]?.message?.content || 'No response received.';

        Memory.addConversation('user', message, model);
        Memory.addConversation('assistant', content, model);

        return { content, model };
      } catch (error) {
        if (attempt === MAX_RETRIES) {
          console.error('AI Error:', error);
          throw error;
        }
        // Network-level failure (e.g. "Failed to fetch") — also worth retrying
        await new Promise(r => setTimeout(r, [1000, 2500, 5000][attempt] || 5000));
      }
    }
  },

  async generateOrEditImage(prompt, imageDataUrl) {
    const body = { provider: 'gemini-image', prompt: prompt };

    if (imageDataUrl) {
      const match = imageDataUrl.match(/^data:(.+);base64,(.*)$/);
      if (match) {
        body.mimeType = match[1];
        body.imageBase64 = match[2];
      }
    }

    const response = await fetch(this.proxyUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error('Image generation error: ' + response.status + ' - ' + err);
    }

    const data = await response.json();
    if (data.imageBase64) {
      return {
        imageUrl: 'data:' + (data.mimeType || 'image/png') + ';base64,' + data.imageBase64,
        text: data.text || ''
      };
    }
    throw new Error(data.error || data.text || 'No image was returned.');
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
    return this.sendMessage(prompt, 'gemini-flash-latest', imageData);
  },

  async summarizeNews(newsText) {
    const prompt = `Summarize this market news and provide trading implications. Format: 1) Key Points (bullet list), 2) Market Impact, 3) Trading Implications, 4) Risk Considerations.\n\nNews: ${newsText}`;
    return this.sendMessage(prompt, 'llama-3.3-70b-versatile');
  },

  async analyzeStrategy(strategy) {
    const prompt = `Review this trading strategy and provide feedback on: 1) Strengths, 2) Weaknesses, 3) Risk management gaps, 4) Suggested improvements.\n\nStrategy: ${JSON.stringify(strategy)}`;
    return this.sendMessage(prompt, 'llama-3.3-70b-versatile');
  },

  loadSettings() {
    return {
      temperature: localStorage.getItem('morgan_temperature') || '0.7',
      maxTokens: localStorage.getItem('morgan_maxTokens') || '4096',
      smartRouting: localStorage.getItem('morgan_smartRouting') !== 'false'
    };
  },

  testConnection() {
    return fetch(this.proxyUrl, { method: 'GET' })
      .then(r => r.ok)
      .catch(() => false);
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
