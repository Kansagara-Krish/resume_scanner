# Resume Scanner - Full Setup Guide

This guide provides detailed instructions to set up the Resume Scanner project from scratch, including local AI integration via Ollama.

## 1. Prerequisites

Ensure you have the following installed on your system:
- **Node.js**: v18 or newer (required for the frontend)
- **pnpm**: `npm install -g pnpm`
- **Python**: v3.11 or newer (required for the backend)
- **PostgreSQL**: Local instance or a Docker container running
- **Docker & Docker Compose**: (Optional but recommended for simplified setup)
- **Google Cloud Assets**: API keys for Google Drive and Gmail (if using those integrations)

---

## 2. Ollama & Local LLM Setup

The Resume Scanner uses Ollama for local, privacy-focused resume parsing and intelligence.

### Installation
1.  **Download Ollama**: Visit [ollama.com](https://ollama.com) and download for your OS (macOS, Linux, or Windows).
2.  **Verify**: Open a terminal and run `ollama --version`.

### Model Preparation
By default, the project is configured to use `llama3:latest`.
1.  **Pull the model**:
    ```bash
    ollama pull llama3:latest
    ```
2.  **Alternative Models**: If you want to use a different model, pull it:
    ```bash
    ollama pull <model-name>
    ```

### Running Ollama
**Important**: As of the latest version, Ollama is **automatically managed by the backend**. You do **NOT** need to manually start it. The backend will:
- Automatically start Ollama when it launches
- Monitor Ollama's health and auto-restart if needed
- Gracefully stop Ollama when the backend shuts down

**Important**: Ensure Ollama is installed and available in your system PATH. The backend will handle the lifecycle automatically.

---

## 3. Database & Shared Infrastructure

1.  **Start PostgreSQL**: Ensure your database service is running and you have a connection string ready.
    - Example: `postgresql://user:password@localhost:5432/hr_copilot`
    - **Windows Users**: See [WINDOWS_SETUP.md](WINDOWS_SETUP.md) for detailed PostgreSQL installation
    
    Quick start (Windows with installed PostgreSQL):
    ```powershell
    Start-Service postgresql-x64-15
    psql -U postgres -c "CREATE DATABASE hr_copilot;"
    ```

---

## 4. Backend Setup (FastAPI)

1.  **Navigate to backend**:
    ```bash
    cd backend
    ```
2.  **Create Virtual Environment** (Recommended):
    ```bash
    python -m venv venv
    source venv/bin/activate  # On Windows: venv\Scripts\activate
    ```
3.  **Install Dependencies**:
    ```bash
    pip install -r requirements.txt
    ```
4.  **Configuration**:
    Create a `.env` file in the `backend/` directory:
    ```env
    DATABASE_URL="postgresql://user:password@localhost:5432/resume_scanner"
    OLLAMA_BASE_URL="http://localhost:11434"
    OLLAMA_MODEL="llama3:latest"
    SECRET_KEY="your_secure_random_key"
    ```
5.  **Initialize Database**:
    ```bash
    prisma generate
    prisma db push
    ```
6.  **Run Server**:
    ```bash
    uvicorn app.main:app --reload
    ```
    
    **Note**: The backend will automatically start Ollama when it launches. No manual Ollama startup is required. The Ollama process will be gracefully terminated when you stop the backend server.

---

## 5. Frontend Setup (Next.js)

1.  **Navigate to frontend**:
    ```bash
    cd frontend
    ```
2.  **Install Dependencies**:
    ```bash
    pnpm install
    ```
3.  **Configuration**:
    Create a `.env` file in the `frontend/` directory:
    ```env
    NEXT_PUBLIC_API_URL="http://localhost:8000/api/v1"
    ```
4.  **Sync Prisma Client**:
    ```bash
    pnpm prisma:generate
    ```
5.  **Run Development Server**:
    ```bash
    pnpm dev
    ```

---

## 6. Running with Docker (Quickest)

If you prefer using Docker, you can start everything with one command from the project root:
```bash
docker-compose up --build
```

**Note**: Ollama is automatically managed by the backend service within the Docker container. You do not need to run a separate Ollama service. Ensure the Ollama model has been pulled on the container's system (this can be added to the backend Dockerfile if needed).

---

## Troubleshooting

- **Ollama Not Starting**: Ensure Ollama is installed and available in your system PATH. You can verify this by running `ollama --version` in a terminal.
- **Model Not Found**: Make sure you have run `ollama pull <model_name>` for the exact model specified in your `.env` (default: `llama3:latest`).
- **Prisma Errors**: Ensure `DATABASE_URL` is correct and PostgreSQL is accepting connections.
- **Ollama Process Issues**: Check the backend logs for error messages. The backend will attempt to auto-restart Ollama if it crashes.
