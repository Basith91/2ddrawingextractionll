import React, { useState, useEffect, useRef } from 'react';
import './DrawingViewer.css';

export default function DrawingViewer({ file, imageUrl: propImageUrl, features, viewLabels, activeFeatureId, activeViewLabel, onFeatureSelect, showBalloons }) {
    const [imageUrl, setImageUrl] = useState(null);
    const containerRef = useRef(null);

    useEffect(() => {
        if (propImageUrl) {
            setImageUrl(propImageUrl);
        } else if (file) {
            // Placeholder while processing or if no URL yet
            setImageUrl("https://placehold.co/800x600?text=Drawing+Preview");
        }
    }, [file, propImageUrl]);

    return (
        <div className="drawing-viewer-container" ref={containerRef}>
            {imageUrl ? (
                <div className="image-wrapper">
                    <img src={imageUrl} alt="Drawing" className="drawing-image" />
                    <div className="balloons-layer">
                        {showBalloons && features.map((feature) => (
                            <div
                                key={feature.id}
                                className={`balloon ${activeFeatureId === feature.id ? 'active' : ''}`}
                                style={{
                                    left: `${feature.x}%`,
                                    top: `${feature.y}%`
                                }}
                                onClick={() => onFeatureSelect(feature.id)}
                            >
                                {feature.id}
                            </div>
                        ))}

                        {/* Render View Labels - ONLY ACTIVE ONE */}
                        {showBalloons && viewLabels && viewLabels.map((view) => {
                            if (activeViewLabel !== view.label) return null; // Only show active
                            return (
                                <div
                                    key={view.id}
                                    className={`view-label-marker ${activeViewLabel === view.label ? 'active-view-marker' : ''}`}
                                    style={{
                                        left: `${view.x}%`,
                                        top: `${view.y}%`
                                    }}
                                >
                                    {view.label}
                                </div>
                            );
                        })}
                    </div>
                </div>
            ) : (
                <div className="empty-state">No drawing loaded</div>
            )}
        </div>
    );
}
