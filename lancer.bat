@echo off
setlocal
title GICA HR - Console de lancement
cd /d "%~dp0"

REM 1. Executable de bureau (release\Console-GICA-RH-*.exe) s'il a ete construit
set "EXE="
for %%f in ("release\Console-GICA-RH-*.exe") do if exist "%%~f" set "EXE=%%~f"
if defined EXE (
  echo Ouverture de la console de bureau : "%EXE%"
  start "" "%EXE%"
  exit /b 0
)

REM 2. Application Electron depuis les sources (npm install)
if exist "node_modules\electron\dist\electron.exe" (
  echo Ouverture de la console de bureau ^(Electron^)...
  start "" "node_modules\electron\dist\electron.exe" .
  exit /b 0
)

REM 3. Repli : console dans le navigateur (node launcher.js)
where node >nul 2>nul
if errorlevel 1 (
  echo.
  echo [!] Node.js est introuvable. Installez-le depuis https://nodejs.org/ puis relancez.
  echo.
  pause
  exit /b 1
)

if not exist "node_modules" (
  echo [1/2] Installation des dependances ^(premier lancement^)...
  call npm install
  if errorlevel 1 (
    echo.
    echo [!] L'installation des dependances a echoue.
    pause
    exit /b 1
  )
)

echo [2/2] Ouverture de la console dans le navigateur...
node launcher.js --start

if errorlevel 1 (
  echo.
  echo [!] La console s'est arretee avec une erreur.
  pause
)
