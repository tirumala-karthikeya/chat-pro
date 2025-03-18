# Chatbot Dashboard Application

A comprehensive dashboard for creating and managing customizable chatbots. Each chatbot has a unique URL and QR code for easy access and sharing.

## Features

- Create customizable chatbots with unique URLs
- Generate and download QR codes for each chatbot
- Customize chatbot appearance (colors, logos, backgrounds)
- Analytics integration
- Responsive design

## Deployment Instructions with Docker

### Prerequisites

- AWS EC2 instance running Ubuntu
- Domain name pointed to your EC2 instance IP (35.164.58.94)
- SSH key pair for EC2 access
- Docker and Docker Compose installed locally (for development)

### Deployment Steps

#### 1. Update SSH Key Path

Before running any of the scripts, make sure to update the SSH key path in the following files:
- `setup-docker-remote.sh`
- `docker-deploy.sh`

Change the `SSH_KEY_PATH` variable to point to your EC2 key file:
```bash
SSH_KEY_PATH="~/.ssh/your-actual-key-name.pem"
```

#### 2. Set Up Docker on EC2

Run the script to set up Docker on your EC2 instance:

```bash
chmod +x setup-docker-remote.sh
./setup-docker-remote.sh
```

This script will:
- Copy the Docker setup script to your EC2 instance
- Install Docker and Docker Compose on your EC2 instance
- Configure Docker to start on boot

#### 3. Build and Deploy the Application

After Docker is set up on the EC2 instance, build and deploy the application:

```bash
# First, build the Docker image locally
chmod +x docker-build.sh
./docker-build.sh

# Then, deploy it to EC2
chmod +x docker-deploy.sh
./docker-deploy.sh
```

The deployment script will:
- Save the Docker image as a tar file
- Copy the image and Docker Compose file to your EC2 instance
- Load the image on your EC2 instance
- Start the application using Docker Compose

#### 4. SSL Configuration (Optional but Recommended)

To enable HTTPS for your domain:

1. Log into your EC2 instance:
   ```bash
   ssh -i ~/.ssh/your-key.pem ubuntu@35.164.58.94
   ```

2. Install Certbot:
   ```bash
   sudo apt update
   sudo apt install -y certbot
   ```

3. Obtain SSL certificates:
   ```bash
   sudo certbot certonly --standalone -d agentics.xpectrum-ai.com -d www.agentics.xpectrum-ai.com
   ```

4. Update your docker-compose.yml to use the SSL certificates:
   ```yaml
   services:
     chatbot-dashboard:
       # ... existing config ...
       ports:
         - "80:80"
         - "443:443"
       volumes:
         - /etc/letsencrypt:/etc/letsencrypt:ro
   ```

5. Update nginx.docker.conf to handle HTTPS

### Updating the Application

When you make changes to your application:

1. Build a new Docker image:
   ```bash
   ./docker-build.sh
   ```

2. Deploy the updated image:
   ```bash
   ./docker-deploy.sh
   ```

The deployment process will automatically stop the old container and start a new one with your updates.

### Troubleshooting

- **Docker Issues**: Check Docker logs:
  ```bash
  docker logs chatbot-dashboard
  ```

- **Container Not Starting**: Check if ports are already in use:
  ```bash
  sudo netstat -tulpn | grep 80
  ```

- **View Running Containers**:
  ```bash
  docker ps
  ```

## Development

### Local Development with Docker

Build and run locally with Docker:
```bash
docker-compose up --build
```

Access the application at http://localhost:80

### Traditional Local Development

1. Install dependencies:
   ```bash
   npm install
   ```

2. Start the development server:
   ```bash
   npm start
   ```

3. Access the application at http://localhost:3000

### Building for Production

To create a production build locally:
```bash
npm run build
```

The built files will be in the `build` directory.

## Environment Variables

- `.env.production`: Contains production-specific variables
  - `REACT_APP_DOMAIN`: The production domain URL
  - `PUBLIC_URL`: Base URL for the application
  - `GENERATE_SOURCEMAP`: Whether to generate source maps for debugging 