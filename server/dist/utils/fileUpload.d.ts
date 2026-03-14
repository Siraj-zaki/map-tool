/**
 * Saves a base64 image string to the filesystem.
 * @param base64String The base64 image string (data:image/...)
 * @returns The relative path to the saved image (e.g. /uploads/pois/...) or null if invalid
 */
export declare const saveBase64Image: (base64String: string) => string | null;
/**
 * Deletes a file from the filesystem
 * @param relativePath Relative path to the file (e.g. /uploads/pois/...)
 */
export declare const deleteFile: (relativePath: string) => void;
//# sourceMappingURL=fileUpload.d.ts.map