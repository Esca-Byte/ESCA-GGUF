// DOM Elements
const chatHistory = document.getElementById('chat-history');
const userInput = document.getElementById('user-input');
const sendBtn = document.getElementById('send-btn');
const stopBtn = document.getElementById('stop-btn');
const fileBtn = document.getElementById('file-btn');
const fileInput = document.getElementById('file-input');
const voiceBtn = document.getElementById('voice-btn');
const newChatBtn = document.getElementById('new-chat-btn');
const historyList = document.getElementById('history-list');
const exportBtn = document.getElementById('export-btn');

// Settings Elements
const settingsModal = document.getElementById('settings-modal');
const openSettingsBtn = document.getElementById('open-settings-btn');
const closeSettingsBtn = document.getElementById('close-settings-btn');
const saveSettingsBtn = document.getElementById('save-settings-btn');
const tabBtns = document.querySelectorAll('.tab-btn');
const tabContents = document.querySelectorAll('.tab-content');

// Params inputs
const ctxInput = document.getElementById('ctx-input');
const tokensInput = document.getElementById('tokens-input');
const tempInput = document.getElementById('temp-input');
const topPInput = document.getElementById('top-p-input');
const gpuLayersInput = document.getElementById('gpu-layers-input');
const systemPromptInput = document.getElementById('system-prompt-input');
const themeSelect = document.getElementById('theme-select');

// Appearance inputs
const fontFamilySelect = document.getElementById('font-family-select');
const fontSizeInput = document.getElementById('font-size-input');
const fontSizeVal = document.getElementById('font-size-val');
const accentColorValue = document.getElementById('accent-color-value');
const colorPresets = document.querySelectorAll('.color-preset');

// Values labels
const tempVal = document.getElementById('temp-val');
const topPVal = document.getElementById('top-p-val');
const ctxVal = document.getElementById('ctx-val');

// Model Downloader
const modelUrlInput = document.getElementById('model-url-input');
const downloadModelBtn = document.getElementById('download-model-btn');
const downloadProgressContainer = document.getElementById('download-progress-container');
const downloadProgressBar = document.getElementById('download-progress-bar');
const downloadStatusText = document.getElementById('download-status-text');

// State
let chatHistoryData = [];
let abortController = null;
let currentSessionId = null;
let downloadInterval = null;

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    initCustomDropdown();
    initSettingsModal();
    initSpeechRecognition();
    initAppearanceSettings();
    loadSettings(); // from local storage
    fetchModels();
    loadSessions();

    // Event Listeners
    tempInput.addEventListener('input', (e) => tempVal.textContent = e.target.value);
    topPInput.addEventListener('input', (e) => topPVal.textContent = e.target.value);
    ctxInput.addEventListener('change', (e) => ctxVal.textContent = e.target.value);
    fontSizeInput.addEventListener('input', (e) => {
        fontSizeVal.textContent = e.target.value + 'px';
        document.documentElement.style.setProperty('--font-size', e.target.value + 'px');
    });

    // Auto-resize textarea
    userInput.addEventListener('input', function () {
        this.style.height = 'auto';
        this.style.height = (this.scrollHeight) + 'px';
        sendBtn.disabled = this.value.trim() === '';
    });

    userInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    });

    sendBtn.addEventListener('click', sendMessage);
    stopBtn.addEventListener('click', stopResponse);
    fileBtn.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', handleFileUpload);
    newChatBtn.addEventListener('click', startNewChat);
    exportBtn.addEventListener('click', exportChat);

    downloadModelBtn.addEventListener('click', startModelDownload);

    // Configure Marked.js
    const renderer = new marked.Renderer();
    renderer.code = function (code, language) {
        const lang = language || 'plaintext';
        const validLang = hljs.getLanguage(lang) ? lang : 'plaintext';
        const highlighted = hljs.highlight(code, { language: validLang }).value;

        return `
        <div class="code-block-wrapper">
            <div class="code-block-header">
                <span class="code-lang">${lang}</span>
                <button class="copy-btn" onclick="copyCode(this)">
                    <span class="copy-icon">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"></path>
                            <rect x="8" y="2" width="8" height="4" rx="1" ry="1"></rect>
                        </svg>
                    </span>
                    <span class="copy-text">Copy</span>
                </button>
            </div>
            <pre><code class="hljs language-${validLang}">${highlighted}</code></pre>
            <textarea class="code-raw" style="display:none;">${code}</textarea>
        </div>
        `;
    };
    marked.setOptions({ renderer: renderer });
});

