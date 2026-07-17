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

# Reload PHP-FPM so OPcache picks up the new code & config.
# optimize:clear/optimize rebuild Laravel's own caches but do NOT reset PHP's
# OPcache; with opcache.validate_timestamps=0 the FPM workers keep serving the
# OLD controller bytecode and cached config until FPM is reloaded. This is why
# backend changes (e.g. the AI advisor prompt) can fail to appear after a deploy.
# Non-fatal: if the deploy user lacks passwordless sudo or no service matches,
# we log a note and continue instead of breaking the deploy.
echo "Reloading PHP-FPM (OPcache)..."
reload_fpm() {
    for svc in php8.4-fpm php8.3-fpm php8.2-fpm php8.1-fpm php8.0-fpm php-fpm; do
        if sudo -n systemctl reload "$svc" 2>/dev/null; then
            echo "Reloaded $svc"
            return 0
        fi
    done
    echo "NOTE: could not reload PHP-FPM (no matching service or no passwordless sudo)."
    echo "      If backend changes don't appear, reload PHP-FPM manually or set opcache.validate_timestamps=1."
    return 0
}
reload_fpm

# Restart queue if it's running
echo "Restarting queues..."
php artisan queue:restart || true



echo "Deployment finished successfully!"
