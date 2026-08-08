@echo off
cd /d "c:\Users\lenovo\Desktop\Mx-ix_Website-main"
echo === GIT PUSH LOG === > git-output.log
echo %DATE% %TIME% >> git-output.log
echo. >> git-output.log

echo === REMOTE === >> git-output.log
git remote -v >> git-output.log 2>&1
echo. >> git-output.log

echo === SET REMOTE === >> git-output.log
git remote set-url origin https://github.com/Netlayer-global/Mx-ix_Website.git >> git-output.log 2>&1
echo. >> git-output.log

echo === BRANCH === >> git-output.log
git branch --show-current >> git-output.log 2>&1
echo. >> git-output.log

echo === ADD ALL === >> git-output.log
git add -A >> git-output.log 2>&1
echo ADD_EXIT=%ERRORLEVEL% >> git-output.log
echo. >> git-output.log

echo === COMMIT === >> git-output.log
git commit -m "feat: complete IXP Manager parity - full IX operations from one admin panel" >> git-output.log 2>&1
echo COMMIT_EXIT=%ERRORLEVEL% >> git-output.log
echo. >> git-output.log

echo === PUSH === >> git-output.log
git push -u origin HEAD >> git-output.log 2>&1
echo PUSH_EXIT=%ERRORLEVEL% >> git-output.log
