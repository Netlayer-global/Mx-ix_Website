@echo off
setlocal
set "NODE_DIR=C:\Program Files\nodejs"
set "PATH=%NODE_DIR%;%PATH%"
set "TSC=%NODE_DIR%\node.exe" 
cd /d "%~dp0"

if exist .tmpcheck rmdir /s /q .tmpcheck

echo RUN_STARTED=%DATE% %TIME% > checks-out.log
echo === compile ip self-check === >> checks-out.log
"%NODE_DIR%\node.exe" node_modules/typescript/bin/tsc scripts/verify-ip-util.ts --outDir .tmpcheck --module commonjs --target ES2020 --esModuleInterop --skipLibCheck --noEmitOnError false >> checks-out.log 2>&1
echo COMPILE_EXIT=%ERRORLEVEL% >> checks-out.log

echo. >> checks-out.log
echo === run ip self-check === >> checks-out.log
"%NODE_DIR%\node.exe" .tmpcheck/scripts/verify-ip-util.js >> checks-out.log 2>&1
echo IPCHECK_EXIT=%ERRORLEVEL% >> checks-out.log

echo. >> checks-out.log
echo === tsc --noEmit (whole backend) === >> checks-out.log
"%NODE_DIR%\node.exe" node_modules/typescript/bin/tsc --noEmit >> checks-out.log 2>&1
echo TSC_EXIT=%ERRORLEVEL% >> checks-out.log

if exist .tmpcheck rmdir /s /q .tmpcheck

endlocal
