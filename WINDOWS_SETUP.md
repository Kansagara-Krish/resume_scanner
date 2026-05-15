# Resume Scanner - Windows Setup Guide

This guide provides Windows-specific instructions for setting up PostgreSQL and running the complete project.

## Prerequisites Installed ✓
- Node.js v18+
- Python 3.12
- Ollama with llama3:latest model
- pnpm

---

## 1. PostgreSQL Setup for Windows

### Option A: PostgreSQL Windows Installer (Recommended)

1. **Download PostgreSQL**:
   - Visit: https://www.postgresql.org/download/windows/
   - Download PostgreSQL 15 or later

2. **Install PostgreSQL**:
   - Run the installer
   - During installation:
     - Port: `5432` (default)
     - Username: `postgres`
     - Password: `123` (matches your `.env`)
     - Data directory: Keep default
   - Finish installation

3. **Verify Installation**:
   ```powershell
   psql --version
   ```

4. **Start PostgreSQL Service** (if not running):
   ```powershell
   # Check service status
   Get-Service postgresql-x64-15 | Select-Object Status
   
   # Start the service
   Start-Service postgresql-x64-15
   ```

5. **Create Database**:
   ```powershell
   psql -U postgres -c "CREATE DATABASE hr_copilot;"
   ```
   When prompted, enter password: `123`

---

### Option B: WSL2 with PostgreSQL (Alternative)

If you have Windows Subsystem for Linux (WSL2) installed:

```bash
wsl
sudo apt update
sudo apt install postgresql postgresql-contrib -y
sudo service postgresql start
sudo -u postgres psql -c "CREATE DATABASE hr_copilot;"
```

Then in your `.env`, use:
```env
DATABASE_URL="postgresql://postgres@localhost:5432/hr_copilot"
```

---

### Option C: Portable PostgreSQL (For Development Only)

Download portable PostgreSQL from: https://www.enterprisedb.com/download-postgresql-binaries

---

## 2. Initialize Database Schema

Once PostgreSQL is running:

```powershell
cd backend
python -m prisma db push
```

This creates all tables from the schema.

---

## 3. Start All Services

### Terminal 1: Ollama (should already be running)
```powershell
ollama serve
```

### Terminal 2: PostgreSQL (if using Windows Service)
```powershell
# Verify it's running
Start-Service postgresql-x64-15
```

### Terminal 3: Backend
```powershell
cd backend
# Activate venv if not already
.venv\Scripts\Activate.ps1
# Start server (NO --reload on Windows to avoid socket issues)
uvicorn app.main:app --port 8000 --host 0.0.0.0
```

### Terminal 4: Frontend
```powershell
cd frontend
pnpm dev
```

---

## 4. Verify Everything Works

- Ollama: `http://localhost:11434/api/tags` → should show llama3
- Backend: `http://localhost:8000/docs` → Swagger UI
- Frontend: `http://localhost:3000` → Application
- Database: Check connection in backend logs

---

## Troubleshooting

### PostgreSQL Won't Start
```powershell
# Check if service exists
Get-Service postgresql-x64-*

# If missing, reinstall PostgreSQL
# Or use psql from PowerShell:
psql -U postgres
```

### Port 8000 Already in Use
```powershell
netstat -ano | findstr :8000
taskkill /PID <PID> /F
```

### Uvicorn: "WinError 10013" Socket Error
- Remove `--reload` flag
- It causes issues with multiprocessing on Windows
- Restart the server when you change code

### Database Connection Refused
```powershell
# Verify PostgreSQL is running
Get-Service postgresql-x64-15 | Select-Object Status

# Check connection string in backend\.env
# Should be: postgresql://postgres:123@localhost:5432/hr_copilot
```

---

## Next Steps

After successful setup:
1. Login with Google OAuth at `http://localhost:3000`
2. Upload resumes in PDF, DOCX, or TXT format
3. System uses llama3 for analysis
4. Results stored in PostgreSQL

