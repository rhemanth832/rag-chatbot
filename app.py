import os
import hashlib
from flask import Flask, request, jsonify, render_template
from groq import Groq
from werkzeug.utils import secure_filename
import pdfplumber
import docx
from dotenv import load_dotenv

load_dotenv()

app = Flask(__name__)
app.config['UPLOAD_FOLDER'] = 'uploads'
app.config['MAX_CONTENT_LENGTH'] = 16 * 1024 * 1024  # 16MB max

ALLOWED_EXTENSIONS = {'txt', 'pdf', 'docx', 'md'}

document_store = {}
chat_history = []

groq_client = Groq(api_key=os.getenv("GROQ_API_KEY"))


def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS


def extract_text(filepath, filename):
    ext = filename.rsplit('.', 1)[1].lower()
    text = ""

    if ext in ('txt', 'md'):
        with open(filepath, 'r', encoding='utf-8', errors='ignore') as f:
            text = f.read()

    elif ext == 'pdf':
        # pdfplumber handles modern/scanned PDFs far better than PyPDF2
        with pdfplumber.open(filepath) as pdf:
            for page in pdf.pages:
                page_text = page.extract_text()
                if page_text:
                    text += page_text + "\n"

    elif ext == 'docx':
        doc = docx.Document(filepath)
        text = "\n".join([para.text for para in doc.paragraphs])

    return text.strip()


def chunk_text(text, chunk_size=800, overlap=100):
    chunks = []
    start = 0
    while start < len(text):
        end = min(start + chunk_size, len(text))
        chunks.append(text[start:end])
        start += chunk_size - overlap
    return chunks


def simple_search(query, top_k=4):
    query_words = set(query.lower().split())
    scored_chunks = []
    for doc_id, doc_data in document_store.items():
        for chunk in doc_data['chunks']:
            chunk_words = set(chunk.lower().split())
            score = len(query_words & chunk_words)
            if score > 0:
                scored_chunks.append({
                    'text': chunk,
                    'score': score,
                    'source': doc_data['filename']
                })
    scored_chunks.sort(key=lambda x: x['score'], reverse=True)
    return scored_chunks[:top_k]


@app.route('/')
def index():
    return render_template('index.html')


@app.route('/upload', methods=['POST'])
def upload_file():
    if 'file' not in request.files:
        return jsonify({'error': 'No file part'}), 400
    file = request.files['file']
    if file.filename == '':
        return jsonify({'error': 'No selected file'}), 400
    if file and allowed_file(file.filename):
        filename = secure_filename(file.filename)
        os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)
        filepath = os.path.join(app.config['UPLOAD_FOLDER'], filename)
        file.save(filepath)
        text = extract_text(filepath, filename)
        if not text:
            return jsonify({'error': 'Could not extract text from file'}), 400
        chunks = chunk_text(text)
        doc_id = hashlib.md5(filename.encode()).hexdigest()
        document_store[doc_id] = {
            'filename': filename,
            'chunks': chunks,
            'total_chars': len(text)
        }
        return jsonify({
            'success': True,
            'filename': filename,
            'chunks': len(chunks),
            'doc_id': doc_id
        })
    return jsonify({'error': 'File type not allowed'}), 400


@app.route('/documents', methods=['GET'])
def list_documents():
    docs = [
        {'id': doc_id, 'filename': data['filename'], 'chunks': len(data['chunks'])}
        for doc_id, data in document_store.items()
    ]
    return jsonify({'documents': docs})


@app.route('/delete/<doc_id>', methods=['DELETE'])
def delete_document(doc_id):
    if doc_id in document_store:
        del document_store[doc_id]
        return jsonify({'success': True})
    return jsonify({'error': 'Document not found'}), 404


@app.route('/chat', methods=['POST'])
def chat():
    data = request.get_json()
    user_message = data.get('message', '').strip()
    if not user_message:
        return jsonify({'error': 'Empty message'}), 400

    context_chunks = simple_search(user_message)
    context = ""
    sources = []

    if context_chunks:
        context_parts = []
        for chunk in context_chunks:
            context_parts.append(f"[From: {chunk['source']}]\n{chunk['text']}")
            if chunk['source'] not in sources:
                sources.append(chunk['source'])
        context = "\n\n---\n\n".join(context_parts)

    if context:
        system_prompt = f"""You are a helpful RAG assistant. Answer the user's question using the provided context documents.
Be accurate, concise, and cite which document your information comes from when relevant.
If the context doesn't contain relevant information, say so and answer from general knowledge.

CONTEXT DOCUMENTS:
{context}"""
    else:
        system_prompt = """You are a helpful AI assistant. No documents have been uploaded yet, so answer from your general knowledge.
Encourage the user to upload documents for more specific, context-aware answers."""

    chat_history.append({"role": "user", "content": user_message})
    messages_to_send = chat_history[-10:]

    try:
        response = groq_client.chat.completions.create(
            model="llama-3.1-8b-instant",
            messages=[
                {"role": "system", "content": system_prompt},
                *messages_to_send
            ],
            temperature=0.6,
            max_tokens=1024,
        )
        assistant_message = response.choices[0].message.content
        chat_history.append({"role": "assistant", "content": assistant_message})
        return jsonify({
            'response': assistant_message,
            'sources': sources,
            'context_found': len(context_chunks) > 0
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/clear', methods=['POST'])
def clear_history():
    global chat_history
    chat_history = []
    return jsonify({'success': True})


if __name__ == '__main__':
    os.makedirs('uploads', exist_ok=True)
    app.run(debug=True, host='0.0.0.0', port=5000)