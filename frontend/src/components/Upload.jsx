import { useState, useRef } from 'react';
import { Upload as UploadIcon, FileText, CheckCircle, XCircle, FileWarning, ShieldCheck } from 'lucide-react';
import './Upload.css';

export default function Upload({ onUploadSuccess }) {
  const [primaryFile, setPrimaryFile] = useState(null);
  const [referenceFile, setReferenceFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState(null);

  const primaryInputRef = useRef(null);
  const referenceInputRef = useRef(null);

  const handleFileChange = (e, type) => {
    const file = e.target.files[0];
    if (!file) return;

    const isDxf = file.name.toLowerCase().endsWith('.dxf');
    const isPdf = file.name.toLowerCase().endsWith('.pdf');
    const isImage = file.type.startsWith('image/');

    if (!isPdf && !isDxf && !isImage) {
      setError('Please upload a PDF, DXF, or Image file.');
      return;
    }

    setError(null);
    if (type === 'primary') {
      setPrimaryFile(file);
    } else {
      setReferenceFile(file);
    }
  };

  const handleStartAnalysis = () => {
    if (!primaryFile) {
      setError('Please select a primary drawing to analyze.');
      return;
    }
    setUploading(true);
    onUploadSuccess({
      primaryFile,
      referenceFile
    });
  };

  return (
    <div className="upload-dashboard">
      <div className="upload-grid">
        {/* Primary Upload */}
        <div
          className={`upload-card ${primaryFile ? 'has-file' : ''}`}
          onClick={() => primaryInputRef.current.click()}
        >
          <input
            type="file"
            ref={primaryInputRef}
            onChange={(e) => handleFileChange(e, 'primary')}
            hidden
            accept=".pdf,.dxf,.png,.jpg,.jpeg"
          />
          <div className="card-icon primary">
            {primaryFile ? <CheckCircle size={32} /> : <FileText size={32} />}
          </div>
          <div className="card-content">
            <h3>Active Drawing</h3>
            <p>{primaryFile ? primaryFile.name : 'Upload the drawing with missing data'}</p>
          </div>
          {primaryFile && <span className="badge">Ready</span>}
        </div>

        {/* Reference Upload */}
        <div
          className={`upload-card reference ${referenceFile ? 'has-file' : ''}`}
          onClick={() => referenceInputRef.current.click()}
        >
          <input
            type="file"
            ref={referenceInputRef}
            onChange={(e) => handleFileChange(e, 'reference')}
            hidden
            accept=".pdf,.dxf,.png,.jpg,.jpeg"
          />
          <div className="card-icon reference">
            {referenceFile ? <ShieldCheck size={32} /> : <FileWarning size={32} />}
          </div>
          <div className="card-content">
            <h3>Original Reference</h3>
            <p>{referenceFile ? referenceFile.name : 'Upload the original (Optional Reference)'}</p>
          </div>
          {referenceFile && <span className="badge ref">Reference Set</span>}
        </div>
      </div>

      <div className="upload-actions">
        {error && (
          <div className="error-tip">
            <XCircle size={16} /> {error}
          </div>
        )}

        <button
          className={`start-btn ${!primaryFile ? 'disabled' : ''}`}
          disabled={!primaryFile || uploading}
          onClick={handleStartAnalysis}
        >
          {uploading ? (
            <><div className="btn-spinner"></div> Processing...</>
          ) : (
            <><UploadIcon size={20} /> Start Comprehensive Analysis</>
          )}
        </button>

        <p className="upload-hint">
          {referenceFile
            ? "Comparison mode enabled. AI will detect omissions against the reference."
            : "Standard extraction mode. Upload a reference above to check for missing data."}
        </p>
      </div>
    </div>
  );
}
