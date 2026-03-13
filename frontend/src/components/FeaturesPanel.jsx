import React, { useState } from 'react';
import { Ruler, FileText, Settings, Layers, Download, FileSpreadsheet, File as FileIcon } from 'lucide-react';
import axios from 'axios';
import './FeaturesPanel.css';

export default function FeaturesPanel({ features, metadata, activeFeatureId, activeViewLabel, activeMetadataKey, onFeatureSelect, onViewSelect, onMetadataSelect, activeTab, onTabChange, onCompare, isComparing, hasReference }) {
    const [isExporting, setIsExporting] = useState(false);

    const handleExport = async (format) => {
        console.log(`handleExport called for ${format} on tab ${activeTab}`);

        const isMetadata = activeTab === 'metadata';
        const dataToExport = isMetadata ? metadata : features;

        if (!dataToExport || (Array.isArray(dataToExport) && dataToExport.length === 0) || (Object.keys(dataToExport).length === 0)) {
            console.warn(`No ${activeTab} data to export`);
            return;
        }
        setIsExporting(true);

        try {
            let endpoint;
            if (isMetadata) {
                endpoint = format === 'pdf' ? '/export/metadata/pdf' :
                    format === 'csv' ? '/export/metadata/csv' : '/export/metadata/excel';
            } else {
                endpoint = format === 'pdf' ? '/export/pdf' :
                    format === 'csv' ? '/export/csv' : '/export/excel';
            }

            // Sanitize filename: remove characters that might cause download to fail
            const designationVal = metadata["Designation"]?.value || metadata["Designation"] || "extraction_results";
            let filename = String(designationVal)
                .replace(/[<>:"/\\|?*]/g, '_') // Remove invalid filename chars
                .trim();

            if (!filename || filename === "[object Object]") filename = "extraction_results";

            // Prepare data for export
            const exportData = isMetadata ? {
                metadata: Object.entries(metadata).reduce((acc, [key, val]) => {
                    // Extract .value if it's an object, otherwise use the value itself
                    acc[key] = (typeof val === 'object' && val !== null) ? val.value : val;
                    return acc;
                }, {}),
                filename: filename
            } : {
                features: features.map(f => ({
                    id: String(f.id),
                    type: f.type || "Dimension",
                    value: String(f.value),
                    view: f.view || "General"
                })),
                filename: filename
            };

            // Hardcode localhost:8001 for consistency on the user's machine
            const backendUrl = `http://localhost:8001${endpoint}`;
            console.log(`Requesting export from: ${backendUrl}`);

            const response = await axios.post(backendUrl, exportData, {
                responseType: 'blob',
                timeout: 30000 // Increase to 30s
            });

            if (!response.data || response.data.size === 0) {
                throw new Error("Received empty file from server");
            }

            // Create download link
            const blob = new Blob([response.data], {
                type: format === 'pdf' ? 'application/pdf' :
                    format === 'csv' ? 'text/csv' :
                        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
            });
            const url = window.URL.createObjectURL(blob);

            const link = document.createElement('a');
            link.href = url;
            const suffix = isMetadata ? "_metadata" : "";
            link.download = `${filename}${suffix}.${format === 'excel' ? 'xlsx' : format}`;

            // Required for some browsers
            document.body.appendChild(link);
            link.click();

            // Clean up
            setTimeout(() => {
                document.body.removeChild(link);
                window.URL.revokeObjectURL(url);
            }, 100);

            console.log(`${format.toUpperCase()} download triggered successfully`);
        } catch (error) {
            console.error(`Export to ${format} failed:`, error);
            let msg = `Connecting failed: ${error.message}.`;

            if (error.response) {
                if (error.response.data instanceof Blob) {
                    try {
                        const errorText = await error.response.data.text();
                        try {
                            const errorJson = JSON.parse(errorText);
                            msg = `Server Error (${error.response.status}): ${errorJson.detail || errorText}`;
                        } catch (e) {
                            msg = `Server Error (${error.response.status}): ${errorText.substring(0, 100)}`;
                        }
                    } catch (e) {
                        msg = `Server Error (${error.response.status})`;
                    }
                } else {
                    msg = `Server Error (${error.response.status}): ${JSON.stringify(error.response.data)}`;
                }
            }
            alert(`Oops! Export failed.\n\n${msg}\n\nPlease ensure your backend is running.`);
        } finally {
            setIsExporting(false);
        }
    };

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
                <div className="export-controls">
                    <span className="export-label">Export {activeTab === 'metadata' ? 'Meta Data' : 'Features'}:</span>
                    <div className="export-buttons">
                        <button
                            className="export-btn pdf"
                            onClick={() => handleExport('pdf')}
                            disabled={isExporting || (activeTab === 'features' ? features.length === 0 : Object.keys(metadata).length === 0)}
                            title={`Export ${activeTab} to PDF`}
                        >
                            <FileIcon size={14} />
                            <span>PDF</span>
                        </button>
                        <button
                            className="export-btn csv"
                            onClick={() => handleExport('csv')}
                            disabled={isExporting || (activeTab === 'features' ? features.length === 0 : Object.keys(metadata).length === 0)}
                            title={`Export ${activeTab} to CSV`}
                        >
                            <FileSpreadsheet size={14} />
                            <span>CSV</span>
                        </button>
                        <button
                            className="export-btn excel"
                            onClick={() => handleExport('excel')}
                            disabled={isExporting || (activeTab === 'features' ? features.length === 0 : Object.keys(metadata).length === 0)}
                            title={`Export ${activeTab} to Excel (.xlsx)`}
                        >
                            <FileSpreadsheet size={14} />
                            <span>Excel</span>
                        </button>
                    </div>
                </div>

                {hasReference && (
                    <div className="comparison-tool">
                        <button
                            className={`compare-btn ${isComparing ? 'loading' : ''}`}
                            onClick={onCompare}
                            disabled={isComparing}
                        >
                            <Layers size={16} />
                            {isComparing ? "Checking Omissions..." : "Check for Omissions"}
                        </button>
                    </div>
                )}

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
                                <MetaItem
                                    label="Designation"
                                    value={metadata["Designation"]?.value || metadata["Designation"]}
                                    onSelect={() => onMetadataSelect("Designation")}
                                />
                                <MetaItem
                                    label="Drawing Number"
                                    value={metadata["Drawing Number"]?.value || metadata["Drawing Number"]}
                                    onSelect={() => onMetadataSelect("Drawing Number")}
                                />
                                <MetaItem
                                    label="Revision"
                                    value={metadata["Revision"]?.value || metadata["Revision"]}
                                    onSelect={() => onMetadataSelect("Revision")}
                                />
                            </div>
                        </div>

                        <div className="metadata-section">
                            <h3 className="section-title">Measurements & Units</h3>
                            <div className="metadata-grid">
                                <MetaItem
                                    label="Unit System"
                                    value={metadata["Unit System"]?.value || metadata["Unit System"]}
                                    onSelect={() => onMetadataSelect("Unit System")}
                                />
                                <MetaItem
                                    label="Projection Method"
                                    value={metadata["Projection Method"]?.value || metadata["Projection Method"]}
                                    icon={getProjectionIcon(metadata["Projection Method"]?.value || metadata["Projection Method"])}
                                    onSelect={() => onMetadataSelect("Projection Method")}
                                />
                                <MetaItem
                                    label="Weight"
                                    value={metadata["Weight"]?.value || metadata["Weight"]}
                                    onSelect={() => onMetadataSelect("Weight")}
                                />
                                <MetaItem
                                    label="Volume"
                                    value={metadata["Volume"]?.value || metadata["Volume"]}
                                    onSelect={() => onMetadataSelect("Volume")}
                                />
                                <MetaItem
                                    label="Scale"
                                    value={metadata["Scale"]?.value || metadata["Scale"]}
                                    onSelect={() => onMetadataSelect("Scale")}
                                />
                            </div>
                        </div>

                        <div className="metadata-section">
                            <h3 className="section-title">Material & Manufacturing</h3>
                            <div className="metadata-grid">
                                <MetaItem
                                    label="Material"
                                    value={metadata["Material"]?.value || metadata["Material"]}
                                    onSelect={() => onMetadataSelect("Material")}
                                />
                                <MetaItem
                                    label="General Tolerances"
                                    value={metadata["General Tolerances"]?.value || metadata["General Tolerances"]}
                                    onSelect={() => onMetadataSelect("General Tolerances")}
                                />
                                <MetaItem
                                    label="General Roughness"
                                    value={metadata["General Roughness"]?.value || metadata["General Roughness"]}
                                    onSelect={() => onMetadataSelect("General Roughness")}
                                />
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
                                            <MetaItem
                                                key={key}
                                                label={key}
                                                value={value?.value || value}
                                                onSelect={() => onMetadataSelect(key)}
                                            />
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

function MetaItem({ label, value, icon, onSelect }) {
    const isObject = typeof value === 'object' && value !== null;
    const displayValue = isObject ? value.value : (value === "null" || !value ? "-" : value);

    const handleClick = () => {
        if (isObject && value.x == null) { // Check for x coordinate to determine if it's an old format object
            alert(`Note: To see "${label}" highlighted on the drawing, please re-upload this drawing one time.`);
        }
        onSelect();
    };

    return (
        <div
            className="metadata-item-grid"
            onClick={handleClick}
            style={{ cursor: 'pointer' }}
        >
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
