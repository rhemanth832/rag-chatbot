// ─── State ───────────────────────────────────────────────────
let isLoading = false;
let documents = {};

// ─── Init ─────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  setupDragDrop();
  document.getElementById('fileInput').addEventListener('change', handleFileSelect);
  refreshDocs();
});

// ─── File Upload ──────────────────────────────────────────────
function setupDragDrop() {
  const zone = document.getElementById('uploadZone');
  zone.addEventListener('dragover', e => { e.preventDefault(); zone.classList.add('drag-over'); });
  zone.addEventListener('dragleave', () => zone.classList.remove('drag-over'));
  zone.addEventListener('drop', e => {
    e.preventDefault();
    zone.classList.remove('drag-over');
    const file = e.dataTransfer.files[0];
    if (file) uploadFile(file);
  });
  zone.addEventListener('click', e => {
    if (e.target.classList.contains('upload-link')) return;
    document.getElementById('fileInput').click();
  });
}

function handleFileSelect(e) {
  const file = e.target.files[0];
  if (file) uploadFile(file);
  e.target.value = '';
}

async function uploadFile(file) {
  const allowed = ['txt','pdf','docx','md'];
  const ext = file.name.split('.').pop().toLowerCase();
  if (!allowed.includes(ext)) {
    showToast('Only PDF, DOCX, TXT, MD allowed', 'error');
    return;
  }

  const progress = document.getElementById('uploadProgress');
  const bar = document.getElementById('uploadBar');
  progress.style.display = 'block';

  // Animate progress bar
  let pct = 0;
  const ticker = setInterval(() => {
    pct = Math.min(pct + 10, 85);
    bar.style.width = pct + '%';
  }, 80);

  const formData = new FormData();
  formData.append('file', file);

  try {
    const res = await fetch('/upload', { method: 'POST', body: formData });
    const data = await res.json();
    clearInterval(ticker);
    bar.style.width = '100%';

    if (data.success) {
      showToast(`✓ ${data.filename} (${data.chunks} chunks)`, 'success');
      refreshDocs();
    } else {
      showToast(data.error || 'Upload failed', 'error');
    }
  } catch (err) {
    clearInterval(ticker);
    showToast('Upload error', 'error');
  }

  setTimeout(() => {
    progress.style.display = 'none';
    bar.style.width = '0%';
  }, 800);
}

async function refreshDocs() {
  try {
    const res = await fetch('/documents');
    const data = await res.json();
    renderDocs(data.documents);
    updateRagBadge(data.documents.length > 0);
  } catch {}
}

function renderDocs(docs) {
  const list = document.getElementById('docList');
  const counter = document.getElementById('docCount');
  counter.textContent = docs.length;

  if (docs.length === 0) {
    list.innerHTML = '<li class="doc-empty">No documents yet</li>';
    return;
  }

  list.innerHTML = docs.map(doc => `
    <li class="doc-item">
      <span class="doc-name" title="${doc.filename}">📄 ${doc.filename}</span>
      <span class="doc-chunks">${doc.chunks}ch</span>
      <button class="doc-del" onclick="deleteDoc('${doc.id}')" title="Remove">✕</button>
    </li>
  `).join('');
}

async function deleteDoc(docId) {
  try {
    await fetch(`/delete/${docId}`, { method: 'DELETE' });
    refreshDocs();
  } catch {}
}

function updateRagBadge(active) {
  const badge = document.getElementById('ragBadge');
  badge.textContent = active ? 'RAG ON' : 'RAG OFF';
  badge.classList.toggle('active', active);
}

// ─── Chat ─────────────────────────────────────────────────────
function handleKey(e) {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    sendMessage();
  }
}

function autoResize(el) {
  el.style.height = 'auto';
  el.style.height = Math.min(el.scrollHeight, 160) + 'px';
}

