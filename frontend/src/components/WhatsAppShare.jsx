import React, { useEffect, useRef, useState } from "react";
import {
  openWhatsAppChat,
  fetchBillPhotoFile,
  shareBillFile,
} from "../utils/whatsapp";

// bill: { billNo, customerName, mobileNo, grandTotal, balanceDue, photoUrl }
const WhatsAppShare = ({ bill }) => {
  const [state, setState] = useState("idle"); // idle | preparing | ready
  const [note, setNote] = useState("");
  const fileRef = useRef(null);

  // A different photo means the prepared file is no longer valid
  useEffect(() => {
    fileRef.current = null;
    setState("idle");
    setNote("");
  }, [bill.photoUrl]);

  const handlePhotoButton = async () => {
    // Second tap: share right away, with no await before it
    if (state === "ready" && fileRef.current) {
      try {
        await shareBillFile(fileRef.current, bill);
      } catch (err) {
        if (err?.name !== "AbortError") {
          setNote("Could not open the share sheet. Use the WhatsApp button instead.");
        }
      }
      return;
    }

    // First tap: download the photo
    setState("preparing");
    setNote("");

    try {
      const file = await fetchBillPhotoFile(bill);

      if (file) {
        fileRef.current = file;
        setState("ready");
      } else {
        setState("idle");
        setNote("This browser can't share photos. Use the WhatsApp button (it includes the photo link).");
      }
    } catch (err) {
      setState("idle");
      setNote("Could not load the photo. Check your internet and try again.");
    }
  };

  const photoLabel =
    state === "preparing" ? "Preparing..." : state === "ready" ? "✅ Share now" : "📤 Send Photo";

  return (
    <div>
      <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
        <button type="button" onClick={() => openWhatsAppChat(bill)} style={waBtn}>
          💬 WhatsApp
        </button>

        {bill.photoUrl && (
          <button
            type="button"
            onClick={handlePhotoButton}
            disabled={state === "preparing"}
            style={waBtn}
          >
            {photoLabel}
          </button>
        )}
      </div>

      {note && (
        <p style={{ color: "#f59e0b", fontSize: "12px", margin: "8px 0 0" }}>{note}</p>
      )}
    </div>
  );
};

const waBtn = {
  flex: 1,
  padding: "10px 14px",
  borderRadius: "7px",
  border: "1px solid rgba(34,197,94,0.5)",
  background: "rgba(34,197,94,0.1)",
  color: "#22c55e",
  fontSize: "13px",
  fontWeight: "600",
  cursor: "pointer",
  whiteSpace: "nowrap",
};

export default WhatsAppShare;