# Chatbot Management Dashboard

A full-stack application for creating, managing, and deploying AI chatbots with customizable UI.

## Features

- Create, edit, and delete chatbots with customizable designs
- QR code generation for easy sharing
- Analytics integration
- Responsive UI
- Persistent storage with MongoDB

## Architecture

- **Frontend**: React.js
- **Backend**: FastAPI (Python)
- **Database**: MongoDB

## Setup Instructions

### Prerequisites

- Node.js (v14+)
- Python (v3.8+)
- MongoDB

### Backend Setup

1. Navigate to the API directory:
   ```
   cd api
   ```

2. Install dependencies:
   ```
   pip install -r requirements.txt
   ```

3. Set the MongoDB connection string:
   ```
   export MONGODB_URI="mongodb://localhost:27017"
   ```

4. Start the backend server:
   ```
   python run.py
   ```
   The API will be available at `http://localhost:8001`

### Frontend Setup

1. Navigate to the web directory:
   ```
   cd web
   ```

2. Install dependencies:
   ```
   npm install
   ```

3. Start the development server:
   ```
   npm start
   ```
   The web app will be available at `http://localhost:3000`

## Deployment

### Local Machine

For local development and testing, the app will default to using `localhost:8001` for the API.

### Production Deployment

When deploying to a production server:

1. The frontend automatically detects when it's not running locally and constructs the API URL based on the current hostname.
2. Make sure both the API and web server are running on the same domain.
3. The API should be accessible on port 8001.

Example:
- Web UI: `http://your-domain.com`
- API: `http://your-domain.com:8001`

## Debugging

### Debug Panel

The application includes a built-in debug panel for troubleshooting connection issues:

1. Press `Ctrl+Shift+D` to toggle the debug panel
2. The panel displays:
   - Current API URL
   - Connection status
   - Host information
   - Network status

### Common Issues and Solutions

#### API Connection Issues

If you're having trouble connecting to the API:

1. Check if the API is running
2. Verify the API URL is correct
3. Use the "Test CORS" button in the debug panel to check CORS configuration
4. Try opening the API directly in a browser using the "Open API in Browser" button

#### Cross-Origin (CORS) Issues

If you see CORS errors in the console:

1. Make sure the API's CORS settings allow requests from your frontend origin
2. Check if the API is accessible from the browser

#### Deployment Considerations

When deploying:

1. Ensure port 8001 is open and accessible from the internet
2. Configure your firewall to allow traffic on this port
3. Set up proper DNS records if using a domain name

## License

This project is licensed under the MIT License - see the LICENSE file for details. 