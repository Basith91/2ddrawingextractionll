import React, { useState } from 'react';
import { Ruler, FileText, Settings, Layers } from 'lucide-react';
import './FeaturesPanel.css';

export default function FeaturesPanel({ features, metadata, activeFeatureId, activeViewLabel, onFeatureSelect, onViewSelect, activeTab, onTabChange }) {
    // Local state removed, using props now

    return (
        <div className="features-panel">
            <div className="features-tabs">
                <button
                    className={`tab-button ${activeTab === 'features' ? 'active' : ''}`}
                    onClick={() => onTabChange('features')}
                    title="Measurements & Features"
                >
                    <Ruler size={18} />
                    <span>Features</span>
                </button>
                <button
                    className={`tab-button ${activeTab === 'metadata' ? 'active' : ''}`}
                    onClick={() => onTabChange('metadata')}
                    title="Document Metadata"
                >
                    <FileText size={18} />
                    <span>Meta Data</span>
                </button>
            </div>

            <div className="panel-content">
                {activeTab === 'features' ? (
                    <div className="features-list">
                        {features.length === 0 ? (
                            <div className="empty-panel">No features extracted yet.</div>
                        ) : (
                            // Group by VIEW instead of TYPE
                            Object.entries(features.reduce((acc, feature) => {
                                const view = feature.view || 'General';
                                if (!acc[view]) acc[view] = [];
                                acc[view].push(feature);
                                return acc;
                            }, {})).map(([viewName, groupFeatures]) => (
                                <div key={viewName} className="feature-group">
                                    <h3
                                        className={`feature-group-title view-header ${activeViewLabel === viewName ? 'active-view' : ''}`}
                                        onClick={() => onViewSelect && onViewSelect(viewName)}
                                        style={{ cursor: 'pointer' }}
                                        title="Click to highlight this view on drawing"
                                    >
                                        {viewName}
                                    </h3>

                                    {/* Sub-group by TYPE within View */}
                                    {Object.entries(groupFeatures.reduce((typeAcc, feature) => {
                                        const t = feature.type || 'Other';
                                        if (!typeAcc[t]) typeAcc[t] = [];
                                        typeAcc[t].push(feature);
                                        return typeAcc;
                                    }, {})).sort().map(([typeName, typeFeatures]) => (
                                        <div key={typeName} className="type-subgroup">
                                            <h4 className="type-sub-header">{typeName}</h4>
                                            {typeFeatures.map((feature) => (
                                                <div
                                                    key={feature.id}
                                                    className={`feature-item ${activeFeatureId === feature.id ? 'active' : ''}`}
                                                    onClick={() => onFeatureSelect(feature.id)}
                                                >
                                                    <div className="feature-id-badge">{feature.id}</div>
                                                    <div className="feature-details">
                                                        <span className="feature-type-badge">{feature.type}</span>
                                                        <span className="feature-value">{feature.value}</span>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    ))}
                                </div>
                            ))
                        )}
                    </div>
                ) : (
                    <div className="metadata-list">
                        <div className="metadata-section">
                            <h3 className="section-title">Identification & Documentation</h3>
                            <div className="metadata-grid">
                                <MetaItem label="Designation" value={metadata["Designation"]} />
                                <MetaItem label="Drawing Number" value={metadata["Drawing Number"]} />
                                <MetaItem label="Revision" value={metadata["Revision"]} />
                            </div>
                        </div>

                        <div className="metadata-section">
                            <h3 className="section-title">Measurements & Units</h3>
                            <div className="metadata-grid">
                                <MetaItem label="Unit System" value={metadata["Unit System"]} />
                                <MetaItem
                                    label="Projection Method"
                                    value={metadata["Projection Method"]}
                                    icon={getProjectionIcon(metadata["Projection Method"])}
                                />
                                <MetaItem label="Weight" value={metadata["Weight"]} />
                                <MetaItem label="Volume" value={metadata["Volume"]} />
                                <MetaItem label="Scale" value={metadata["Scale"]} />
                            </div>
                        </div>

                        <div className="metadata-section">
                            <h3 className="section-title">Material & Manufacturing</h3>
                            <div className="metadata-grid">
                                <MetaItem label="Material" value={metadata["Material"]} />
                                <MetaItem label="General Tolerances" value={metadata["General Tolerances"]} />
                                <MetaItem label="General Roughness" value={metadata["General Roughness"]} />
                            </div>
                        </div>

                        {/* Fallback for any other keys */}
                        {Object.entries(metadata).filter(([k]) => ![
                            "Designation", "Drawing Number", "Revision",
                            "Unit System", "Projection Method", "Weight", "Volume", "Scale",
                            "Material", "General Tolerances", "General Roughness"
                        ].includes(k)).length > 0 && (
                                <div className="metadata-section">
                                    <h3 className="section-title">Other Details</h3>
                                    <div className="metadata-grid">
                                        {Object.entries(metadata).filter(([k]) => ![
                                            "Designation", "Drawing Number", "Revision",
                                            "Unit System", "Projection Method", "Weight", "Volume", "Scale",
                                            "Material", "General Tolerances", "General Roughness"
                                        ].includes(k)).map(([key, value]) => (
                                            <MetaItem key={key} label={key} value={value} />
                                        ))}
                                    </div>
                                </div>
                            )}
                    </div>
                )}
            </div>
        </div>
    );
}

function MetaItem({ label, value, icon }) {
    const displayValue = (!value || value === "null") ? "-" : value;

    return (
        <div className="metadata-item-grid">
            <span className="meta-label">{label}</span>
            <div className="meta-value-container">
                {icon && <span className="meta-icon">{icon}</span>}
                <span className="meta-value">{displayValue}</span>
            </div>
        </div>
    );
}

function getProjectionIcon(method) {
    if (!method) return null;
    const m = method.toLowerCase();

    // Third Angle Projection Icon (Circle then Cone)
    if (m.includes('third')) {
        return (
            <svg width="24" height="24" viewBox="0 0 50 30" fill="none" stroke="currentColor" strokeWidth="2">
                {/* Circle symbol (left) */}
                <circle cx="12" cy="15" r="8" />
                <circle cx="12" cy="15" r="4" />
                {/* Cone symbol (right) - Small rect to Large rect */}
                <path d="M28 10 L28 20 L42 25 L42 5 Z" />
                <line x1="5" y1="15" x2="45" y2="15" strokeDasharray="4 2" strokeWidth="1" opacity="0.5" />
                <line x1="12" y1="5" x2="12" y2="25" strokeDasharray="4 2" strokeWidth="1" opacity="0.5" />
            </svg>
        );
    }

    // First Angle Projection (Cone then Circle)
    if (m.includes('first')) {
        return (
            <svg width="24" height="24" viewBox="0 0 50 30" fill="none" stroke="currentColor" strokeWidth="2">
                {/* Cone symbol (left) */}
                <path d="M8 10 L8 20 L22 25 L22 5 Z" />
                {/* Circle symbol (right) */}
                <circle cx="38" cy="15" r="8" />
                <circle cx="38" cy="15" r="4" />
                <line x1="5" y1="15" x2="45" y2="15" strokeDasharray="4 2" strokeWidth="1" opacity="0.5" />
            </svg>
        );
    }

    return null;
}
