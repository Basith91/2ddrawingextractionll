import React, { useState } from 'react';
import './ApiKeyModal.css';

export default function ApiKeyModal({ isOpen, onSubmit }) {
    const [apiKey, setApiKey] = useState('');

    if (!isOpen) return null;

    const handleSubmit = (e) => {
        e.preventDefault();
        if (apiKey.trim()) {
            onSubmit(apiKey);
        }
    };

    return (
        <div className="modal-overlay">
            <div className="modal-content">
                <h2>Enter Gemini API Key</h2>
                <p>To use the advanced LLM extraction, please provide your Google Gemini API Key.</p>
                <form onSubmit={handleSubmit}>
                    <input
                        type="password"
                        placeholder="AIzaSy..."
                        value={apiKey}
                        onChange={(e) => setApiKey(e.target.value)}
                        className="api-input"
                    />
                    <button type="submit" className="submit-btn" disabled={!apiKey.trim()}>
                        Start Processing
                    </button>
                </form>
                <p className="hint">The key is used only for this session.</p>
            </div>
        </div>
    );
}
