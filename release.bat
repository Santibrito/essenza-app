@echo off
REM Script simple para crear un nuevo release en Windows
REM Uso: release.bat 1.0.1

if "%1"=="" (
  echo ❌ Error: Debes especificar la version
  echo Uso: release.bat 1.0.1
  exit /b 1
)

set NEW_VERSION=%1

echo 🚀 Creando release v%NEW_VERSION%
echo.

REM Actualizar version en package.json
call npm version %NEW_VERSION% --no-git-tag-version

REM Actualizar version en .env
powershell -Command "(Get-Content .env) -replace 'VITE_APP_VERSION=.*', 'VITE_APP_VERSION=v%NEW_VERSION%' | Set-Content .env"

echo ✅ Version actualizada a %NEW_VERSION%
echo.
echo 📝 Ahora ejecuta:
echo    git add .
echo    git commit -m "chore: release v%NEW_VERSION%"
echo    git push
echo.
echo 🤖 GitHub Actions compilara automaticamente los instaladores
