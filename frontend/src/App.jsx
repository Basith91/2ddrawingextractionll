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
  const [features, setFeatures] = useState([]);
  const [viewLabels, setViewLabels] = useState([]);
  const [metadata, setMetadata] = useState({});
  const [activeTab, setActiveTab] = useState('features');
  const [isProcessing, setIsProcessing] = useState(false);
  const [uploadedImageUrl, setUploadedImageUrl] = useState(null);
  const [apiKey, setApiKey] = useState(localStorage.getItem('gemini_api_key') || '');
  const [showApiKeyModal, setShowApiKeyModal] = useState(!localStorage.getItem('gemini_api_key'));

  const handleApiKeySubmit = (key) => {
    setApiKey(key);
    localStorage.setItem('gemini_api_key', key);
    setShowApiKeyModal(false);
  };

  const handleUploadSuccess = async ({ filename, file: uploadedFile }) => {
    setFile(uploadedFile);
    setIsProcessing(true);
    setActiveViewLabel(null); // Reset on new upload
    setActiveFeatureId(null);

    const formData = new FormData();
    formData.append("file", uploadedFile);

    // DEBUG: Alert to confirm function is called
    alert(`Starting upload for: ${filename}`);

    try {
      const response = await fetch('http://localhost:8001/upload', {
        method: 'POST',
        headers: {
          'x-api-key': apiKey
        },
        body: formData,
      });

      if (!response.ok) throw new Error('Upload failed');

      const data = await response.json();

      // Update the drawing viewer with the real image URL from backend
      if (data.url) {
        // Force a timestamp to avoid caching issues if same filename
        // But data.url usually points to a unique temp file
        // We need to pass this URL to DrawingViewer
        // DrawingViewer takes 'file' object currently, we should change it or 
        // add a new prop 'imageUrl'
      }

      setFeatures(data.features || []);
      setViewLabels(data.view_labels || []);
      setMetadata(data.metadata || {});

      // We need to pass the URL to the viewer. Let's add a state for it.
      // Or hack it into the checked file object? No, better to have clean state.
      // But for now, let's just modify the `file` state logic in DrawingViewer or pass a prop.
      // Let's modify App to hold imageUrl state.
      setUploadedImageUrl(data.url);

    } catch (err) {
      console.error("Processing error:", err);
      // Fallback mock data if backend fails or no OCR
      setFeatures([
        { id: 1, value: "Error: " + err.message, type: "Error", x: 50, y: 50 },
        { id: 2, value: "Check Backend Logs", type: "Error", x: 50, y: 60 }
      ]);
      setMetadata({
        "Designation": "Error - Check Backend",
        "Drawing Number": "Connection Failed?",
        "Revision": "-"
      });
      alert(`Upload Failed: ${err.message}. Ensure backend is running.`);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleFeatureSelect = (id) => {
    setActiveFeatureId(id);
  };

  const handleViewSelect = (viewName) => {
    setActiveViewLabel(viewName === activeViewLabel ? null : viewName); // Toggle
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
          isProcessing ? (
            <div className="processing-view">
              <div className="processing-spinner"></div>
              <h2>Analyzing Drawing...</h2>
              <p>Identifying dimensions, tolerances, and GD&T features using Gemini LLM</p>
            </div>
          ) : (
            <div className="workspace-view">
              <div className="workspace-main">
                <DrawingViewer
                  file={file}
                  imageUrl={uploadedImageUrl}
                  features={features}
                  viewLabels={viewLabels}
                  activeFeatureId={activeFeatureId}
                  activeViewLabel={activeViewLabel}
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
                  onFeatureSelect={handleFeatureSelect}
                  onViewSelect={handleViewSelect}
                  activeTab={activeTab}
                  onTabChange={setActiveTab}
                />
              </div>
            </div>
          )
        )}
      </main>
    </div>
  );
}

export default App;