/* --- Appearance Settings --- */
function initAppearanceSettings() {
    colorPresets.forEach(btn => {
        btn.addEventListener('click', () => {
            colorPresets.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            const color = btn.dataset.color;
            accentColorValue.value = color;
            applyAccentColor(color);
        });
    });

    fontFamilySelect.addEventListener('change', (e) => {
        document.documentElement.style.setProperty('--font-family', e.target.value);
    });
}

function applyAccentColor(color) {
    document.documentElement.style.setProperty('--accent-color', color);
    // Calculate hover color (slightly darker)
    const hoverColor = adjustColor(color, -20);
    document.documentElement.style.setProperty('--accent-hover', hoverColor);
    // Calculate subtle color (low opacity)
    document.documentElement.style.setProperty('--accent-subtle', color + '1a'); // 1a is ~10% opacity in hex
}

function adjustColor(hex, amt) {
    let usePound = false;
    if (hex[0] == "#") {
        hex = hex.slice(1);
        usePound = true;
    }
    let num = parseInt(hex, 16);
    let r = (num >> 16) + amt;
    if (r > 255) r = 255; else if (r < 0) r = 0;
    let b = ((num >> 8) & 0x00FF) + amt;
    if (b > 255) b = 255; else if (b < 0) b = 0;
    let g = (num & 0x0000FF) + amt;
    if (g > 255) g = 255; else if (g < 0) g = 0;
    return (usePound ? "#" : "") + (g | (b << 8) | (r << 16)).toString(16).padStart(6, '0');
}

/* --- Settings Modal & Logic --- */
function initSettingsModal() {
    const modal = document.getElementById('settings-modal');
    const closeBtn = document.getElementById('close-settings-btn');
    const saveBtn = document.getElementById('save-settings-btn');
    const openBtn = document.getElementById('open-settings-btn');

    if (!modal || !openBtn) return;

    openBtn.addEventListener('click', () => {
        modal.classList.remove('hidden');
    });

    if (closeBtn) {
        closeBtn.addEventListener('click', () => {
            modal.classList.add('hidden');
        });
    }

    if (saveBtn) {
        saveBtn.addEventListener('click', () => {
            try {
                saveSettings();
            } catch (e) {
                console.error("Failed to save settings:", e);
            }
            modal.classList.add('hidden');
        });
    }

    // Tabs
    const tabBtns = document.querySelectorAll('.tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');
    
    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            tabBtns.forEach(b => b.classList.remove('active'));
            tabContents.forEach(c => c.classList.remove('active'));
            btn.classList.add('active');
            const target = document.getElementById(btn.dataset.tab);
            if (target) target.classList.add('active');
        });
    });
}

function saveSettings() {
    const settings = {
        ctx: ctxInput.value,
        tokens: tokensInput.value,
        temp: tempInput.value,
        topP: topPInput.value,
        gpuLayers: gpuLayersInput.value,
        systemPrompt: systemPromptInput.value,
        theme: themeSelect.value,
        model: document.getElementById('model-select-value').value,
        fontFamily: fontFamilySelect.value,
        fontSize: fontSizeInput.value,
        accentColor: accentColorValue.value
    };
    localStorage.setItem('esca_settings', JSON.stringify(settings));

    // Apply Settings
    applyTheme(settings.theme);
    applyAccentColor(settings.accentColor);
    document.documentElement.style.setProperty('--font-family', settings.fontFamily);
    document.documentElement.style.setProperty('--font-size', settings.fontSize + 'px');
}

function loadSettings() {
    const saved = localStorage.getItem('esca_settings');
    if (saved) {
        const s = JSON.parse(saved);
        if (s.ctx) { ctxInput.value = s.ctx; ctxVal.textContent = s.ctx; }
        if (s.tokens) tokensInput.value = s.tokens;
        if (s.temp) { tempInput.value = s.temp; tempVal.textContent = s.temp; }
        if (s.topP) { topPInput.value = s.topP; topPVal.textContent = s.topP; }
        if (s.gpuLayers) gpuLayersInput.value = s.gpuLayers;
        if (s.systemPrompt) systemPromptInput.value = s.systemPrompt;
        if (s.theme) { themeSelect.value = s.theme; applyTheme(s.theme); }
        
        if (s.fontFamily) {
            fontFamilySelect.value = s.fontFamily;
            document.documentElement.style.setProperty('--font-family', s.fontFamily);
        }
        if (s.fontSize) {
            fontSizeInput.value = s.fontSize;
            fontSizeVal.textContent = s.fontSize + 'px';
            document.documentElement.style.setProperty('--font-size', s.fontSize + 'px');
        }
        if (s.accentColor) {
            accentColorValue.value = s.accentColor;
            applyAccentColor(s.accentColor);
            colorPresets.forEach(btn => {
                if (btn.dataset.color === s.accentColor) btn.classList.add('active');
                else btn.classList.remove('active');
            });
        }

        // Note: Model selection happens after fetchModels
    }
}

