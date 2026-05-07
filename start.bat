@echo off
echo Starting Pizza 4P's MIS Dashboard...
echo.

echo [1/2] Starting Backend (FastAPI)...
start "Pizza4PS - Backend" cmd /k "cd /d D:\pizza4ps-mis\backend && C:\Users\LENOVO\anaconda3\python.exe -m uvicorn main:app --host 0.0.0.0 --port 8003"

echo Waiting for backend to start...
timeout /t 5 /nobreak > nul

echo [2/2] Starting Frontend (React)...
start "Pizza4PS - Frontend" cmd /k "cd /d D:\pizza4ps-mis\frontend && npm run dev"

echo Waiting for frontend to start...
timeout /t 5 /nobreak > nul

echo.
echo ✓ Both servers starting...
echo ✓ Opening browser...
echo.
echo Login: admin / pizza4ps2024
echo.
start "" "http://localhost:5173"

echo Done! You can minimise this window.
pause
