@echo off
title GICA HR - Lancement Complet
echo ==============================================
echo   DEMARRAGE DE GICA HR (PORT 8082 et 8081)
echo ==============================================
echo.
echo [1/2] Demarrage du serveur API (Backend sur 8081)...
start "GICA HR - Serveur API" cmd /k "node server.js"

echo [2/2] Demarrage du serveur Vite (Frontend sur 8082)...
start "GICA HR - Frontend Vite" cmd /k "npm run dev"

echo.
echo ==============================================
echo Lancement effectue !
echo Ouvrez http://localhost:8082 dans votre navigateur.
echo ==============================================
echo.
pause
