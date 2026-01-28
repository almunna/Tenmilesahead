#!/bin/bash
# TenMilesAhead Deployment Script for Hostinger VPS
# Run this script on your VPS after SSH'ing in

set -e

echo "=========================================="
echo "  TenMilesAhead Deployment Script"
echo "=========================================="

# Configuration
DOMAIN="tenmilesahead.com"
APP_DIR="/var/www/tenmilesahead"
REPO_URL="https://github.com/almunna/Tenmilesahead.git"

# Step 1: Update system and install dependencies
echo ""
echo "[1/7] Updating system and installing dependencies..."
apt update && apt upgrade -y
apt install -y docker.io docker-compose nginx certbot python3-certbot-nginx git

# Enable and start Docker
systemctl enable docker
systemctl start docker

# Step 2: Create app directory
echo ""
echo "[2/7] Setting up application directory..."
mkdir -p $APP_DIR
cd $APP_DIR

#Step 3: Clone the repository
echo ""
echo "[3/7] Cloning repository..."
if [ -d ".git" ]; then
    echo "Repository exists, pulling latest changes..."
    git pull origin main || git pull origin milestone-3-1
else
    git clone $REPO_URL .
fi

# Step 4: Create .env.local file
echo ""
echo "[4/7] Creating environment file..."
cat > .env.local << 'EOF'
# Copy your values from .env.local.example and fill in your actual keys
NEXT_PUBLIC_FIREBASE_API_KEY=your_firebase_api_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_project.firebasestorage.app
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=your_stripe_publishable_key
STRIPE_SECRET_KEY=your_stripe_secret_key
STRIPE_WEBHOOK_SECRET=your_stripe_webhook_secret
EOF

echo ""
echo "IMPORTANT: Edit .env.local with your actual keys before building!"
echo "Run: nano .env.local"
read -p "Press Enter after you've updated the .env.local file..."

# Step 5: Create docker-compose.yml
echo ""
echo "[5/7] Creating docker-compose configuration..."
cat > docker-compose.yml << 'EOF'
version: '3.8'

services:
  tenmilesahead:
    build:
      context: .
      args:
        - NEXT_PUBLIC_FIREBASE_API_KEY=${NEXT_PUBLIC_FIREBASE_API_KEY}
        - NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=${NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN}
        - NEXT_PUBLIC_FIREBASE_PROJECT_ID=${NEXT_PUBLIC_FIREBASE_PROJECT_ID}
        - NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=${NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET}
        - NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=${NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID}
        - NEXT_PUBLIC_FIREBASE_APP_ID=${NEXT_PUBLIC_FIREBASE_APP_ID}
        - NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID=${NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID}
        - NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=${NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY}
    container_name: tenmilesahead
    restart: unless-stopped
    ports:
      - "3001:3000"
    env_file:
      - .env.local
    environment:
      - NODE_ENV=production
EOF

# Step 6: Build and start the Docker container
echo ""
echo "[6/7] Building and starting Docker container..."
docker-compose --env-file .env.local up -d --build

# Step 7: Configure Nginx
echo ""
echo "[7/7] Configuring Nginx..."
cat > /etc/nginx/sites-available/tenmilesahead << 'EOF'
server {
    listen 80;
    server_name tenmilesahead.com www.tenmilesahead.com;

    location / {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 86400;
    }
}
EOF

# Enable the site
ln -sf /etc/nginx/sites-available/tenmilesahead /etc/nginx/sites-enabled/

# Test and reload Nginx
nginx -t && systemctl reload nginx

echo ""
echo "=========================================="
echo "  Deployment Complete!"
echo "=========================================="
echo ""
echo "Next steps:"
echo "1. Point your domain DNS to this server IP: 5.181.218.54"
echo "2. Run this command to enable HTTPS:"
echo "   certbot --nginx -d tenmilesahead.com -d www.tenmilesahead.com"
echo ""
echo "Your site should be accessible at: http://tenmilesahead.com"
echo ""
