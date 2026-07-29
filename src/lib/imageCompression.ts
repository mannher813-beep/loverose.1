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
      fileType: "image/jpeg", // Force JPEG output — without this, the library defaults to
      // the source's own format, so a PNG stays a PNG (lossless recompression only),
      // missing the ~5-7x size win JPEG gives on ordinary photos.
    };

    // Safety net: on a slow/weak connection or low-end device, the Web Worker
    // used for compression can stall indefinitely with no error and no result,
    // leaving the upload silently stuck forever. Force a fallback to the
    // original (uncompressed) file after 8s instead of hanging forever.
    const timeout = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("COMPRESSION_TIMEOUT")), 8000)
    );

    const compressedFile = await Promise.race([imageCompression(file, options), timeout]);
    
    // Safety check: only use the compressed version if it is indeed smaller
    if (compressedFile.size < file.size) {
      // Use the compressed blob's own type (always JPEG per fileType above),
      // not the original file's type — otherwise a PNG upload ends up as
      // JPEG bytes mislabeled "image/png". Rename the extension to match.
      const newName = file.name.replace(/\.[^.]+$/, "") + ".jpg";
      return new File([compressedFile], newName, {
        type: compressedFile.type || "image/jpeg",
        lastModified: Date.now(),
      });
    }
    
    return file;
  } catch (err) {
    console.warn("Image compression failed, using original file:", err);
    return file; // Fallback to original file
  }
}
