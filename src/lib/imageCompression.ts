import imageCompression from "browser-image-compression";

/**
 * Compresses an image file (JPG, JPEG, PNG, WEBP) locally before uploading.
 * Keeps visual quality high, limits dimensions to 1920x1920, and preserves proportions.
 * Falls back to the original file if compression fails or if it's not a compressible image.
 */
export async function compressImageIfNeeded(file: File): Promise<File> {
  const compressibleTypes = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
  
  if (!compressibleTypes.includes(file.type)) {
    return file; // Return original if not supported format
  }

  try {
    const options = {
      maxSizeMB: 0.6, // Excellent balance of file size and visual quality
      maxWidthOrHeight: 1920, // Max size is 1920px as per specifications
      useWebWorker: true, // Compress in background thread so the UI remains interactive
      initialQuality: 0.82, // High initial visual quality, virtually indistinguishable from source
    };

    const compressedFile = await imageCompression(file, options);
    
    // Safety check: only use the compressed version if it is indeed smaller
    if (compressedFile.size < file.size) {
      // Preserve original file name
      return new File([compressedFile], file.name, {
        type: file.type,
        lastModified: Date.now(),
      });
    }
    
    return file;
  } catch (err) {
    console.warn("Image compression failed, using original file:", err);
    return file; // Fallback to original file
  }
}
