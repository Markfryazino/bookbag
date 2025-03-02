#!/usr/bin/env python
import os
from PIL import Image

# Ensure the images directory exists
if not os.path.exists('images'):
    os.makedirs('images')

def resize_icon(input_image, size):
    """Resize the input image to the specified size and save it as an icon."""
    print(f"Creating {size}x{size} icon...")
    
    # Open the source image
    try:
        with Image.open(input_image) as img:
            # Resize the image, maintaining aspect ratio
            img = img.resize((size, size), Image.LANCZOS)
            
            # Save the resized image
            output_file = f"images/icon{size}.png"
            img.save(output_file)
            print(f"Created {output_file}")
    except Exception as e:
        print(f"Error creating icon: {e}")

# Main execution
try:
    # Source image path
    source_icon = "images/books_icon.png"
    
    # Check if source image exists
    if not os.path.exists(source_icon):
        print(f"Error: Source image {source_icon} not found!")
        exit(1)
        
    # Create icons in all required sizes
    resize_icon(source_icon, 16)
    resize_icon(source_icon, 48)
    resize_icon(source_icon, 128)
    
    print("All icons created successfully!")
except Exception as e:
    print(f"Error: {e}") 