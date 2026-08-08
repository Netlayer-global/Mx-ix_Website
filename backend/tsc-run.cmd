@echo off
cd /d "%~dp0"
echo RUN=%DATE% %TIME% > tsc-final.log
"C:\Program Files\nodejs\node.exe" node_modules/typescript/bin/tsc --noEmit >> tsc-final.log 2>&1
if %ERRORLEVEL%==0 (echo TSC_EXIT=0 >> tsc-final.log) else (echo TSC_EXIT=%ERRORLEVEL% >> tsc-final.log)
