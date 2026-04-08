# ◈ RAGbot — Chat with Your Documents

A lightweight **Retrieval-Augmented Generation (RAG)** chatbot built with Flask, Groq API (LLaMA 3), and vanilla HTML/CSS/JS. Upload PDF, DOCX, TXT, or Markdown files and ask questions — the bot retrieves relevant passages and answers with context.

---

## 🗂 Project Structure

```
rag-chatbot/
├── app.py                  # Flask backend + RAG logic
├── requirements.txt
├── Procfile                # For Render/Railway deployment
├── render.yaml             # Render deployment config
├── .env.example
├── .gitignore
├── uploads/                # Uploaded files (auto-created)
├── templates/
│   └── index.html          # Main UI
└── static/
    ├── css/style.css
    └── js/app.js
```

---

## ⚡ Quickstart (VS Code)

### 1. Get a Free Groq API Key

Go to [https://console.groq.com](https://console.groq.com) → Sign up → API Keys → Create key.

---

### 2. Open in VS Code & Set Up Environment

Open the **integrated terminal** in VS Code (`Ctrl+`` ` or `View → Terminal`) and run:

```bash
# Navigate into the project
cd rag-chatbot

# Create a virtual environment
python -m venv venv

# Activate it
# On Windows:
venv\Scripts\activate

# On macOS/Linux:
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt
```

---

### 3. Set Your API Key

```bash
# Windows (PowerShell)
$env:GROQ_API_KEY="your_key_here"

# Windows (CMD)
set GROQ_API_KEY=your_key_here

# macOS / Linux
export GROQ_API_KEY=your_key_here
```

> **Tip:** Create a `.env` file (copy from `.env.example`) and use the `python-dotenv` package to load it automatically, or set via VS Code's launch.json.

---

### 4. Run the App

```bash
python app.py
```

Open your browser at: **http://localhost:5000**

---

## 🖥 VS Code Tips

- **Run & Debug:** Press `F5` — create a `launch.json` (Python → Flask) for one-click run.
- **Auto-reload:** Flask runs in debug mode by default, so it auto-restarts on file saves.
- **Terminal shortcut:** `` Ctrl+` `` opens the integrated terminal.

---

## 🚀 Deploy to Render (Free Tier)

### Step 1 — Push to GitHub

```bash
git init
git add .
git commit -m "initial commit"
git remote add origin https://github.com/YOUR_USERNAME/rag-chatbot.git
git push -u origin main
```

### Step 2 — Create Web Service on Render

1. Go to [https://render.com](https://render.com) and sign in.
2. Click **New → Web Service**.
3. Connect your GitHub repo.
4. Render auto-detects `render.yaml` — no config needed.
5. In **Environment Variables**, add:
   - Key: `GROQ_API_KEY`
   - Value: your Groq API key
6. Click **Deploy**.

Your app will be live at `https://rag-chatbot.onrender.com` in ~2 minutes.

---

## 🚀 Deploy to Railway (Alternative)

```bash
# Install Railway CLI
npm install -g @railway/cli

# Login and deploy
railway login
railway init
railway up
railway variables set GROQ_API_KEY=your_key_here
```

---

## ⚙️ How RAG Works Here

```
User Question
     │
     ▼
Keyword Search across all uploaded document chunks
     │
     ▼
Top-4 most relevant chunks retrieved
     │
     ▼
Chunks injected as context into the system prompt
     │
     ▼
Groq API (LLaMA 3 8B) generates a grounded answer
     │
     ▼
Response shown with source file citations
```

---

## 📁 Supported File Types

| Format        | Extension |
| ------------- | --------- |
| Plain text    | `.txt`    |
| PDF           | `.pdf`    |
| Word document | `.docx`   |
| Markdown      | `.md`     |

Max file size: **16 MB**

---

## 🛠 Configuration

| Setting         | Default          | Location          |
| --------------- | ---------------- | ----------------- |
| LLM Model       | `llama3-8b-8192` | `app.py` line ~80 |
| Chunk size      | 800 chars        | `chunk_text()`    |
| Chunk overlap   | 100 chars        | `chunk_text()`    |
| Top-K retrieval | 4 chunks         | `simple_search()` |
| Max file size   | 16 MB            | `app.config`      |
| Port            | 5000             | `app.run()`       |

---

## 🔒 Notes

- Documents are stored **in-memory** — they reset when the server restarts. For production, swap to a vector database like ChromaDB, Pinecone, or Weaviate.
- Chat history is kept for the last 10 turns per session.
- The retrieval uses keyword overlap (no embeddings). For better semantic search, integrate `sentence-transformers`.

---

## 📦 Tech Stack

- **Backend:** Flask (Python)
- **LLM:** LLaMA 3 8B via Groq API
- **Frontend:** HTML5 + CSS3 + Vanilla JS
- **PDF parsing:** pdfplumber
- **DOCX parsing:** python-docx
- **Deployment:** Render / Railway

---

## 📄 License

MIT — free to use, modify, and deploy.
