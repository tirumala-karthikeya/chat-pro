import React, { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import './App.css';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

const ws_url = 'ws://localhost:8001/ws';

function App() {
    // Get URL parameters
    const { name, uniqueId } = useParams();
    
    const [messages, setMessages] = useState([]);
    const [socket, setSocket] = useState(null);
    const [inputMessage, setInputMessage] = useState('');
    const [conversationId, setConversationId] = useState('');
    const [minimized, setMinimized] = useState(false);
    const [showMenu, setShowMenu] = useState(false);
    const [isListening, setIsListening] = useState(false);
    const menuRef = useRef(null);
    const fileInputRef = useRef(null);
    const inputRef = useRef(null);
    const messagesEndRef = useRef(null);
    const [userImage, setUserImage] = useState(null);
    const [botResponse, setBotResponse] = useState("");
    const [isReceivingMessage, setIsReceivingMessage] = useState(false);
    const responseTimeoutRef = useRef(null);
    const lastMessageIdRef = useRef(null);
    const currentBotResponseRef = useRef("");
    const [isThinking, setIsThinking] = useState(false);
    
    // Add state for configuration
    const [config, setConfig] = useState({
        chatLogoColor: '#3884db',
        chatLogoImage: '/logo.png',
        iconAvatarImage: '/assistance.jpg',
        staticImage: '/name.jpg',
        chatHeaderColor: '#b4c7c5',
        chatBgGradientStart: '#ffffff',
        chatBgGradientEnd: '#6398d5',
        bodyBackgroundImage: '',
        welcomeText: 'Welcome to our assistant! How can I help you today?',
        apiKey: '',
        name: 'Assistant',
        uniqueId: '',
        analyticsUrl: 'http://localhost:8088/superset/dashboard/1/?native_filters_key=Fa1TCGahXdiVfZhNjZrPy3B1jZ9yTguoXRkKKmBPW9w88GDy2Qc7wuFXjlp8oNtK'
    });

    // Load configuration at startup - from URL params or sessionStorage
    useEffect(() => {
        // First check if there's a bot config in sessionStorage
        const selectedChatbot = sessionStorage.getItem('selectedChatbot');
        
        if (selectedChatbot) {
            try {
                const botConfig = JSON.parse(selectedChatbot);
                // Verify this is the correct bot using URL params
                if (!uniqueId || botConfig.uniqueId === uniqueId) {
                    setConfig(botConfig);
                    console.log('Loaded bot config from session storage');
                    return;
                }
            } catch (e) {
                console.error('Error parsing chatbot config:', e);
            }
        }
        
        // If we reach here, try to load from localStorage using URL params
        if (uniqueId) {
            try {
                const savedChatbots = localStorage.getItem('chatbots');
                if (savedChatbots) {
                    const bots = JSON.parse(savedChatbots);
                    const matchedBot = bots.find(bot => bot.uniqueId === uniqueId);
                    if (matchedBot) {
                        setConfig(matchedBot);
                        console.log('Loaded bot config from localStorage using URL params');
                        return;
                    }
                }
            } catch (e) {
                console.error('Error accessing localStorage:', e);
                // If localStorage is full or inaccessible, try to clean it up
                cleanupLocalStorage();
            }
        }
        
        console.log('Using default bot configuration');
    }, [uniqueId]);

    // Function to safely save to localStorage with error handling
    const safeSetLocalStorage = (key, value) => {
        try {
            localStorage.setItem(key, JSON.stringify(value));
        } catch (e) {
            if (e.name === 'QuotaExceededError') {
                console.warn('LocalStorage quota exceeded, attempting cleanup...');
                cleanupLocalStorage();
                // Try one more time after cleanup
                try {
                    localStorage.setItem(key, JSON.stringify(value));
                } catch (retryError) {
                    console.error('Failed to save after cleanup:', retryError);
                    // Fallback to sessionStorage for temporary storage
                    sessionStorage.setItem(key, JSON.stringify(value));
                }
            } else {
                console.error('Error saving to localStorage:', e);
                // Fallback to sessionStorage
                sessionStorage.setItem(key, JSON.stringify(value));
            }
        }
    };

    // Function to clean up localStorage when it's full
    const cleanupLocalStorage = () => {
        try {
            // Get all chatbots
            const savedChatbots = localStorage.getItem('chatbots');
            if (savedChatbots) {
                const bots = JSON.parse(savedChatbots);
                // Keep only the most recent 5 chatbots
                const recentBots = bots.slice(-5);
                localStorage.setItem('chatbots', JSON.stringify(recentBots));
                console.log('Cleaned up localStorage, kept most recent 5 chatbots');
            }
        } catch (e) {
            console.error('Error during localStorage cleanup:', e);
        }
    };

    // Apply configuration to CSS variables
    useEffect(() => {
        document.documentElement.style.setProperty('--chat-logo-color', config.chatLogoColor);
        document.documentElement.style.setProperty('--chat-header-color', config.chatHeaderColor);
        document.documentElement.style.setProperty('--chat-bg-gradient-start', config.chatBgGradientStart);
        document.documentElement.style.setProperty('--chat-bg-gradient-end', config.chatBgGradientEnd);
        
        // Set body background image if provided
        if (config.bodyBackgroundImage) {
            document.documentElement.style.setProperty('--body-bg-image', `url("${config.bodyBackgroundImage}")`);
        } else {
            document.documentElement.style.setProperty('--body-bg-image', 'none');
        }
        
        // Update title with chatbot name
        document.title = config.name || 'Chatbot';
    }, [config]);
    
    // Initialize chat with welcome message
    useEffect(() => {
        if (config.welcomeText) {
            setMessages([
                { content: config.welcomeText, id: Date.now(), sender: 'bot' }
            ]);
        }
    }, [config.welcomeText]);

    // Initialize and handle WebSocket connection
    useEffect(() => {
        if (!config.apiKey) {
            console.warn("No API key configured, chat functionality will be limited");
            return;
        }
        
        // For WebSocket connection, we'll use client_id in the URL for compatibility
        // and pass the API key in the messages
        const clientId = `client-${Date.now()}`;
        const ws = new WebSocket(`ws://localhost:8001/ws/${clientId}`);
        
        ws.onopen = () => {
            console.log('WebSocket connection established');
            
            // Send an initial message with the API key to set it up
            const initMessage = {
                api_key: config.apiKey,
                type: "init"
            };
            ws.send(JSON.stringify(initMessage));
        };

        ws.onmessage = (event) => {
            const data = JSON.parse(event.data);
            console.log('Received message:', data);

            if (data.conversation_id) {
                setConversationId(data.conversation_id);
            }

            if (data.type === 'chunk' && data.content) {
                // Reset typing state completely when first chunk arrives
                setIsThinking(false);
                
                // Clear any existing timeout
                if (responseTimeoutRef.current) {
                    clearTimeout(responseTimeoutRef.current);
                }
                
                // Update our references to keep track of the latest state
                const newContent = currentBotResponseRef.current + data.content;
                currentBotResponseRef.current = newContent;
                
                // Update the state for rendering
                setBotResponse(newContent);
                setIsReceivingMessage(true);
                
                // Set a timeout to finalize the message
                responseTimeoutRef.current = setTimeout(() => {
                    const finalContent = currentBotResponseRef.current;
                    
                    if (finalContent && finalContent.trim() !== '') {
                        // Add the completed message to the messages list
                        setMessages(prevMessages => [
                            ...prevMessages,
                            { 
                                content: finalContent, 
                                id: Date.now(), 
                                sender: 'bot' 
                            }
                        ]);
                        
                        // Reset the accumulators
                        currentBotResponseRef.current = "";
                        setBotResponse("");
                        setIsReceivingMessage(false);
                    }
                }, 1000); // 1 second timeout
                
                scrollToBottom();
            }
        };

        ws.onerror = (error) => {
            console.error('WebSocket error:', error);
        };

        ws.onclose = () => {
            console.log('WebSocket connection closed');
        };

        setSocket(ws);

        return () => {
            if (ws && ws.readyState === WebSocket.OPEN) {
                ws.close();
            }
        };
    }, [config.apiKey]);

    // Auto-resize the input text area and scroll to bottom
    useEffect(() => {
        if (inputRef.current) {
            // Reset height to auto to correctly calculate the new height
            inputRef.current.style.height = 'auto';
            // Set the height to the scroll height to fit all content
            inputRef.current.style.height = `${inputRef.current.scrollHeight}px`;
        }
    }, [inputMessage]);

    // Scroll messages to bottom whenever messages update
    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    // Handle clicks outside the menu
    useEffect(() => {
        function handleClickOutside(event) {
            if (menuRef.current && !menuRef.current.contains(event.target)) {
                setShowMenu(false);
            }
        }
        
        document.addEventListener("mousedown", handleClickOutside);
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, [menuRef]);

    // Function to scroll to the bottom of messages
    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    // Send a message to the WebSocket server
    const sendMessage = () => {
        if (!socket || socket.readyState !== WebSocket.OPEN || inputMessage.trim() === '') {
            console.error('WebSocket is not open or message is empty');
            return;
        }

        const message = {
            query: inputMessage,
            conversation_id: conversationId,
            api_key: config.apiKey  // Include the API key in every message
        };

        setMessages(prevMessages => [
            ...prevMessages,
            { content: inputMessage, id: Date.now(), sender: 'user' }
        ]);

        // Show thinking indicator
        setIsThinking(true);
        
        socket.send(JSON.stringify(message));
        setInputMessage('');
        
        // If the microphone is currently on, turn it off
        if (isListening) {
            stopListening();
        }
        
        if (inputRef.current) {
            inputRef.current.style.height = 'auto';
        }

        scrollToBottom();
    };

    // Handle Enter key press
    const handleKeyPress = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    };

    // Toggle chat minimize/maximize
    const toggleMinimize = () => {
        setMinimized(!minimized);
    };

    // Modify the reset chat function to preserve welcome message
    const resetChat = () => {
        setMessages([
            { content: config.welcomeText, id: Date.now(), sender: 'bot' }
        ]);
        
        setConversationId('');
        setBotResponse("");
        setIsReceivingMessage(false);
        setShowMenu(false);
        
        // Notify server of reset with the API key
        if (socket && socket.readyState === WebSocket.OPEN) {
            socket.send(JSON.stringify({ 
                reset: true,
                api_key: config.apiKey
            }));
        }
    };

    // Handle image upload
    const handleImageUpload = (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => {
                setUserImage(reader.result);
            };
            reader.readAsDataURL(file);
        }
    };

    // Voice recognition functionality
    const toggleListening = () => {
        if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
            alert('Speech recognition is not supported in your browser. Try Chrome or Edge.');
            return;
        }

        if (isListening) {
            stopListening();
        } else {
            startListening();
        }
    };

    const startListening = () => {
        setIsListening(true);
        
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        const recognition = new SpeechRecognition();
        
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = 'en-US';
        
        recognition.onresult = (event) => {
            const transcript = Array.from(event.results)
                .map(result => result[0])
                .map(result => result.transcript)
                .join('');
                
            setInputMessage(transcript);
        };
        
        recognition.onend = () => {
            setIsListening(false);
        };
        
        recognition.onerror = (event) => {
            console.error('Speech recognition error', event);
            setIsListening(false);
        };
        
        recognition.start();
        window.recognition = recognition;
    };
    
    const stopListening = () => {
        if (window.recognition) {
            window.recognition.stop();
            setIsListening(false);
        }
        
        // Ensure we clear any pending dictation when stopping
        // This helps prevent leftover text when the user cancels voice input
        if (isListening) {
            setInputMessage('');
        }
    };

    // Clean up the timeout on component unmount
    useEffect(() => {
        return () => {
            if (responseTimeoutRef.current) {
                clearTimeout(responseTimeoutRef.current);
            }
        };
    }, []);

    // Add this to initialize chat on component mount
    useEffect(() => {
        // Initialize chat with welcome message
        resetChat();
    }, []);

    // Add this function in your App component
    useEffect(() => {
        // Function to handle image click for full-size viewing
        const handleImageClick = (e) => {
            if (e.target.tagName === 'IMG' && e.target.parentNode.className === 'message-content') {
                // Create modal or open image in new tab
                window.open(e.target.src, '_blank');
            }
        };

        // Add event listener
        document.addEventListener('click', handleImageClick);

        // Clean up
        return () => {
            document.removeEventListener('click', handleImageClick);
        };
    }, []);

    // Also add this to the ReactMarkdown components to process images properly
    const imageRenderer = ({ src, alt }) => {
        return (
            <img 
                src={src} 
                alt={alt || "Image"} 
                className={src.includes('large') ? 'large-image' : ''}
                onLoad={(e) => {
                    // Check if image is large and add appropriate class
                    if (e.target.naturalWidth > 400 || e.target.naturalHeight > 400) {
                        e.target.classList.add('large-image');
                    }
                }}
            />
        );
    };

    return (
        <div className={`chat-container ${minimized ? 'minimized' : ''}`}>
            <div className="chat-position-wrapper">
                <div className="chat-logo" onClick={toggleMinimize}>
                    <img 
                        src={config.chatLogoImage || "/logo.png"} 
                        alt="Chat Logo" 
                        onError={(e) => {
                            e.target.onerror = null;
                            e.target.src = "/logo.png"; // Fallback if image cannot be loaded
                        }}
                    />
                </div>
                
                {!minimized && (
                    <div className="chat-expanded">
                        <div className="chat-header">
                            <div className="avatar">
                                <img 
                                    src={config.iconAvatarImage || "/assistance.jpg"} 
                                    alt="Bot Avatar"
                                    onError={(e) => {
                                        e.target.onerror = null;
                                        e.target.src = "/assistance.jpg"; // Fallback
                                    }}
                                />
                            </div>
                            <div className="chat-options">
                                <div className="static-image">
                                    <img 
                                        src={config.staticImage || "/name.jpg"} 
                                        alt="Static Image"
                                        onError={(e) => {
                                            e.target.onerror = null;
                                            e.target.src = "/name.jpg"; // Fallback
                                        }}
                                    />
                                </div>
                            </div>
                            <div className="chat-controls" ref={menuRef}>
                                <button className="menu-button" onClick={(e) => {
                                    e.stopPropagation();
                                    setShowMenu(!showMenu);
                                }}>
                                    ⋮
                                </button>
                                {showMenu && (
                                    <div className="menu-dropdown">
                                        <button onClick={resetChat}>Reset Chat</button>
                                        <a href={config.analyticsUrl} target="_blank" rel="noopener noreferrer">Analytics</a>
                                    </div>
                                )}
                            </div>
                            <button className="close-button" onClick={toggleMinimize}>×</button>
                            <div className="api-key-indicator" title={`Using API Key: ${config.apiKey}`}>
                                <span className="api-dot"></span>
                            </div>
                        </div>
                        
                        <div className="chat-content-area">
                            <div className="chat-messages">
                                {/* Regular messages */}
                                {messages.map((message, index) => (
                                    <div key={index} className={`message-wrapper ${message.sender}-wrapper`}>
                                        <div className={`message ${message.sender}-message`}>
                                            {message.sender === 'user' && userImage && (
                                                <div className="user-image">
                                                    <img src={userImage} alt="User" />
                                                </div>
                                            )}
                                            <div className="message-content">
                                                <ReactMarkdown 
                                                    remarkPlugins={[remarkGfm]}
                                                    components={{
                                                        img: imageRenderer,
                                                        p: ({children}) => <p className="markdown-paragraph">{children}</p>,
                                                        code: ({children}) => <code className="markdown-code">{children}</code>,
                                                        pre: ({children}) => <pre className="markdown-pre">{children}</pre>
                                                    }}
                                                >
                                                    {message.content || "\u00A0"}
                                                </ReactMarkdown>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                                
                                {/* Typing indicator */}
                                {isThinking && (
                                    <div className="message-wrapper bot-wrapper">
                                        <div className="message bot-message">
                                            <div className="typing-dots">
                                                <div className="typing-dot"></div>
                                                <div className="typing-dot"></div>
                                                <div className="typing-dot"></div>
                                            </div>
                                        </div>
                                    </div>
                                )}
                                
                                {/* Streaming message */}
                                {isReceivingMessage && botResponse && (
                                    <div className="message-wrapper bot-wrapper">
                                        <div className="message bot-message streaming">
                                            <div className="message-content">
                                                <ReactMarkdown 
                                                    remarkPlugins={[remarkGfm]}
                                                    components={{
                                                        img: imageRenderer,
                                                        p: ({children}) => <p className="markdown-paragraph">{children}</p>,
                                                        code: ({children}) => <code className="markdown-code">{children}</code>,
                                                        pre: ({children}) => <pre className="markdown-pre">{children}</pre>
                                                    }}
                                                >
                                                    {botResponse || "\u00A0"}
                                                </ReactMarkdown>
                                            </div>
                                        </div>
                                    </div>
                                )}
                                
                                <div ref={messagesEndRef} />
                            </div>

                            <div className="chat-input">
                                <textarea
                                    ref={inputRef}
                                    value={inputMessage}
                                    onChange={(e) => setInputMessage(e.target.value)}
                                    onKeyPress={handleKeyPress}
                                    placeholder="Type a message..."
                                    rows="1"
                                    className="chat-textarea"
                                />
                                <div className="input-buttons">
                                    <button 
                                        className={`voice-button ${isListening ? 'listening' : ''}`}
                                        onClick={toggleListening}
                                        title="Voice input"
                                    >
                                        <svg viewBox="0 0 24 24" width="24" height="24">
                                            <path fill={isListening ? "#ff0000" : "#075e54"} d="M12,2c-1.66,0-3,1.34-3,3v6c0,1.66,1.34,3,3,3s3-1.34,3-3V5C15,3.34,13.66,2,12,2z"/>
                                            <path fill={isListening ? "#ff0000" : "#075e54"} d="M19,11h-1c0,3.31-2.69,6-6,6s-6-2.69-6-6H5c0,3.82,2.82,7,6.5,7.58V20h-2v2h5v-2h-2v-1.42C16.18,18,19,14.82,19,11z"/>
                                        </svg>
                                    </button>
                                    <button onClick={sendMessage} className="send-button">
                                        <svg viewBox="0 0 24 24" width="24" height="24">
                                            <path fill="#ffffff" d="M1.101 21.757L23.8 12.028 1.101 2.3l.011 7.912 13.623 1.816-13.623 1.817-.011 7.912z"></path>
                                        </svg>
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

export default App;
