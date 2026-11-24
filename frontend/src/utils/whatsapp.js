// Converts a 10-digit Indian mobile number to WhatsApp format (91XXXXXXXXXX)
export const toWhatsAppNumber = (mobile) => {
  const digits = String(mobile || "").replace(/\D/g, "");
  if (digits.length === 10) return `91${digits}`;
  if (digits.length === 12 && digits.startsWith("91")) return digits;
  return null;
};

export const buildBillMessage = ({ customerName, billNo, grandTotal, balanceDue, photoUrl }) => {
  const lines = [
    `Hello ${customerName || ""},`,
    `Your bill ${billNo || ""} from Maa Durga Abhushan Bhandar.`,
  ];

  if (Number(grandTotal) > 0) lines.push(`Total: ₹${Number(grandTotal).toFixed(2)}`);
  if (Number(balanceDue) > 0) lines.push(`Balance due: ₹${Number(balanceDue).toFixed(2)}`);
  if (photoUrl) lines.push(`Bill photo: ${photoUrl}`);

  lines.push("Thank you!");
  return lines.join("\n");
};

// Option 1: open a WhatsApp chat with the customer's number and the message
export const openWhatsAppChat = (bill) => {
  const number = toWhatsAppNumber(bill.mobileNo);
  if (!number) {
    alert("This customer's mobile number is not valid.");
    return;
  }

  const url = `https://wa.me/${number}?text=${encodeURIComponent(buildBillMessage(bill))}`;
  window.open(url, "_blank", "noopener,noreferrer");
};

// Option 2: share the actual photo file through the phone's share sheet
export const shareBillPhoto = async (bill) => {
  if (!bill.photoUrl) return false;

  const res = await fetch(bill.photoUrl);
  const blob = await res.blob();
  const file = new File([blob], `${bill.billNo || "bill"}.jpg`, {
    type: blob.type || "image/jpeg",
  });

  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    await navigator.share({ files: [file], text: buildBillMessage({ ...bill, photoUrl: "" }) });
    return true;
  }

  return false; // browser can't share files
};