# MX-IX VPS Deployment Script
# This script automates the deployment of MX-IX frontend to the VPS

$VPS_IP = "103.139.191.172"
$VPS_USER = "netlayer-noc"
$REPO_URL = "https://github.com/Wonder-Creative-Studio/MX-IX_frontend.git"

Write-Host "=== MX-IX VPS Deployment Script ===" -ForegroundColor Cyan
Write-Host "Connecting to VPS: $VPS_IP" -ForegroundColor Yellow
Write-Host "You will be prompted for the password..." -ForegroundColor Yellow
Write-Host ""

# Create the deployment commands
$deployCommands = @"
echo '=== Step 1: Installing Node.js 20 ==='
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

echo '=== Verifying Node.js installation ==='
node -v
npm -v

echo '=== Step 2: Installing Nginx ==='
sudo apt install -y nginx
sudo systemctl start nginx
sudo systemctl enable nginx

echo '=== Step 3: Installing Git ==='
sudo apt install -y git

echo '=== Step 4: Cloning repository ==='
cd /var/www
sudo rm -rf MX-IX_frontend 2>/dev/null || true
sudo git clone $REPO_URL
cd MX-IX_frontend
sudo chown -R \`$USER:\`$USER /var/www/MX-IX_frontend

echo '=== Step 5: Installing dependencies ==='
npm install

echo '=== Step 6: Building project ==='
npm run build

echo '=== Step 7: Configuring Nginx ==='
sudo tee /etc/nginx/sites-available/mx-ix > /dev/null <<'NGINX_EOF'
server {
    listen 80;
    server_name mx-ix.com www.mx-ix.com;
    root /var/www/MX-IX_frontend/dist;
    index index.html;

    location / {
        try_files \`$uri \`$uri/ /index.html;
    }

    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2)\`$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml image/svg+xml;
}
NGINX_EOF

echo '=== Step 8: Enabling site ==='
sudo ln -sf /etc/nginx/sites-available/mx-ix /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl restart nginx

echo '=== Step 9: Installing Certbot ==='
sudo apt install -y certbot python3-certbot-nginx

echo ''
echo '=== DEPLOYMENT COMPLETE! ==='
echo ''
echo 'Next steps:'
echo '1. Tell client to set DNS records:'
echo '   A Record: @ -> 103.139.191.172'
echo '   CNAME: www -> mx-ix.com'
echo ''
echo '2. After DNS propagates (5-60 minutes), run SSL setup:'
echo '   sudo certbot --nginx -d mx-ix.com -d www.mx-ix.com'
echo ''
echo 'Website will be accessible at: http://103.139.191.172'
echo 'After DNS: https://mx-ix.com'
"@

# Execute the deployment
ssh -o StrictHostKeyChecking=no "$VPS_USER@$VPS_IP" "$deployCommands"

Write-Host ""
Write-Host "=== Deployment script completed! ===" -ForegroundColor Green
Write-Host ""
Write-Host "If you need to set up SSL later, connect via SSH and run:" -ForegroundColor Yellow
Write-Host "sudo certbot --nginx -d mx-ix.com -d www.mx-ix.com" -ForegroundColor Cyan
