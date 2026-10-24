@echo off
chcp 65001 > nul
echo ========================================================
echo   Starting Mart AI ERP Frontend (Vite)...
echo   URL: http://localhost:5173
echo ========================================================
cd /d "%~dp0"
npm run dev
pause
