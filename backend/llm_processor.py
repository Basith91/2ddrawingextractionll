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
                    {"id": "1", "type": "DIMENSION|DIAMETER|RADIUS|ANGLE|HOLE CALLOUT|GD&T|TOLERANCE|CHAMFER|THREAD|ROUGHNESS", "value": "str", "x": int(0-1000), "y": int(0-1000)}
                ],
                "view_labels": [
                    {"id": "V1", "label": "V1/Front View", "x": int(0-1000), "y": int(0-1000)}
                ],
                "metadata": {
                    "Designation": "str", "Drawing Number": "str", "Revision": "str",
                    "Unit System": "Metric/Inch", "Projection Method": "Third Angle/First Angle",
                    "Weight": "str", "Volume": "str", "Scale": "str",
                    "Material": "str", "General Tolerances": "str", "General Roughness": "str",
                    "BOM": "Present/None"
                }
            }

            RULES:
            1. FEATURES: Extract all dimensions, geometric tolerances (GD&T icons), and symbols on the drawing view.
               - TYPES:
                 DIMENSION (linear), DIAMETER (Ø), RADIUS (R), ANGLE (°), HOLE CALLOUT (e.g. 7 NOS, M6),
                 GD&T (frames like [⌖|0.05|A|B]), TOLERANCE (±), CHAMFER, THREAD, ROUGHNESS.
               - GD&T SPECIFIC: Return the EXACT SYMBOL (e.g. ⌖, ⏥, ○, ⫽, ⟂, e, ⏿, ⌓) and the FULL FRAME content as the value.
                 DO NOT return words like "Position" or "Flatness". Return "⌖ 0.05 A B" or "[⌖|0.05|A|B]".
               - IGNORE: View labels (SECTION A-A), Datum tags (A, B), Notes.
            
            2. VIEW DETECTION (CRITICAL):
               - Identify the separate drawing views (e.g. Front, Top, Side, Isometric).
               - IF LABELS EXIST: Extract the text (e.g. "FRONT VIEW", "SECTION A-A") and its coordinates.
               - IF NO LABELS: Identify the visual CROSS-HAIR center of the geometry for that view and assign a label like "View 1 (Top Left)", "View 2 (Center)".
               - OUTPUT: Return these as "view_labels" with (x, y) coordinates.

            3. METADATA (Title Block):
               - Projection: Scan the Title Block for the Projection Symbol (Concentric Circles and a Trapezoid/Cone).
                 * First Angle: The Trapezoid/Cone is on the LEFT of the Circles. (Symbol: [Cone] [Circles]) -> Return "First Angle"
                 * Third Angle: The Circles are on the LEFT of the Trapezoid/Cone. (Symbol: [Circles] [Cone]) -> Return "Third Angle"
               - Scale: Prefer view scale (1:1) over title block (NTS).
               - Material: Extract code only (e.g. Al-6061).
               - BOM: If no table lists parts, return "None".
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

            # Models to try in order of preference (Fastest/Cheapest -> More Robust)
            # Based on available_models.txt
            models_to_try = [
                'gemini-2.0-flash',       # Newest/Fastest
                'gemini-flash-latest',    # Stable fallback
                'gemini-1.5-flash-latest' # frequent alias
            ]
            
            last_exception = None

            # Acquire global lock to prevent parallel requests
            with LLMProcessor._global_lock:
                log_debug("Acquired lock. Processing request...")
                
                # 1. Pre-call delay to prevent burst limits
                time.sleep(2.0)

                response = None
                
                for model_name in models_to_try:
                    log_debug(f"Attempting with model: {model_name}")
                    
                    try:
                        # Instantiate specific model for this attempt
                        current_model = genai.GenerativeModel(model_name)
                    except Exception as e:
                         log_debug(f"Failed to instantiate {model_name}: {e}")
                         continue
                    
                    # Exponential Backoff Strategy
                    max_retries = 3
                    for attempt in range(max_retries):
                        try:
                            # Generate content
                            response = current_model.generate_content([sample_file, prompt])
                            log_debug(f"Success with {model_name}!")
                            break # Break retry loop on success
                            
                        except Exception as e:
                            last_exception = e
                            error_str = str(e)
                            
                            if "429" in error_str or "Yellow" in error_str or "ResourceExhausted" in error_str:
                                # Rate Limit Hit - Wait and Retry
                                wait_time = (2 ** attempt) + random.uniform(0, 1) # Exponential backoff + jitter
                                log_debug(f"Rate Limit ({model_name}). Retrying in {wait_time:.2f}s...")
                                time.sleep(wait_time)
                            else:
                                # Non-retryable error (e.g., Invalid Argument/404) -> Try next model immediately
                                log_debug(f"Error with {model_name}: {error_str}. Switching models...")
                                break 
                    
                    if response:
                        break # Break model loop if we got a response

                if not response:
                    raise last_exception or Exception("All models failed to generate content.")
            
            log_debug("Response received from Gemini.")
            
            # Clean response
            text_response = response.text.replace("```json", "").replace("```", "").strip()
            
            log_debug(f"Raw Response Length: {len(text_response)}")
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

            result = json.loads(text_response)
            
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

            result['features'] = processed_features
            result['view_labels'] = processed_view_labels
            
            log_debug(f"JSON parsed successfully. Feature count: {len(result.get('features', []))}")
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

            return {"features": [], "metadata": {}, "error": str(e)}

