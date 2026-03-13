import React, { useState, useEffect, useRef } from 'react';
import './DrawingViewer.css';

export default function DrawingViewer({ file, imageUrl: propImageUrl, features, viewLabels, metadata, omissions, activeFeatureId, activeViewLabel, activeMetadataKey, onFeatureSelect, showBalloons }) {
    const highlightRef = useRef(null);
    const [imageUrl, setImageUrl] = useState(null);
    const containerRef = useRef(null);

    useEffect(() => {
        if (propImageUrl) {
            setImageUrl(propImageUrl);
        } else if (file) {
            setImageUrl("https://placehold.co/800x600?text=Drawing+Preview");
        }
    }, [file, propImageUrl]);

    // Scroll highlight into view when selected
    useEffect(() => {
        if (activeMetadataKey && highlightRef.current && containerRef.current) {
            highlightRef.current.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
        }
    }, [activeMetadataKey]);

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

                        {/* Rendering Omissions (Red Boxes) */}
                        {omissions && omissions.map((omission) => (
                            <div
                                key={omission.id}
                                className="omission-box"
                                style={{
                                    left: `${omission.x}%`,
                                    top: `${omission.y}%`
                                }}
                            >
                                <div className="omission-content">
                                    {omission.value}
                                </div>
                                <div className="omission-label">
                                    {omission.description || "Omitted from active drawing"}
                                </div>
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

                        {/* Metadata Highlight */}
                        {metadata && activeMetadataKey && metadata[activeMetadataKey] &&
                            typeof metadata[activeMetadataKey] === 'object' &&
                            metadata[activeMetadataKey].x !== null && metadata[activeMetadataKey].x !== undefined && (
                                <div
                                    ref={highlightRef}
                                    className="metadata-highlight"
                                    style={{
                                        left: `${metadata[activeMetadataKey].x}%`,
                                        top: `${metadata[activeMetadataKey].y}%`,
                                        width: '100px',
                                        height: '40px'
                                    }}
                                >
                                    <div className="metadata-highlight-label">
                                        {activeMetadataKey}
                                    </div>
                                </div>
                            )}
                    </div>
                </div>
            ) : (
                <div className="empty-state">No drawing loaded</div>
            )}
        </div>
    );
}
