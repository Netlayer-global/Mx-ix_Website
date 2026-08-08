@echo off
cd /d "%~dp0"
echo RUN=%DATE% %TIME% > tsc-v2.log
"C:\Program Files\nodejs\node.exe" node_modules/typescript/bin/tsc --noEmit >> tsc-v2.log 2>&1
echo TSC_EXIT=%ERRORLEVEL% >> tsc-v2.log
