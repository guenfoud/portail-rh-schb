@echo off
title GICA HR - Serveur API
echo ==============================================
echo   DEMARRAGE DU SERVEUR API GICA (PORT 8081)
echo ==============================================
echo.
node server.js
if %errorlevel% neq 0 (
    echo.
    echo [ERREUR] Le serveur a rencontre une erreur de lancement.
    pause
)
