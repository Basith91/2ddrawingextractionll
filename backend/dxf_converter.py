
import sys
import matplotlib.pyplot as plt
import ezdxf
from ezdxf.addons.drawing import RenderContext, Frontend
from ezdxf.addons.drawing.matplotlib import MatplotlibBackend

def convert_dxf_to_image(dxf_path, output_path, dpi=300):
    """
    Converts a DXF file to a PNG image.
    """
    try:
        # Load the DXF document
        doc = ezdxf.readfile(dxf_path)
        msp = doc.modelspace()

        # Create a drawing context
        ctx = RenderContext(doc)
        
        # Setup matplotlib figure
        # We start with a default size, but we'll let the content determine the limits
        fig = plt.figure()
        ax = fig.add_axes([0, 0, 1, 1])
        ctx = RenderContext(doc)
        out = MatplotlibBackend(ax)
        
        # Render the layout
        Frontend(ctx, out).draw_layout(msp, finalize=True)
        
        # Save to file
        fig.savefig(output_path, dpi=dpi)
        plt.close(fig)
        
        return True
    except Exception as e:
        print(f"DXF Conversion Error: {e}")
        return False