function applyTheme(themeName) {
    const link = document.getElementById('highlight-theme');
    if (link) link.href = `https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/styles/${themeName}.min.css`;
}


/* --- Speech to Text --- */
function initSpeechRecognition() {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
        if (voiceBtn) voiceBtn.style.display = 'none';
        return;
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = false;

    let isListening = false;

    if (voiceBtn) {
        voiceBtn.addEventListener('click', () => {
            if (isListening) {
                recognition.stop();
            } else {
                recognition.start();
            }
        });
    }

    recognition.onstart = () => {
        isListening = true;
        if (voiceBtn) {
            voiceBtn.style.color = '#ef4444'; // Red
            voiceBtn.classList.add('listening');
        }
    };

    recognition.onend = () => {
        isListening = false;
        if (voiceBtn) {
            voiceBtn.style.color = '';
            voiceBtn.classList.remove('listening');
        }
    };

    recognition.onresult = (event) => {
        const transcript = event.results[0][0].transcript;
        userInput.value += (userInput.value ? ' ' : '') + transcript;
        userInput.dispatchEvent(new Event('input'));
        userInput.focus();
    };

    recognition.onerror = (event) => {
        console.error("Speech error", event);
        isListening = false;
        if (voiceBtn) voiceBtn.style.color = '';
    };
}


/* --- Model Downloading --- */
async function startModelDownload() {
    const url = modelUrlInput.value.trim();
    if (!url) return;

    downloadModelBtn.disabled = true;
    downloadProgressContainer.classList.remove('hidden');

    try {
        const response = await fetch('/api/download_model', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url })
        });
        const data = await response.json();

        if (data.error) {
            alert(data.error);
            resetDownloadUI();
            return;
        }

        // Start polling
        downloadInterval = setInterval(pollDownloadProgress, 1000);

    } catch (e) {
        console.error(e);
        resetDownloadUI();
        alert("Request failed");
    }
}

async function pollDownloadProgress() {
    try {
        const res = await fetch('/api/download_model/progress');
        const status = await res.json();

        if (status.error) {
            clearInterval(downloadInterval);
            alert("Download Error: " + status.error);
            resetDownloadUI();
            return;
        }

        const pct = status.progress;
        downloadProgressBar.style.width = pct + '%';
        downloadStatusText.textContent = pct + '%';

        if (!status.downloading && pct === 100) {
            clearInterval(downloadInterval);
            downloadStatusText.innerHTML = `<span style="color:var(--success-color)">Completed!</span>`;

            // Refresh model list
            await fetchModels();
            downloadModelBtn.disabled = false;
            modelUrlInput.value = '';
        }

    } catch (e) {
        console.error(e);
        clearInterval(downloadInterval);
    }
}

function resetDownloadUI() {
    downloadModelBtn.disabled = false;
    downloadProgressContainer.classList.add('hidden');
    downloadProgressBar.style.width = '0%';
    downloadStatusText.textContent = '0%';
}


/* --- Copy Function --- */
window.copyCode = function (btn) {
    const wrapper = btn.closest('.code-block-wrapper');
    const code = wrapper.querySelector('.code-raw').value;
    const iconSpan = btn.querySelector('.copy-icon');
    const textSpan = btn.querySelector('.copy-text');

    navigator.clipboard.writeText(code).then(() => {
        const originalIcon = iconSpan.innerHTML;
        const originalText = textSpan.textContent;

        btn.classList.add('copied');
        iconSpan.innerHTML = `
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="20 6 9 17 4 12"></polyline>
            </svg>
        `;
        textSpan.textContent = 'Copied!';

        setTimeout(() => {
            btn.classList.remove('copied');
            iconSpan.innerHTML = originalIcon;
            textSpan.textContent = originalText;
        }, 2000);
    }).catch(err => {
        console.error('Failed to copy text: ', err);
    });
};

