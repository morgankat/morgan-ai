// ===== MORGAN AI - VOICE ENGINE =====

let recognition = null;
let isListening = false;
let wakeWordEnabled = false;

function initVoice() {
  if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
    document.getElementById('voiceStatus').textContent = 'Not supported on this device';
    document.getElementById('voiceOrb').style.opacity = '0.5';
    return;
  }

  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  recognition = new SpeechRecognition();
  recognition.continuous = false;
  recognition.interimResults = true;
  recognition.lang = document.getElementById('voiceLang')?.value || 'en-US';

  recognition.onstart = () => {
    isListening = true;
    document.getElementById('voiceOrb').classList.add('listening');
    document.getElementById('voiceStatus').textContent = 'Listening...';
  };

  recognition.onresult = (event) => {
    let transcript = '';
    for (let i = event.resultIndex; i < event.results.length; i++) {
      transcript += event.results[i][0].transcript;
    }
    document.getElementById('voiceTranscript').textContent = transcript;

    if (event.results[event.results.length - 1].isFinal) {
      handleVoiceCommand(transcript);
    }
  };

  recognition.onerror = (event) => {
    console.error('Voice error:', event.error);
    document.getElementById('voiceStatus').textContent = 'Error: ' + event.error;
    stopVoice();
  };

  recognition.onend = () => {
    stopVoice();
  };
}

function toggleVoice() {
  if (!recognition) {
    initVoice();
  }

  if (isListening) {
    recognition.stop();
  } else {
    try {
      recognition.lang = document.getElementById('voiceLang')?.value || 'en-US';
      recognition.start();
    } catch (e) {
      showToast('Voice error: ' + e.message, 'error');
    }
  }
}

function stopVoice() {
  isListening = false;
  const orb = document.getElementById('voiceOrb');
  if (orb) orb.classList.remove('listening');
  const status = document.getElementById('voiceStatus');
  if (status) status.textContent = 'Tap to speak';
}

function handleVoiceCommand(transcript) {
  const text = transcript.trim().toLowerCase();

  if (text.includes('open chat') || text.includes('talk to morgan')) {
    navigateTo('chat');
    showToast('Opening chat...', 'info');
  } else if (text.includes('open trading') || text.includes('trading assistant')) {
    navigateTo('trading');
    showToast('Opening trading assistant...', 'info');
  } else if (text.includes('open settings')) {
    navigateTo('settings');
    showToast('Opening settings...', 'info');
  } else if (text.includes('open dashboard') || text.includes('go home')) {
    navigateTo('dashboard');
    showToast('Opening dashboard...', 'info');
  } else {
    // Send to AI chat
    navigateTo('chat');
    setTimeout(() => {
      const input = document.getElementById('chatInput');
      if (input) {
        input.value = transcript;
        sendMessage();
      }
    }, 300);
  }
}

function toggleVoiceInput() {
  navigateTo('voice');
  setTimeout(toggleVoice, 300);
}

function toggleWakeWord() {
  wakeWordEnabled = !wakeWordEnabled;
  const toggle = document.getElementById('wakeWordToggle');
  if (toggle) toggle.classList.toggle('on', wakeWordEnabled);
  showToast(wakeWordEnabled ? 'Wake word enabled (say "Hey Morgan")' : 'Wake word disabled', 'info');
}

function speak(text) {
  if (!('speechSynthesis' in window)) return;

  const feedbackToggle = document.getElementById('voiceFeedbackToggle');
  if (feedbackToggle && !feedbackToggle.classList.contains('on')) return;

  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = document.getElementById('voiceLang')?.value || 'en-US';
  utterance.rate = 1.0;
  utterance.pitch = 1.0;
  window.speechSynthesis.speak(utterance);
}

// Init voice on load
setTimeout(initVoice, 1000);
