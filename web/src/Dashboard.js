import React, { useState, useEffect, useRef } from 'react';
import QRCode from 'react-qr-code';
import './Dashboard.css';

// API base URL - dynamically determined based on environment
const getApiBaseUrl = () => {
    // Get the current hostname (will be the EC2 public DNS/IP when deployed)
    const hostname = window.location.hostname;
    const protocol = window.location.protocol;
    
    // Check if using a specific environment variable
    if (process.env.REACT_APP_API_URL) {
        return process.env.REACT_APP_API_URL;
    }
    
    // If running locally (localhost), use localhost:8001
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
        return 'http://localhost:8001';
    }
    
    // Otherwise use the same hostname as the frontend WITHOUT port 8001
    // Path should be /api to match Nginx location configuration
    return `${protocol}//${hostname}/api`;
};

const API_BASE_URL = getApiBaseUrl();
console.log('Using API URL:', API_BASE_URL);

function Dashboard() {
    const [chatbots, setChatbots] = useState([]);
    const [showForm, setShowForm] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [visibleQRCodes, setVisibleQRCodes] = useState({});
    const [isLoading, setIsLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState(null);
    const [toast, setToast] = useState({ show: false, message: '', type: 'success' });
    const [showDebugPanel, setShowDebugPanel] = useState(false);
    const [apiStatus, setApiStatus] = useState('Not checked');
    const [lastUpdated, setLastUpdated] = useState(Date.now());
    const [currentBot, setCurrentBot] = useState({
        id: '',
        name: '',
        chatLogoColor: '#3884db',
        chatLogoImage: '',
        iconAvatarImage: '',
        staticImage: '',
        chatHeaderColor: '#b4c7c5',
        chatBgGradientStart: '#ffffff',
        chatBgGradientEnd: '#6398d5',
        bodyBackgroundImage: '',
        welcomeText: 'Welcome to our assistant! How can I help you today?',
        apiKey: '',
        analyticsUrl: 'http://localhost:8088/superset/dashboard/1/?native_filters_key=Fa1TCGahXdiVfZhNjZrPy3B1jZ9yTguoXRkKKmBPW9w88GDy2Qc7wuFXjlp8oNtK',
        uniqueId: generateUniqueId()
    });
    const [dataSource, setDataSource] = useState('unknown');
    const [qrModalBot, setQrModalBot] = useState(null);

    // Enable debug panel with Ctrl+Shift+D
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.ctrlKey && e.shiftKey && e.key === 'D') {
                e.preventDefault();
                setShowDebugPanel(prev => !prev);
            }
        };
        
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, []);

    // Check API connection status
    const checkApiStatus = async () => {
        try {
            setApiStatus('Checking connection...');
            
            // Try to get the health endpoint first
            console.log(`Checking API health at ${API_BASE_URL}/health`);
            
            const timeoutController = new AbortController();
            const timeoutId = setTimeout(() => timeoutController.abort(), 5000);
            
            const response = await fetch(`${API_BASE_URL}/health`, { 
                method: 'GET',
                headers: { 'Content-Type': 'application/json' },
                signal: timeoutController.signal
            });
            
            clearTimeout(timeoutId);
            
            if (response.ok) {
                try {
                    const healthData = await response.json();
                    const dbType = healthData.database || 'Unknown';
                    const connected = healthData.connected === true;
                    const connectionString = healthData.connection_string || 'Not provided';
                    
                    // Determine connection status
                    let statusMessage = '';
                    if (dbType === 'MongoDB' && connected) {
                        statusMessage = 'Connected to DB';
                        setDataSource('MongoDB');
                    } else if (dbType === 'MongoDB' && !connected) {
                        statusMessage = 'DB configured but connection failed';
                        setDataSource('localStorage');
                    } else if (dbType === 'localStorage') {
                        statusMessage = 'Using local storage (DB not configured)';
                        setDataSource('localStorage');
                    } else {
                        statusMessage = `Connected to ${dbType}`;
                    }
                    
                    setApiStatus(`API OK - ${statusMessage}`);
                    console.log('API health check successful:', healthData);
                    
                    // Add more detailed diagnostics
                    let diagnosticDetails = '';
                    if (connectionString) {
                        // Redact username/password from connection string for display
                        let redactedString = connectionString;
                        try {
                            // Try to redact username/password from MongoDB URI if present
                            if (connectionString.includes('@')) {
                                const parts = connectionString.split('@');
                                const credentials = parts[0].split('://')[1];
                                redactedString = connectionString.replace(credentials, '***:***');
                            }
                            diagnosticDetails += ` - MongoDB URI: ${redactedString}`;
                        } catch (e) {
                            diagnosticDetails += ` - MongoDB URI: (redaction failed)`;
                        }
                    }
                    
                    // Also check if we can get chatbots
                    try {
                        const chatbotsRequestStart = Date.now();
                        const chatbotsResponse = await fetch(`${API_BASE_URL}/chatbots`, {
                            signal: AbortSignal.timeout(3000)
                        });
                        const requestTime = Date.now() - chatbotsRequestStart;
                        
                        if (chatbotsResponse.ok) {
                            const data = await chatbotsResponse.json();
                            const chatbotsCount = Array.isArray(data) ? data.length : (data.chatbots ? data.chatbots.length : '?');
                            console.log(`Successfully fetched ${chatbotsCount} chatbots in ${requestTime}ms`);
                            setApiStatus(`${statusMessage}${diagnosticDetails} - Found ${chatbotsCount} chatbots (${requestTime}ms)`);
                        } else {
                            setApiStatus(`${statusMessage}${diagnosticDetails} - Error fetching chatbots: ${chatbotsResponse.status}`);
                        }
                    } catch (chatbotsError) {
                        console.warn('Error fetching chatbots during health check:', chatbotsError);
                        setApiStatus(`${statusMessage}${diagnosticDetails} - Could not fetch chatbots: ${chatbotsError.message}`);
                    }
                } catch (parseError) {
                    console.error('Error parsing health response:', parseError);
                    setApiStatus(`API response parsing error: ${parseError.message}`);
                }
            } else {
                console.warn(`API health check returned status ${response.status}`);
                try {
                    const errorText = await response.text();
                    setApiStatus(`Error: API returned ${response.status} ${response.statusText}. Details: ${errorText.substring(0, 100)}`);
                } catch (textError) {
                    setApiStatus(`Error: API returned ${response.status} ${response.statusText}`);
                }
            }
        } catch (error) {
            console.error('API health check failed:', error);
            
            // Provide more specific error messages based on the error type
            if (error.name === 'AbortError') {
                setApiStatus(`Error: Connection timeout after 5 seconds`);
            } else if (error.message && error.message.includes('Failed to fetch')) {
                setApiStatus(`Error: Network connection failed - API unreachable`);
            } else if (error.message && error.message.includes('NetworkError')) {
                setApiStatus(`Error: CORS issue or network restriction`);
            } else {
                setApiStatus(`Error: ${error.message || 'Could not connect to API'}`);
            }
            
            // Check if localStorage has any chatbots that could be used
            try {
                const storedChatbots = localStorage.getItem('chatbots');
                if (storedChatbots) {
                    const parsedChatbots = JSON.parse(storedChatbots);
                    if (Array.isArray(parsedChatbots) && parsedChatbots.length > 0) {
                        const timestamp = localStorage.getItem('chatbots_timestamp');
                        const timestampStr = timestamp 
                            ? new Date(parseInt(timestamp)).toLocaleString() 
                            : 'unknown time';
                        setApiStatus(prev => `${prev} - Using ${parsedChatbots.length} chatbots from localStorage (${timestampStr})`);
                    }
                }
            } catch (e) {
                console.warn('Error checking localStorage during API failure:', e);
            }
            
            console.log('Debug info - Navigator online:', window.navigator.onLine);
            console.log('Debug info - API URL:', API_BASE_URL);
        }
    };

    // Show toast notification
    const showToast = (message, type = 'success') => {
        setToast({ show: true, message, type });
        setTimeout(() => {
            setToast({ show: false, message: '', type: 'success' });
        }, 3000);
    };

    // Generate a random unique ID
    function generateUniqueId() {
        return Math.random().toString(36).substring(2, 12);
    }

    // Filter chatbots based on search term
    const filteredChatbots = chatbots.filter(bot => 
        bot.name.toLowerCase().includes(searchTerm.toLowerCase())
    );

    // Fetch chatbots from the API
    const fetchChatbots = async (isRetry = false) => {
        if (isRetry) {
            setApiStatus('Retrying connection...');
        }
        
        // Only show loading state if this is a user-initiated load AND we have no cached chatbots
        if ((isRetry || isLoading) && chatbots.length === 0) {
            setIsLoading(true);
        } else {
            // Show subtle refreshing indicator for background refreshes
            setRefreshing(true);
        }
        
        // Track data source for UI feedback
        let dataSource = 'api';
        let success = false;
        
        try {
            console.log(`Fetching chatbots from ${API_BASE_URL}/chatbots`);
            
            // Set a timeout of 3 seconds for the fetch to improve perceived performance
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 3000);
            
            const response = await fetch(`${API_BASE_URL}/chatbots`, {
                signal: controller.signal
            });
            
            clearTimeout(timeoutId);
            
            if (!response.ok) {
                console.error(`API returned status ${response.status}: ${response.statusText}`);
                
                // If the response is not ok, throw an error to be caught below
                throw new Error(`API returned status ${response.status}: ${response.statusText}`);
            }
            
            const data = await response.json();
            console.log('Fetched chatbots from API:', data);
            
            // Fix: Check if the response has a chatbots property, otherwise use the data directly
            const chatbotsArray = data.chatbots || data;
            
            // Ensure we're working with an array
            if (!Array.isArray(chatbotsArray)) {
                console.error('Expected an array of chatbots but received:', chatbotsArray);
                throw new Error('Invalid data format: Expected an array of chatbots');
            } else {
                // API fetch succeeded - update state with MongoDB data
                setChatbots(chatbotsArray);
                
                // Store last update timestamp
                setLastUpdated(Date.now());
                
                // Also save to localStorage as backup for future offline use
                try {
                    localStorage.setItem('chatbots', JSON.stringify(chatbotsArray));
                    localStorage.setItem('chatbots_timestamp', Date.now());
                    console.log('Saved API chatbots to localStorage as backup');
                } catch (storageError) {
                    console.warn('Failed to save chatbots to localStorage:', storageError);
                }
                
                if (isRetry || showDebugPanel) {
                    setApiStatus(`Connected - Successfully fetched ${chatbotsArray.length} chatbots from DB`);
                }
                
                success = true;
                dataSource = 'MongoDB';
            }
            
            // Check the storage type by calling the health endpoint
            try {
                const healthResponse = await fetch(`${API_BASE_URL}/health`);
                if (healthResponse.ok) {
                    const healthData = await healthResponse.json();
                    dataSource = healthData.database || 'MongoDB';
                    setDataSource(dataSource);
                }
            } catch (healthError) {
                console.warn('Could not determine data source:', healthError);
            }
        } catch (error) {
            console.error('Error fetching chatbots from API:', error);
            
            // Store the error message for the debug panel
            const errorMessage = error.message || 'Unknown error';
            setApiStatus(`Error: ${errorMessage}`);
            success = false;
            
            // Only show error in development, or if we explicitly retried
            if (process.env.NODE_ENV === 'development' && isRetry) {
                console.warn('API connection error during explicit retry:', error);
            }
        }
        
        // If API fetch failed, try to load from local storage as fallback
        if (!success) {
            try {
                // Show notification that we're using local data
                showToast('Network issue detected. Using offline data.', 'warning');
                
                console.log('Attempting to load chatbots from localStorage');
                const storedChatbots = localStorage.getItem('chatbots');
                
                if (storedChatbots) {
                    const parsedChatbots = JSON.parse(storedChatbots);
                    if (Array.isArray(parsedChatbots) && parsedChatbots.length > 0) {
                        setChatbots(parsedChatbots);
                        dataSource = 'localStorage';
                        setDataSource(dataSource);
                        
                        const timestamp = localStorage.getItem('chatbots_timestamp');
                        const timestampStr = timestamp 
                            ? new Date(parseInt(timestamp)).toLocaleString() 
                            : 'unknown time';
                        
                        console.log(`Loaded ${parsedChatbots.length} chatbots from localStorage (saved at ${timestampStr})`);
                        setApiStatus(`Using local data from ${timestampStr} - API connection failed`);
                        success = true;
                    } else {
                        console.warn('No valid chatbots found in localStorage');
                    }
                } else {
                    console.warn('No chatbots found in localStorage');
                    // Initialize with empty array if nothing in local storage
                    setChatbots([]);
                }
            } catch (localStorageError) {
                console.error('Error using localStorage fallback:', localStorageError);
                setChatbots([]);
                setError('Failed to load chatbots from any source. Please refresh the page and try again.');
            }
        }
        
        setIsLoading(false);
        setRefreshing(false);
        return success;
    };

    // Fetch chatbots when the component mounts and set up auto-refresh
    useEffect(() => {
        // First try to show data from localStorage immediately
        try {
            const storedChatbots = localStorage.getItem('chatbots');
            if (storedChatbots) {
                const parsedChatbots = JSON.parse(storedChatbots);
                if (Array.isArray(parsedChatbots) && parsedChatbots.length > 0) {
                    // Show cached data immediately
                    setChatbots(parsedChatbots);
                    console.log('Showing cached chatbots while fetching fresh data');
                    // Reduce the perceived loading time by showing cached data
                    setIsLoading(false);
                }
            }
        } catch (e) {
            console.warn('Error loading cached chatbots:', e);
        }
        
        // Then fetch fresh data from the API
        fetchChatbots().finally(() => {
            setIsLoading(false);
        });
        
        // Check the API status immediately on mount to determine data source
        if (!showDebugPanel) {
            checkApiStatus(); // Call this even if debug panel is not shown to get data source
        }
        
        // Set up auto-refresh every 10 seconds
        const autoRefreshInterval = setInterval(() => {
            // Only fetch if not in form edit mode to prevent disrupting user edits
            if (!showForm) {
                // Use silent refresh (no loading indicator)
                fetchChatbots(false); 
                console.log('Auto-refreshing chatbots data');
            }
        }, 10000);
        
        // Clean up interval on component unmount
        return () => clearInterval(autoRefreshInterval);
    }, [showForm]);

    // Check API status when debug panel is shown
    useEffect(() => {
        if (showDebugPanel) {
            checkApiStatus();
        }
    }, [showDebugPanel]);

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setCurrentBot({
            ...currentBot,
            [name]: value
        });
    };

    // Handle file uploads and convert to base64
    const handleFileUpload = (e) => {
        const { name, files } = e.target;
        if (files && files[0]) {
            const file = files[0];
            const reader = new FileReader();
            reader.onloadend = () => {
                setCurrentBot({
                    ...currentBot,
                    [name]: reader.result
                });
            };
            reader.readAsDataURL(file);
        }
    };

    // Validate API key format
    const validateApiKey = async (apiKey) => {
        try {
            if (!apiKey || apiKey.trim() === '') {
                return { valid: false, message: "API key cannot be empty" };
            }
            
            // Check for a valid Next-AGI API key format
            const validFormat = /^app-[a-zA-Z0-9]{24,}$/;
            if (!validFormat.test(apiKey)) {
                return { 
                    valid: false, 
                    message: "API key format is invalid. Should start with 'app-' followed by alphanumeric characters." 
                };
            }
            
            return { valid: true };
        } catch (error) {
            console.error("Error validating API key:", error);
            return { valid: false, message: "Error validating API key" };
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        
        // Validate the API key
        const validation = await validateApiKey(currentBot.apiKey);
        if (!validation.valid) {
            alert(`Invalid API key: ${validation.message}`);
            return;
        }
        
        const newBot = {
            ...currentBot,
            id: currentBot.id || Date.now().toString(),
            uniqueId: currentBot.uniqueId || generateUniqueId()
        };
        
        try {
            let response;
            
            if (currentBot.id) {
                console.log('Updating existing chatbot with ID:', currentBot.id, 'and uniqueId:', currentBot.uniqueId);
                
                // Immediately update the existing bot in the state for instant UI feedback
                setChatbots(prevChatbots => {
                    const updatedBots = prevChatbots.map(bot => {
                        // Match by both id and uniqueId to ensure correct update
                        if (bot.id === newBot.id || bot.uniqueId === newBot.uniqueId) {
                            console.log('Found bot to update in UI:', bot.name);
                            return newBot;
                        }
                        return bot;
                    });
                    console.log('Updated chatbots state:', updatedBots.length);
                    return updatedBots;
                });
                
                // Then send API request
                response = await fetch(`${API_BASE_URL}/chatbots/${newBot.uniqueId}`, {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(newBot)
                });
            } else {
                console.log('Creating new chatbot');
                
                // Create new bot
                response = await fetch(`${API_BASE_URL}/chatbots`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(newBot)
                });
                
                // Immediately add the new bot to the state
                setChatbots(prevChatbots => [...prevChatbots, newBot]);
            }
            
            // Also refresh from API in the background without showing loading state
            fetchChatbots(false);
            
            // If we get here, consider the operation successful (even if response has issues)
            showToast(currentBot.id ? 'Chatbot updated successfully!' : 'Chatbot created successfully!');
            
            // Reset form
            setCurrentBot({
                id: '',
                name: '',
                chatLogoColor: '#3884db',
                chatLogoImage: '',
                iconAvatarImage: '',
                staticImage: '',
                chatHeaderColor: '#b4c7c5',
                chatBgGradientStart: '#ffffff',
                chatBgGradientEnd: '#6398d5',
                bodyBackgroundImage: '',
                welcomeText: 'Welcome to our assistant! How can I help you today?',
                apiKey: '',
                analyticsUrl: 'http://localhost:8088/superset/dashboard/1/?native_filters_key=Fa1TCGahXdiVfZhNjZrPy3B1jZ9yTguoXRkKKmBPW9w88GDy2Qc7wuFXjlp8oNtK',
                uniqueId: generateUniqueId()
            });
            
            setShowForm(false);
        } catch (error) {
            console.error("Error saving chatbot:", error);
            
            // Check if the chatbot exists in the list after the failed API call
            const botExists = await checkIfBotExists(newBot.uniqueId);
            
            if (botExists) {
                // If bot exists despite the error, consider it a success
                showToast(currentBot.id ? 'Chatbot updated successfully!' : 'Chatbot created successfully!');
                setShowForm(false);
                
                // Add to UI if it's not already there
                if (!currentBot.id) {
                    setChatbots(prevChatbots => {
                        // Check if bot is already in list
                        if (!prevChatbots.some(bot => bot.uniqueId === newBot.uniqueId)) {
                            return [...prevChatbots, newBot];
                        }
                        return prevChatbots;
                    });
                } else {
                    // Update the bot in UI even if there was an API error but bot exists
                    setChatbots(prevChatbots => {
                        return prevChatbots.map(bot => {
                            if (bot.id === newBot.id || bot.uniqueId === newBot.uniqueId) {
                                return newBot;
                            }
                            return bot;
                        });
                    });
                }
                
                // Reset form
                setCurrentBot({
                    id: '',
                    name: '',
                    chatLogoColor: '#3884db',
                    chatLogoImage: '',
                    iconAvatarImage: '',
                    staticImage: '',
                    chatHeaderColor: '#b4c7c5',
                    chatBgGradientStart: '#ffffff',
                    chatBgGradientEnd: '#6398d5',
                    bodyBackgroundImage: '',
                    welcomeText: 'Welcome to our assistant! How can I help you today?',
                    apiKey: '',
                    analyticsUrl: 'http://localhost:8088/superset/dashboard/1/?native_filters_key=Fa1TCGahXdiVfZhNjZrPy3B1jZ9yTguoXRkKKmBPW9w88GDy2Qc7wuFXjlp8oNtK',
                    uniqueId: generateUniqueId()
                });
            } else {
                // Only show error if we couldn't verify the bot was saved
                showToast('Failed to save chatbot. Please try again.', 'error');
                
                // Only fall back to localStorage if there was a network error
                if (!window.navigator.onLine || error.message.includes("Failed to fetch")) {
                    // Fallback to localStorage
                    if (currentBot.id) {
                        // Update existing bot in local array
                        setChatbots(chatbots.map(bot => bot.id === currentBot.id ? newBot : bot));
                    } else {
                        // Add new bot to local array
                        setChatbots([...chatbots, newBot]);
                    }
                    
                    // Update localStorage as fallback
                    localStorage.setItem('chatbots', JSON.stringify(
                        currentBot.id 
                            ? chatbots.map(bot => bot.id === currentBot.id ? newBot : bot)
                            : [...chatbots, newBot]
                    ));
                }
            }
        }
    };

    // Add this helper function to check if a bot exists in the database
    const checkIfBotExists = async (uniqueId) => {
        try {
            // Try to fetch the specific chatbot by uniqueId
            const response = await fetch(`${API_BASE_URL}/chatbots/${uniqueId}`);
            return response.ok;
        } catch (error) {
            console.error("Error checking if bot exists:", error);
            return false;
        }
    };

    const editChatbot = (bot) => {
        console.log('Editing chatbot:', bot.name, 'with ID:', bot.id, 'and uniqueId:', bot.uniqueId);
        
        // Make sure we set ALL properties from the bot to edit
        setCurrentBot({
            ...bot,
            // Ensure these properties exist even if not in the original bot
            id: bot.id || '',
            uniqueId: bot.uniqueId || generateUniqueId(),
            chatLogoColor: bot.chatLogoColor || '#3884db',
            chatHeaderColor: bot.chatHeaderColor || '#b4c7c5',
            chatBgGradientStart: bot.chatBgGradientStart || '#ffffff',
            chatBgGradientEnd: bot.chatBgGradientEnd || '#6398d5',
            welcomeText: bot.welcomeText || 'Welcome to our assistant! How can I help you today?',
            analyticsUrl: bot.analyticsUrl || 'http://localhost:8088/superset/dashboard/1/?native_filters_key=Fa1TCGahXdiVfZhNjZrPy3B1jZ9yTguoXRkKKmBPW9w88GDy2Qc7wuFXjlp8oNtK',
        });
        
        setShowForm(true);
    };

    const deleteChatbot = async (id, uniqueId) => {
        if (window.confirm("Are you sure you want to delete this chatbot?")) {
            try {
                // Immediately remove the chatbot from UI for better user experience
                setChatbots(prevChatbots => prevChatbots.filter(bot => bot.id !== id));
                
                // Show success message immediately
                showToast('Chatbot deleted successfully!');
                
                // Send delete request to API
                const response = await fetch(`${API_BASE_URL}/chatbots/${uniqueId}`, {
                    method: 'DELETE',
                });
                
                // Also refresh from API in the background without showing loading state
                fetchChatbots(false);
                
                // Check if the bot was actually removed
                const botStillExists = await checkIfBotExists(uniqueId);
                
                if (botStillExists) {
                    console.error("Chatbot still exists after deletion attempt");
                    // If bot still exists, add it back to the UI
                    fetchChatbots(false);
                    
                    // Show error message
                    showToast('Failed to delete chatbot. Please try again.', 'error');
                }
            } catch (error) {
                console.error("Error deleting chatbot:", error);
                
                // Check if the chatbot still exists despite the error
                const botStillExists = await checkIfBotExists(uniqueId);
                
                if (botStillExists) {
                    // If bot still exists, add it back to the UI
                    fetchChatbots(false);
                    
                    // Show error message
                    showToast('Failed to delete chatbot. Please try again.', 'error');
                }
            }
        }
    };

    // Get the full URL for the chatbot
    const getChatbotFullUrl = (bot) => {
        // Use production domain for QR codes and links
        const isProd = process.env.NODE_ENV === 'production';
        // Get protocol (HTTP/HTTPS)
        const protocol = window.location.protocol;
        // If in production, use the domain from env and current protocol
        const baseUrl = isProd 
            ? `${protocol}//agentics.xpectrum-ai.com` 
            : window.location.origin;
            
        return `${baseUrl}/chatbot/${encodeURIComponent(bot.name)}/${bot.uniqueId}`;
    };

    // Toggle QR code visibility for a specific chatbot
    const toggleQRCode = (botId) => {
        setVisibleQRCodes(prev => ({
            ...prev,
            [botId]: !prev[botId]
        }));
    };

    // Function to download QR code as an image
    const downloadQRCode = (bot) => {
        const qrCodeElement = document.getElementById(`qr-code-${bot.id}`);
        
        if (!qrCodeElement) return;
        
        // Create a canvas element
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        
        // Set canvas size (make it a bit larger to include padding)
        const size = 180;
        canvas.width = size;
        canvas.height = size;
        
        // Fill with white background
        context.fillStyle = 'white';
        context.fillRect(0, 0, size, size);
        
        // Create a new image from the QR code SVG
        const image = new Image();
        
        // Convert SVG to data URL
        const svgData = new XMLSerializer().serializeToString(qrCodeElement);
        const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
        const url = URL.createObjectURL(svgBlob);
        
        image.onload = () => {
            // Draw image in the center of the canvas
            context.drawImage(image, 15, 15, size - 30, size - 30);
            
            // Create download link
            const link = document.createElement('a');
            link.download = `${bot.name}-qrcode.png`;
            link.href = canvas.toDataURL('image/png');
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            
            // Clean up
            URL.revokeObjectURL(url);
        };
        
        image.src = url;
    };

    const launchChatbot = (bot) => {
        // Store the selected bot in sessionStorage
        sessionStorage.setItem('selectedChatbot', JSON.stringify(bot));
        
        // Open with unique URL
        window.open(`/chatbot/${encodeURIComponent(bot.name)}/${bot.uniqueId}`, '_blank');
    };

    // Function to test CORS configuration
    const testCorsConfiguration = async () => {
        try {
            setApiStatus('Testing CORS configuration...');
            
            // First, do a preflight OPTIONS request
            const optionsResponse = await fetch(`${API_BASE_URL}/health`, {
                method: 'OPTIONS',
                headers: {
                    'Origin': window.location.origin,
                    'Access-Control-Request-Method': 'GET',
                    'Access-Control-Request-Headers': 'Content-Type'
                }
            });
            
            console.log('CORS Preflight response:', optionsResponse);
            
            if (optionsResponse.ok) {
                // Check if preflight returned proper CORS headers
                const allowOrigin = optionsResponse.headers.get('Access-Control-Allow-Origin');
                const allowMethods = optionsResponse.headers.get('Access-Control-Allow-Methods');
                const allowHeaders = optionsResponse.headers.get('Access-Control-Allow-Headers');
                
                console.log('CORS Headers:', { allowOrigin, allowMethods, allowHeaders });
                
                if (allowOrigin) {
                    setApiStatus(`CORS Preflight successful - Access-Control-Allow-Origin: ${allowOrigin}`);
                    
                    // Now test an actual GET request
                    const getResponse = await fetch(`${API_BASE_URL}/health`, {
                        method: 'GET',
                        headers: { 'Content-Type': 'application/json' }
                    });
                    
                    if (getResponse.ok) {
                        setApiStatus('CORS configuration is working properly');
                    } else {
                        setApiStatus(`CORS Preflight worked but GET failed with ${getResponse.status}`);
                    }
                } else {
                    setApiStatus('CORS Preflight response missing Access-Control-Allow-Origin header');
                }
            } else {
                setApiStatus(`CORS Preflight failed with status ${optionsResponse.status}`);
            }
        } catch (error) {
            console.error('CORS test failed:', error);
            setApiStatus(`CORS test error: ${error.message}`);
        }
    };

    // Function to handle QR code click
    const handleQRClick = (bot) => {
        setQrModalBot(bot);
    };

    // Function to close QR modal
    const handleCloseQRModal = () => {
        setQrModalBot(null);
    };

    // Add this function to handle QR code download
    const handleQRDownload = (bot) => {
        // Get the existing QR code canvas
        const qrCanvas = document.querySelector('.chatbot-qr-code canvas');
        
        if (!qrCanvas) {
            console.error('QR code canvas not found');
            return;
        }

        try {
            // Convert the canvas to a data URL
            const dataUrl = qrCanvas.toDataURL('image/png');
            
            // Create a link element
            const link = document.createElement('a');
            link.href = dataUrl;
            link.download = `${bot.name}-qr-code.png`;
            
            // Append to body, click, and remove
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        } catch (error) {
            console.error('Error downloading QR code:', error);
        }
    };

    return (
        <div className="dashboard-wrapper">
            <div className="dashboard-background"></div>
            {toast.show && (
                <div className={`toast-notification ${toast.type}`}>
                    {toast.message}
                </div>
            )}
            {showDebugPanel && (
                <div className="debug-panel">
                    <h3>Debug Information</h3>
                    <div className="debug-row">
                        <span>API URL:</span>
                        <span>{API_BASE_URL}</span>
                    </div>
                    <div className="debug-row">
                        <span>Status:</span>
                        <span>{apiStatus}</span>
                    </div>
                    <div className="debug-row">
                        <span>Host:</span>
                        <span>{window.location.hostname}</span>
                    </div>
                    <div className="debug-row">
                        <span>Port:</span>
                        <span>{window.location.port || '(default)'}</span>
                    </div>
                    <div className="debug-row">
                        <span>Protocol:</span>
                        <span>{window.location.protocol}</span>
                    </div>
                    <div className="debug-row">
                        <span>Origin:</span>
                        <span>{window.location.origin}</span>
                    </div>
                    <div className="debug-row">
                        <span>Navigator Online:</span>
                        <span>{window.navigator.onLine ? 'Yes' : 'No'}</span>
                    </div>
                    <div className="debug-row">
                        <span>Network Type:</span>
                        <span>{navigator.connection ? navigator.connection.effectiveType : 'Unknown'}</span>
                    </div>
                    <div className="debug-row">
                        <span>Data Source:</span>
                        <span>{dataSource}</span>
                    </div>
                    <div className="debug-row">
                        <span>Last Updated:</span>
                        <span>{new Date(lastUpdated).toLocaleTimeString()}</span>
                    </div>
                    <div className="debug-actions">
                        <button onClick={() => setShowDebugPanel(false)}>Close</button>
                        <button onClick={() => window.location.reload()}>Reload Page</button>
                        <button onClick={() => fetchChatbots(true)}>Retry API</button>
                        <button onClick={testCorsConfiguration}>Test CORS</button>
                        <button onClick={() => {
                            const testUrl = `${API_BASE_URL}/health`;
                            window.open(testUrl, '_blank');
                        }}>Open API in Browser</button>
                    </div>
                    <div className="debug-tip">
                        Tip: Press Ctrl+Shift+D to toggle this panel
                    </div>
                </div>
            )}
            <div className="dashboard-container">
                <header className="dashboard-header">
                    <div className="header-left">
                        <div className="company-logo">
                            <img src="/logo.jpeg" alt="Company Logo" />
                        </div>
                        <h1>Agents Dashboard</h1>
                    </div>
                    
                    <div className="header-right">
                        <div className="search-bar">
                            <input 
                                type="text"
                                placeholder="Search chatbots..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="18" height="18">
                                <path d="M21.71 20.29l-5.4-5.4A8 8 0 1 0 15 16l5.4 5.4a1 1 0 0 0 1.41-1.41zM10 16a6 6 0 1 1 6-6 6 6 0 0 1-6 6z" fill="#555"/>
                            </svg>
                        </div>
                        <button 
                            className="create-button"
                            onClick={() => setShowForm(true)}
                        >
                            <span>+</span> Create New Chatbot
                        </button>
                    </div>
                </header>

                <div className={`data-source-indicator ${dataSource}`}>
                    {dataSource === 'localStorage' && (
                        <div className="offline-badge">
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
                                <path d="M8 16a.5.5 0 0 1-.5-.5v-1.293l-.646.647a.5.5 0 0 1-.707-.708L7.5 12.793v-1.086l-.646.647a.5.5 0 0 1-.707-.708L7.5 10.293V8.866l-.646.647a.5.5 0 0 1-.707-.708L7.5 7.453v-2.95A.5.5 0 0 1 8 4a.5.5 0 0 1 .5.5v2.95l1.354-1.353a.5.5 0 0 1 .707.708L9.207 8.866v1.427l1.354-1.353a.5.5 0 0 1 .707.708L9.914 11.003v1.08l1.353-1.352a.5.5 0 0 1 .707.708L10.5 12.793v1.294a.5.5 0 0 1-.5.5h-2z"/>
                            </svg>
                            <span>Offline Mode</span>
                            <button className="refresh-button" onClick={() => fetchChatbots(true)}>
                                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" fill="currentColor" viewBox="0 0 16 16">
                                    <path fillRule="evenodd" d="M8 3a5 5 0 1 0 4.546 2.914.5.5 0 0 1 .908-.417A6 6 0 1 1 8 2v1z"/>
                                    <path d="M8 4.466V.534a.25.25 0 0 1 .41-.192l2.36 1.966c.12.1.12.284 0 .384L8.41 4.658A.25.25 0 0 1 8 4.466z"/>
                                </svg>
                                Try reconnect
                            </button>
                        </div>
                    )}
                    {dataSource === 'MongoDB' && (
                        <div className="online-badge">
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
                                <path d="M10.478 1.647a.5.5 0 1 0-.956-.294l-4 13a.5.5 0 0 0 .956.294l4-13zM4.854 4.146a.5.5 0 0 1 0 .708L1.707 8l3.147 3.146a.5.5 0 0 1-.708.708l-3.5-3.5a.5.5 0 0 1 0-.708l3.5-3.5a.5.5 0 0 1 .708 0zm6.292 0a.5.5 0 0 0 0 .708L14.293 8l-3.147 3.146a.5.5 0 0 0 .708.708l3.5-3.5a.5.5 0 0 0 0-.708l-3.5-3.5a.5.5 0 0 0-.708 0z"/>
                            </svg>
                            <span>DB Connected</span>
                        </div>
                    )}
                    {dataSource === 'unknown' && (
                        <div className="pending-badge">
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
                                <path d="M8 15A7 7 0 1 1 8 1a7 7 0 0 1 0 14zm0 1A8 8 0 1 0 8 0a8 8 0 0 0 0 16z"/>
                                <path d="M7.002 11a1 1 0 1 1 2 0 1 1 0 0 1-2 0zM7.1 4.995a.905.905 0 1 1 1.8 0l-.35 3.507a.552.552 0 0 1-1.1 0L7.1 4.995z"/>
                            </svg>
                            <span>Checking data source...</span>
                        </div>
                    )}
                </div>

                <div className="dashboard-content">
                    {isLoading && chatbots.length === 0 ? (
                        <div className="loading-container">
                            <div className="loading-spinner"></div>
                            <p>Loading chatbots...</p>
                        </div>
                    ) : error ? (
                        <div className="error-message">
                            <p>{error}</p>
                            <button onClick={fetchChatbots} className="retry-button">Retry</button>
                        </div>
                    ) : filteredChatbots.length === 0 ? (
                        <div className="no-chatbots">
                            {searchTerm ? (
                                <p>No chatbots found matching "{searchTerm}"</p>
                            ) : (
                                <div>
                                    <p>No chatbots have been created yet.</p>
                                    <button 
                                        className="create-first-button"
                                        onClick={() => setShowForm(true)}
                                    >
                                        Create Your First Chatbot
                                    </button>
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="chatbots-grid">
                            {filteredChatbots.map(bot => (
                                <div key={bot.id} className="chatbot-card">
                                    <div className="card-header">
                                        <div 
                                            className="chatbot-logo" 
                                            style={{backgroundColor: bot.chatLogoColor}}
                                            onClick={() => launchChatbot(bot)}
                                        >
                                            {bot.chatLogoImage ? (
                                                <img src={bot.chatLogoImage} alt={bot.name} />
                                            ) : (
                                                <div className="default-logo">{bot.name.charAt(0)}</div>
                                            )}
                                        </div>
                                        <h3>{bot.name}</h3>
                                    </div>
                                    <div className="card-content">
                                        <div className="unique-url">
                                            <div className="url-label">Unique URL:</div>
                                            <div className="url-value">/chatbot/{bot.name}/{bot.uniqueId.substring(0, 5)}...</div>
                                        </div>
                                        
                                        <div className="card-preview">
                                            <div className="preview-item">
                                                <span className="preview-label">Header:</span>
                                                <span className="color-preview" style={{backgroundColor: bot.chatHeaderColor}}></span>
                                            </div>
                                            <div className="preview-item">
                                                <span className="preview-label">Gradient:</span>
                                                <span 
                                                    className="gradient-preview" 
                                                    style={{
                                                        background: `linear-gradient(to right, ${bot.chatBgGradientStart}, ${bot.chatBgGradientEnd})`
                                                    }}
                                                ></span>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="card-actions">
                                        <button onClick={() => editChatbot(bot)} className="edit-button">
                                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
                                                <path d="M12.146.146a.5.5 0 0 1 .708 0l3 3a.5.5 0 0 1 0 .708l-10 10a.5.5 0 0 1-.168.11l-5 2a.5.5 0 0 1-.65-.65l2-5a.5.5 0 0 1 .11-.168l10-10zM11.207 2.5 13.5 4.793 14.793 3.5 12.5 1.207 11.207 2.5zm1.586 3L10.5 3.207 4 9.707V10h.5a.5.5 0 0 1 .5.5v.5h.5a.5.5 0 0 1 .5.5v.5h.293l6.5-6.5zm-9.761 5.175-.106.106-1.528 3.821 3.821-1.528.106-.106A.5.5 0 0 1 5 12.5V12h-.5a.5.5 0 0 1-.5-.5V11h-.5a.5.5 0 0 1-.468-.325z"/>
                                            </svg>
                                            Edit
                                        </button>
                                        <button onClick={() => handleQRClick(bot)} className="qr-button">
                                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
                                                <path d="M0 .5A.5.5 0 0 1 .5 0h3a.5.5 0 0 1 0 1H1v2.5a.5.5 0 0 1-1 0v-3Zm12 0a.5.5 0 0 1 .5-.5h3a.5.5 0 0 1 .5.5v3a.5.5 0 0 1-1 0V1h-2.5a.5.5 0 0 1-.5-.5ZM.5 12a.5.5 0 0 1 .5.5V15h2.5a.5.5 0 0 1 0 1h-3a.5.5 0 0 1-.5-.5v-3a.5.5 0 0 1 .5-.5h6.636a.5.5 0 0 1 .5.5Zm15 0a.5.5 0 0 1 .5.5v3a.5.5 0 0 1-.5.5h-3a.5.5 0 0 1 0-1H15v-2.5a.5.5 0 0 1 .5-.5Z"/>
                                            </svg>
                                            Show QR
                                        </button>
                                        <button onClick={() => window.open(bot.analyticsUrl, '_blank')} className="analytics-button">
                                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
                                                <path d="M0 0h16v16H0V0zm1 1v14h14V1H1zm1 1h12v12H2V2zm2 9h2v2H4v-2zm3 0h2v2H7v-2zm3 0h2v2h-2v-2zM4 8h2v2H4V8zm3 0h2v2H7V8zm3 0h2v2h-2V8zM4 5h2v2H4V5zm3 0h2v2H7V5zm3 0h2v2h-2V5z"/>
                                            </svg>
                                            Analytics
                                        </button>
                                        <button onClick={() => deleteChatbot(bot.id, bot.uniqueId)} className="delete-button">
                                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
                                                <path d="M5.5 5.5A.5.5 0 0 1 6 6v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm2.5 0a.5.5 0 0 1 .5.5v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm3 .5a.5.5 0 0 0-1 0v6a.5.5 0 0 0 1 0V6z"/>
                                                <path fillRule="evenodd" d="M14.5 3a1 1 0 0 1-1 1H13v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V4h-.5a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1H6a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1h3.5a1 1 0 0 1 1 1v1zM4.118 4 4 4.059V13a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V4.059L11.882 4H4.118zM2.5 3V2h11v1h-11z"/>
                                            </svg>
                                            Delete
                                        </button>
                                        <button onClick={() => launchChatbot(bot)} className="launch-button">
                                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
                                                <path fillRule="evenodd" d="M8.636 3.5a.5.5 0 0 0-.5-.5H1.5A1.5 1.5 0 0 0 0 4.5v10A1.5 1.5 0 0 0 1.5 16h10a1.5 1.5 0 0 0 1.5-1.5V7.864a.5.5 0 0 0-1 0V14.5a.5.5 0 0 1-.5.5h-10a.5.5 0 0 1-.5-.5v-10a.5.5 0 0 1 .5-.5h6.636a.5.5 0 0 0 .5-.5z"/>
                                                <path fillRule="evenodd" d="M16 .5a.5.5 0 0 0-.5-.5h-5a.5.5 0 0 0 0 1h3.793L6.146 9.146a.5.5 0 1 0 .708.708L15 1.707V5.5a.5.5 0 0 0 1 0v-5z"/>
                                            </svg>
                                            Launch
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {showForm && (
                <div className="form-overlay">
                    <div className="form-container">
                        <h2>{currentBot.id ? 'Edit Chatbot' : 'Create New Chatbot'}</h2>
                        <form onSubmit={handleSubmit}>
                            <div className="form-grid">
                                <div className="form-group">
                                    <label>Name</label>
                                    <input 
                                        type="text" 
                                        name="name" 
                                        value={currentBot.name} 
                                        onChange={handleInputChange}
                                        required
                                    />
                                </div>

                                <div className="form-group">
                                    <label>Chat Logo Color</label>
                                    <div className="color-input">
                                        <input 
                                            type="color" 
                                            name="chatLogoColor" 
                                            value={currentBot.chatLogoColor} 
                                            onChange={handleInputChange}
                                        />
                                        <input 
                                            type="text" 
                                            name="chatLogoColor" 
                                            value={currentBot.chatLogoColor} 
                                            onChange={handleInputChange}
                                        />
                                    </div>
                                </div>

                                <div className="form-group">
                                    <label>Chat Logo Image</label>
                                    <div className="file-input-container">
                                        <input 
                                            type="file" 
                                            accept="image/*" 
                                            onChange={(e) => handleFileUpload(e)} 
                                            name="chatLogoImage"
                                            id="chatLogoImage"
                                            className="file-input"
                                        />
                                        <label htmlFor="chatLogoImage" className="file-input-label">Choose File</label>
                                        <span className="file-name">
                                            {currentBot.chatLogoImage ? 'Image selected' : 'No file chosen'}
                                        </span>
                                    </div>
                                    {currentBot.chatLogoImage && (
                                        <div className="image-preview">
                                            <img src={currentBot.chatLogoImage} alt="Logo preview" />
                                        </div>
                                    )}
                                </div>

                                <div className="form-group">
                                    <label>Icon Avatar Image</label>
                                    <div className="file-input-container">
                                        <input 
                                            type="file" 
                                            accept="image/*" 
                                            onChange={(e) => handleFileUpload(e)} 
                                            name="iconAvatarImage"
                                            id="iconAvatarImage"
                                            className="file-input"
                                        />
                                        <label htmlFor="iconAvatarImage" className="file-input-label">Choose File</label>
                                        <span className="file-name">
                                            {currentBot.iconAvatarImage ? 'Image selected' : 'No file chosen'}
                                        </span>
                                    </div>
                                    {currentBot.iconAvatarImage && (
                                        <div className="image-preview">
                                            <img src={currentBot.iconAvatarImage} alt="Avatar preview" />
                                        </div>
                                    )}
                                </div>

                                <div className="form-group">
                                    <label>Static Image</label>
                                    <div className="file-input-container">
                                        <input 
                                            type="file" 
                                            accept="image/*" 
                                            onChange={(e) => handleFileUpload(e)} 
                                            name="staticImage"
                                            id="staticImage"
                                            className="file-input"
                                        />
                                        <label htmlFor="staticImage" className="file-input-label">Choose File</label>
                                        <span className="file-name">
                                            {currentBot.staticImage ? 'Image selected' : 'No file chosen'}
                                        </span>
                                    </div>
                                    {currentBot.staticImage && (
                                        <div className="image-preview">
                                            <img src={currentBot.staticImage} alt="Static image preview" />
                                        </div>
                                    )}
                                </div>

                                <div className="form-group">
                                    <label>Chat Header Color</label>
                                    <div className="color-input">
                                        <input 
                                            type="color" 
                                            name="chatHeaderColor" 
                                            value={currentBot.chatHeaderColor} 
                                            onChange={handleInputChange}
                                        />
                                        <input 
                                            type="text" 
                                            name="chatHeaderColor" 
                                            value={currentBot.chatHeaderColor} 
                                            onChange={handleInputChange}
                                        />
                                    </div>
                                </div>

                                <div className="form-group">
                                    <label>Chat Background Gradient Start</label>
                                    <div className="color-input">
                                        <input 
                                            type="color" 
                                            name="chatBgGradientStart" 
                                            value={currentBot.chatBgGradientStart} 
                                            onChange={handleInputChange}
                                        />
                                        <input 
                                            type="text" 
                                            name="chatBgGradientStart" 
                                            value={currentBot.chatBgGradientStart} 
                                            onChange={handleInputChange}
                                        />
                                    </div>
                                </div>

                                <div className="form-group">
                                    <label>Chat Background Gradient End</label>
                                    <div className="color-input">
                                        <input 
                                            type="color" 
                                            name="chatBgGradientEnd" 
                                            value={currentBot.chatBgGradientEnd} 
                                            onChange={handleInputChange}
                                        />
                                        <input 
                                            type="text" 
                                            name="chatBgGradientEnd" 
                                            value={currentBot.chatBgGradientEnd} 
                                            onChange={handleInputChange}
                                        />
                                    </div>
                                </div>

                                <div className="form-group">
                                    <label>Body Background Image</label>
                                    <div className="file-input-container">
                                        <input 
                                            type="file" 
                                            accept="image/*" 
                                            onChange={(e) => handleFileUpload(e)} 
                                            name="bodyBackgroundImage"
                                            id="bodyBackgroundImage"
                                            className="file-input"
                                        />
                                        <label htmlFor="bodyBackgroundImage" className="file-input-label">Choose File</label>
                                        <span className="file-name">
                                            {currentBot.bodyBackgroundImage ? 'Image selected' : 'No file chosen'}
                                        </span>
                                    </div>
                                    {currentBot.bodyBackgroundImage && (
                                        <div className="image-preview">
                                            <img src={currentBot.bodyBackgroundImage} alt="Background preview" />
                                        </div>
                                    )}
                                </div>

                                <div className="form-group">
                                    <label>Welcome Text</label>
                                    <textarea 
                                        name="welcomeText" 
                                        value={currentBot.welcomeText} 
                                        onChange={handleInputChange}
                                        required
                                    ></textarea>
                                </div>

                                <div className="form-group">
                                    <label>NEXT_AGI_API_KEY</label>
                                    <input 
                                        type="text" 
                                        name="apiKey" 
                                        value={currentBot.apiKey} 
                                        onChange={handleInputChange}
                                        required
                                    />
                                </div>

                                <div className="form-group">
                                    <label>Analytics URL</label>
                                    <input 
                                        type="text" 
                                        name="analyticsUrl" 
                                        value={currentBot.analyticsUrl} 
                                        onChange={handleInputChange}
                                        placeholder="Enter analytics dashboard URL"
                                    />
                                    <small className="form-help">URL to your analytics dashboard for this chatbot</small>
                                </div>
                            </div>

                            <div className="form-actions">
                                <button type="submit" className="save-button">
                                    {currentBot.id ? 'Update Chatbot' : 'Create Chatbot'}
                                </button>
                                <button 
                                    type="button" 
                                    className="cancel-button"
                                    onClick={() => {
                                        setShowForm(false);
                                        setCurrentBot({
                                            id: '',
                                            name: '',
                                            chatLogoColor: '#3884db',
                                            chatLogoImage: '',
                                            iconAvatarImage: '',
                                            staticImage: '',
                                            chatHeaderColor: '#b4c7c5',
                                            chatBgGradientStart: '#ffffff',
                                            chatBgGradientEnd: '#6398d5',
                                            bodyBackgroundImage: '',
                                            welcomeText: 'Welcome to our assistant! How can I help you today?',
                                            apiKey: '',
                                            analyticsUrl: 'http://localhost:8088/superset/dashboard/1/?native_filters_key=Fa1TCGahXdiVfZhNjZrPy3B1jZ9yTguoXRkKKmBPW9w88GDy2Qc7wuFXjlp8oNtK',
                                            uniqueId: generateUniqueId()
                                        });
                                    }}
                                >
                                    Cancel
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
            
            {/* Subtle refreshing indicator */}
            {refreshing && !isLoading && (
                <div className="refresh-indicator">
                    <div className="refresh-spinner"></div>
                    <span>Updating data...</span>
                </div>
            )}
            
            <footer className="dashboard-footer">
                <p>© 2025 Xpectrum AI - All rights reserved</p>
            </footer>

            {qrModalBot && (
                <div className="qr-modal-overlay" onClick={handleCloseQRModal}>
                    <div className="qr-modal-content" onClick={e => e.stopPropagation()}>
                        <QRCode 
                            value={getChatbotFullUrl(qrModalBot)}
                            size={250}
                            level="H"
                            className="chatbot-qr-code"
                        />
                        <p className="qr-code-instruction">Scan to access chatbot</p>
                        <button 
                            className="download-qr-button"
                            onClick={() => handleQRDownload(qrModalBot)}
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
                                <path d="M.5 9.9a.5.5 0 0 1 .5.5v2.5a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-2.5a.5.5 0 0 1 1 0v2.5a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2v-2.5a.5.5 0 0 1 .5-.5z"/>
                                <path d="M7.646 11.854a.5.5 0 0 0 .708 0l3-3a.5.5 0 0 0-.708-.708L8.5 10.293V1.5a.5.5 0 0 0-1 0v8.793L5.354 8.146a.5.5 0 1 0-.708.708l3 3z"/>
                            </svg>
                            Download QR
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}

export default Dashboard; 