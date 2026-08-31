@echo off
chcp 65001 >nul
echo.
echo  SMO Equipment - GitHub Sync
echo  กำลัง sync ขึ้น GitHub...
echo.
powershell -ExecutionPolicy Bypass -File "%~dp0sync.ps1" %*
pause
