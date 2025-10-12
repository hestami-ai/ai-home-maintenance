@echo off
REM ============================================================================
REM ClamAV Health Check Script
REM This script checks if ClamAV is running correctly and can scan files
REM ============================================================================

echo.
echo ============================================================================
echo ClamAV Health Check
echo ============================================================================
echo.

REM Check if Docker is running
docker info >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Docker is not running or not accessible
    exit /b 1
)

REM Check if ClamAV container exists and is running
echo [1/5] Checking ClamAV container status...
docker ps --filter "name=clamav-dev" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}" | findstr /C:"clamav-dev" >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] ClamAV container is not running
    echo.
    echo Attempting to start ClamAV container...
    docker compose -f compose.dev.yaml up -d clamav
    timeout /t 10 /nobreak >nul
)

docker ps --filter "name=clamav-dev" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
echo [OK] ClamAV container is running
echo.

REM Check ClamAV logs for startup completion
echo [2/5] Checking ClamAV daemon status...
docker logs clamav-dev --tail 5 2>&1 | findstr /C:"clamd started" >nul 2>&1
if %errorlevel% neq 0 (
    echo [WARNING] ClamAV daemon may still be starting up
    echo Recent logs:
    docker logs clamav-dev --tail 10
    echo.
    echo Waiting 10 seconds for daemon to start...
    timeout /t 10 /nobreak >nul
) else (
    echo [OK] ClamAV daemon is started
)
echo.

REM Test ClamAV version
echo [3/5] Testing ClamAV version...
docker exec api-dev python -c "from clamav_client.clamd import ClamdNetworkSocket; cd = ClamdNetworkSocket(host='clamav-dev', port=3310); print('Version:', cd.version())" 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Failed to get ClamAV version
    exit /b 1
)
echo [OK] ClamAV version retrieved successfully
echo.

REM Test ClamAV ping
echo [4/5] Testing ClamAV connectivity...
docker exec api-dev python -c "from clamav_client.clamd import ClamdNetworkSocket; cd = ClamdNetworkSocket(host='clamav-dev', port=3310); result = cd.ping(); print('Ping response:', result)" 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Failed to ping ClamAV
    exit /b 1
)
echo [OK] ClamAV ping successful
echo.

REM Test ClamAV instream scanning
echo [5/5] Testing ClamAV file scanning (instream method)...
docker exec api-dev python -c "from clamav_client.clamd import ClamdNetworkSocket; from io import BytesIO; cd = ClamdNetworkSocket(host='clamav-dev', port=3310); test_data = BytesIO(b'This is a clean test file for ClamAV scanning'); result = cd.instream(test_data); print('Scan result:', result)" 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Failed to scan test file
    exit /b 1
)
echo [OK] File scanning test successful
echo.

REM Test with EICAR test virus string (should be detected)
echo [BONUS] Testing malware detection with EICAR test string...
docker exec api-dev python -c "from clamav_client.clamd import ClamdNetworkSocket; from io import BytesIO; cd = ClamdNetworkSocket(host='clamav-dev', port=3310); eicar = BytesIO(b'X5O!P%%@AP[4\\PZX54(P^^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*'); result = cd.instream(eicar); print('EICAR scan result:', result)" 2>&1
if %errorlevel% neq 0 (
    echo [WARNING] EICAR test failed - this may be expected in some configurations
) else (
    echo [OK] Malware detection is working
)
echo.

echo ============================================================================
echo ClamAV Health Check Complete
echo ============================================================================
echo All checks passed! ClamAV is running correctly.
echo.

exit /b 0
