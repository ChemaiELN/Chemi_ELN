@echo off
title Laurus ELN - Frontend Server

echo ============================================
echo  Laurus ELN Frontend - Static File Server
echo ============================================

:: Check Python is available - used to serve static files
python --version >nul 2>&1
if errorlevel 1 goto no_python

if not exist "dist\index.html" goto no_dist

echo Serving frontend on http://0.0.0.0:9091
echo Open http://10.10.51.90:9091 in a browser.
echo Press Ctrl+C to stop.
echo.
python serve.py
goto end

:no_python
echo ERROR: Python is not installed or not in PATH.
goto end

:no_dist
echo ERROR: dist\index.html not found. The frontend has not been built.
goto end

:end
pause
