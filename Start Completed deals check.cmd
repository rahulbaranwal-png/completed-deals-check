@echo off
title Completed deals check
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0Start-CompletedDealsCheck.ps1"
pause
