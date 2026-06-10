# MX-IX — Ubuntu Deployment Guide

Deploys the full stack on one Ubuntu server (22.04/24.04):
- **MongoDB** (database)
- **Backend** (Node/Express) on port 5000, managed by **PM2**
- **Frontend** (static React build) served by **Nginx**, which also reverse-proxies `/api` → backend

> In production the frontend calls `/api` on the same origin, so Nginx must proxy `/api` to the backend.

---

## 1. Install prerequisites

```bash
sudo apt update && sudo apt upgrade -y

# Node.js 20 LTS
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs git nginx

# PM2 (process manager)
sudo npm install -g pm2

# MongoDB 7
curl -fsSL https://www.mongodb.org/static/pgp/server-7.0.asc | sudo gpg -o /usr/share/keyrings/mongodb-server-7.0.gpg --dearmor
echo "deb [ arch=amd64,arm64 signed-by=/usr/share/keyrings/mongodb-server-7.0.gpg ] https://repo.mongodb.org/apt/ubuntu jammy/mongodb-org/7.0 multiverse" | sudo tee /etc/apt/sources.list.d/mongodb-org-7.0.list
sudo apt update && sudo apt install -y mongodb-org
sudo systemctl enable --now mongod
```

## 2. Clone the repository

```bash
cd /var/www
sudo git clone https://github.com/Netlayer-global/Mx-ix_Website.git mx-ix
sudo chown -R $USER:$USER /var/www/mx-ix
cd /var/www/mx-ix
```
> Private repo: use a GitHub Personal Access Token or deploy key when prompted.

## 3. Backend

```bash
cd /var/www/mx-ix/backend
npm install
npm run build           # compiles TypeScript to dist/

# create .env
cat > .env <<'EOF'
PORT=5000
NODE_ENV=production
MONGODB_URI=mongodb://localhost:27017/mx-ix-admin
JWT_SECRET=CHANGE_ME_TO_A_LONG_RANDOM_STRING
JWT_EXPIRES_IN=7d
ADMIN_EMAIL=admin@mx-ix.com
ADMIN_PASSWORD=CHANGE_ME
FRONTEND_URL=https://mx-ix.com
LG_API_URL=http://103.139.191.168/api/v1
# Optional integrations:
GRAFANA_URL=
GRAFANA_API_KEY=
SMTP_HOST=
SMTP_PORT=587
SMTP_USER=
SMTP_PASS=
SMTP_FROM=MX-IX Status <status@mx-ix.com>
EOF

# seed initial data (admin user, sample content)
npm run seed

# start with PM2 (runs compiled dist/app.js)
pm2 start dist/app.js --name mx-ix-api
pm2 save
pm2 startup    # run the command it prints to enable boot startup
```

## 4. Frontend

```bash
cd /var/www/mx-ix/frontend
npm install
npm run build           # outputs to dist/
```

## 5. Nginx

```bash
sudo nano /etc/nginx/sites-available/mx-ix
```
Paste:
```nginx
server {
    listen 80;
    server_name mx-ix.com www.mx-ix.com;   # change to your domain / server IP

    root /var/www/mx-ix/frontend/dist;
    index index.html;

    # API → backend
    location /api/ {
        proxy_pass http://127.0.0.1:5000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # SPA fallback (path-based routing: /about, /members, /looking-glass, ...)
    location / {
        try_files $uri $uri/ /index.html;
    }
}
```
Enable + reload:
```bash
sudo ln -s /etc/nginx/sites-available/mx-ix /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
```

## 6. Firewall + HTTPS (optional but recommended)

```bash
sudo ufw allow 'Nginx Full' && sudo ufw allow OpenSSH && sudo ufw enable

# Free SSL via Let's Encrypt (needs a domain pointing to this server)
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d mx-ix.com -d www.mx-ix.com
```

---

## Updating after new commits
```bash
cd /var/www/mx-ix
git pull
cd backend && npm install && npm run build && pm2 restart mx-ix-api
cd ../frontend && npm install && npm run build
sudo systemctl reload nginx
```

## Verify
```bash
pm2 status                       # mx-ix-api online
curl -s http://127.0.0.1:5000/api/health
curl -s http://127.0.0.1/api/members | head   # via Nginx
```
Then open `http://<server-ip>/` — admin at `/admin` (admin@mx-ix.com / your ADMIN_PASSWORD).
