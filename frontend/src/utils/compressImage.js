import imageCompression from "browser-image-compression";

// Resize + compress a photo to a JPEG Blob before upload.
// Always rejects with a real Error that has a readable message.

const MAX_SIDE = 1600; // longest side in px
const QUALITY = 0.8;
const MAX_ORIGINAL_FALLBACK = 8 * 1024 * 1024; // upload original if compression fails and it is <= 8 MB

const isHeic = (file) =>
  /heic|heif/i.test(file.type || "") || /\.(heic|heif)$/i.test(file.name || "");

const isWebSafe = (file) => /^image\/(jpeg|png|webp)$/i.test(file.type || "");

const loadViaImageTag = (file) =>
  new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Could not decode image"));
    };
    img.src = url;
  });

const loadImage = async (file) => {
  if (typeof createImageBitmap === "function") {
    try {
      // "from-image" applies the EXIF rotation so phone photos aren't sideways
      return await createImageBitmap(file, { imageOrientation: "from-image" });
    } catch (_) {
      try {
        return await createImageBitmap(file);
      } catch (_) {
        /* fall through to <img> */
      }
    }
  }
  return loadViaImageTag(file);
};

const canvasCompress = async (file) => {
  if (!file) throw new Error("No photo selected.");

  let source;
  try {
    source = await loadImage(file);
  } catch (_) {
    if (isHeic(file)) {
      throw new Error(
        "HEIC photos are not supported. Set the camera to 'Most Compatible' (JPG) or choose a JPG/PNG photo."
      );
    }
    if (isWebSafe(file) && file.size <= MAX_ORIGINAL_FALLBACK) return file;
    throw new Error("Could not read this photo. Please try a different one.");
  }

  try {
    const srcW = source.width || source.naturalWidth;
    const srcH = source.height || source.naturalHeight;
    if (!srcW || !srcH) throw new Error("empty image");

    const scale = Math.min(1, MAX_SIDE / Math.max(srcW, srcH));
    const w = Math.max(1, Math.round(srcW * scale));
    const h = Math.max(1, Math.round(srcH * scale));

    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;

    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("no canvas");

    ctx.fillStyle = "#fff"; // PNG transparency -> white instead of black
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(source, 0, 0, w, h);

    const blob = await new Promise((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", QUALITY)
    );

    canvas.width = canvas.height = 0; // free memory (important on phones)

    if (!blob) throw new Error("toBlob returned null");
    return blob;
  } catch (_) {
    if (isWebSafe(file) && file.size <= MAX_ORIGINAL_FALLBACK) return file;
    throw new Error(
      "This photo is too large or in an unsupported format. Try a smaller JPG/PNG."
    );
  } finally {
    if (typeof source.close === "function") source.close();
  }
};

const LIB_OPTIONS = {
  maxSizeMB: 0.25, // target about 250 KB
  maxWidthOrHeight: 1280, // plenty for reading a bill
  initialQuality: 0.7,
  fileType: "image/jpeg",
};

export const compressImage = async (file) => {
  if (!file) throw new Error("Please select an image file.");

  // Some phones report an empty type for camera/HEIC files, so only
  // reject when a non-image type is clearly reported.
  if (file.type && !file.type.startsWith("image/")) {
    throw new Error("Please select an image file.");
  }

  // 1) Library with a web worker (fast, page stays responsive)
  try {
    return await imageCompression(file, { ...LIB_OPTIONS, useWebWorker: true });
  } catch (err) {
    console.warn("Compression with web worker failed, retrying without it:", err);
  }

  // 2) Library on the main thread (works when the worker script is blocked)
  try {
    return await imageCompression(file, { ...LIB_OPTIONS, useWebWorker: false });
  } catch (err) {
    console.warn("Library compression failed, trying canvas fallback:", err);
  }

  // 3) Own canvas method; always throws a readable Error if it fails too
  return canvasCompress(file);
};