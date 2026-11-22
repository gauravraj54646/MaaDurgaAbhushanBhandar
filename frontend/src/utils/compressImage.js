import imageCompression from "browser-image-compression";

export const compressImage = async (file) => {
  if (!file || !file.type.startsWith("image/")) {
    throw new Error("Please select an image file.");
  }

  return imageCompression(file, {
    maxSizeMB: 0.25,          // target about 250 KB
    maxWidthOrHeight: 1280,   // plenty for reading a bill
    initialQuality: 0.7,
    fileType: "image/jpeg",
    useWebWorker: true,       // runs in the background, so the page doesn't freeze
  });
};