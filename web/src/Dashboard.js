import React, { useState, useEffect, useRef } from 'react';
import QRCode from 'react-qr-code';
import './Dashboard.css';

function Dashboard() {
    const [chatbots, setChatbots] = useState([]);
    const [showForm, setShowForm] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [visibleQRCodes, setVisibleQRCodes] = useState({});
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

    // Generate a random unique ID
    function generateUniqueId() {
        return Math.random().toString(36).substring(2, 12);
    }

    // Filter chatbots based on search term
    const filteredChatbots = chatbots.filter(bot => 
        bot.name.toLowerCase().includes(searchTerm.toLowerCase())
    );

    useEffect(() => {
        // Load saved chatbots from localStorage
        const savedChatbots = localStorage.getItem('chatbots');
        if (savedChatbots) {
            setChatbots(JSON.parse(savedChatbots));
        }
    }, []);

    // Save chatbots to localStorage whenever they change
    useEffect(() => {
        localStorage.setItem('chatbots', JSON.stringify(chatbots));
    }, [chatbots]);

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
        
        if (currentBot.id) {
            // Update existing bot
            setChatbots(chatbots.map(bot => bot.id === currentBot.id ? newBot : bot));
        } else {
            // Add new bot
            setChatbots([...chatbots, newBot]);
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
        
        setShowForm(false);
    };

    const editChatbot = (bot) => {
        setCurrentBot(bot);
        setShowForm(true);
    };

    const deleteChatbot = (id) => {
        if (window.confirm("Are you sure you want to delete this chatbot?")) {
            setChatbots(chatbots.filter(bot => bot.id !== id));
        }
    };

    // Get the full URL for the chatbot
    const getChatbotFullUrl = (bot) => {
        // Get the current hostname (e.g., localhost:3000 or your production domain)
        const baseUrl = window.location.origin;
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

    return (
        <div className="dashboard-wrapper">
            <div className="dashboard-background"></div>
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

                <div className="dashboard-content">
                    {filteredChatbots.length === 0 ? (
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
                                        
                                        {visibleQRCodes[bot.id] && (
                                            <div className="qr-code-container">
                                                <QRCode 
                                                    id={`qr-code-${bot.id}`}
                                                    value={getChatbotFullUrl(bot)}
                                                    size={150}
                                                    level="H"
                                                    className="chatbot-qr-code"
                                                />
                                                <p className="qr-code-instruction">Scan to access chatbot</p>
                                                <button 
                                                    onClick={() => downloadQRCode(bot)} 
                                                    className="download-qr-button"
                                                >
                                                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
                                                        <path d="M.5 9.9a.5.5 0 0 1 .5.5v2.5a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-2.5a.5.5 0 0 1 1 0v2.5a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2v-2.5a.5.5 0 0 1 .5-.5z"/>
                                                        <path d="M7.646 11.854a.5.5 0 0 0 .708 0l3-3a.5.5 0 0 0-.708-.708L8.5 10.293V1.5a.5.5 0 0 0-1 0v8.793L5.354 8.146a.5.5 0 1 0-.708.708l3 3z"/>
                                                    </svg>
                                                    Download QR
                                                </button>
                                            </div>
                                        )}
                                        
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
                                        <button onClick={() => toggleQRCode(bot.id)} className="qr-code-button">
                                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
                                                <path d="M0 .5A.5.5 0 0 1 .5 0h3a.5.5 0 0 1 0 1H1v2.5a.5.5 0 0 1-1 0v-3Zm12 0a.5.5 0 0 1 .5-.5h3a.5.5 0 0 1 .5.5v3a.5.5 0 0 1-1 0V1h-2.5a.5.5 0 0 1-.5-.5ZM.5 12a.5.5 0 0 1 .5.5V15h2.5a.5.5 0 0 1 0 1h-3a.5.5 0 0 1-.5-.5v-3a.5.5 0 0 1 .5-.5Zm15 0a.5.5 0 0 1 .5.5v3a.5.5 0 0 1-.5.5h-3a.5.5 0 0 1 0-1H15v-2.5a.5.5 0 0 1 .5-.5ZM4 4h1v1H4V4Zm2 0h1v1H6V4Zm1 2v1H6V6h1Zm0 2H6v1h1V8ZM6 2h1v1H6V2Zm0 8h1v1H6v-1ZM4 2h1v1H4V2Zm0 8h1v1H4v-1Zm6-8h1v1h-1V2Zm0 3h1v1h-1V5Zm0 3h1v1h-1V8Zm0 3h1v1h-1v-1Zm3-6h1v1h-1V5Zm0 3h1v1h-1V8ZM9 2h1v1H9V2Zm0 8h1v1H9v-1Zm3-6h1v1h-1V4Zm1-2h1v1h-1V2Zm0 8h1v1h-1v-1Z"/>
                                            </svg>
                                            {visibleQRCodes[bot.id] ? 'Hide QR' : 'Show QR'}
                                        </button>
                                        <button onClick={() => window.open(bot.analyticsUrl, '_blank')} className="analytics-button">
                                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
                                                <path d="M0 0h16v16H0V0zm1 1v14h14V1H1zm1 1h12v12H2V2zm2 9h2v2H4v-2zm3 0h2v2H7v-2zm3 0h2v2h-2v-2zM4 8h2v2H4V8zm3 0h2v2H7V8zm3 0h2v2h-2V8zM4 5h2v2H4V5zm3 0h2v2H7V5zm3 0h2v2h-2V5z"/>
                                            </svg>
                                            Analytics
                                        </button>
                                        <button onClick={() => deleteChatbot(bot.id)} className="delete-button">
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
            
            <footer className="dashboard-footer">
                <p>© 2023 Chatbot Management System</p>
            </footer>
        </div>
    );
}

export default Dashboard; 