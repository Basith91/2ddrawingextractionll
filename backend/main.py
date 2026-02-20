from fastapi import FastAPI, UploadFile, File, HTTPException, Header
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
import uvicorn
import shutil
import os
import uuid
import pypdfium2 as pdfium
from dotenv import load_dotenv
from ocr_engine import OCREngine
from llm_processor import LLMProcessor

# Load environment variables
load_dotenv()

app = FastAPI()

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize OCR Engine once (heavy model)
try:
    ocr_engine = OCREngine()
except Exception as e:
    print(f"Warning: OCR Engine failed to initialize: {e}")
    ocr_engine = None

# Ensure temp directory exists
os.makedirs("temp", exist_ok=True)
app.mount("/temp", StaticFiles(directory="temp"), name="temp")

@app.get("/")
def read_root():
    return {"message": "2D Extraction API is running"}

# Helper for file logging
def log_debug(msg):
    try:
        with open("backend_debug.log", "a", encoding="utf-8") as f:
            import datetime
            timestamp = datetime.datetime.now().isoformat()
            f.write(f"[{timestamp}] {msg}\n")
    except:
        pass

@app.post("/upload")
async def upload_file(
    file: UploadFile = File(...), 
    x_api_key: str = Header(None)
):
    log_debug(f"Received upload request: {file.filename}")

    if not file.filename.lower().endswith(('.pdf', '.png', '.jpg', '.jpeg', '.dxf')):
        log_debug("Invalid file type rejected")
        raise HTTPException(status_code=400, detail="Invalid file type")

    # Initialize LLM Processor
    llm_processor = LLMProcessor(api_key=x_api_key)

    # Generate unique IDs
    file_id = str(uuid.uuid4())
    ext = os.path.splitext(file.filename)[1].lower()
    filename_base = f"{file_id}"
    file_path = os.path.join("temp", f"{filename_base}{ext}")

    try:
        # Save uploaded file
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        log_debug(f"Saved file to {file_path}")
            
        # Handle PDF to Image Conversion for Visuals
        display_image_filename = f"{filename_base}{ext}"
        
        if ext == '.pdf':
            log_debug("Converting PDF to image...")
            # Convert first page to image
            pdf = pdfium.PdfDocument(file_path)
            page = pdf[0]
            # Scale 4 = ~288 DPI (72 * 4), ensuring small text in title blocks is crisp for the LLM
            bitmap = page.render(scale=4) 
            pil_image = bitmap.to_pil()
            
            display_image_filename = f"{filename_base}.png"
            display_image_path = os.path.join("temp", display_image_filename)
            pil_image.save(display_image_path)
            log_debug(f"Converted PDF to image: {display_image_path}")
            
            # CRITICAL FIX: Analyze the IMAGE, not the PDF.
            analysis_result = llm_processor.analyze_image(display_image_path)
            
        elif ext == '.dxf':
            log_debug("Converting DXF to image...")
            display_image_filename = f"{filename_base}.png"
            display_image_path = os.path.join("temp", display_image_filename)
            
            from dxf_converter import convert_dxf_to_image
            success = convert_dxf_to_image(file_path, display_image_path)
            
            if not success:
                raise Exception("Failed to convert DXF to image")
                
            log_debug(f"Converted DXF to image: {display_image_path}")
            analysis_result = llm_processor.analyze_image(display_image_path)
            
        else:
            # It's already an image
            analysis_result = llm_processor.analyze_image(file_path)
        
        log_debug("Analysis complete. Returning response.")
        
        # URL for the frontend to confirm what to show
        # If it was a PDF, we point to the converted PNG
        image_url = f"http://localhost:8001/temp/{display_image_filename}"
        
        return {
            "filename": file.filename,
            "url": image_url,
            "features": analysis_result.get('features', []),
            "view_labels": analysis_result.get('view_labels', []),
            "metadata": analysis_result.get('metadata', {}),
            "raw_ocr": [] # Not using local OCR
        }

    except Exception as e:
        import traceback
        error_msg = f"Error processing file: {str(e)}\n{traceback.format_exc()}"
        print(error_msg)
        log_debug(f"CRITICAL ERROR: {error_msg}")
        
        return {
            "filename": file.filename, 
            "error": str(e),
            "features": [],
            "metadata": {}
        }

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
