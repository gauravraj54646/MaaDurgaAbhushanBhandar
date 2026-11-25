const formatRupees = (value) =>
  `₹${Number(value || 0).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

// Converts an Indian mobile number to WhatsApp format (91XXXXXXXXXX)
export const toWhatsAppNumber = (mobile) => {
  let digits = String(mobile || "").replace(/\D/g, "");
  if (digits.length === 11 && digits.startsWith("0")) digits = digits.slice(1);
  if (digits.length === 10) return `91${digits}`;
  if (digits.length === 12 && digits.startsWith("91")) return digits;
  return null;
};

export const buildBillMessage = ({
  customerName,
  billNo,
  grandTotal,
  balanceDue,
  photoUrl,
}) => {
  const name = String(customerName || "").trim();

  const lines = [
    name ? `Hello ${name},` : "Hello,",
    `Your bill no. ${billNo || ""} from Maa Durga Abhushan Bhandar.`,
  ];

  if (Number(grandTotal) > 0) {
    lines.push(`Total: ${formatRupees(grandTotal)}`);

    if (Number(balanceDue) > 0) {
      lines.push(`Balance due: ${formatRupees(balanceDue)}`);
    } else {
      lines.push("Payment: Paid in full");
    }
  }

  if (photoUrl) lines.push(`Bill photo: ${photoUrl}`);

  lines.push("Thank you!");
  return lines.join("\n");
};

// Option 1: open a WhatsApp chat with the customer's number and the message.
// Call this directly from a tap handler so the browser doesn't block it.
export const openWhatsAppChat = (bill) => {
  const number = toWhatsAppNumber(bill.mobileNo);
  if (!number) {
    alert("This customer's mobile number is not valid.");
    return;
  }

  const url = `https://wa.me/${number}?text=${encodeURIComponent(buildBillMessage(bill))}`;
  window.open(url, "_blank", "noopener,noreferrer");
};

// Option 2, step 1: download the photo as a File.
// Returns null when this browser can't share files.
export const fetchBillPhotoFile = async (bill) => {
  if (!bill.photoUrl) return null;

  const res = await fetch(bill.photoUrl);
  if (!res.ok) throw new Error("Could not load the photo.");

  const blob = await res.blob();
  const file = new File([blob], `${bill.billNo || "bill"}.jpg`, {
    type: blob.type || "image/jpeg",
  });

  if (!navigator.canShare || !navigator.canShare({ files: [file] })) return null;

  return file;
};

// Option 2, step 2: open the share sheet. Call this directly from a tap,
// with no await before it, so Safari allows it.
export const shareBillFile = (file, bill) =>
  navigator.share({
    files: [file],
    text: buildBillMessage({ ...bill, photoUrl: "" }),
  });