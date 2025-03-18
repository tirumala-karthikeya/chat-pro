#!/bin/bash

# Variables
EC2_USER="ubuntu"
EC2_IP="35.164.58.94"
SSH_KEY_PATH="~/.ssh/your-ec2-key.pem" # Update this with your actual key path

# Check if the key file exists
if [ ! -f "$SSH_KEY_PATH" ]; then
  echo "Error: SSH key file not found: $SSH_KEY_PATH"
  echo "Please update the SSH_KEY_PATH variable with your actual key path."
  exit 1
fi

echo "Copying Docker setup script to EC2..."
scp -i $SSH_KEY_PATH ec2-docker-setup.sh $EC2_USER@$EC2_IP:~/

echo "Making script executable..."
ssh -i $SSH_KEY_PATH $EC2_USER@$EC2_IP "chmod +x ~/ec2-docker-setup.sh"

echo "Running Docker setup script on EC2..."
ssh -i $SSH_KEY_PATH $EC2_USER@$EC2_IP "~/ec2-docker-setup.sh"

echo "Docker setup initiated. Once complete, you can deploy your application using docker-deploy.sh" 