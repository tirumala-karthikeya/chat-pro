import React, { useEffect } from 'react';
import App from './App';

function ChatbotPage() {
    useEffect(() => {
        // Check if this page was opened properly with configuration
        const selectedChatbot = sessionStorage.getItem('selectedChatbot');
        if (!selectedChatbot) {
            // Redirect back to dashboard if no configuration found
            window.location.href = '/';
        }
    }, []);

    return (
        <div className="chatbot-page">
            <App />
        </div>
    );
}

export default ChatbotPage; 