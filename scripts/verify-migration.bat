@echo off
REM Verification script: Compare old and new databases

echo ========================================
echo Database Migration Verification
echo ========================================
echo.

echo Comparing table counts...
echo.
echo OLD DATABASE (db):
docker compose -f compose.dev.yaml exec -T db psql -U hestami_user -d hestami_db -c "SELECT schemaname, tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename;"
echo.
echo NEW DATABASE (db-new):
docker compose -f compose.dev.yaml exec -T db-new psql -U hestami_user -d hestami_db -c "SELECT schemaname, tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename;"
echo.

echo ========================================
echo Checking key table row counts...
echo ========================================
echo.

echo ServiceProvider records:
echo OLD:
docker compose -f compose.dev.yaml exec -T db psql -U hestami_user -d hestami_db -t -c "SELECT COUNT(*) FROM services_serviceprovider;"
echo NEW:
docker compose -f compose.dev.yaml exec -T db-new psql -U hestami_user -d hestami_db -t -c "SELECT COUNT(*) FROM services_serviceprovider;"
echo.

echo ServiceProviderScrapedData records:
echo OLD:
docker compose -f compose.dev.yaml exec -T db psql -U hestami_user -d hestami_db -t -c "SELECT COUNT(*) FROM services_serviceproviderscrapeddata;"
echo NEW:
docker compose -f compose.dev.yaml exec -T db-new psql -U hestami_user -d hestami_db -t -c "SELECT COUNT(*) FROM services_serviceproviderscrapeddata;"
echo.

echo ========================================
echo Checking PostGIS and pgvector extensions...
echo ========================================
echo.
docker compose -f compose.dev.yaml exec -T db-new psql -U hestami_user -d hestami_db -c "SELECT extname, extversion FROM pg_extension WHERE extname IN ('postgis', 'postgis_topology', 'vector', 'pg_trgm', 'btree_gin', 'unaccent');"
echo.

echo ========================================
echo Testing PostGIS functionality...
echo ========================================
echo.
docker compose -f compose.dev.yaml exec -T db-new psql -U hestami_user -d hestami_db -c "SELECT PostGIS_version();"
echo.

echo ========================================
echo Testing pgvector functionality...
echo ========================================
echo.
docker compose -f compose.dev.yaml exec -T db-new psql -U hestami_user -d hestami_db -c "SELECT '[1,2,3]'::vector;"
echo.

echo ========================================
echo Verification complete!
echo ========================================