/* --- Custom Dropdown --- */
let modelsData = [];
function initCustomDropdown() {
    const wrapper = document.querySelector('.custom-select-wrapper');
    const trigger = document.getElementById('model-dropdown-trigger');

    if (!wrapper || !trigger) return;

    trigger.addEventListener('click', (e) => {
        e.stopPropagation();
        const isOpen = wrapper.classList.contains('open');
        
        // Close all other dropdowns if any exist
        document.querySelectorAll('.custom-select-wrapper').forEach(w => w.classList.remove('open'));
        
        if (!isOpen) {
            wrapper.classList.add('open');
            fetchModels(); // Refresh list whenever opened
        }
    });

    window.addEventListener('click', () => {
        if (wrapper.classList.contains('open')) {
            wrapper.classList.remove('open');
        }
    });
}

async function fetchModels() {
    const statusMsg = document.getElementById('model-load-status');
    const optionsList = document.getElementById('model-options-list');
    try {
        const response = await fetch('/api/models');
        modelsData = await response.json();

        optionsList.innerHTML = '';

        if (modelsData.length === 0) {
            const emptyDiv = document.createElement('div');
            emptyDiv.className = 'option';
            emptyDiv.textContent = 'No models found';
            optionsList.appendChild(emptyDiv);
            return;
        }

        modelsData.forEach(model => {
            const optionDiv = document.createElement('div');
            optionDiv.className = 'option';
            optionDiv.textContent = model;
            optionDiv.addEventListener('click', () => selectModel(model, optionDiv));
            optionsList.appendChild(optionDiv);
        });

        // Auto-select last used if present
        const saved = JSON.parse(localStorage.getItem('esca_settings') || '{}');
        if (saved.model && modelsData.includes(saved.model)) {
            selectModel(saved.model, null);
        }

    } catch (error) {
        console.error('Error fetching models:', error);
        if (statusMsg) statusMsg.textContent = 'Failed to load model list.';
    }
}

function selectModel(modelName, optionElement) {
    const triggerText = document.getElementById('selected-model-text');
    const hiddenInput = document.getElementById('model-select-value');

    if (triggerText) triggerText.textContent = modelName;
    if (hiddenInput) hiddenInput.value = modelName;

    document.querySelectorAll('.option').forEach(opt => opt.classList.remove('selected'));
    if (!optionElement) {
        Array.from(document.querySelectorAll('.option')).forEach(opt => {
            if (opt.textContent === modelName) opt.classList.add('selected');
        });
    } else {
        optionElement.classList.add('selected');
    }

    loadModel(modelName);
    saveSettings();
}

async function loadModel(modelName) {
    const statusMsg = document.getElementById('model-load-status');
    if (statusMsg) {
        statusMsg.textContent = `Loading...`;
        statusMsg.className = 'loading';
    }

    const nCtx = ctxInput ? ctxInput.value : 8192;
    const nGpu = gpuLayersInput ? gpuLayersInput.value : 0;

    try {
        const response = await fetch('/api/load_model', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model: modelName,
                n_ctx: nCtx,
                n_gpu_layers: nGpu
            })
        });

        const data = await response.json();

        if (response.ok) {
            if (statusMsg) {
                statusMsg.innerHTML = `Active <span style="font-size:0.8em; opacity:0.7">(${nGpu} GPU layers)</span>`;
                statusMsg.className = 'success';
            }
        } else {
            if (statusMsg) {
                statusMsg.textContent = `Error: ${data.error}`;
                statusMsg.className = 'error';
            }
        }
    } catch (error) {
        if (statusMsg) {
            statusMsg.textContent = `Connection Error`;
            statusMsg.className = 'error';
        }
    }
}

/* --- Sessions --- */
async function loadSessions() {
    try {
        const response = await fetch('/api/sessions');
        const sessions = await response.json();

        historyList.innerHTML = '';
        sessions.forEach(session => {
            const item = document.createElement('div');
            item.className = 'history-item';
            if (session.id === currentSessionId) item.classList.add('active');

            const title = document.createElement('span');
            title.textContent = session.title;
            item.appendChild(title);

            const delBtn = document.createElement('button');
            delBtn.innerHTML = '&times;';
            delBtn.className = 'delete-chat-btn';
            delBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                e.preventDefault();
                deleteSession(session.id);
            });
            item.appendChild(delBtn);

            item.onclick = () => loadSession(session.id);
            historyList.appendChild(item);
        });
    } catch (error) {
        console.error("Failed to load sessions", error);
    }
}

