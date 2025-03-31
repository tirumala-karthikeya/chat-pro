#!/bin/bash

# Update system packages
sudo apt update && sudo apt upgrade -y

# Install required packages
sudo apt install -y apt-transport-https ca-certificates curl software-properties-common

# Add Docker's official GPG key
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo apt-key add -

# Add the Docker repository
sudo add-apt-repository "deb [arch=amd64] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable"

# Update package database with Docker packages
sudo apt update

# Install Docker
sudo apt install -y docker-ce

# Add current user to the Docker group to run Docker without sudo
sudo usermod -aG docker ${USER}

# Install Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/download/v2.23.3/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# Enable and start Docker service
sudo systemctl enable docker
sudo systemctl start docker

# Check Docker and Docker Compose versions
echo "Docker version:"
docker --version
echo "Docker Compose version:"
docker-compose --version

echo "Docker and Docker Compose installed successfully!"
echo "NOTE: You may need to log out and log back in for the Docker group changes to take effect." 