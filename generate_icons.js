const fs = require('fs');
const { createCanvas } = require('canvas');

// Make sure the images directory exists
if (!fs.existsSync('./images')) {
  fs.mkdirSync('./images');
}

// Function to create an icon
function createIcon(size) {
  console.log(`Creating ${size}x${size} icon...`);
  
  // Create canvas with the given size
  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext('2d');
  
  // Draw blue background
  ctx.fillStyle = '#4285f4';
  ctx.fillRect(0, 0, size, size);
  
  // Draw white "APS" text
  ctx.fillStyle = 'white';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  
  // Set font size based on icon size
  const fontSize = Math.floor(size * 0.5);
  ctx.font = `bold ${fontSize}px Arial, sans-serif`;
  
  // Draw text
  ctx.fillText('APS', size/2, size/2);
  
  // Save to PNG file
  const buffer = canvas.toBuffer('image/png');
  fs.writeFileSync(`./images/icon${size}.png`, buffer);
  
  console.log(`Created images/icon${size}.png`);
}

// Create icons of all required sizes
try {
  createIcon(16);
  createIcon(48);
  createIcon(128);
  console.log('All icons generated successfully!');
} catch (err) {
  console.error('Error generating icons:', err);
} 