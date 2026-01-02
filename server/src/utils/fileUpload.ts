import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';

const UPLOADS_DIR = path.join(__dirname, '..', '..', 'uploads');
const POI_IMAGES_DIR = path.join(UPLOADS_DIR, 'pois');

// Ensure directories exist
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR);
}
if (!fs.existsSync(POI_IMAGES_DIR)) {
  fs.mkdirSync(POI_IMAGES_DIR);
}

/**
 * Saves a base64 image string to the filesystem.
 * @param base64String The base64 image string (data:image/...)
 * @returns The relative path to the saved image (e.g. /uploads/pois/...) or null if invalid
 */
export const saveBase64Image = (base64String: string): string | null => {
  try {
    // Check if it's a base64 string
    const matches = base64String.match(
      /^data:image\/([a-zA-Z+]+);base64,(.+)$/
    );

    if (!matches || matches.length !== 3) {
      // Not a base64 string, might already be a path or url
      if (
        base64String.startsWith('/uploads/') ||
        base64String.startsWith('http')
      ) {
        return base64String;
      }
      return null;
    }

    const extension = matches[1] === 'jpeg' ? 'jpg' : matches[1];
    const base64Data = matches[2];
    const buffer = Buffer.from(base64Data, 'base64');

    const fileName = `${uuidv4()}.${extension}`;
    const filePath = path.join(POI_IMAGES_DIR, fileName);

    fs.writeFileSync(filePath, buffer);

    return `/uploads/pois/${fileName}`;
  } catch (error) {
    console.error('Error saving base64 image:', error);
    return null;
  }
};

/**
 * Deletes a file from the filesystem
 * @param relativePath Relative path to the file (e.g. /uploads/pois/...)
 */
export const deleteFile = (relativePath: string) => {
  try {
    if (!relativePath || !relativePath.startsWith('/uploads/')) return;

    // sanitized path to prevent directory traversal
    const safePath = path.normalize(relativePath).replace(/^(\.\.[\/\\])+/, '');
    const fullPath = path.join(path.dirname(UPLOADS_DIR), safePath); // Go up one level from uploads dir to match root

    // Actually, UPLOADS_DIR is .../server/uploads
    // relativePath is /uploads/pois/xxx.jpg
    // We need to construct the full path correctly.
    // uploads dir is defined as `path.join(__dirname, '..', '..', 'uploads');`
    // If __dirname is `server/src/utils`, then `..` is `server/src`, `..` is `server`.
    // So UPLOADS_DIR is `server/uploads`.

    // If incoming path is `/uploads/pois/xyz.jpg`, we need to join `server` root with this relative path?
    // Or just join UPLOADS_DIR's parent with the relative path.

    const serverRoot = path.join(__dirname, '..', '..');
    const absolutePath = path.join(serverRoot, relativePath);

    if (fs.existsSync(absolutePath)) {
      fs.unlinkSync(absolutePath);
    }
  } catch (error) {
    console.error('Error deleting file:', error);
  }
};
