#!/bin/bash

# Update system packages
sudo apt update && sudo apt upgrade -y

# Install Nginx
sudo apt install nginx -y
sudo systemctl start nginx
sudo systemctl enable nginx

# Install Certbot for SSL (for HTTPS)
sudo apt install certbot python3-certbot-nginx -y

# Create web directory if it doesn't exist
sudo mkdir -p /var/www/html
sudo chown -R ubuntu:ubuntu /var/www/html

# Copy Nginx configuration (assumes nginx.conf is in the current directory)
sudo cp nginx.conf /etc/nginx/sites-available/agentics.conf
sudo ln -sf /etc/nginx/sites-available/agentics.conf /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default # Remove default config

# Restart Nginx to apply configuration
sudo systemctl restart nginx

# Get SSL certificate (uncomment when domain is pointed to server)
# sudo certbot --nginx -d agentics.xpectrum-ai.com -d www.agentics.xpectrum-ai.com

echo "EC2 setup completed! You can now deploy your application."