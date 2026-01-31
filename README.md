# ESCA-GGUF

A lightweight, local web interface for running and chatting with GGUF Large Language Models (LLMs) using `Flask` and `llama-cpp-python`. This project allows you to download models directly from Hugging Face, manage local model files, and chat with them using a clean web UI with streaming responses.

## Features

- **Local Inference**: Run LLMs locally on your machine using `llama-cpp-python`.
- **Model Management**: Download GGUF models directly via URL or drop them into the `models/` folder.
- **Streaming Responses**: Real-time token generation using Server-Sent Events (SSE) / chunked responses.
- **Session Management**: persistent chat history stored locally.
- **Customizable Parameters**: Adjust `max_tokens`, `temperature`, `top_p`, `n_ctx` (context window), and `n_gpu_layers`.
- **System Prompts**: Set custom system prompts to guide model behavior.

## Prerequisites

- Python 3.8+
- A C++ compiler (required for building `llama-cpp-python` wheels)
  - **Windows**: Visual Studio Community with C++ development tools.
  - **Linux/Mac**: GCC/Clang.

## Installation

1.  **Clone the repository:**
    ```bash
    git clone https://github.com/Esca-Byte/ESCA-GGUF.git
    cd ESCA-GGUF
    ```

2.  **Install dependencies:**
    It is recommended to use a virtual environment.
    ```bash
    # Create virtual environment
    python -m venv venv
    
    # Activate it
    # Windows:
    .\venv\Scripts\activate
    # Linux/Mac:
    source venv/bin/activate
    
    # Install packages
    pip install -r requirements.txt
    ```

    > **Note on Hardware Acceleration:** 
    > To enable GPU acceleration (CUDA, Metal, etc.), you must set specific environment variables before installing `llama-cpp-python`. Refer to the [llama-cpp-python documentation](https://github.com/abetlen/llama-cpp-python) for detailed instructions.
    >
    > *Example for NVIDIA GPU (Windows PowerShell):*
    > ```powershell
    > $env:CMAKE_ARGS = "-DGGML_CUDA=on"
    > pip install llama-cpp-python --upgrade --force-reinstall --no-cache-dir
    > ```

## Usage

1.  **Start the Server:**
    ```bash
    python app.py
    ```
    The application will start at `http://localhost:5000`.

2.  **Download a Model:**
    - Open the web interface.
    - Go to the "Models" section or use the Download feature.
    - Paste a direct download link to a `.gguf` file (e.g., from Hugging Face).
    - *Alternatively*, manually download `.gguf` files and place them in the `models/` directory.

3.  **Load a Model:**
    - Select a model from the dropdown list.
    - Adjust "Context Window" and "GPU Layers" if needed.
    - Click "Load Model".

4.  **Chat:**
    - Type your message and hit Enter.
    - Watch the response stream in real-time.

## Project Structure

- `app.py`: Main Flask application server.
- `models/`: Directory where `.gguf` files are stored.
- `templates/`: HTML templates (contains `index.html`).
- `static/`: Static assets (CSS/JS).
- `chat_sessions.json`: Local JSON store for chat history.

## API Endpoints

The backend provides a simple REST API:

- `GET /api/models`: List available models.
- `POST /api/load_model`: Load a specific model into memory.
- `POST /api/download_model`: Download a GGUF file from a URL.
- `GET /api/download_model/progress`: specific model download progress.
- `POST /api/chat`: Send a message and get a streaming response.
- `GET /api/sessions`: List chat sessions.
- `POST /api/sessions`: Create or update a session.

## License

[MIT License](LICENSE)
