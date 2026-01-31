import os
from flask import Flask, render_template, request, jsonify, Response
from llama_cpp import Llama
import json
import uuid
from datetime import datetime

app = Flask(__name__)

# Configuration
MODEL_DIR = "./models"
SESSIONS_FILE = "chat_sessions.json"
cur_model = None
model_path = None

# Global state
download_status = {
    "downloading": False,
    "progress": 0,
    "filename": "",
    "error": None
}

def get_models():
    models = []
    if os.path.exists(MODEL_DIR):
        for file in os.listdir(MODEL_DIR):
            if file.endswith(".gguf"):
                models.append(file)
    return models

def load_sessions_data():
    if not os.path.exists(SESSIONS_FILE):
        return {}
    try:
        with open(SESSIONS_FILE, 'r') as f:
            return json.load(f)
    except:
        return {}

def save_sessions_data(data):
    with open(SESSIONS_FILE, 'w') as f:
        json.dump(data, f, indent=2)

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/models', methods=['GET'])
def list_models():
    return jsonify(get_models())

@app.route('/api/load_model', methods=['POST'])
def load_model_route():
    global cur_model, model_path
    data = request.json
    selected_model = data.get('model')
    try:
        n_ctx = int(data.get('n_ctx', 8192))
        n_gpu_layers = int(data.get('n_gpu_layers', 0))
    except (ValueError, TypeError):
        n_ctx = 8192
        n_gpu_layers = 0

    if not selected_model:
        return jsonify({"error": "No model specified"}), 400
        
    full_path = os.path.join(MODEL_DIR, selected_model)
    
    if not os.path.exists(full_path):
        return jsonify({"error": "Model file not found"}), 404
        
    try:
        # Check if model path changed OR if context window changed OR if GPU layers changed
        # Note: Llama object doesn't expose n_gpu_layers easily to check, so we force reload if requested settings differ
        # For simplicity, we'll reload if the user clicks "Load" again with new settings.
        # In a more complex app, we'd track current config.
        
        cur_model = Llama(
            model_path=full_path,
            n_ctx=int(n_ctx),
            n_gpu_layers=n_gpu_layers,
            verbose=False
        )
        model_path = full_path
            
        return jsonify({"status": "success", "message": f"Loaded {selected_model}"})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/sessions', methods=['GET'])
def get_sessions():
    sessions = load_sessions_data()
    # Return list of summaries: {id, title, timestamp}
    summary_list = []
    for sid, sdata in sessions.items():
        summary_list.append({
            "id": sid,
            "title": sdata.get('title', 'New Chat'),
            "updated_at": sdata.get('updated_at', '')
        })
    # Sort by updated_at desc
    summary_list.sort(key=lambda x: x['updated_at'], reverse=True)
    return jsonify(summary_list)

@app.route('/api/sessions/<session_id>', methods=['GET'])
def get_session(session_id):
    sessions = load_sessions_data()
    if session_id in sessions:
        return jsonify(sessions[session_id])
    return jsonify({"error": "Session not found"}), 404

@app.route('/api/sessions', methods=['POST'])
def save_session():
    data = request.json
    session_id = data.get('id')
    sessions = load_sessions_data()
    
    timestamp = datetime.now().isoformat()
    
    if not session_id:
        session_id = str(uuid.uuid4())
        new_session = {
            "id": session_id,
            "title": data.get('title', 'New Chat'),
            "history": data.get('history', []),
            "created_at": timestamp,
            "updated_at": timestamp
        }
        sessions[session_id] = new_session
    else:
        if session_id not in sessions:
             # creating new with specific ID (unlikely but safe)
             sessions[session_id] = {
                "id": session_id,
                "created_at": timestamp 
             }
        
        sessions[session_id]["history"] = data.get('history', [])
        sessions[session_id]["title"] = data.get('title', sessions[session_id].get('title', 'New Chat'))
        sessions[session_id]["updated_at"] = timestamp

    save_sessions_data(sessions)
    return jsonify({"id": session_id, "status": "saved"})

@app.route('/api/sessions/<session_id>', methods=['DELETE'])
def delete_session(session_id):
    sessions = load_sessions_data()
    if session_id in sessions:
        del sessions[session_id]
        save_sessions_data(sessions)
        return jsonify({"status": "deleted"})
    return jsonify({"error": "Session not found"}), 404

import threading
import requests

def download_file_thread(url, dest_path):
    global download_status
    part_path = dest_path + ".part"
    try:
        resume_byte = 0
        if os.path.exists(part_path):
            resume_byte = os.path.getsize(part_path)
        
        headers = {}
        if resume_byte > 0:
            headers['Range'] = f'bytes={resume_byte}-'
        
        with requests.get(url, stream=True, headers=headers, timeout=30) as r:
            # If server doesn't support range, it will return 200 instead of 206
            if r.status_code == 416: # Range not satisfiable
                # Maybe the file is already complete? Or URL changed
                # Let's restart from scratch
                resume_byte = 0
                r = requests.get(url, stream=True, timeout=30)
                r.raise_for_status()
            elif r.status_code not in [200, 206]:
                r.raise_for_status()

            total_length = r.headers.get('content-length')
            if total_length:
                total_length = int(total_length) + resume_byte
            
            mode = 'ab' if (r.status_code == 206 and resume_byte > 0) else 'wb'
            if mode == 'wb':
                resume_byte = 0 # Reset if we are starting over

            with open(part_path, mode) as f:
                if total_length is None:
                    f.write(r.content)
                    download_status['progress'] = 100
                else:
                    dl = resume_byte
                    for data in r.iter_content(chunk_size=8192):
                        if not download_status['downloading']: # Allow stopping
                            break
                        dl += len(data)
                        f.write(data)
                        download_status['progress'] = int(100 * dl / total_length)
            
            if download_status['downloading']:
                # Verify size if possible
                if total_length and os.path.getsize(part_path) < total_length:
                    raise Exception("Download interrupted: File incomplete")
                
                # Move to final destination
                if os.path.exists(dest_path):
                    os.remove(dest_path)
                os.rename(part_path, dest_path)
                
                download_status['downloading'] = False
                download_status['progress'] = 100
                download_status['filename'] = os.path.basename(dest_path)
    except Exception as e:
        download_status['error'] = str(e)
        download_status['downloading'] = False

