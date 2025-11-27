#!/bin/sh

# entrypoint.sh - Production entrypoint for device-api

set -e

echo "Starting device-api..."

# Wait for database connection (optional)
if [ -n "$DATABASE_URL" ]; then
    echo "Database URL configured: ${DATABASE_URL%%@*}@***"
else
    echo "Warning: DATABASE_URL not set"
fi

# Wait for Redis connection (optional)
if [ -n "$REDIS_URL" ]; then
    echo "Redis URL configured: ${REDIS_URL%%@*}@***"
else
    echo "Warning: REDIS_URL not set"
fi

# Execute the main command
echo "Executing: $@"
exec "$@"
