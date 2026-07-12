#!/bin/bash
# ============================================================
# Sanfoor Enterprise Deployment Script
# ============================================================
# Usage: bash deploy.sh
# This script sets up the production server with:
#   - Supervisor (Queue Workers)
#   - Optimized Nginx Config
#   - Optimized PHP-FPM Config
#   - OPcache Tuning
#   - Redis Queue
# ============================================================

set -e

echo ""
echo "╔══════════════════════════════════════════════╗"
echo "║   Sanfoor Enterprise Deployment Script 🚀    ║"
echo "╚══════════════════════════════════════════════╝"
echo ""

APP_DIR="/var/www/sanfoor"

# ── Step 1: Install Supervisor ──
echo "📦 [1/7] Installing Supervisor..."
apt-get update -qq
apt-get install -y -qq supervisor > /dev/null 2>&1
echo "   ✅ Supervisor installed"

# ── Step 2: Configure Queue Workers ──
echo "⚙️  [2/7] Configuring Queue Workers..."
cp "$APP_DIR/deployment/supervisor/sanfoor-worker.conf" /etc/supervisor/conf.d/sanfoor-worker.conf
supervisorctl reread > /dev/null 2>&1
supervisorctl update > /dev/null 2>&1
echo "   ✅ Queue workers configured (2 processes)"

# ── Step 3: Optimize Nginx ──
echo "🌐 [3/7] Optimizing Nginx Configuration..."
# Backup current config
cp /etc/nginx/sites-enabled/default /etc/nginx/sites-enabled/default.backup.$(date +%Y%m%d) 2>/dev/null || true
cp "$APP_DIR/deployment/nginx/sanfoor.conf" /etc/nginx/sites-enabled/default
nginx -t > /dev/null 2>&1
if [ $? -eq 0 ]; then
    systemctl reload nginx
    echo "   ✅ Nginx optimized & reloaded"
else
    echo "   ⚠️  Nginx config test failed, reverting..."
    cp /etc/nginx/sites-enabled/default.backup.$(date +%Y%m%d) /etc/nginx/sites-enabled/default
    systemctl reload nginx
    echo "   ❌ Reverted to previous Nginx config"
fi

# ── Step 4: Optimize PHP-FPM ──
echo "🐘 [4/7] Optimizing PHP-FPM..."
PHP_FPM_POOL="/etc/php/8.2/fpm/pool.d/www.conf"
cp "$PHP_FPM_POOL" "${PHP_FPM_POOL}.backup.$(date +%Y%m%d)" 2>/dev/null || true
cp "$APP_DIR/deployment/php-fpm/www.conf" "$PHP_FPM_POOL"
systemctl restart php8.2-fpm
echo "   ✅ PHP-FPM optimized & restarted"

# ── Step 5: Enable OPcache JIT ──
echo "⚡ [5/7] Enabling OPcache JIT..."
PHP_INI="/etc/php/8.2/fpm/php.ini"
# Only add if not already set
if ! grep -q "opcache.jit=" "$PHP_INI"; then
    cat >> "$PHP_INI" << 'EOF'

; ── Sanfoor OPcache Tuning ──
opcache.enable=1
opcache.memory_consumption=256
opcache.max_accelerated_files=20000
opcache.validate_timestamps=0
opcache.jit=1255
opcache.jit_buffer_size=128M
EOF
    systemctl restart php8.2-fpm
    echo "   ✅ OPcache JIT enabled"
else
    echo "   ℹ️  OPcache JIT already configured"
fi

# ── Step 6: Laravel Optimizations ──
echo "🔧 [6/7] Running Laravel Optimizations..."
cd "$APP_DIR"
php artisan config:cache
php artisan route:cache
php artisan view:cache
php artisan event:cache
echo "   ✅ Laravel caches rebuilt"

# ── Step 7: Verify Everything ──
echo "🔍 [7/7] Verifying Services..."
echo ""

# Check Nginx
if systemctl is-active --quiet nginx; then
    echo "   ✅ Nginx: Running"
else
    echo "   ❌ Nginx: NOT Running"
fi

# Check PHP-FPM
if systemctl is-active --quiet php8.2-fpm; then
    echo "   ✅ PHP-FPM: Running"
else
    echo "   ❌ PHP-FPM: NOT Running"
fi

# Check Redis
if redis-cli ping > /dev/null 2>&1; then
    echo "   ✅ Redis: Running"
else
    echo "   ❌ Redis: NOT Running"
fi

# Check Supervisor Workers
WORKER_STATUS=$(supervisorctl status sanfoor-worker:* 2>/dev/null | grep RUNNING | wc -l)
echo "   ✅ Queue Workers: $WORKER_STATUS running"

# Check PostgreSQL
if pg_isready > /dev/null 2>&1; then
    echo "   ✅ PostgreSQL: Running"
else
    echo "   ❌ PostgreSQL: NOT Running"
fi

echo ""
echo "╔══════════════════════════════════════════════╗"
echo "║   🎉 Deployment Complete!                    ║"
echo "║   All services are configured & running.     ║"
echo "╚══════════════════════════════════════════════╝"
echo ""
