# Chatbot Dashboard Application

A comprehensive dashboard for creating and managing customizable chatbots. Each chatbot has a unique URL and QR code for easy access and sharing.

## Features

- Create customizable chatbots with unique URLs
- Generate and download QR codes for each chatbot
- Customize chatbot appearance (colors, logos, backgrounds)
- Analytics integration
- Responsive design

## Deployment Instructions for AWS EC2

### Prerequisites

- AWS EC2 instance running Ubuntu
- Domain name pointed to your EC2 instance IP (35.164.58.94)
- SSH key pair for EC2 access

### Deployment Steps

#### 1. Update SSH Key Path

Before running any of the scripts, make sure to update the SSH key path in the following files:
- `setup-remote.sh`
- `deploy.sh`

Change the `SSH_KEY_PATH` variable to point to your EC2 key file:
```bash
SSH_KEY_PATH="~/.ssh/your-actual-key-name.pem"
```

#### 2. Initial Server Setup

Run the remote setup script to configure the EC2 instance:

```bash
./setup-remote.sh
```

This script will:
- Copy nginx configuration to your EC2 instance
- Copy and execute the EC2 setup script on your instance
- Install and configure Nginx
- Set up proper permissions

#### 3. Build and Deploy the Application

After the server is set up, deploy the application:

```bash
./deploy.sh
```

This script will:
- Build the React application
- Copy the build files to your EC2 instance
- Copy the nginx configuration if it doesn't exist

#### 4. SSL Configuration (Optional but Recommended)

To enable HTTPS for your domain:

1. Log into your EC2 instance:
   ```bash
   ssh -i ~/.ssh/your-key.pem ubuntu@35.164.58.94
   ```

2. Run Certbot to obtain and configure SSL certificates:
   ```bash
   sudo certbot --nginx -d agentics.xpectrum-ai.com -d www.agentics.xpectrum-ai.com
   ```

3. Follow the prompts to complete the process

### Troubleshooting

- **Nginx Configuration Issues**: Check the Nginx error logs:
  ```bash
  sudo tail -f /var/log/nginx/error.log
  ```

- **Permission Issues**: Ensure proper ownership of web files:
  ```bash
  sudo chown -R ubuntu:ubuntu /var/www/html
  ```

- **Restart Nginx**: After making changes to configuration:
  ```bash
  sudo systemctl restart nginx
  ```

## Development

### Local Development

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