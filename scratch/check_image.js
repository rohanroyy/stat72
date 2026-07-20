import fs from 'fs';

// PNG files have width and height at offset 16 and 20 respectively (4 bytes each, big endian)
function getPngDimensions(filePath) {
  const buffer = Buffer.alloc(8);
  const fd = fs.openSync(filePath, 'r');
  fs.readSync(fd, buffer, 0, 8, 16);
  fs.closeSync(fd);
  const width = buffer.readInt32BE(0);
  const height = buffer.readInt32BE(4);
  return { width, height };
}

try {
  const dimensions = getPngDimensions('c:/Users/S P E C T R E/stat72webapp/public/favicon.png');
  console.log('Dimensions:', dimensions);
} catch (err) {
  console.error(err);
}
