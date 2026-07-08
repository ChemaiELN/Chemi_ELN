@echo off
title Laurus ELN - Backend
:: Slim launcher for auto-start (Task Scheduler). Assumes start.bat has
:: already been run once (dependencies installed, DB migrated + seeded).
cd /d "%~dp0"
python -m uvicorn app.main:app --host 0.0.0.0 --port 8000
