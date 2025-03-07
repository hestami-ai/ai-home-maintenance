#!/bin/bash

# Health check script for Hestami AI services

check_service() {
    local service=$1
    local port=$2
    local endpoint=$3
    
    echo "Checking $service..."
    
    # Try to connect to the service
    response=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:$port$endpoint)
    
    if [ $response -eq 200 ]; then
        echo "✅ $service is healthy (Status: $response)"
        return 0
    else
        echo "❌ $service is not healthy (Status: $response)"
        return 1
    fi
}

# Check all services
services_status=0

# Check Frontend
check_service "Frontend" 3000 "/api/health"
services_status=$((services_status + $?))

# Check Backend API
check_service "Backend API" 8050 "/api/health/"
services_status=$((services_status + $?))

# Check Static Files Server
check_service "Static Server" 80 "/health"
services_status=$((services_status + $?))

# Check Database
if docker-compose -f compose.prod.yaml exec db pg_isready -U postgres > /dev/null 2>&1; then
    echo "✅ Database is healthy"
else
    echo "❌ Database is not healthy"
    services_status=$((services_status + 1))
fi

# Final status
if [ $services_status -eq 0 ]; then
    echo -e "\n✅ All services are healthy"
    exit 0
else
    echo -e "\n❌ Some services are unhealthy"
    exit 1
fi