async function loadSession(sessionId) {
    if (abortController) stopResponse();

    try {
        const response = await fetch(`/api/sessions/${sessionId}`);
        const data = await response.json();

        if (data.error) return;

        currentSessionId = data.id;
        chatHistoryData = data.history || [];

        chatHistory.innerHTML = '';
        chatHistoryData.forEach(msg => {
            appendMessage('user', msg.user);
            const botMsgDiv = appendMessage('bot', '');
            botMsgDiv.innerHTML = marked.parse(msg.bot);
        });

        chatHistory.scrollTop = chatHistory.scrollHeight;
        loadSessions();

    } catch (error) {
        console.error("Error loading session:", error);
    }
}

function startNewChat() {
    if (abortController) stopResponse();
    currentSessionId = null;
    chatHistoryData = [];
    chatHistory.innerHTML = `
        <div class="welcome-msg">
            <h1>Ready to Chat?</h1>
            <p>Select a model in settings and start a new conversation.</p>
        </div>
    `;
    loadSessions();
}

async function deleteSession(sessionId) {
    if (!confirm("Delete this chat?")) return;
    try {
        const response = await fetch(`/api/sessions/${sessionId}`, { method: 'DELETE' });
        if (!response.ok) throw new Error("Failed to delete");

        if (currentSessionId === sessionId) {
            startNewChat();
        } else {
            loadSessions();
        }
    } catch (error) {
        console.error(error);
    }
}

async function saveCurrentSession() {
    let title = "New Chat";
    if (chatHistoryData.length > 0) {
        title = chatHistoryData[0].user.substring(0, 30) + (chatHistoryData[0].user.length > 30 ? "..." : "");
    }

    const payload = {
        id: currentSessionId,
        title: title,
        history: chatHistoryData.map(h => ({ user: h.user, bot: h.bot }))
    };

    try {
        const response = await fetch('/api/sessions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const data = await response.json();
        currentSessionId = data.id;
        loadSessions();
    } catch (e) {
        console.error("Failed to save session", e);
    }
}

/* --- Chat & Streaming --- */
function stopResponse() {
    if (abortController) {
        abortController.abort();
        abortController = null;
    }
    stopLoadingState();
}

function startLoadingState() {
    sendBtn.classList.add('hidden');
    stopBtn.classList.remove('hidden');
    userInput.disabled = true;
    userInput.style.opacity = '0.7';
}

function stopLoadingState() {
    sendBtn.classList.remove('hidden');
    stopBtn.classList.add('hidden');
    userInput.disabled = false;
    userInput.style.opacity = '1';
    userInput.focus();
    sendBtn.disabled = userInput.value.trim() === '';
}

async function sendMessage() {
    const text = userInput.value.trim();
    if (!text) return;

    userInput.value = '';
    userInput.style.height = 'auto';

    startLoadingState();
    appendMessage('user', text);
    const botMsgDiv = appendMessage('bot', '<span class="cursor"></span>');
    const metricsDiv = document.createElement('div');
    metricsDiv.className = 'metrics-display';
    botMsgDiv.parentElement.appendChild(metricsDiv);

    abortController = new AbortController();

    const maxTokens = tokensInput.value;
    const temperature = tempInput.value;
    const topP = topPInput.value;
    const systemPrompt = systemPromptInput.value;

    let botText = '';
    let finalMetadata = null;

    try {
        const apiHistory = chatHistoryData.map(h => ({ user: h.user, bot: h.bot }));

        const response = await fetch('/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                message: text,
                history: apiHistory,
                max_tokens: maxTokens,
                temperature: temperature,
                top_p: topP,
                system_prompt: systemPrompt
            }),
            signal: abortController.signal
        });

        if (!response.ok) throw new Error('Network error');

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let lastRenderTime = 0;
        const RENDER_INTERVAL = 50;

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const chunk = decoder.decode(value, { stream: true });

            if (chunk.includes('<|METADATA|>')) {
                const parts = chunk.split('<|METADATA|>');
                botText += parts[0];
                try {
                    finalMetadata = JSON.parse(parts[1]);
                } catch (e) { }
            } else {
                botText += chunk;
            }

            const now = Date.now();
            if (now - lastRenderTime > RENDER_INTERVAL) {
                botMsgDiv.innerHTML = marked.parse(botText);
                renderMath(botMsgDiv);
                chatHistory.scrollTop = chatHistory.scrollHeight;
                lastRenderTime = now;
            }
        }

        botMsgDiv.innerHTML = marked.parse(botText);
        renderMath(botMsgDiv);

        if (finalMetadata) {
            metricsDiv.textContent = `${finalMetadata.tokens} tokens in ${finalMetadata.duration}s (${finalMetadata.tps} t/s)`;
        }

        chatHistoryData.push({
            user: text,
            bot: botText
        });
        saveCurrentSession();

    } catch (error) {
        if (error.name === 'AbortError') {
            botMsgDiv.innerHTML = marked.parse(botText + " *[Stopped]*");
            chatHistoryData.push({ user: text, bot: botText + " *[Stopped]*" });
            saveCurrentSession();
        } else {
            botMsgDiv.innerHTML = `<p class="error-text">Error: ${error.message}</p>`;
        }
    } finally {
        stopLoadingState();
        abortController = null;
        chatHistory.scrollTop = chatHistory.scrollHeight;
    }
}

