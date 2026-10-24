@echo off
chcp 65001 > nul
echo ========================================================
echo   Mart AI ERP - 전체 서비스 실행 (Backend + Frontend)
echo ========================================================
echo [1/3] Docker PostgreSQL 상태 확인 중...
docker compose up -d

echo.
echo [2/3] FastAPI 백엔드 서버 시작 (포트: 8000)...
start "Mart AI Backend (FastAPI)" cmd /k "cd /d %~dp0 && set PYTHONPATH=backend && set PYTHONIOENCODING=utf-8 && backend\.venv\Scripts\python.exe backend/run.py"

echo.
echo [3/3] React 웹 프론트엔드 시작 (포트: 5173)...
start "Mart AI Frontend (Vite)" cmd /k "cd /d %~dp0 && npm run dev"

echo.
echo ========================================================
echo   모든 서비스가 성공적으로 실행되었습니다!
echo   - 웹 대시보드: http://localhost:5173
echo   - FastAPI Swagger API 문서: http://localhost:8000/docs
echo   - pgAdmin 4 데이터베이스 관리: http://localhost:5050
echo ========================================================
echo.
pause
