import { useState, useEffect } from 'react';
import './App.css';
import Upload from './components/Upload';
import DrawingViewer from './components/DrawingViewer';
import FeaturesPanel from './components/FeaturesPanel';
import ApiKeyModal from './components/ApiKeyModal';
import { Layout, Key } from 'lucide-react';

function App() {
  const [file, setFile] = useState(null);
  const [activeFeatureId, setActiveFeatureId] = useState(null);
  const [activeViewLabel, setActiveViewLabel] = useState(null); // New state for active view
  const [activeMetadataKey, setActiveMetadataKey] = useState(null); // New state for metadata highlight
  const [features, setFeatures] = useState([]);
  const [viewLabels, setViewLabels] = useState([]);
  const [metadata, setMetadata] = useState({});
  const [activeTab, setActiveTab] = useState('features');
  const [isProcessing, setIsProcessing] = useState(false);
  const [uploadedImageUrl, setUploadedImageUrl] = useState(null);
  const [apiKey, setApiKey] = useState(localStorage.getItem('gemini_api_key') || '');
  const [showApiKeyModal, setShowApiKeyModal] = useState(!localStorage.getItem('gemini_api_key'));
  const [backendStatus, setBackendStatus] = useState('Ready');

  // NEW: Comparison States
  const [primaryFilename, setPrimaryFilename] = useState(null);
  const [referenceFilename, setReferenceFilename] = useState(null);
  const [omissions, setOmissions] = useState([]);
  const [isComparing, setIsComparing] = useState(false);

  const handleApiKeySubmit = (key) => {
    setApiKey(key);
    localStorage.setItem('gemini_api_key', key);
    setShowApiKeyModal(false);
  };

  // Poll backend status when processing
  useEffect(() => {
    let interval;
    if (isProcessing) {
      interval = setInterval(async () => {
        try {
          const res = await fetch('http://localhost:8001/status');
          const data = await res.json();
          if (data.status) setBackendStatus(data.status);
        } catch (e) {
          console.error("Status check failed", e);
        }
      }, 2000);
    } else {
      setBackendStatus('Ready');
    }
    return () => clearInterval(interval);
  }, [isProcessing]);

  const handleUploadSuccess = async ({ primaryFile, referenceFile }) => {
    setFile(primaryFile);
    setIsProcessing(true);
    setActiveViewLabel(null);
    setActiveFeatureId(null);
    setOmissions([]);

    const previewUrl = URL.createObjectURL(primaryFile);
    setUploadedImageUrl(previewUrl);

    const formData = new FormData();
    formData.append("file", primaryFile);
    if (referenceFile) {
      formData.append("reference_file", referenceFile);
    }

    try {
      const response = await fetch('http://localhost:8001/upload', {
        method: 'POST',
        headers: { 'x-api-key': apiKey },
        body: formData,
      });

      if (!response.ok) throw new Error('Upload failed');
      const data = await response.json();

      setFeatures(data.features || []);
      setViewLabels(data.view_labels || []);
      setMetadata(data.metadata || {});
      setPrimaryFilename(data.primary_filename);
      setReferenceFilename(data.reference_filename);

      if (data.url) setUploadedImageUrl(data.url);
      if (data.error) alert(`Analysis Error: ${data.error}`);

    } catch (err) {
      console.error("Processing error:", err);
      setFeatures([{ id: 1, value: "Error: " + err.message, type: "Error", x: 50, y: 50 }]);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCompare = async () => {
    if (!primaryFilename || !referenceFilename) return;

    setIsComparing(true);
    setBackendStatus("Comparing drawings...");

    try {
      const response = await fetch('http://localhost:8001/compare', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey
        },
        body: JSON.stringify({
          primary_filename: primaryFilename,
          reference_filename: referenceFilename
        }),
      });

      if (!response.ok) throw new Error('Comparison failed');
      const data = await response.json();

      setOmissions(data.omissions || []);
      if (data.omissions?.length > 0) {
        alert(`Found ${data.omissions.length} missing dimensions! They are highlighted in red.`);
      } else {
        alert("No omissions found! The drawing matches the reference perfectly.");
      }

    } catch (err) {
      console.error("Comparison error:", err);
      alert("Failed to compare drawings: " + err.message);
    } finally {
      setIsComparing(false);
      setBackendStatus("Ready");
    }
  };

  const handleFeatureSelect = (id) => {
    setActiveFeatureId(id);
  };

  const handleViewSelect = (viewName) => {
    setActiveViewLabel(viewName === activeViewLabel ? null : viewName); // Toggle
  };

  const handleMetadataSelect = (key) => {
    setActiveMetadataKey(key === activeMetadataKey ? null : key); // Toggle
  };

  return (
    <div className="app-container">
      <ApiKeyModal isOpen={showApiKeyModal} onSubmit={handleApiKeySubmit} />

      <header className="app-header">
        <div className="logo">
          <Layout className="logo-icon" />
          <h1>2D Extraction LLM</h1>
        </div>
        <div className="user-controls">
          <button className="icon-btn" onClick={() => setShowApiKeyModal(true)} title="Update API Key">
            <Key size={20} />
          </button>
        </div>
      </header>

      <main className="app-content">
        {!file ? (
          <div className="upload-view">
            <Upload onUploadSuccess={handleUploadSuccess} />
          </div>
        ) : (
          <div className="workspace-view">
            {isProcessing && (
              <div className="processing-overlay">
                <div className="processing-card">
                  <div className="processing-spinner"></div>
                  <h2>Analyzing Drawing...</h2>
                  <p className="subtitle-text">Identifying dimensions, tolerances, and GD&T features using Gemini LLM</p>
                </div>
              </div>
            )}
            <div className="workspace-main">
              <DrawingViewer
                file={file}
                imageUrl={uploadedImageUrl}
                features={features}
                viewLabels={viewLabels}
                metadata={metadata}
                omissions={omissions}
                activeFeatureId={activeFeatureId}
                activeViewLabel={activeViewLabel}
                activeMetadataKey={activeMetadataKey}
                onFeatureSelect={handleFeatureSelect}
                showBalloons={activeTab === 'features'}
              />
            </div>
            <div className="workspace-sidebar">
              <FeaturesPanel
                features={features}
                metadata={metadata}
                activeFeatureId={activeFeatureId}
                activeViewLabel={activeViewLabel}
                activeMetadataKey={activeMetadataKey}
                onFeatureSelect={handleFeatureSelect}
                onViewSelect={handleViewSelect}
                onMetadataSelect={handleMetadataSelect}
                activeTab={activeTab}
                onTabChange={setActiveTab}
                onCompare={handleCompare}
                isComparing={isComparing}
                hasReference={!!referenceFilename}
              />
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

export default App;
