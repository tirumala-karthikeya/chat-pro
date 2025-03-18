#!/bin/bash

# Variables
EC2_USER="ubuntu"
EC2_IP="35.164.58.94"
SSH_KEY_PATH="~/.ssh/your-ec2-key.pem" # Update this with your actual key path
IMAGE_NAME="chatbot-dashboard"
REMOTE_DIR="/home/ubuntu/chatbot-app"

# Check if the key file exists
if [ ! -f "$SSH_KEY_PATH" ]; then
  echo "Error: SSH key file not found: $SSH_KEY_PATH"
  echo "Please update the SSH_KEY_PATH variable with your actual key path."
  exit 1
fi

echo "Saving Docker image to tar file..."
docker save $IMAGE_NAME:latest -o $IMAGE_NAME.tar

echo "Copying Docker Compose file and deployment script to EC2..."
scp -i $SSH_KEY_PATH docker-compose.yml $EC2_USER@$EC2_IP:~/

echo "Copying Docker image to EC2..."
scp -i $SSH_KEY_PATH $IMAGE_NAME.tar $EC2_USER@$EC2_IP:~/

echo "Setting up and running the application on EC2..."
ssh -i $SSH_KEY_PATH $EC2_USER@$EC2_IP << 'EOF'
  # Create application directory if it doesn't exist
  mkdir -p $REMOTE_DIR

  # Move files to application directory
  mv ~/docker-compose.yml $REMOTE_DIR/
  mv ~/$IMAGE_NAME.tar $REMOTE_DIR/

  # Change to application directory
  cd $REMOTE_DIR

  # Load Docker image from tar file
  echo "Loading Docker image..."
  docker load -i $IMAGE_NAME.tar
  rm $IMAGE_NAME.tar

  # Stop and remove any existing container
  echo "Stopping existing container if any..."
  docker-compose down || true

  # Start the application using Docker Compose
  echo "Starting application..."
  docker-compose up -d

  # Show container status
  docker ps
EOF

echo "Cleaning up local tar file..."
rm $IMAGE_NAME.tar

echo "Deployment completed successfully!" 