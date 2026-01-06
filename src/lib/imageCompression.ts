/**
 * Image compression utility
 * Compresses images to a target file size while maintaining quality
 * Supports HEIF/HEIC conversion
 */

const MAX_DIMENSION = 2000;
const DEFAULT_TARGET_SIZE_KB = 300;

// HEIF/HEIC mime types
const HEIF_TYPES = ['image/heif', 'image/heic', 'image/heif-sequence', 'image/heic-sequence'];

/**
 * Check if a file is a HEIF/HEIC image
 */
function isHeifImage(file: File): boolean {
  const extension = file.name.toLowerCase().split('.').pop();
  return HEIF_TYPES.includes(file.type) || extension === 'heic' || extension === 'heif';
}

/**
 * Load an image file into an HTMLImageElement
 * For HEIF/HEIC files, uses the browser's built-in conversion if supported
 */
function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => {
      // If loading fails (e.g., HEIF not supported), reject with helpful message
      reject(new Error('Failed to load image. HEIF/HEIC files may not be supported on this browser.'));
    };
    img.src = URL.createObjectURL(file);
  });
}

/**
 * Calculate new dimensions while maintaining aspect ratio
 */
function calculateDimensions(
  width: number,
  height: number,
  maxDimension: number
): { width: number; height: number } {
  if (width <= maxDimension && height <= maxDimension) {
    return { width, height };
  }

  const ratio = Math.min(maxDimension / width, maxDimension / height);
  return {
    width: Math.round(width * ratio),
    height: Math.round(height * ratio),
  };
}

/**
 * Compress image using canvas with a specific quality
 */
async function compressWithQuality(
  img: HTMLImageElement,
  maxDimension: number,
  quality: number
): Promise<Blob> {
  const { width, height } = calculateDimensions(
    img.naturalWidth,
    img.naturalHeight,
    maxDimension
  );

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Failed to get canvas context');

  // Use high-quality image scaling
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, 0, 0, width, height);

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) {
          resolve(blob);
        } else {
          reject(new Error('Failed to compress image'));
        }
      },
      'image/jpeg',
      quality
    );
  });
}

/**
 * Compress an image file to approximately the target size in KB
 * Uses binary search to find the optimal quality setting
 * Automatically converts HEIF/HEIC to JPEG
 */
export async function compressImage(
  file: File,
  targetSizeKB: number = DEFAULT_TARGET_SIZE_KB,
  maxDimension: number = MAX_DIMENSION
): Promise<Blob> {
  // If file is already small enough and is JPEG (and not HEIF), return as-is
  const targetSizeBytes = targetSizeKB * 1024;
  const needsConversion = isHeifImage(file);
  
  if (file.size <= targetSizeBytes && file.type === 'image/jpeg' && !needsConversion) {
    return file;
  }

  const img = await loadImage(file);

  // First, try with quality 0.9 and see if we're under the limit
  let blob = await compressWithQuality(img, maxDimension, 0.9);
  
  if (blob.size <= targetSizeBytes) {
    // Clean up object URL
    URL.revokeObjectURL(img.src);
    return blob;
  }

  // Binary search to find optimal quality
  let minQuality = 0.1;
  let maxQuality = 0.9;
  let bestBlob = blob;
  let iterations = 0;
  const maxIterations = 8;

  while (maxQuality - minQuality > 0.05 && iterations < maxIterations) {
    const midQuality = (minQuality + maxQuality) / 2;
    blob = await compressWithQuality(img, maxDimension, midQuality);
    
    if (blob.size <= targetSizeBytes) {
      bestBlob = blob;
      minQuality = midQuality;
    } else {
      maxQuality = midQuality;
    }
    iterations++;
  }

  // If we still couldn't get it under the target, reduce dimensions further
  if (bestBlob.size > targetSizeBytes) {
    let currentMaxDimension = maxDimension;
    while (currentMaxDimension > 500 && bestBlob.size > targetSizeBytes) {
      currentMaxDimension = Math.round(currentMaxDimension * 0.75);
      bestBlob = await compressWithQuality(img, currentMaxDimension, 0.7);
    }
  }

  // Clean up object URL
  URL.revokeObjectURL(img.src);

  return bestBlob;
}

/**
 * Get a compressed File object instead of Blob
 */
export async function compressImageToFile(
  file: File,
  targetSizeKB: number = DEFAULT_TARGET_SIZE_KB,
  maxDimension: number = MAX_DIMENSION
): Promise<File> {
  const blob = await compressImage(file, targetSizeKB, maxDimension);
  
  // Generate a new filename with .jpg extension
  const originalName = file.name.replace(/\.[^/.]+$/, '');
  const newName = `${originalName}.jpg`;
  
  return new File([blob], newName, { type: 'image/jpeg' });
}
