#!/bin/bash

# Build the React application
echo "Building React application..."
npm run build

# Define variables
EC2_USER="ec2-user"
EC2_IP="35.164.58.94"
EC2_PATH="/var/www/html"
SSH_KEY_PATH="~/.ssh/your-ec2-key.pem" # Update this to your EC2 key path

# Copy build files to EC2
echo "Deploying to EC2 at $EC2_IP..."
scp -i $SSH_KEY_PATH -r build/* $EC2_USER@$EC2_IP:$EC2_PATH

echo "Deployment completed successfully!" 