@echo off
echo Starting ARPG Engine...

:: Open the browser first
start http://localhost:8000

:: Start the Python server in this command window
python -m http.server 8000