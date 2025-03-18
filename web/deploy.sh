#!/bin/bash

# Build the React application
echo "Building React application..."
npm run build

# Define variables
EC2_USER="ubuntu"
EC2_IP="35.164.58.94"
EC2_PATH="/var/www/html"
SSH_KEY_PATH="~/.ssh/your-ec2-key.pem" # Update this to your EC2 key path

# Copy nginx.conf to EC2 if it doesn't exist there
echo "Copying nginx configuration..."
scp -i $SSH_KEY_PATH nginx.conf $EC2_USER@$EC2_IP:~/nginx.conf

# Copy build files to EC2
echo "Deploying to EC2 at $EC2_IP..."
scp -i $SSH_KEY_PATH -r build/* $EC2_USER@$EC2_IP:$EC2_PATH

echo "Deployment completed successfully!" 