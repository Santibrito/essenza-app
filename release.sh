#!/bin/bash

# Script simple para crear un nuevo release
# Uso: ./release.sh 1.0.1

if [ -z "$1" ]; then
  echo "❌ Error: Debes especificar la versión"
  echo "Uso: ./release.sh 1.0.1"
  exit 1
fi

NEW_VERSION=$1

echo "🚀 Creando release v$NEW_VERSION"
echo ""

# Actualizar versión en package.json
npm version $NEW_VERSION --no-git-tag-version

# Actualizar versión en .env
sed -i "s/VITE_APP_VERSION=.*/VITE_APP_VERSION=v$NEW_VERSION/" .env

echo "✅ Versión actualizada a $NEW_VERSION"
echo ""
echo "📝 Ahora ejecuta:"
echo "   git add ."
echo "   git commit -m \"chore: release v$NEW_VERSION\""
echo "   git push"
echo ""
echo "🤖 GitHub Actions compilará automáticamente los instaladores"
