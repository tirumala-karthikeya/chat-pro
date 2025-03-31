import React from 'react';
import ReactDOM from 'react-dom';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import App from './App';
import Dashboard from './Dashboard';

// Render the App component into the root div element
ReactDOM.render(
    <React.StrictMode>
        <Router>
            <Routes>
                <Route path="/" element={<Dashboard />} />
                <Route path="/chatbot/:name/:uniqueId" element={<App />} />
            </Routes>
        </Router>
    </React.StrictMode>,
    document.getElementById('root')
);
