#!/bin/bash
# Programma la sincronizzazione di ClasseViva su questo Mac ogni 3 ore (e all'accensione).
# Uso, dalla cartella del progetto: bash scripts/installa-mac.sh
set -euo pipefail

DIR="$(cd "$(dirname "$0")/.." && pwd)"
NPM="$(command -v npm || true)"
if [ -z "$NPM" ]; then echo "npm non trovato: installa Node.js da https://nodejs.org"; exit 1; fi
if [ ! -f "$DIR/.env.local" ]; then echo "Manca $DIR/.env.local con CLASSEVIVA_USER e CLASSEVIVA_PASS"; exit 1; fi
chmod 600 "$DIR/.env.local"

LABEL="it.assistentestudio.classeviva"
PLIST="$HOME/Library/LaunchAgents/$LABEL.plist"
LOG="$HOME/Library/Logs/assistente-studio.log"
mkdir -p "$HOME/Library/LaunchAgents" "$HOME/Library/Logs"

cat > "$PLIST" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>$LABEL</string>
  <key>WorkingDirectory</key><string>$DIR</string>
  <key>ProgramArguments</key>
  <array><string>$NPM</string><string>run</string><string>-s</string><string>sincronizza:classeviva</string></array>
  <key>EnvironmentVariables</key>
  <dict><key>PATH</key><string>$(dirname "$NPM"):/usr/local/bin:/opt/homebrew/bin:/usr/bin:/bin</string></dict>
  <key>StartInterval</key><integer>10800</integer>
  <key>RunAtLoad</key><true/>
  <key>StandardOutPath</key><string>$LOG</string>
  <key>StandardErrorPath</key><string>$LOG</string>
</dict>
</plist>
PLIST

launchctl bootout "gui/$(id -u)/$LABEL" 2>/dev/null || true
launchctl bootstrap "gui/$(id -u)" "$PLIST"
echo "Fatto: ClasseViva si aggiorna ogni 3 ore. Registro: $LOG"
