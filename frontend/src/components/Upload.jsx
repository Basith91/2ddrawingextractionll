import { useState, useRef } from 'react';
import { Upload as UploadIcon, FileText, CheckCircle, XCircle } from 'lucide-react';
import './Upload.css';

export default function Upload({ onUploadSuccess }) {
  const [dragActive, setDragActive] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState(null);
  const inputRef = useRef(null);

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  const handleChange = (e) => {
    e.preventDefault();
    if (e.target.files && e.target.files[0]) {
      handleFile(e.target.files[0]);
    }
  };

  const handleFile = async (file) => {
    const validTypes = ['application/pdf', 'image/png', 'image/jpeg', 'image/jpg'];
    // DXF often has empty type or specific CAD types, so checking extension is safer
    const isDxf = file.name.toLowerCase().endsWith('.dxf');
    const isPdf = file.name.toLowerCase().endsWith('.pdf');
    const isImage = file.type.startsWith('image/');

    if (!isPdf && !isDxf && !isImage) {
      setError('Please upload a PDF, DXF, or Image file.');
      return;
    }

    setError(null);
    setUploading(true);

    const formData = new FormData();
    formData.append("file", file);

    try {
      // Just pass the file to the parent component
      // The parent (App.jsx) handles the actual API upload
      onUploadSuccess({ filename: file.name, file: file });

    } catch (err) {
      setError('Failed to process file.');
    } finally {
      setUploading(false);
    }
  };

  const onButtonClick = () => {
    inputRef.current.click();
  };

  return (
    <div className="upload-container">
      <div
        className={`upload-area ${dragActive ? 'drag-active' : ''}`}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
        onClick={onButtonClick}
      >
        <input
          ref={inputRef}
          type="file"
          className="file-input"
          accept=".pdf,.dxf,.png,.jpg,.jpeg"
          onChange={handleChange}
        />

        {uploading ? (
          <div className="upload-status">
            <div className="spinner"></div>
            <p>Uploading & Processing...</p>
          </div>
        ) : (
          <div className="upload-placeholder">
            <UploadIcon size={48} className="upload-icon" />
            <h3>Click to upload or drag and drop</h3>
            <p>PDF or DXF Drawings</p>
          </div>
        )}
      </div>
      {error && (
        <div className="error-message">
          <XCircle size={20} />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
}
