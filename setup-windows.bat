@echo off
REM Resume Scanner - Windows Quick Setup Script

echo.
echo =========================================
echo Resume Scanner - Windows Setup
echo =========================================
echo.

echo [1/4] Checking PostgreSQL Service...
sc query postgresql-x64-15 >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    echo ✓ PostgreSQL service found
    for /f "tokens=3" %%A in ('sc query postgresql-x64-15 ^| findstr STATE') do (
        if "%%A"=="RUNNING" (
            echo ✓ PostgreSQL is RUNNING
        ) else (
            echo ⚠ PostgreSQL is stopped. Starting...
            net start postgresql-x64-15
        )
    )
) else (
    echo ✗ PostgreSQL service not found
    echo.
    echo Please install PostgreSQL first:
    echo   1. Download: https://www.postgresql.org/download/windows/
    echo   2. Run installer with:
    echo      - Port: 5432
    echo      - User: postgres
    echo      - Password: 123
    echo   3. Run this script again
    pause
    exit /b 1
)

echo.
echo [2/4] Checking OpenRouter configuration...
if exist backend\.env (
    findstr /R /C:"^OPENROUTER_API_KEY=" backend\.env >nul 2>&1
    if %ERRORLEVEL% EQU 0 (
        echo ✓ OpenRouter environment variables exist in backend\.env
    ) else (
        echo ⚠ OpenRouter variables not found in backend\.env
        echo   Please add OPENROUTER_API_KEY and OPENROUTER_MODEL to backend\.env
    )
) else (
    echo ⚠ backend\.env not found. Ensure you copy backend\.env.example to backend\.env and configure OpenRouter.
)

echo.
echo [3/4] Initializing Backend...
cd backend
if exist .env (
    echo ✓ Backend .env found
) else (
    echo ⚠ Creating .env file...
    copy .env.example .env
)

echo Generating Prisma client...
python -m prisma generate

echo Pushing database schema...
python -m prisma db push

echo.
echo [4/4] Setup Complete!
echo.
echo Start the application:
echo   Terminal 1 (Backend):  cd backend && uvicorn app.main:app --port 8000 --host 0.0.0.0
echo   Terminal 2 (Frontend): cd frontend && pnpm dev
echo.
echo Access the app:
echo   Frontend: http://localhost:3000
echo   Backend:  http://localhost:8000/docs
echo.
pause
