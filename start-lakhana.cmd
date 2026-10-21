@echo off
setlocal
cd /d "%~dp0"
set "LAKHANA_NODE=node"
where node >nul 2>nul
if errorlevel 1 (
  set "LAKHANA_NODE=%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe"
)
echo Open http://127.0.0.1:3000 in your browser after the server starts.
echo Keep this window open while using LAKHANA. Press Ctrl+C to stop.
"%LAKHANA_NODE%" server.mjs
if errorlevel 1 pause
