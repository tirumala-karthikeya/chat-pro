#!/bin/bash

# MongoDB setup script for EC2
# Run this script once when setting up the EC2 instance

# Update package list
echo "Updating package list..."
sudo apt-get update

# Install MongoDB
echo "Installing MongoDB..."
sudo apt-get install -y mongodb

# Start MongoDB service
echo "Starting MongoDB service..."
sudo systemctl start mongodb

# Enable MongoDB to start on boot
echo "Enabling MongoDB to start on boot..."
sudo systemctl enable mongodb

# Check MongoDB status
echo "Checking MongoDB status..."
sudo systemctl status mongodb

# Create MongoDB user and database
echo "Creating MongoDB user and database..."
mongo <<EOF
use chatbots
db.createUser({
  user: "chatbot_user",
  pwd: "changeme_immediately", 
  roles: [{ role: "readWrite", db: "chatbots" }]
})
EOF

echo "MongoDB setup complete!"
echo "IMPORTANT: Update your .env file with the following values:"
echo "MONGODB_URI=mongodb+srv://ghoshishw:YBaejDO1zEy1GhhX@cluster0.tslum.mongodb.net/"
echo "MONGODB_DB=chatbots"
echo ""
echo "SECURITY WARNING: Remember to change the default password immediately!" 