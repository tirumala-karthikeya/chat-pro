#!/bin/bash

# Variables
EC2_USER="ubuntu"
EC2_IP="35.164.58.94"
SSH_KEY_PATH="~/.ssh/your-ec2-key.pem" # Update this to your EC2 key path

echo "Copying configuration files to EC2..."
# Copy nginx.conf
scp -i $SSH_KEY_PATH nginx.conf $EC2_USER@$EC2_IP:~/nginx.conf

# Copy setup script
scp -i $SSH_KEY_PATH ec2-setup.sh $EC2_USER@$EC2_IP:~/ec2-setup.sh

# Make the script executable on the remote server
ssh -i $SSH_KEY_PATH $EC2_USER@$EC2_IP "chmod +x ~/ec2-setup.sh"

echo "Running setup script on EC2..."
# Run the setup script
ssh -i $SSH_KEY_PATH $EC2_USER@$EC2_IP "~/ec2-setup.sh"

echo "EC2 setup initiated. Ready for deployment." 