async function sendMessage() {
  if (isLoading) return;
  const input = document.getElementById('userInput');
  const msg = input.value.trim();
  if (!msg) return;

  input.value = '';
  input.style.height = 'auto';

  // Remove welcome message if present
  const welcome = document.querySelector('.welcome-msg');
  if (welcome) welcome.remove();

  appendMessage('user', msg);
  const typingId = showTyping();
  setLoading(true);

  try {
    const res = await fetch('/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: msg })
    });
    const data = await res.json();
    removeTyping(typingId);

    if (data.error) {
      appendMessage('bot', '⚠️ ' + data.error, []);
    } else {
      appendMessage('bot', data.response, data.sources || []);
    }
  } catch (err) {
    removeTyping(typingId);
    appendMessage('bot', '⚠️ Network error. Is Flask running?', []);
  }

  setLoading(false);
}

function sendQuick(text) {
  document.getElementById('userInput').value = text;
  sendMessage();
}

function appendMessage(role, text, sources = []) {
  const container = document.getElementById('messages');
  const div = document.createElement('div');
  div.className = `msg ${role}`;

  const avatar = role === 'user' ? 'U' : '◈';
  const sourcesHtml = sources.length ? `
    <div class="msg-sources">
      ${sources.map(s => `<span class="source-chip">📎 ${s}</span>`).join('')}
    </div>` : '';

  div.innerHTML = `
    <div class="msg-avatar">${avatar}</div>
    <div class="msg-body">
      <div class="msg-bubble">${formatText(text)}</div>
      ${sourcesHtml}
    </div>
  `;
  container.appendChild(div);
  container.scrollTop = container.scrollHeight;
}

function formatText(text) {
  return text
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/`([^`]+)`/g, '<code style="background:rgba(255,255,255,0.07);padding:2px 5px;border-radius:4px;font-size:12px;">$1</code>')
    .replace(/\n/g, '<br>');
}

let typingCounter = 0;
function showTyping() {
  const id = 'typing-' + (++typingCounter);
  const container = document.getElementById('messages');
  const div = document.createElement('div');
  div.className = 'msg bot';
  div.id = id;
  div.innerHTML = `
    <div class="msg-avatar">◈</div>
    <div class="msg-body">
      <div class="msg-bubble typing-bubble">
        <div class="typing-dot"></div>
        <div class="typing-dot"></div>
        <div class="typing-dot"></div>
      </div>
    </div>
  `;
  container.appendChild(div);
  container.scrollTop = container.scrollHeight;
  return id;
}

function removeTyping(id) {
  const el = document.getElementById(id);
  if (el) el.remove();
}

function setLoading(state) {
  isLoading = state;
  document.getElementById('sendBtn').disabled = state;
  document.getElementById('userInput').disabled = state;
}

async function clearChat() {
  try {
    await fetch('/clear', { method: 'POST' });
  } catch {}
  const msgs = document.getElementById('messages');
  msgs.innerHTML = `
    <div class="welcome-msg">
      <div class="welcome-icon">◈</div>
      <h2>Hello, I'm RAGbot</h2>
      <p>Upload documents on the left, then ask me anything about them.</p>
      <div class="quick-prompts">
        <button onclick="sendQuick('Summarize the uploaded document')">Summarize document</button>
        <button onclick="sendQuick('What are the key points?')">Key points</button>
        <button onclick="sendQuick('What questions can I ask about this document?')">What can I ask?</button>
      </div>
    </div>
  `;
}

// ─── Toast ────────────────────────────────────────────────────
function showToast(msg, type = 'info') {
  const t = document.createElement('div');
  t.style.cssText = `
    position:fixed;bottom:24px;right:24px;z-index:999;
    padding:10px 16px;border-radius:8px;font-size:12px;
    font-family:'DM Mono',monospace;max-width:300px;
    animation:fadeUp 0.25s ease;
    background:${type === 'error' ? '#2a1010' : '#101f10'};
    border:1px solid ${type === 'error' ? '#ff6b6b' : '#b8ff57'};
    color:${type === 'error' ? '#ff6b6b' : '#b8ff57'};
  `;
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 3500);
}
