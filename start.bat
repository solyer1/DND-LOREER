@echo off
echo Starting King's Sanctuary Bot and Web Server...

echo [1/2] Starting Discord Bot...
start "DND Lore Bot" cmd /k "cd bot && node index.js"

echo [2/2] Starting Local Web Server...
start "King's Sanctuary Web" cmd /k "cd web && npm run dev"

echo Done! Both services are launching in their own windows.
echo You can close this window now.
