// ===== MORGAN AI - VOICE MODULE =====
// Text-to-speech (Morgan speaks) + speech-to-text (listens) + barge-in interrupt.
// Hooks into existing chatMessages, chatInput, sendBtn, voiceOrb, etc. — no
// changes needed to app.js or ai.js.

const Voice = {
  recognition: null,
  isListening: false,
  wakeWordMode: false,
  synth: window.speechSynthesis,
  lang: localStorage.getItem('morgan_voiceLang') || 'en-US',

  init() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      console.warn('Speech recognition not supported on this browser.');
      return;
    }

    this.recognition = new SpeechRecognition();
    this.recognition.continuous = true;
    this.recognition.interimResults = true;
    this.recognition.lang = this.lang;

    this.recognition.onresult = (event) => this.handleResult(event);
    this.recognition.onerror = (event) => this.handleError(event);
    this.recognition.onend = () => this.handleEnd();

    const langSelect = document.getElementById('voiceLang');
    if (langSelect) {
      langSelect.value = this.lang;
      langSelect.addEventListener('change', () => {
        this.lang = langSelect.value;
        localStorage.setItem('morgan_voiceLang', this.lang);
        if (this.recognition) this.recognition.lang = this.lang;
      });
    }
    // Note: speaking replies is triggered explicitly by app.js's sendMessage()
    // via the global speak() function below — kept as a single source so
    // Morgan doesn't say each reply twice.
  },

  voiceFeedbackOn() {
    const toggle = document.getElementById('voiceFeedbackToggle');
    return !toggle || toggle.classList.contains('on');
  },

  // ---- Speaking (text-to-speech) ----
  speak(text) {
    if (!this.synth) return;
    this.synth.cancel(); // stop any current speech first
    const cleanText = text.replace(/[*_#`]/g, ''); // strip markdown symbols
    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.lang = this.lang;
    utterance.rate = 1.0;
    utterance.pitch = 1.05;
    utterance.onstart = () => this.setOrbState('speaking');
    utterance.onend = () => this.setOrbState('idle');
    this.synth.speak(utterance);
  },

  stopSpeaking() {
    if (this.synth) this.synth.cancel();
    this.setOrbState('idle');
  },

  // ---- Listening (speech-to-text) ----
  toggleVoiceInput() {
    if (!this.recognition) {
      alert('Voice input is not supported on this browser.');
      return;
    }
    if (this.isListening) {
      this.stopListening();
    } else {
      this.startListening('chat');
    }
  },

  toggleVoice() {
    if (!this.recognition) {
      alert('Voice input is not supported on this browser.');
      return;
    }
    if (this.isListening) {
      this.stopListening();
    } else {
      this.startListening('orb');
    }
  },

  toggleWakeWord() {
    const toggle = document.getElementById('wakeWordToggle');
    this.wakeWordMode = !this.wakeWordMode;
    if (toggle) toggle.classList.toggle('on', this.wakeWordMode);

    if (this.wakeWordMode) {
      this.startListening('wake');
    } else if (this.isListening) {
      this.stopListening();
    }
  },

  startListening(mode) {
    // Barge-in: if Morgan is currently speaking, stop immediately when the user starts talking
    this.stopSpeaking();

    this.isListening = true;
    this.mode = mode;
    this.setOrbState('listening');

    const statusEl = document.getElementById('voiceStatus');
    if (statusEl) statusEl.textContent = mode === 'wake' ? 'Listening for "Morgan"...' : 'Listening...';

    try {
      this.recognition.start();
    } catch (e) {
      // already started — ignore
    }
  },

  stopListening() {
    this.isListening = false;
    this.setOrbState('idle');
    const statusEl = document.getElementById('voiceStatus');
    if (statusEl) statusEl.textContent = 'Tap to speak';
    if (this.recognition) {
      try { this.recognition.stop(); } catch (e) {}
    }
  },

  handleResult(event) {
    let interim = '';
    let final = '';

    for (let i = event.resultIndex; i < event.results.length; i++) {
      const transcript = event.results[i][0].transcript;
      if (event.results[i].isFinal) {
        final += transcript;
      } else {
        interim += transcript;
      }
    }

    const transcriptEl = document.getElementById('voiceTranscript');
    if (transcriptEl) transcriptEl.textContent = final || interim;

    if (this.mode === 'wake') {
      const heard = (final || interim).toLowerCase();
      if (heard.includes('morgan')) {
        // Wake word detected — switch into active listening for the actual command
        this.mode = 'orb';
        const statusEl = document.getElementById('voiceStatus');
        if (statusEl) statusEl.textContent = "Yes? I'm listening...";
        if (transcriptEl) transcriptEl.textContent = '';
      }
      return;
    }

    if (final) {
      this.handleFinalTranscript(final.trim());
    }
  },

  handleFinalTranscript(text) {
    if (!text) return;

    // "Stop talking" / "close" commands — silence Morgan completely
    const lower = text.toLowerCase();
    if (/\b(stop talking|be quiet|stop listening|close everything|go away|shut up)\b/.test(lower)) {
      this.stopSpeaking();
      this.stopListening();
      if (this.wakeWordMode) {
        this.wakeWordMode = false;
        const toggle = document.getElementById('wakeWordToggle');
        if (toggle) toggle.classList.remove('on');
      }
      return;
    }

    const chatInput = document.getElementById('chatInput');
    if (chatInput) {
      chatInput.value = text;
    }

    if (typeof window.sendMessage === 'function') {
      window.sendMessage();
    }

    // Go back to wake-word listening if that mode was active, otherwise stop
    if (this.wakeWordMode) {
      this.mode = 'wake';
      const statusEl = document.getElementById('voiceStatus');
      if (statusEl) statusEl.textContent = 'Listening for "Morgan"...';
    } else {
      this.stopListening();
    }
  },

  handleError(event) {
    console.warn('Speech recognition error:', event.error);
    if (event.error === 'no-speech' && (this.wakeWordMode || this.isListening)) {
      // keep going — silence isn't a real error for continuous listening
      return;
    }
    this.stopListening();
  },

  handleEnd() {
    // Auto-restart if wake word mode or active listening is still supposed to be on
    if (this.wakeWordMode || this.isListening) {
      try { this.recognition.start(); } catch (e) {}
    } else {
      this.setOrbState('idle');
    }
  },

  setOrbState(state) {
    const orb = document.getElementById('voiceOrb');
    const waves = document.getElementById('voiceWaves');
    if (orb) orb.classList.remove('listening', 'speaking', 'idle');
    if (orb) orb.classList.add(state);
    if (waves) waves.style.display = state === 'listening' ? 'flex' : 'none';
  }
};

// Global functions referenced directly by index.html onclick handlers
// and by app.js after each AI reply
function toggleVoiceInput() { Voice.toggleVoiceInput(); }
function toggleVoice() { Voice.toggleVoice(); }
function toggleWakeWord() { Voice.toggleWakeWord(); }
function speak(text) { Voice.speak(text); }
function stopSpeaking() { Voice.stopSpeaking(); }

document.addEventListener('DOMContentLoaded', () => Voice.init());
