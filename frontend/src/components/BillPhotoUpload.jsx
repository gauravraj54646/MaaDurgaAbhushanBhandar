import React, { useContext, useEffect, useRef, useState } from "react";
import { AuthContext } from "../context/AuthContext";
import { compressImage } from "../utils/compressImage";

// value: { url, publicId } or null
// onChange: called with { url, publicId } after upload, or null after remove
// onBusyChange: optional, called with true/false while a photo is uploading
const BillPhotoUpload = ({ value, onChange, onBusyChange }) => {
  const { user } = useContext(AuthContext);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [previewOpen, setPreviewOpen] = useState(false);

  const cameraRef = useRef(null);
  const galleryRef = useRef(null);

  // Tell the parent page when an upload is in progress
  useEffect(() => {
    onBusyChange?.(busy);
  }, [busy, onBusyChange]);

  // Make sure the parent is never left stuck on "busy" if this unmounts
  useEffect(() => {
    return () => onBusyChange?.(false);
  }, [onBusyChange]);

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // allows picking the same photo again
    if (!file) return;

    setBusy(true);
    setError("");

    try {
      const small = await compressImage(file);

      const formData = new FormData();
      formData.append("photo", small, "bill.jpg");

      const res = await fetch("/api/uploads/bill-photo", {
        method: "POST",
        headers: { Authorization: `Bearer ${user.token}` },
        body: formData,
      });

      // Read as text first so an HTML error page doesn't crash JSON parsing
      const raw = await res.text();
      let data = {};
      try {
        data = raw ? JSON.parse(raw) : {};
      } catch (_) {
        throw new Error(
          res.status === 413
            ? "Photo is too large."
            : `Upload failed (server error ${res.status}). Please try again.`
        );
      }

      if (!res.ok) throw new Error(data.message || "Upload failed");

      // The backend deletes the old image when the bill is saved.
      onChange({ url: data.url, publicId: data.publicId });
    } catch (err) {
      console.error("Bill photo upload failed:", err);
      setError(
        (err && err.message) ||
          "Could not process this photo. Try a smaller JPG/PNG."
      );
    } finally {
      setBusy(false);
    }
  };

  const hasPhoto = Boolean(value?.url);

  return (
    <div style={{ marginTop: 12 }}>
      {hasPhoto && (
        <img
          src={value.url}
          alt="Bill"
          onClick={() => setPreviewOpen(true)}
          style={{
            display: "block",
            maxWidth: "100%",
            maxHeight: 240,
            marginBottom: 10,
            borderRadius: 8,
            border: "1px solid #27272a",
            cursor: "zoom-in",
          }}
        />
      )}

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <button
          type="button"
          style={btn}
          disabled={busy}
          onClick={() => cameraRef.current?.click()}
        >
          {busy ? "Uploading..." : "📷 Take Photo"}
        </button>

        <button
          type="button"
          style={btn}
          disabled={busy}
          onClick={() => galleryRef.current?.click()}
        >
          🖼️ Gallery
        </button>

        {hasPhoto && (
          <button
            type="button"
            style={{ ...btn, color: "#ef4444" }}
            disabled={busy}
            onClick={() => onChange(null)}
          >
            Remove
          </button>
        )}
      </div>

      {/* Opens the camera directly on phones */}
      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleFile}
        style={{ display: "none" }}
      />

      {/* Opens the photo library / file picker */}
      <input
        ref={galleryRef}
        type="file"
        accept="image/*"
        onChange={handleFile}
        style={{ display: "none" }}
      />

      {error && (
        <p style={{ color: "#ef4444", fontSize: 13, margin: "8px 0 0" }}>{error}</p>
      )}

      {/* Tap-to-enlarge preview */}
      {previewOpen && hasPhoto && (
        <div
          onClick={() => setPreviewOpen(false)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.85)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 2000,
            padding: 12,
          }}
        >
          <img
            src={value.url}
            alt="Bill full size"
            style={{ maxWidth: "100%", maxHeight: "100%", borderRadius: 8 }}
          />
        </div>
      )}
    </div>
  );
};

const btn = {
  padding: "10px 16px",
  borderRadius: 7,
  border: "1px solid #3f3f46",
  background: "#18181b",
  color: "#fff",
  fontSize: 13.5,
  fontWeight: 600,
  cursor: "pointer",
};

export default BillPhotoUpload;