function appendMessage(role, text) {
    const welcome = document.querySelector('.welcome-msg');
    if (welcome) welcome.remove();

    const msgDiv = document.createElement('div');
    msgDiv.className = `message ${role}`;

    const iconDiv = document.createElement('div');
    iconDiv.className = 'avatar';
    iconDiv.innerHTML = role === 'user'
        ? '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>'
        : '<img src="/static/brain_logo.svg" alt="Esca" style="width: 100%; height: 100%; object-fit: contain;">';

    const contentDiv = document.createElement('div');
    contentDiv.className = 'content';
    if (role === 'user') contentDiv.textContent = text;
    else contentDiv.innerHTML = text;

    msgDiv.appendChild(iconDiv);
    msgDiv.appendChild(contentDiv);

    chatHistory.appendChild(msgDiv);
    chatHistory.scrollTop = chatHistory.scrollHeight;
    return contentDiv;
}

function handleFileUpload(e) {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function (e) {
        const content = e.target.result;
        const fileInfo = `\n\n--- Content of ${file.name} ---\n${content}\n--- End of ${file.name} ---\n\n`;
        userInput.value += fileInfo;
        userInput.style.height = 'auto';
        userInput.style.height = (userInput.scrollHeight) + 'px';
        sendBtn.disabled = false;
        fileInput.value = '';
    };
    reader.readAsText(file);
}

function exportChat() {
    if (chatHistoryData.length === 0) return;
    let content = `# Chat Export - ${new Date().toLocaleString()} \n\n`;
    chatHistoryData.forEach(msg => {
        content += `### User\n${msg.user} \n\n### Assistant\n${msg.bot} \n\n`;
    });
    const blob = new Blob([content], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `chat_export_${new Date().toISOString().slice(0, 10)}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

/* --- HF Browser & Prompt Library Logic --- */
function applyPersona(name, prompt) {
    const systemPromptInput = document.getElementById('system-prompt-input');
    if (systemPromptInput) {
        systemPromptInput.value = prompt;
        saveSettings();
        
        // Switch to Parameters tab to show it's applied
        const paramsTabBtn = document.querySelector('[data-tab="params-tab"]');
        if (paramsTabBtn) paramsTabBtn.click();
        
        // Visual feedback
        const btn = document.getElementById('save-settings-btn');
        const originalText = btn.textContent;
        btn.textContent = `Applied ${name}!`;
        btn.style.background = 'var(--success-color)';
        setTimeout(() => {
            btn.textContent = originalText;
            btn.style.background = '';
        }, 2000);
    }
}

// Global scope expose for onclick handlers
window.applyPersona = applyPersona;

function renderMath(element) {
    if (window.renderMathInElement) {
        renderMathInElement(element, {
            delimiters: [
                {left: '$$', right: '$$', display: true},
                {left: '$', right: '$', display: false},
                {left: '\\(', right: '\\)', display: false},
                {left: '\\begin{equation}', right: '\\end{equation}', display: true},
                {left: '\\begin{align}', right: '\\end{align}', display: true},
                {left: '\\begin{alignat}', right: '\\end{alignat}', display: true},
                {left: '\\begin{gather}', right: '\\end{gather}', display: true},
                {left: '\\begin{CD}', right: '\\end{CD}', display: true},
                {left: '\\[', right: '\\]', display: true}
            ],
            throwOnError : false
        });
    }
}

