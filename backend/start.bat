@echo off
title Laurus ELN - Backend Server

echo ============================================
echo  Laurus ELN Backend - Startup
echo ============================================

:: Check Python is installed
python --version >nul 2>&1
if errorlevel 1 goto no_python

:: Remove any half-created venv from a previous attempt - not used anymore.
if exist "venv" rmdir /s /q venv

:: Install dependencies OFFLINE into the base Python.
:: No virtual environment is used, to avoid AppLocker / antivirus blocking
:: the copied python.exe / pip.exe inside venv\Scripts on locked-down servers.
echo Installing dependencies offline...
python -m pip install -r requirements.txt --no-index --find-links=packages
if errorlevel 1 goto pip_failed

:: Check .env file exists
if not exist ".env" goto no_env

:: Run database migrations
echo Running database migrations...
python -m alembic upgrade head
if errorlevel 1 goto migrate_failed

:: Seed reference data + initial admin user - idempotent, safe to re-run.
echo Seeding database - roles, admin user, reference data...
python seed_all.py

:: Start the backend server
echo.
echo Starting backend on http://0.0.0.0:8000
echo Press Ctrl+C to stop.
echo.
python -m uvicorn app.main:app --host 0.0.0.0 --port 8000
goto end

:no_python
echo.
echo ERROR: Python is not installed or not in PATH.
echo Install Python 3.11 64-bit and enable "Add Python to PATH".
goto end

:pip_failed
echo.
echo ERROR: Dependency install failed. See messages above.
goto end

:no_env
echo.
echo WARNING: No .env file found. Copying .env.example to .env.
copy .env.example .env
echo Open .env, set DATABASE_URL and SECRET_KEY, then re-run this script.
goto end

:migrate_failed
echo.
echo ERROR: Database migration failed.
echo Check DATABASE_URL in .env and that PostgreSQL is running.
goto end

:end
echo.
pause
