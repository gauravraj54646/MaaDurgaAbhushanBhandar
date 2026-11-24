import React, { useState } from "react";
import { openWhatsAppChat, shareBillPhoto } from "../utils/whatsapp";

// bill: { billNo, customerName, mobileNo, grandTotal, balanceDue, photoUrl }
const WhatsAppShare = ({ bill }) => {
  const [busy, setBusy] = useState(false);

  const handleSendPhoto = async () => {
    setBusy(true);
    try {
      const shared = await shareBillPhoto(bill);
      if (!shared) {
        // This browser can't share files, so fall back to the chat link
        openWhatsAppChat(bill);
      }
    } catch (err) {
      // User closing the share sheet throws AbortError; ignore that
      if (err?.name !== "AbortError") openWhatsAppChat(bill);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
      <button type="button" onClick={() => openWhatsAppChat(bill)} style={waBtn}>
        💬 WhatsApp
      </button>

      {bill.photoUrl && (
        <button type="button" onClick={handleSendPhoto} disabled={busy} style={waBtn}>
          {busy ? "Preparing..." : "📤 Send Photo"}
        </button>
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