const SHOP_NAME = "Maa Durga Abhushan Bhandar";

const formatRupees = (value) =>
  `₹${Number(value || 0).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

// WhatsApp uses * and _ for formatting, so strip them from names
// and bill numbers to avoid breaking the layout.
const cleanText = (text) => String(text || "").replace(/[*_~`]/g, "").trim();

const formatMessageDate = (value) => {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

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
  billDate,
  grandTotal,
  balanceDue,
  photoUrl,
}) => {
  const name = cleanText(customerName);
  const total = Number(grandTotal || 0);
  const due = Number(balanceDue || 0);
  const paid = Math.max(total - due, 0);
  const date = formatMessageDate(billDate);
  const line = "--------------------";

  const out = [];

  out.push(name ? `Namaste *${name}* ji!` : "Namaste!");
  out.push("");
  out.push(`Thank you for shopping with *${SHOP_NAME}*!`);
  out.push("");
  out.push(line);
  out.push(`*Bill No:* ${cleanText(billNo)}`);
  if (date) out.push(`*Date:* ${date}`);

  if (total > 0) {
    out.push(line);
    out.push(`*Total:* ${formatRupees(total)}`);

    if (due > 0) {
      out.push(`*Paid:* ${formatRupees(paid)}`);
      out.push(`*Balance Due:* ${formatRupees(due)}`);
    } else {
      out.push("*Payment:* Paid in full!");
    }
  }

  out.push(line);

  if (photoUrl) {
    out.push("");
    out.push("Bill photo:");
    out.push(photoUrl);
  }

  out.push("");
  out.push("Thank you! Please visit again!");

  return out.join("\n");
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
  const file = new File([blob], `${cleanText(bill.billNo) || "bill"}.jpg`, {
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