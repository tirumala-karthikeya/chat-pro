#!/bin/bash

# Variables
IMAGE_NAME="chatbot-dashboard"
IMAGE_TAG=$(date +%Y%m%d-%H%M%S)

echo "Building Docker image: $IMAGE_NAME:$IMAGE_TAG"

# Build the Docker image
docker build -t $IMAGE_NAME:$IMAGE_TAG -t $IMAGE_NAME:latest .

echo "Docker image built successfully: $IMAGE_NAME:$IMAGE_TAG"
echo "Also tagged as: $IMAGE_NAME:latest" 