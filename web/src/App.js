import React, { useState, useEffect, useRef } from 'react';
import './App.css';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

const ws_url = 'ws://localhost:8001/ws';

function App() {
    const [messages, setMessages] = useState([]);
    const [socket, setSocket] = useState(null);
    const [inputMessage, setInputMessage] = useState('');
    const [conversationId, setConversationId] = useState('');
    const [minimized, setMinimized] = useState(true); // Start minimized
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

    // Initialize and handle WebSocket connection
    useEffect(() => {
        const ws = new WebSocket(`${ws_url}/abc-123`);
        
        ws.onopen = () => {
            console.log('WebSocket connection established');
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
            if (ws) {
                ws.close();
            }
        };
    }, []);

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
        if (socket && socket.readyState === WebSocket.OPEN && inputMessage.trim() !== '') {
            const message = {
                query: inputMessage,
                conversation_id: conversationId,
            };

            setMessages(prevMessages => [
                ...prevMessages,
                { content: inputMessage, id: Date.now(), sender: 'user' }
            ]);

            // Show thinking indicator before sending the message
            setIsThinking(true);

            socket.send(JSON.stringify(message));
            setInputMessage('');
            
            // If the microphone is currently on, turn it off after sending the message
            if (isListening) {
                stopListening();
            }
            
            // Reset the input height after sending
            if (inputRef.current) {
                inputRef.current.style.height = 'auto';
            }
        } else {
            console.error('WebSocket is not open or message is empty');
        }
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
        // Keep only the welcome message
        setMessages([
            { content: "Welcome to our assistant! How can I help you today?", id: Date.now(), sender: 'bot' }
        ]);
        
        // Reset conversation ID
        setConversationId('');
        
        // Clear any pending bot response
        setBotResponse("");
        setIsReceivingMessage(false);
        
        // Close menu
        setShowMenu(false);
        
        // Notify server of reset
        if (socket && socket.readyState === WebSocket.OPEN) {
            socket.send(JSON.stringify({ reset: true }));
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

    // Add this effect to set CSS variables from environment variables
    useEffect(() => {
        // Set CSS variables from environment variables
        document.documentElement.style.setProperty('--chat-logo-color', 
            process.env.REACT_APP_CHAT_LOGO_COLOR || '#3884db');
        document.documentElement.style.setProperty('--chat-header-color', 
            process.env.REACT_APP_CHAT_HEADER_COLOR || '#ffffff');
        document.documentElement.style.setProperty('--chat-bg-gradient-start', 
            process.env.REACT_APP_CHAT_BG_GRADIENT_START || '#6398d5');
        document.documentElement.style.setProperty('--chat-bg-gradient-end', 
            process.env.REACT_APP_CHAT_BG_GRADIENT_END || '#ffffff');
        
        // Set body background image properly with a check if it exists
        if (process.env.REACT_APP_BODY_BG_IMAGE) {
            document.documentElement.style.setProperty('--body-bg-image', `url("${process.env.REACT_APP_BODY_BG_IMAGE}")`);
        } else {
            // If no environment variable is set, we can either:
            // 1. Leave it as 'none' which will use the background-color
            // 2. Set a default image if you have one in your public folder
            
            // Option 1: Use no image (will show the background color)
            document.documentElement.style.setProperty('--body-bg-image', 'url("/background.jpg")');
            
            // Option 2: If you have a default image in public folder:
            // document.documentElement.style.setProperty('--body-bg-image', 'url("/default-bg.jpg")');
        }
    }, []);

    return (
        <div className={`chat-container ${minimized ? 'minimized' : ''}`}>
            <div className="chat-position-wrapper">
                <div className="chat-logo" onClick={toggleMinimize}>
                    <img 
                        src={process.env.REACT_APP_CHAT_LOGO_IMAGE || "/logo.png"} 
                        alt="Chat Logo" 
                    />
                </div>
                
                {!minimized && (
                    <div className="chat-expanded">
                        <div className="chat-header">
                            <div className="avatar">
                                <img 
                                    src={process.env.REACT_APP_AVATAR_IMAGE || "/assistance.jpg"} 
                                    alt="Bot Avatar" 
                                />
                            </div>
                            <div className="chat-options">
                                <div className="static-image">
                                    <img 
                                        src={process.env.REACT_APP_STATIC_IMAGE || "/name.jpg"} 
                                        alt="Static Image" 
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
                                        <a href="http://localhost:8088/superset/dashboard/1/?native_filters_key=Fa1TCGahXdiVfZhNjZrPy3B1jZ9yTguoXRkKKmBPW9w88GDy2Qc7wuFXjlp8oNtK" target="_blank" rel="noopener noreferrer">Analytics</a>
                                    </div>
                                )}
                            </div>
                            <button className="close-button" onClick={toggleMinimize}>×</button>
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
                                                <ReactMarkdown remarkPlugins={[remarkGfm]}>
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
                                                <ReactMarkdown remarkPlugins={[remarkGfm]}>
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
