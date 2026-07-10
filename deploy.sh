#!/bin/bash
set -e

echo "Deploying application..."



# Pull the latest changes from the git repository
echo "Pulling latest changes..."
git pull origin main

# Install/update composer dependencies
echo "Installing composer dependencies..."
composer install --no-interaction --prefer-dist --optimize-autoloader --ignore-platform-req=php

# Install NPM dependencies and build assets
echo "Building frontend assets..."
npm install
npm run build

# Clear the old cache
echo "Clearing cache..."
php artisan clear-compiled
php artisan optimize:clear

# Run database migrations
echo "Running migrations..."
php artisan migrate --force

# Recreate cache
echo "Optimizing..."
php artisan optimize

# Restart queue if it's running
echo "Restarting queues..."
php artisan queue:restart || true



echo "Deployment finished successfully!"
