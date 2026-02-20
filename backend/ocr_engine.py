import logging

# Set logging level to warning to suppress verbose PaddleOCR output
logging.getLogger("ppocr").setLevel(logging.WARNING)

class OCREngine:
    def __init__(self, lang='en'):
        try:
            from paddleocr import PaddleOCR
        except ImportError:
            print("PaddleOCR not found. OCR features will be disabled.")
            self.ocr = None
            return

        # Initialize PaddleOCR
        # use_angle_cls=True allows detecting rotated text which is common in drawings
        print("Initializing PaddleOCR...")
        self.ocr = PaddleOCR(use_angle_cls=True, lang=lang, show_log=False)
        print("PaddleOCR initialized.")

    def process_image(self, image_path):
        """
        Runs OCR on the given image path.
        Returns a list of dictionaries: {'text': str, 'confidence': float, 'box': [[x1, y1], [x2, y1], [x2, y2], [x1, y2]]}
        """
        if not self.ocr:
            return []

        result = self.ocr.ocr(image_path, cls=True)
        
        extracted_data = []
        if not result or result[0] is None:
            return extracted_data

        for idx, line in enumerate(result[0]):
            box = line[0]
            text, confidence = line[1]
            
            # Simple bounding box center calculation for balloons
            # box is [[x1,y1], [x2,y1], [x2,y2], [x1,y2]]
            x_coords = [point[0] for point in box]
            y_coords = [point[1] for point in box]
            center_x = sum(x_coords) / 4
            center_y = sum(y_coords) / 4
            
            extracted_data.append({
                "id": idx + 1,
                "text": text,
                "confidence": confidence,
                "box": box,
                "center": (center_x, center_y)
            })
            
        return extracted_data
