#!/bin/bash

# Exit on any error
set -e

# Define color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}Chatbot Deployment Script${NC}"
echo -e "${YELLOW}This script will deploy your chatbot app to an EC2 instance${NC}"

# Check if AWS CLI is installed
if ! command -v aws &> /dev/null; then
    echo -e "${RED}AWS CLI is not installed. Please install it first.${NC}"
    echo -e "Visit: https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html"
    exit 1
fi

# Check if SSH key is provided
if [ "$#" -ne 1 ]; then
    echo -e "${RED}Usage: $0 <path-to-ssh-key>${NC}"
    echo -e "Example: $0 ~/.ssh/my-ec2-key.pem"
    exit 1
fi

SSH_KEY=$1

# Ask for EC2 instance IP
read -p "Enter your EC2 instance IP address: " EC2_IP

# Verify connection to EC2
echo -e "${YELLOW}Verifying connection to EC2 instance...${NC}"
if ! ssh -i $SSH_KEY -o StrictHostKeyChecking=no ubuntu@$EC2_IP "echo Connected successfully"; then
    echo -e "${RED}Failed to connect to the EC2 instance. Please check your IP and SSH key.${NC}"
    exit 1
fi

# Check if MongoDB is installed on EC2
echo -e "${YELLOW}Checking if MongoDB is installed...${NC}"
if ! ssh -i $SSH_KEY ubuntu@$EC2_IP "command -v mongod &> /dev/null"; then
    echo -e "${YELLOW}MongoDB not found. Setting up MongoDB...${NC}"
    # Copy MongoDB setup script to EC2
    scp -i $SSH_KEY ../api/setup_mongodb.sh ubuntu@$EC2_IP:~/setup_mongodb.sh
    # Run MongoDB setup script
    ssh -i $SSH_KEY ubuntu@$EC2_IP "chmod +x ~/setup_mongodb.sh && sudo ~/setup_mongodb.sh"
else
    echo -e "${GREEN}MongoDB is already installed.${NC}"
fi

# Build the Docker image
echo -e "${YELLOW}Building the Docker image...${NC}"
./docker-build.sh

# Get the Docker image ID
IMAGE_ID=$(docker images --format "{{.ID}}" chatbot-app:latest)
if [ -z "$IMAGE_ID" ]; then
    echo -e "${RED}Docker image build failed.${NC}"
    exit 1
fi

# Save the Docker image to a tar file
echo -e "${YELLOW}Saving the Docker image...${NC}"
docker save chatbot-app:latest > chatbot-app.tar

# Copy the image to EC2
echo -e "${YELLOW}Copying the Docker image to EC2 (this may take a while)...${NC}"
scp -i $SSH_KEY chatbot-app.tar ubuntu@$EC2_IP:~/chatbot-app.tar

# Copy the docker-compose.yml and nginx configuration
echo -e "${YELLOW}Copying configuration files...${NC}"
scp -i $SSH_KEY docker-compose.yml ubuntu@$EC2_IP:~/docker-compose.yml
scp -i $SSH_KEY nginx.docker.conf ubuntu@$EC2_IP:~/nginx.conf

# Copy environment files
echo -e "${YELLOW}Copying environment files...${NC}"
scp -i $SSH_KEY .env.production ubuntu@$EC2_IP:~/.env
scp -i $SSH_KEY ../api/.env ubuntu@$EC2_IP:~/api.env

# Load the image and start the containers
echo -e "${YELLOW}Loading the Docker image and starting the containers...${NC}"
ssh -i $SSH_KEY ubuntu@$EC2_IP << 'EOF'
    # Load the Docker image
    docker load < chatbot-app.tar
    rm chatbot-app.tar
    
    # Check if MongoDB is running
    if ! systemctl is-active --quiet mongodb; then
        echo "Starting MongoDB service..."
        sudo systemctl start mongodb
    fi
    
    # Stop any running containers
    docker-compose down || true
    
    # Start the containers
    docker-compose up -d
    
    # Clean up dangling images
    docker image prune -f
EOF

echo -e "${GREEN}Deployment completed!${NC}"
echo -e "Your chatbot app should now be running at: http://$EC2_IP"
echo -e "${YELLOW}Note: It may take a few moments for the server to start up completely.${NC}" 