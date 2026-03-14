"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteFile = exports.saveBase64Image = void 0;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const uuid_1 = require("uuid");
const UPLOADS_DIR = path_1.default.join(__dirname, '..', '..', 'uploads');
const POI_IMAGES_DIR = path_1.default.join(UPLOADS_DIR, 'pois');
// Ensure directories exist
if (!fs_1.default.existsSync(UPLOADS_DIR)) {
    fs_1.default.mkdirSync(UPLOADS_DIR);
}
if (!fs_1.default.existsSync(POI_IMAGES_DIR)) {
    fs_1.default.mkdirSync(POI_IMAGES_DIR);
}
/**
 * Saves a base64 image string to the filesystem.
 * @param base64String The base64 image string (data:image/...)
 * @returns The relative path to the saved image (e.g. /uploads/pois/...) or null if invalid
 */
const saveBase64Image = (base64String) => {
    try {
        // Check if it's a base64 string
        const matches = base64String.match(/^data:image\/([a-zA-Z+]+);base64,(.+)$/);
        if (!matches || matches.length !== 3) {
            // Not a base64 string, might already be a path or url
            if (base64String.startsWith('/uploads/') ||
                base64String.startsWith('http')) {
                return base64String;
            }
            return null;
        }
        const extension = matches[1] === 'jpeg' ? 'jpg' : matches[1];
        const base64Data = matches[2];
        const buffer = Buffer.from(base64Data, 'base64');
        const fileName = `${(0, uuid_1.v4)()}.${extension}`;
        const filePath = path_1.default.join(POI_IMAGES_DIR, fileName);
        fs_1.default.writeFileSync(filePath, buffer);
        return `/uploads/pois/${fileName}`;
    }
    catch (error) {
        console.error('Error saving base64 image:', error);
        return null;
    }
};
exports.saveBase64Image = saveBase64Image;
/**
 * Deletes a file from the filesystem
 * @param relativePath Relative path to the file (e.g. /uploads/pois/...)
 */
const deleteFile = (relativePath) => {
    try {
        if (!relativePath || !relativePath.startsWith('/uploads/'))
            return;
        // sanitized path to prevent directory traversal
        const safePath = path_1.default.normalize(relativePath).replace(/^(\.\.[\/\\])+/, '');
        const fullPath = path_1.default.join(path_1.default.dirname(UPLOADS_DIR), safePath); // Go up one level from uploads dir to match root
        // Actually, UPLOADS_DIR is .../server/uploads
        // relativePath is /uploads/pois/xxx.jpg
        // We need to construct the full path correctly.
        // uploads dir is defined as `path.join(__dirname, '..', '..', 'uploads');`
        // If __dirname is `server/src/utils`, then `..` is `server/src`, `..` is `server`.
        // So UPLOADS_DIR is `server/uploads`.
        // If incoming path is `/uploads/pois/xyz.jpg`, we need to join `server` root with this relative path?
        // Or just join UPLOADS_DIR's parent with the relative path.
        const serverRoot = path_1.default.join(__dirname, '..', '..');
        const absolutePath = path_1.default.join(serverRoot, relativePath);
        if (fs_1.default.existsSync(absolutePath)) {
            fs_1.default.unlinkSync(absolutePath);
        }
    }
    catch (error) {
        console.error('Error deleting file:', error);
    }
};
exports.deleteFile = deleteFile;
//# sourceMappingURL=fileUpload.js.map