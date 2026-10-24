@echo off
echo ========================================================
echo Starting Mart AI ERP FastAPI Backend Server...
echo ========================================================
cd /d "%~dp0"
set PYTHONPATH=backend
set PYTHONIOENCODING=utf-8
backend\.venv\Scripts\python.exe backend/run.py
pause
