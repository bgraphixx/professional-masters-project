#!/bin/sh
set -e

echo "Applying database migrations..."
alembic upgrade head

echo "Seeding default categories..."
python -m app.scripts.seed --seed-db

echo "Starting application..."
exec "$@"
