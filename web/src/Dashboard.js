import React, { useState, useEffect } from 'react';
import './Dashboard.css';

function Dashboard() {
    const [chatbots, setChatbots] = useState([]);
    const [showForm, setShowForm] = useState(false);
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
        uniqueId: generateUniqueId() // Add unique ID for the URL
    });

    // Generate a random unique ID
    function generateUniqueId() {
        return Math.random().toString(36).substring(2, 12);
    }

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

    const validateApiKey = async (apiKey) => {
        try {
            // You can add a simple validation endpoint in your API
            // Or just check if it matches the expected format
            if (!apiKey || apiKey.trim() === '') {
                return { valid: false, message: "API key cannot be empty" };
            }
            
            // Check for a valid Next-AGI API key format (if you know it)
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
            uniqueId: generateUniqueId()
        });
        
        setShowForm(false);
    };

    const editChatbot = (bot) => {
        setCurrentBot(bot);
        setShowForm(true);
    };

    const deleteChatbot = (id) => {
        setChatbots(chatbots.filter(bot => bot.id !== id));
    };

    const launchChatbot = (bot) => {
        // Store the selected bot in sessionStorage
        sessionStorage.setItem('selectedChatbot', JSON.stringify(bot));
        
        // Open with unique URL
        window.open(`/chatbot/${encodeURIComponent(bot.name)}/${bot.uniqueId}`, '_blank');
    };

    return (
        <div className="dashboard-container">
            <header className="dashboard-header">
                <h1>Chatbot Management Dashboard</h1>
                <button 
                    className="create-button"
                    onClick={() => setShowForm(true)}
                >
                    Create New Chatbot
                </button>
            </header>

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

            <div className="chatbots-grid">
                {chatbots.map(bot => (
                    <div key={bot.id} className="chatbot-card">
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
                        <div className="unique-url">
                            <small>URL: /chatbot/{bot.name}/{bot.uniqueId}</small>
                        </div>
                        <div className="card-actions">
                            <button onClick={() => editChatbot(bot)}>Edit</button>
                            <button onClick={() => deleteChatbot(bot.id)}>Delete</button>
                            <button onClick={() => launchChatbot(bot)}>Launch</button>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}

export default Dashboard; 