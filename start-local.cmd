@echo off
cd /d "%~dp0app"
where node >nul 2>nul
if errorlevel 1 (
  echo Please install Node.js 22 or later.
  pause
  exit /b 1
)
if not exist node_modules\ws call npm install --no-audit --no-fund
call npm run dev
pause