@app.route('/api/download_model', methods=['POST'])
def download_model():
    global download_status
    data = request.json
    url = data.get('url')
    
    if not url:
        return jsonify({"error": "No URL provided"}), 400
        
    if download_status['downloading']:
        return jsonify({"error": "Download in progress"}), 400

    from urllib.parse import urlparse
    parsed_url = urlparse(url)
    path = parsed_url.path
    
    # Handle Hugging Face blob -> resolve conversion
    if 'huggingface.co' in parsed_url.netloc and '/blob/' in path:
        url = url.replace('/blob/', '/resolve/')
        path = path.replace('/blob/', '/resolve/')

    filename = os.path.basename(path)
    
    if not filename.endswith('.gguf'):
        return jsonify({"error": "URL must point to a .gguf file"}), 400

    if not os.path.exists(MODEL_DIR):
        os.makedirs(MODEL_DIR)

    dest_path = os.path.join(MODEL_DIR, filename)
    
    # If file exists, check if it's actually there
    if os.path.exists(dest_path):
        # We could check size here, but for now let's just allow re-downloading if requested
        # or just return success if it's already there?
        # Let's check if the user wants to force it.
        pass

    download_status = {
        "downloading": True,
        "progress": 0,
        "filename": filename,
        "error": None
    }
    
    thread = threading.Thread(target=download_file_thread, args=(url, dest_path))
    thread.daemon = True # Ensure thread doesn't block exit
    thread.start()
    
    return jsonify({"status": "started", "filename": filename})

@app.route('/api/download_model/progress', methods=['GET'])
def download_progress():
    return jsonify(download_status)

@app.route('/api/chat', methods=['POST'])
def chat():
    global cur_model
    data = request.json
    message = data.get('message')
    history = data.get('history', [])
    system_prompt = data.get('system_prompt', "")
    
    try:
        max_tokens = int(data.get('max_tokens', 1500))
        temperature = float(data.get('temperature', 0.7))
        top_p = float(data.get('top_p', 0.95))
    except (ValueError, TypeError):
        max_tokens = 1500
        temperature = 0.7
        top_p = 0.95
    
    if not cur_model:
        return jsonify({"error": "Model not loaded"}), 400
    
    if not message:
         return jsonify({"error": "No message provided"}), 400

    messages = []
    
    if system_prompt:
        messages.append({"role": "system", "content": system_prompt})
    
    for h in history:
        messages.append({"role": "user", "content": h['user']})
        messages.append({"role": "assistant", "content": h['bot']})
    messages.append({"role": "user", "content": message})

    def generate():
        # State: 0=CHECKING, 1=SUPPRESSING, 2=STREAMING
        state = 0
        buffer = ""
        START_TAG = "<|channel|>analysis"
        END_TAG = "<|channel|>final<|message|>"
        
        start_time = datetime.now()
        tokens_generated = 0
        
        try:
            stream = cur_model.create_chat_completion(
                messages=messages,
                stream=True,
                max_tokens=max_tokens,
                temperature=temperature,
                top_p=top_p
            )
            for output in stream:
                if 'choices' in output and len(output['choices']) > 0:
                     delta = output['choices'][0]['delta']
                     if 'content' in delta:
                        content = delta['content']
                        tokens_generated += 1
                        
                        if state == 2: # STREAMING
                            yield content
                            continue
                        
                        buffer += content
                        
                        if state == 0: # CHECKING
                            # If buffer fully matches START_TAG, switch to suppressing
                            if buffer.startswith(START_TAG):
                                state = 1
                            # If buffer deviates from START_TAG (and isn't just a partial match)
                            # partial match means START_TAG starts with buffer
                            elif not START_TAG.startswith(buffer):
                                # It's a normal message, flush buffer and stream
                                yield buffer
                                state = 2
                                buffer = ""
                                
                        if state == 1: # SUPPRESSING
                            # Look for END_TAG in buffer
                            if END_TAG in buffer:
                                # Found the end of analysis, yield everything after it
                                parts = buffer.split(END_TAG, 1)
                                yield parts[1]
                                state = 2
                                buffer = ""

            # Calculate metrics
            end_time = datetime.now()
            duration = (end_time - start_time).total_seconds()
            tps = tokens_generated / duration if duration > 0 else 0
            
            stats = {
                "duration": round(duration, 2),
                "tokens": tokens_generated,
                "tps": round(tps, 2)
            }
            yield f"\n\n<|METADATA|>{json.dumps(stats)}"

        except Exception as e:
             yield f"Error: {str(e)}"

    return Response(generate(), mimetype='text/plain')
    
if __name__ == '__main__':
    app.run(debug=True, port=5000)
