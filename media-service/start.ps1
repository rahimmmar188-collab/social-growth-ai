# Start the Social Growth AI Media Service
# Run from: media-service/ directory

Write-Host "Starting Social Growth AI Media Service..." -ForegroundColor Cyan

if (-not (Test-Path ".\venv\Scripts\python.exe")) {
    Write-Host "Venv not found. Run setup first:" -ForegroundColor Red
    Write-Host "  py -3.12 -m venv venv" -ForegroundColor Yellow
    Write-Host "  .\venv\Scripts\pip install -r requirements.txt" -ForegroundColor Yellow
    exit 1
}

Write-Host "Service running at http://localhost:8000" -ForegroundColor Green
Write-Host "Press Ctrl+C to stop" -ForegroundColor Gray
.\venv\Scripts\python.exe -m uvicorn main:app --host 127.0.0.1 --port 8000 --reload
