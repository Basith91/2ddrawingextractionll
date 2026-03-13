import google.generativeai as genai
import json
import os
import warnings

# Suppress the "support has ended" warning for now as we are actively using this version
warnings.filterwarnings("ignore", message="All support for the `google.generativeai` package has ended")

class LLMProcessor:
    def __init__(self, api_key=None):
        self.api_key = api_key
        if not api_key:
            # Try getting from env
            self.api_key = os.getenv("GEMINI_API_KEY")
        
        if self.api_key:
            genai.configure(api_key=self.api_key)
            # Use 'gemini-flash-latest' as it is confirmed available and stable
            self.model = genai.GenerativeModel('gemini-flash-latest')
        else:
            print("Warning: No API Key provided for LLMProcessor.")
            self.model = None

    def analyze_image(self, image_path):
        """
        Analyzes the image directly using Gemini Vision capabilities.
        Input: Atomic path to the image file.
        Output: {'features': List, 'metadata': Dict}
        """
        # Helper for file logging (local to this function for simplicity or could import)
        def log_debug(msg):
            try:
                with open("backend_debug.log", "a", encoding="utf-8") as f:
                    import datetime
                    timestamp = datetime.datetime.now().isoformat()
                    f.write(f"[{timestamp}] [LLM] {msg}\n")
            except:
                pass

        if not self.model:
            log_debug("LLM API Key missing")
            return {"error": "LLM API Key missing", "features": [], "metadata": {}}

        try:
            log_debug(f"Uploading {image_path} to Gemini...")
            # Upload the file to Gemini
            sample_file = genai.upload_file(path=image_path, display_name="Engineering Drawing")
            log_debug("File uploaded to Gemini successfully.")
            
            prompt = """
            Analyze this Engineering Drawing. Return a STRICT JSON object.

            DO NOT EXTRACT text from the Title Block or General Notes as 'features'.
            
            OUTPUT FORMAT:
            {
                "features": [
                    {"id": "1", "type": "DIMENSION|GD&T|...", "value": "str", "x": 0-1000, "y": 0-1000}
                ],
                "view_labels": [
                    {"id": "V1", "label": "V1/Front View", "x": 0-1000, "y": 0-1000}
                ],
                "metadata": {
                    "Designation": {"value": "str", "x": 0-1000, "y": 0-1000},
                    "Drawing Number": {"value": "str", "x": 0-1000, "y": 0-1000},
                    "Revision": {"value": "str", "x": 0-1000, "y": 0-1000},
                    "Unit System": {"value": "Metric/Inch", "x": 0-1000, "y": 0-1000},
                    "Projection Method": {"value": "Third Angle/First Angle", "x": 0-1000, "y": 0-1000},
                    "Weight": {"value": "str", "x": 0-1000, "y": 0-1000},
                    "Volume": {"value": "str", "x": 0-1000, "y": 0-1000},
                    "Scale": {"value": "str", "x": 0-1000, "y": 0-1000},
                    "Material": {"value": "str", "x": 0-1000, "y": 0-1000},
                    "General Tolerances": {"value": "str", "x": 0-1000, "y": 0-1000},
                    "General Roughness": {"value": "str", "x": 0-1000, "y": 0-1000},
                    "BOM": {"value": "Present/None", "x": 0-1000, "y": 0-1000}
                }
            }
            
            CRITICAL: For 'metadata', ALWAYS return an object with both 'value' and 'x','y' coordinates. 
            Do NOT return a plain string for metadata fields.

            RULES:
            1. FEATURES (CRITICAL - TOTAL EXHAUSTION):
               - EXTRACT EVERY SINGLE dimension, geometric tolerance (GD&T icons), and symbol visible.
               - DO NOT SKIP ANY DIMENSION. Pay special attention to "Micro-Dimensions": small numerical values (e.g., 1, 2, 0.5) near centerlines, gaps, or thicknesses that may not have long extension lines.
               - CHECK ALL VIEWS: Front, Top, Side, Sections, Detail, and even the 3D/Isometric view if it contains any callouts or dimensions.
               - TYPES:
                 DIMENSION (linear/angular), DIAMETER (Ø), RADIUS (R), ANGLE (°), 
                 HOLE CALLOUT (e.g. 7 NOS, M6, Ø3.5 THROUGH), 
                 GD&T (frames like [⌖|0.05|A|B]), TOLERANCE (±), CHAMFER, THREAD, ROUGHNESS.
               - GD&T SPECIFIC: Return the EXACT SYMBOL (e.g. ⌖, ⏥, ○, ⫽, ⟂, e, ⏿, ⌓) and the FULL FRAME content as the value.
               - IGNORE: View labels (SECTION A-A), Datum tags (A, B), Notes text block.
            
            2. VIEW DETECTION (CRITICAL):
                - Identify separate views and labels.
                - Return "view_labels" with (x, y) coordinates for EVERY view label or centerline.

            3. METADATA (Title Block):
               - Scan the Title Block area for each field.
               - For EACH field (Designation, Drawing Number, etc.), return the extracted "value" AND its (x, y) coordinates on the drawing.
               - Projection: Scan the Title Block for the Projection Symbol.
            
            4. BOM DETECTION (CRITICAL):
               - Check if there is a 'Bill of Materials' or 'Part List' table on the drawing (usually near the title block or top right).
               - Only return "Present" if you see a MULTI-ROW TABLE with columns like 'ITEM', 'PART NO', 'QTY', 'NOMENCLATURE'.
               - If only the single part shown in the drawing is described in the title block, then BOM is "None".
               - Return "None" if NO multi-row list is found.
               - DO NOT assume a BOM exists just because it is a mechanical part.
            """
            
            log_debug("Generating content with Gemini Vision...")
            
            # --- RATE LIMIT & CONCURRENCY HANDLING ---
            import threading
            import time
            import random
            import math

            # Initialize lock as a CLASS ATTRIBUTE if not checkable generally, 
            # but here we are in an instance method.
            # To ensure it is global across multiple instantiations (as main.py does),
            # we must use a class-level lock.
            if not hasattr(LLMProcessor, '_global_lock'):
                LLMProcessor._global_lock = threading.Lock()
            
            # Tracking status for the frontend
            LLMProcessor._current_status = "Preparing drawing..."

            # Verified Models Supported by the User's API Key (Prioritizing Gemini 1.5 Pro for Paid/Credit Tier)
            models_to_try = [
                'models/gemini-1.5-pro-latest',    # Primary (Stable 1.5 Pro - Best for Accuracy)
                'models/gemini-1.5-pro',           # Alternate Pro
                'models/gemini-flash-latest',      # Fallback (Stable 1.5 Flash)
                'models/gemini-2.0-flash',        # Secondary (Fast)
                'models/gemini-2.0-flash-lite',   # 2.0 Lite
                'models/gemini-pro-latest',       # Legacy Pro Alias
            ]
            
            last_exception = None
            response = None

            # Acquire global lock to prevent parallel requests (critical for Free Tier)
            LLMProcessor._current_status = "Waiting for queue..."
            with LLMProcessor._global_lock:
                LLMProcessor._current_status = "Checking API limits..."
                log_debug("Acquired lock. Processing request...")
                
                # Pre-call delay to prevent burst limits on a fresh session
                time.sleep(2.0)

                for model_idx, model_name in enumerate(models_to_try):
                    LLMProcessor._current_status = f"Trying model {model_idx + 1}/{len(models_to_try)}..."
                    log_debug(f"STARTING sequence for: {model_name}")
                    
                    try:
                        current_model = genai.GenerativeModel(model_name)
                    except Exception as e:
                         log_debug(f"Instantiate Error ({model_name}): {e}")
                         continue
                    
                    # Strategic Retry Logic
                    max_retries = 10 
                    for attempt in range(max_retries):
                        try:
                            LLMProcessor._current_status = f"Generating content ({model_name})..."
                            response = current_model.generate_content([sample_file, prompt])
                            log_debug(f"SUCCESS with {model_name} on attempt {attempt+1}")
                            LLMProcessor._current_status = "Processing results..."
                            break 
                            
                        except Exception as e:
                            last_exception = e
                            error_str = str(e)
                            
                            # Log short snippet for debugging
                            log_debug(f"Attempt {attempt+1} failed ({model_name}): {error_str[:60]}...")
                            
                            if "429" in error_str or "Quota" in error_str or "ResourceExhausted" in error_str:
                                # High Latency Backoff for Free Tier (Wait 3, 6, 12, 24, 45...)
                                wait_time = min(45, (3 * (2 ** attempt)) + random.uniform(0, 5))
                                LLMProcessor._current_status = f"Quota reached. Waiting {int(wait_time)}s..."
                                log_debug(f"QUOTA LIMIT. Cooling down for {wait_time:.1f}s...")
                                time.sleep(wait_time)
                            elif "404" in error_str or "NotFound" in error_str:
                                # Skip to next model immediately
                                log_debug(f"Model {model_name} NOT FOUND. Skipping.")
                                break
                            else:
                                # Server errors (500)
                                time.sleep(3)
                    
                    if response:
                        break # Successfully extracted!

                if not response:
                    LLMProcessor._current_status = "Ready"
                    log_debug("CRITICAL: All models and retries exhausted.")
                    # Return a friendly message for the UI
                    raise Exception("AI Quota reached. Please wait 60 seconds and click upload again.")
            
            log_debug("Response received from Gemini.")
            
            # Clean response
            text_response = response.text.replace("```json", "").replace("```", "").strip()
            
            log_debug(f"Raw Response Length: {len(text_response)}")
            if not text_response:
                log_debug("Empty response from Gemini")
                return {"features": [], "metadata": {}, "error": "Empty response from Gemini"}

            try:
                with open("debug_llm_response.txt", "w", encoding="utf-8") as f:
                    f.write(text_response)
            except:
                pass

            # Handle cases where json might be wrapped in other text
            if "{" in text_response:
                start = text_response.find("{")
                end = text_response.rfind("}") + 1
                text_response = text_response[start:end]
            
            try:
                result = json.loads(text_response)
            except json.JSONDecodeError as je:
                log_debug(f"JSON Decode Error: {je}. Raw Text: {text_response[:100]}...")
                # Attempt to extract anything that looks like JSON if the above failed
                return {"features": [], "metadata": {}, "error": f"Invalid JSON response: {str(je)}"}
            
            # --- SPATIAL CLASSIFICATION (VIEW BUCKETING) ---
            features = result.get('features', [])
            view_labels = result.get('view_labels', [])
            
            if view_labels:
                log_debug(f"Found {len(view_labels)} view markers. Performing clustering...")
                for feat in features:
                    # Get feature coordinates
                    fx = feat.get('x')
                    fy = feat.get('y')
                    
                    # Handle missing coords (if LLM failed slightly)
                    if fx is None or fy is None:
                        if 'Center' in feat:
                            fx = feat['Center'].get('x', 0)
                            fy = feat['Center'].get('y', 0)
                        else:
                            fx, fy = 0, 0
                    
                    best_view = "Unknown"
                    min_dist = float('inf')
                    
                    # Euclidean Distance to each view marker
                    for view in view_labels:
                        vx = view.get('x', 0)
                        vy = view.get('y', 0)
                        
                        dist = math.sqrt((fx - vx)**2 + (fy - vy)**2)
                        
                        if dist < min_dist:
                            min_dist = dist
                            best_view = view.get('label', "View")
                    
                    # Assign closest view
                    feat['view'] = best_view
            else:
                log_debug("No view markers found. Skipping clustering.")
                for feat in features:
                    feat['view'] = "General"

            # Post-process features to ensure frontend compatibility
            processed_features = []
            for idx, f in enumerate(features):
                # Normalize keys (Lowecase vs TitleCase)
                val = f.get('value') or f.get('Value') or "Unknown"
                typ = f.get('type') or f.get('Type') or "Note"
                view_name = f.get('view', "General")

                # RECLASSIFICATION: If value contains ±, it's a TOLERANCE
                if '±' in val or '+/-' in val:
                    typ = "TOLERANCE"
                
                # Handle coordinates
                x = f.get('x')
                y = f.get('y')
                if x is None and 'Center' in f:
                    x = f['Center'].get('x', 0)
                    y = f['Center'].get('y', 0)
                
                # Normalize coordinates (0-1000 -> 0-100)
                if x is not None: x = x / 10.0
                if y is not None: y = y / 10.0
                
                # Assign ID if missing
                fid = f.get('id') or str(idx + 1)
                
                processed_features.append({
                    "id": fid,
                    "value": val,
                    "type": typ,
                    "view": view_name, # Added View Field
                    "x": x if x is not None else 0,
                    "y": y if y is not None else 0
                })

            # Process view_labels similarly (Normalize 0-1000 -> 0-100)
            processed_view_labels = []
            for v in view_labels:
                vx = v.get('x', 0)
                vy = v.get('y', 0)
                v_label = v.get('label', 'View')
                v_id = v.get('id', 'V')
                
                processed_view_labels.append({
                    "id": v_id,
                    "label": v_label,
                    "x": vx / 10.0,
                    "y": vy / 10.0
                })

            # PROCESS METADATA (Normalize coordinates)
            metadata = result.get('metadata', {})
            processed_metadata = {}
            for key, data in metadata.items():
                if isinstance(data, dict):
                    val = data.get('value', '-')
                    mx = data.get('x')
                    my = data.get('y')
                    
                    # Normalize 0-1000 -> 0-100
                    if mx is not None: mx = mx / 10.0
                    if my is not None: my = my / 10.0
                    
                    processed_metadata[key] = {
                        "value": val,
                        "x": mx if mx is not None else None,
                        "y": my if my is not None else None
                    }
                else:
                    # Fallback for old structure or strings
                    processed_metadata[key] = {"value": data, "x": None, "y": None}

            result['features'] = processed_features
            result['view_labels'] = processed_view_labels
            result['metadata'] = processed_metadata
            
            log_debug(f"JSON parsed successfully. Feature count: {len(result.get('features', []))}")
            LLMProcessor._current_status = "Ready"
            return result

        except Exception as e:
            import traceback
            error_msg = f"LLM Vision Error: {str(e)}\n{traceback.format_exc()}"
            print(error_msg)
            log_debug(f"EXCEPTION: {error_msg}")
            
            # Write error to file for debugging
            try:
                with open("llm_error_log.txt", "w", encoding="utf-8") as f:
                    f.write(error_msg)
            except:
                pass

            LLMProcessor._current_status = "Ready"
            return {"features": [], "metadata": {}, "error": str(e)}

    def compare_images(self, primary_image_path, reference_image_path):
        """
        Compares the primary (active) image against a reference image.
        Detects missing dimensions or features from the reference that are not in the primary.
        """
        def log_debug(msg):
            try:
                with open("backend_debug.log", "a", encoding="utf-8") as f:
                    import datetime
                    timestamp = datetime.datetime.now().isoformat()
                    f.write(f"[{timestamp}] [LLM-COMPARE] {msg}\n")
            except:
                pass

        if not self.model:
            return {"error": "LLM API Key missing", "omissions": []}

        try:
            log_debug(f"Uploading images for comparison: {primary_image_path}, {reference_image_path}")
            
            # Upload both files
            primary_file = genai.upload_file(path=primary_image_path, display_name="Active Drawing")
            reference_file = genai.upload_file(path=reference_image_path, display_name="Original Reference")
            
            prompt = """
            You are an expert Engineering Drawing Quality Auditor.
            COMPARE IMAGE 1 (Original Reference) with IMAGE 2 (Active Drawing).

            TASK:
            1. Report EVERY SINGLE text, dimension, symbol, or note that is in Image 1 but is MISSING or DIFFERENT in Image 2.
            2. SCAN THE ENTIRE IMAGE:
               - Dimensions and GD&T features.
               - Title Block (Bottom Right): Mass, Sheet Size, Designation, etc.
               - Extended Data/Technical Data: Lists of notes, technical specs, material properties.
               - Administrative Data: Dates, names, material types.
               - Document References and Remarks.
               - General Notes and Revision History.
            3. CRITICAL: If a value has CHANGED (e.g., Image 1 shows 'A2' and Image 2 shows 'A3'), report the 'A2' value from Image 1 as an omission at its original position.

            OUTPUT FORMAT (STRICT JSON):
            {
                "omissions": [
                    {
                        "id": "M1",
                        "value": "The EXACT missing or original text/number from Image 1",
                        "x": 0-1000, 
                        "y": 0-1000,
                        "description": "Short reasoning"
                    }
                ]
            }

            CRITICAL RULES:
            - TOTAL EXHAUSTIVENESS: If even a single character is different or hidden, report it.
            - Provide the EXACT COORDINATES from Image 1.
            - Ensure the 'value' matches what was in Image 1 word-for-word.
            - Be EXTREMELY PRECISE with small text in the 'Notes' or 'Technical data' sections.
            """

            log_debug("Calling Gemini for comparison...")
            
            # Re-use the same priority logic (Pro is prioritized now)
            models_to_try = [
                'models/gemini-1.5-pro-latest',
                'models/gemini-1.5-pro',
                'models/gemini-flash-latest'
            ]
            
            response = None
            for model_name in models_to_try:
                try:
                    current_model = genai.GenerativeModel(model_name)
                    response = current_model.generate_content([reference_file, primary_file, prompt])
                    break
                except Exception as e:
                    log_debug(f"Model {model_name} failed: {str(e)}")
            
            if not response:
                raise Exception("All models failed for comparison.")

            text_response = response.text.replace("```json", "").replace("```", "").strip()
            
            # Clean JSON
            if "{" in text_response:
                start = text_response.find("{")
                end = text_response.rfind("}") + 1
                text_response = text_response[start:end]
            
            log_debug(f"Comparison raw response: {text_response[:1000]}...")
            
            result = json.loads(text_response)
            omissions = result.get('omissions', [])

            # Normalize coordinates (0-1000 -> 0-100)
            log_debug(f"Comparison complete. Found {len(omissions)} omissions.")
            for o in omissions:
                log_debug(f"Omission: {o.get('value')} at ({o.get('x')}, {o.get('y')})")
                if 'x' in o: o['x'] = o['x'] / 10.0
                if 'y' in o: o['y'] = o['y'] / 10.0
            
            return {"omissions": omissions}

        except Exception as e:
            log_debug(f"Comparison EXCEPTION: {str(e)}")
            return {"error": str(e), "omissions": []}
