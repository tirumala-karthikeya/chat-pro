#!/bin/bash

# Update system packages
sudo yum update -y

# Install Nginx
sudo amazon-linux-extras install nginx1 -y
sudo systemctl start nginx
sudo systemctl enable nginx

# Install Certbot for SSL (for HTTPS)
sudo amazon-linux-extras install epel -y
sudo yum install certbot python-certbot-nginx -y

# Create web directory if it doesn't exist
sudo mkdir -p /var/www/html
sudo chown -R ec2-user:ec2-user /var/www/html

# Copy Nginx configuration
sudo cp /home/ec2-user/nginx.conf /etc/nginx/conf.d/agentics.conf
sudo rm -f /etc/nginx/conf.d/default.conf # Remove default config

# Restart Nginx to apply configuration
sudo systemctl restart nginx

# Get SSL certificate (uncomment when domain is pointed to server)
# sudo certbot --nginx -d agentics.xpectrum-ai.com -d www.agentics.xpectrum-ai.com

echo "EC2 setup completed! You can now deploy your application." 