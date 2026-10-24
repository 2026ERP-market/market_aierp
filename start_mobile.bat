@echo off
chcp 65001 > nul
echo ========================================================
echo   Starting Mart AI ERP Mobile App (Expo)...
echo ========================================================
cd /d "%~dp0\mobile"
npx expo start
pause
