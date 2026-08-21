import React, { useState, useContext, useRef, useEffect } from "react";
import { AuthContext } from "../context/AuthContext";
import { useNavigate, useParams } from "react-router-dom";

const wordCount = (str = "") => str.trim().split(/\s+/).filter(Boolean).length;

const toDateInput = (isoDate) => {
  if (!isoDate) return "";
  const d = new Date(isoDate);
  if (Number.isNaN(d.getTime())) return "";
  return d.toISOString().split("T")[0];
};

const EditBillProduct = () => {
  const { user } = useContext(AuthContext);
  const navigate = useNavigate();
  const { id } = useParams();

  const fieldRefs = useRef({});

  const [formData, setFormData] = useState(null); // null until loaded
  const [fetchError, setFetchError] = useState("");
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});
  const [showConfirm, setShowConfirm] = useState(false);

  // =========================================================
  // LOAD EXISTING BILL
  // =========================================================

  useEffect(() => {
    if (!user || user.role !== "admin") {
      navigate("/");
      return;
    }

    let cancelled = false;

    const loadBill = async () => {
      try {
        const res = await fetch(`/api/bills/${id}`, {
          headers: { Authorization: `Bearer ${user.token}` },
        });

        const data = await res.json();

        if (!res.ok) throw new Error(data.message || "Failed to load bill");
        if (cancelled) return;

        setFormData({
          billNo: data.billNo || "",
          billDate: toDateInput(data.billDate),
          customerName: data.customerName || "",
          mobileNo: data.mobileNo || "",
          address: data.address || "",
          gstin: data.gstin || "",
          items: (data.items || []).map((i, idx) => ({ id: `existing_${idx}`, ...i })),
          exchangeItems: (data.exchangeItems || []).map((e, idx) => ({
            id: `existing_ex_${idx}`,
            ...e,
          })),
          discount: data.discount ?? "",
          cgstPercent: data.cgstPercent ?? 1.5,
          sgstPercent: data.sgstPercent ?? 1.5,
          paymentMode: data.paymentMode || "cash",
          amountPaid: data.amountPaid ?? "",
          soldBy: data.soldBy || "",
          notes: data.notes || "",
        });
      } catch (err) {
        if (!cancelled) setFetchError(err.message || "Failed to load bill");
      }
    };

    loadBill();

    return () => {
      cancelled = true;
    };
  }, [id, user, navigate]);

  // =========================================================
  // HANDLE NORMAL FIELD
  // =========================================================

  const handleChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));

    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: "" }));
    }
  };

  // =========================================================
  // ITEM CALCULATIONS (same formula as the backend hook)
  // =========================================================

  const calculateItemAmount = (item) => {
    const netWeight = Number(item.netWeight || 0);
    const ratePerGram = Number(item.ratePerGram || 0);
    const wastagePercent = Number(item.wastagePercent || 0);
    const makingCharge = Number(item.makingCharge || 0);
    const stoneCharge = Number(item.stoneCharge || 0);
    const quantity = Number(item.quantity || 1);

    const metalValue = netWeight * ratePerGram;
    const wastageValue = metalValue * (wastagePercent / 100);

    let makingValue = 0;
    if (item.makingChargeType === "flat") makingValue = makingCharge;
    else if (item.makingChargeType === "perGram") makingValue = makingCharge * netWeight;
    else if (item.makingChargeType === "percentage") makingValue = metalValue * (makingCharge / 100);

    return (metalValue + wastageValue + makingValue + stoneCharge) * quantity;
  };

  const calculateExchangeAmount = (ex) => {
    const netWeight = Number(ex.netWeight || 0);
    const ratePerGram = Number(ex.ratePerGram || 0);
    return netWeight * ratePerGram;
  };

  const items = formData?.items || [];
  const exchangeItems = formData?.exchangeItems || [];

  const itemAmounts = items.map(calculateItemAmount);
  const exchangeAmounts = exchangeItems.map(calculateExchangeAmount);

  const itemsSubtotal = itemAmounts.reduce((sum, a) => sum + a, 0);
  const exchangeTotal = exchangeAmounts.reduce((sum, a) => sum + a, 0);

  const discountValue = Number(formData?.discount || 0);
  const taxableAmount = Math.max(itemsSubtotal - discountValue, 0);

  const cgstAmount = taxableAmount * (Number(formData?.cgstPercent || 0) / 100);
  const sgstAmount = taxableAmount * (Number(formData?.sgstPercent || 0) / 100);

  const preRound = taxableAmount + cgstAmount + sgstAmount - exchangeTotal;
  const grandTotal = Math.max(Math.round(preRound), 0);
  const roundOff = grandTotal - preRound;

  const amountPaidValue = Number(formData?.amountPaid || 0);
  const balanceDue = Math.max(grandTotal - amountPaidValue, 0);

  // =========================================================
  // ADD / REMOVE / UPDATE ITEM
  // =========================================================

  const addItem = () => {
    if (items.length >= 100) {
      alert("Maximum 100 items are allowed on a single bill.");
      return;
    }

    setFormData((prev) => ({
      ...prev,
      items: [
        ...prev.items,
        {
          id: Date.now(),
          itemName: "",
          category: "gold",
          huid: "",
          purity: "",
          hsnCode: "",
          grossWeight: "",
          stoneWeight: "",
          netWeight: "",
          ratePerGram: "",
          makingChargeType: "perGram",
          makingCharge: "",
          wastagePercent: "",
          stoneCharge: "",
          quantity: 1,
        },
      ],
    }));
  };

  const removeItem = (itemId) => {
    setFormData((prev) => ({
      ...prev,
      items: prev.items.filter((item) => item.id !== itemId),
    }));
  };

  const updateItem = (itemId, field, value) => {
    setFormData((prev) => ({
      ...prev,
      items: prev.items.map((item) => {
        if (item.id !== itemId) return item;

        const updated = { ...item, [field]: value };

        if (field === "grossWeight" || field === "stoneWeight") {
          const gross = Number(field === "grossWeight" ? value : item.grossWeight || 0);
          const stone = Number(field === "stoneWeight" ? value : item.stoneWeight || 0);
          updated.netWeight = String(Math.max(gross - stone, 0));
        }

        return updated;
      }),
    }));
  };

  // =========================================================
  // ADD / REMOVE / UPDATE EXCHANGE ITEM
  // =========================================================

  const addExchangeItem = () => {
    setFormData((prev) => ({
      ...prev,
      exchangeItems: [
        ...prev.exchangeItems,
        {
          id: Date.now(),
          description: "",
          category: "gold",
          grossWeight: "",
          purity: "",
          deduction: "",
          netWeight: "",
          ratePerGram: "",
        },
      ],
    }));
  };

  const removeExchangeItem = (exId) => {
    setFormData((prev) => ({
      ...prev,
      exchangeItems: prev.exchangeItems.filter((ex) => ex.id !== exId),
    }));
  };

  const updateExchangeItem = (exId, field, value) => {
    setFormData((prev) => ({
      ...prev,
      exchangeItems: prev.exchangeItems.map((ex) => {
        if (ex.id !== exId) return ex;

        const updated = { ...ex, [field]: value };

        if (field === "grossWeight" || field === "deduction") {
          const gross = Number(field === "grossWeight" ? value : ex.grossWeight || 0);
          const deduction = Number(field === "deduction" ? value : ex.deduction || 0);
          updated.netWeight = String(Math.max(gross - deduction, 0));
        }

        return updated;
      }),
    }));
  };

  // =========================================================
  // SCROLL / FOCUS TO FIRST INVALID FIELD
  // =========================================================

  const scrollToFirstError = (errs) => {
    const errorKeys = Object.keys(errs).filter((k) => errs[k]);
    if (errorKeys.length === 0) return;

    const node = fieldRefs.current[errorKeys[0]];
    if (!node) return;

    node.scrollIntoView({ behavior: "smooth", block: "center" });

    window.setTimeout(() => {
      if (typeof node.focus === "function") node.focus({ preventScroll: true });
    }, 350);
  };

  // =========================================================
  // VALIDATION
  // =========================================================

  const validate = () => {
    const errs = {};

    if (!formData.customerName.trim()) {
      errs.customerName = "Customer name is required.";
    }

    if (wordCount(formData.customerName) > 60) {
      errs.customerName = "Customer name must be 60 words or fewer.";
    }

    if (!/^\d{10}$/.test(formData.mobileNo)) {
      errs.mobileNo = "Mobile No. must be exactly 10 digits.";
    }

    if (formData.address && wordCount(formData.address) > 100) {
      errs.address = "Address must be 100 words or fewer.";
    }

    if (!formData.billDate) {
      errs.billDate = "Bill date is required.";
    }

    if (items.length === 0) {
      errs.items = "Add at least one item to the bill.";
    }

    items.forEach((item, index) => {
      if (!item.itemName.trim()) {
        errs[`itemName_${index}`] = `Item name is required for Item ${index + 1}.`;
      }

      if (item.grossWeight === "" || Number(item.grossWeight) < 0) {
        errs[`itemGrossWeight_${index}`] = `Enter a valid gross weight for Item ${index + 1}.`;
      }

      if (item.ratePerGram === "" || Number(item.ratePerGram) < 0) {
        errs[`itemRate_${index}`] = `Enter a valid rate for Item ${index + 1}.`;
      }
    });

    exchangeItems.forEach((ex, index) => {
      if (ex.grossWeight === "" || Number(ex.grossWeight) < 0) {
        errs[`exchangeWeight_${index}`] = `Enter a valid gross weight for Exchange ${index + 1}.`;
      }

      if (ex.ratePerGram === "" || Number(ex.ratePerGram) < 0) {
        errs[`exchangeRate_${index}`] = `Enter a valid rate for Exchange ${index + 1}.`;
      }
    });

    if (formData.discount !== "" && Number(formData.discount) < 0) {
      errs.discount = "Discount cannot be negative.";
    }

    if (formData.amountPaid !== "" && Number(formData.amountPaid) < 0) {
      errs.amountPaid = "Amount paid cannot be negative.";
    } else if (amountPaidValue > grandTotal) {
      errs.amountPaid = `Amount paid cannot exceed the grand total of ₹${grandTotal.toFixed(2)}.`;
    }

    if (formData.notes && wordCount(formData.notes) > 300) {
      errs.notes = "Notes must be 300 words or fewer.";
    }

    setErrors(errs);

    if (Object.keys(errs).length > 0) {
      scrollToFirstError(errs);
    }

    return Object.keys(errs).length === 0;
  };

  // =========================================================
  // SUBMIT
  // =========================================================

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!validate()) return;
    setShowConfirm(true);
  };

  const confirmSubmit = async () => {
    setShowConfirm(false);
    setLoading(true);

    try {
      const cleanedItems = items.map((item) => ({
        itemName: item.itemName,
        category: item.category,
        huid: item.huid,
        purity: item.purity,
        hsnCode: item.hsnCode,
        grossWeight: Number(item.grossWeight || 0),
        stoneWeight: Number(item.stoneWeight || 0),
        netWeight: Number(item.netWeight || 0),
        ratePerGram: Number(item.ratePerGram || 0),
        makingChargeType: item.makingChargeType,
        makingCharge: Number(item.makingCharge || 0),
        wastagePercent: Number(item.wastagePercent || 0),
        stoneCharge: Number(item.stoneCharge || 0),
        quantity: Number(item.quantity || 1),
      }));

      const cleanedExchangeItems = exchangeItems.map((ex) => ({
        description: ex.description,
        category: ex.category,
        grossWeight: Number(ex.grossWeight || 0),
        purity: ex.purity,
        deduction: Number(ex.deduction || 0),
        netWeight: Number(ex.netWeight || 0),
        ratePerGram: Number(ex.ratePerGram || 0),
      }));

      const submitData = {
        billNo: formData.billNo.trim(),
        billDate: formData.billDate,
        customerName: formData.customerName,
        mobileNo: formData.mobileNo.trim(),
        address: formData.address,
        gstin: formData.gstin,
        items: cleanedItems,
        exchangeItems: cleanedExchangeItems,
        discount: Number(formData.discount || 0),
        cgstPercent: Number(formData.cgstPercent || 0),
        sgstPercent: Number(formData.sgstPercent || 0),
        paymentMode: formData.paymentMode,
        amountPaid: Number(formData.amountPaid || 0),
        soldBy: formData.soldBy,
        notes: formData.notes,
      };

      const res = await fetch(`/api/bills/${id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${user.token}`,
        },
        body: JSON.stringify(submitData),
      });

      const contentType = res.headers.get("content-type") || "";

      if (!contentType.includes("application/json")) {
        throw new Error(
          `Server did not return JSON (status ${res.status}). Check that the API server is running and the request URL/proxy is correct.`,
        );
      }

      const responseData = await res.json();

      if (res.ok) {
        alert("Bill updated successfully!");
        navigate("/admin/bill/products");
      } else {
        alert(responseData.message || "Error updating bill");
      }
    } catch (error) {
      console.error("Error updating bill:", error);
      alert(error.message || "Something went wrong while updating the bill.");
    } finally {
      setLoading(false);
    }
  };

  // =========================================================
  // ADMIN CHECK / LOADING STATES
  // =========================================================

  if (!user || user.role !== "admin") {
    return null;
  }

  if (fetchError) {
    return (
      <div style={{ maxWidth: "600px", margin: "60px auto", textAlign: "center" }}>
        <p style={{ color: "#ef4444", fontSize: "14px" }}>{fetchError}</p>
        <button
          type="button"
          onClick={() => navigate("/admin/bill/products")}
          style={{
            marginTop: "12px",
            padding: "10px 18px",
            borderRadius: "7px",
            border: "none",
            background: "#f97316",
            color: "#fff",
            cursor: "pointer",
            fontWeight: "600",
          }}
        >
          Back to Manage Bills
        </button>
      </div>
    );
  }

  if (!formData) {
    return (
      <div style={{ maxWidth: "600px", margin: "60px auto", textAlign: "center", color: "#a1a1aa" }}>
        Loading bill...
      </div>
    );
  }

  // =========================================================
  // UI
  // =========================================================

  return (
    <div
      style={{
        maxWidth: "1360px",
        margin: "30px auto",
        background: "#18181b",
        padding: "36px 40px",
        borderRadius: "14px",
        border: "1px solid rgba(255,255,255,0.05)",
        boxSizing: "border-box",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          flexWrap: "wrap",
          gap: "12px",
          marginBottom: "26px",
        }}
      >
        <h2 style={{ color: "#f97316", margin: 0, fontSize: "22px" }}>
          Edit Bill {formData.billNo ? `— ${formData.billNo}` : ""}
        </h2>

        <button
          type="button"
          onClick={() => navigate("/admin/bill/products")}
          style={{
            padding: "10px 18px",
            borderRadius: "7px",
            border: "none",
            background: "#3f3f46",
            color: "#fff",
            fontSize: "13.5px",
            fontWeight: "600",
            cursor: "pointer",
            whiteSpace: "nowrap",
          }}
        >
          🧾 Manage Bills
        </button>
      </div>

      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "18px" }}>
        {/* BILL NO + DATE */}
        <div className="two-col" style={twoColGridStyle}>
          <div>
            <label style={labelStyle}>Bill No.</label>
            <input
              type="text"
              maxLength={15}
              value={formData.billNo}
              onChange={(e) =>
                handleChange("billNo", e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 15))
              }
              style={inputStyle}
            />
          </div>

          <div>
            <label style={labelStyle}>Bill Date</label>
            <input
              type="date"
              required
              value={formData.billDate}
              onChange={(e) => handleChange("billDate", e.target.value)}
              ref={(el) => (fieldRefs.current.billDate = el)}
              style={{ ...inputStyle, cursor: "pointer" }}
            />
            <FieldError msg={errors.billDate} />
          </div>
        </div>

        {/* CUSTOMER */}
        <div>
          <label style={labelStyle}>Customer Name</label>
          <input
            type="text"
            required
            value={formData.customerName}
            onChange={(e) => handleChange("customerName", e.target.value)}
            ref={(el) => (fieldRefs.current.customerName = el)}
            style={inputStyle}
          />
          <FieldError msg={errors.customerName} />
        </div>

        <div className="three-col" style={threeColGridStyle}>
          <div>
            <label style={labelStyle}>Mobile No.</label>
            <input
              type="text"
              required
              maxLength={10}
              value={formData.mobileNo}
              onChange={(e) => handleChange("mobileNo", e.target.value.replace(/[^0-9]/g, ""))}
              ref={(el) => (fieldRefs.current.mobileNo = el)}
              style={inputStyle}
            />
            <FieldError msg={errors.mobileNo} />
          </div>

          <div>
            <label style={labelStyle}>Address</label>
            <input
              type="text"
              value={formData.address}
              onChange={(e) => handleChange("address", e.target.value)}
              style={inputStyle}
            />
            <FieldError msg={errors.address} />
          </div>

          <div>
            <label style={labelStyle}>GSTIN</label>
            <input
              type="text"
              maxLength={15}
              value={formData.gstin}
              onChange={(e) => handleChange("gstin", e.target.value.toUpperCase())}
              style={inputStyle}
            />
          </div>
        </div>

        {/* ITEMS */}
        <SectionCard>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              gap: "10px",
              marginBottom: "16px",
            }}
          >
            <div>
              <SectionHeader title="Items" marginBottom="2px" />
              <div style={{ color: "#71717a", fontSize: "12.5px" }}>{items.length}/100 added</div>
            </div>

            <AddButton onClick={addItem} text="+ Add Item" />
          </div>

          {errors.items && <SmallError msg={errors.items} />}

          {items.map((item, index) => {
            const amount = itemAmounts[index];

            return (
              <div
                key={item.id}
                style={{ marginBottom: "16px", paddingBottom: "16px", borderBottom: "1px solid #1f1f23" }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginBottom: "10px",
                  }}
                >
                  <span style={{ color: "#a1a1aa", fontSize: "13px", fontWeight: "600" }}>
                    Item {index + 1}
                  </span>

                  <button
                    type="button"
                    onClick={() => removeItem(item.id)}
                    title="Remove item"
                    style={deleteButtonStyle}
                  >
                    🗑
                  </button>
                </div>

                <div className="item-grid" style={itemGridStyle}>
                  <div>
                    <label style={smallLabelStyle}>Item Name</label>
                    <input
                      type="text"
                      value={item.itemName}
                      onChange={(e) => updateItem(item.id, "itemName", e.target.value)}
                      ref={(el) => (fieldRefs.current[`itemName_${index}`] = el)}
                      style={inputStyle}
                    />
                    <SmallError msg={errors[`itemName_${index}`]} />
                  </div>

                  <div>
                    <label style={smallLabelStyle}>Category</label>
                    <select
                      value={item.category}
                      onChange={(e) => updateItem(item.id, "category", e.target.value)}
                      style={{ ...inputStyle, cursor: "pointer" }}
                    >
                      <option value="gold">Gold</option>
                      <option value="silver">Silver</option>
                      <option value="diamond">Diamond</option>
                      <option value="platinum">Platinum</option>
                      <option value="other">Other</option>
                    </select>
                  </div>

                  <div>
                    <label style={smallLabelStyle}>Purity</label>
                    <input
                      type="text"
                      value={item.purity}
                      onChange={(e) => updateItem(item.id, "purity", e.target.value)}
                      style={inputStyle}
                    />
                  </div>

                  <div>
                    <label style={smallLabelStyle}>HUID</label>
                    <input
                      type="text"
                      maxLength={6}
                      value={item.huid}
                      onChange={(e) => updateItem(item.id, "huid", e.target.value.toUpperCase())}
                      style={inputStyle}
                    />
                  </div>

                  <div>
                    <label style={smallLabelStyle}>Gross Wt. (g)</label>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={item.grossWeight}
                      onChange={(e) => updateItem(item.id, "grossWeight", e.target.value)}
                      ref={(el) => (fieldRefs.current[`itemGrossWeight_${index}`] = el)}
                      style={inputStyle}
                    />
                    <SmallError msg={errors[`itemGrossWeight_${index}`]} />
                  </div>

                  <div>
                    <label style={smallLabelStyle}>Stone Wt. (g)</label>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={item.stoneWeight}
                      onChange={(e) => updateItem(item.id, "stoneWeight", e.target.value)}
                      style={inputStyle}
                    />
                  </div>

                  <div>
                    <label style={smallLabelStyle}>Net Wt. (g)</label>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={item.netWeight}
                      onChange={(e) => updateItem(item.id, "netWeight", e.target.value)}
                      style={inputStyle}
                    />
                  </div>

                  <div>
                    <label style={smallLabelStyle}>Rate / gram</label>
                    <MoneyInput
                      value={item.ratePerGram}
                      onChange={(e) => updateItem(item.id, "ratePerGram", e.target.value)}
                      compact
                    />
                    <SmallError msg={errors[`itemRate_${index}`]} />
                  </div>

                  <div>
                    <label style={smallLabelStyle}>Making Charge Type</label>
                    <select
                      value={item.makingChargeType}
                      onChange={(e) => updateItem(item.id, "makingChargeType", e.target.value)}
                      style={{ ...inputStyle, cursor: "pointer" }}
                    >
                      <option value="perGram">Per Gram</option>
                      <option value="flat">Flat</option>
                      <option value="percentage">Percentage</option>
                    </select>
                  </div>

                  <div>
                    <label style={smallLabelStyle}>Making Charge</label>
                    <MoneyInput
                      value={item.makingCharge}
                      onChange={(e) => updateItem(item.id, "makingCharge", e.target.value)}
                      compact
                    />
                  </div>

                  <div>
                    <label style={smallLabelStyle}>Wastage (%)</label>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={item.wastagePercent}
                      onChange={(e) => updateItem(item.id, "wastagePercent", e.target.value)}
                      style={inputStyle}
                    />
                  </div>

                  <div>
                    <label style={smallLabelStyle}>Stone Charge</label>
                    <MoneyInput
                      value={item.stoneCharge}
                      onChange={(e) => updateItem(item.id, "stoneCharge", e.target.value)}
                      compact
                    />
                  </div>

                  <div>
                    <label style={smallLabelStyle}>Qty</label>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={item.quantity}
                      onChange={(e) => updateItem(item.id, "quantity", e.target.value)}
                      style={inputStyle}
                    />
                  </div>
                </div>

                <div style={{ marginTop: "10px", textAlign: "right", color: "#22c55e", fontSize: "14px", fontWeight: "700" }}>
                  Line Amount: ₹{amount.toFixed(2)}
                </div>
              </div>
            );
          })}

          {items.length === 0 && (
            <div style={{ color: "#52525b", fontSize: "13px", textAlign: "center", padding: "14px" }}>
              No items added
            </div>
          )}

          {items.length > 0 && (
            <div style={subTotalStyle}>
              <span>
                Items Subtotal: <b style={{ color: "#22c55e" }}>₹{itemsSubtotal.toFixed(2)}</b>
              </span>
            </div>
          )}
        </SectionCard>

        {/* EXCHANGE ITEMS */}
        <SectionCard>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              gap: "10px",
              marginBottom: exchangeItems.length ? "16px" : "0",
            }}
          >
            <div>
              <SectionHeader title="Old Gold / Silver Exchange (optional)" marginBottom="2px" />
              <div style={{ color: "#71717a", fontSize: "12.5px" }}>{exchangeItems.length} added</div>
            </div>

            <AddButton onClick={addExchangeItem} text="+ Add Exchange Item" />
          </div>

          {exchangeItems.map((ex, index) => {
            const amount = exchangeAmounts[index];

            return (
              <div
                key={ex.id}
                style={{ marginBottom: "14px", paddingBottom: "14px", borderBottom: "1px solid #1f1f23" }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginBottom: "10px",
                  }}
                >
                  <span style={{ color: "#a1a1aa", fontSize: "13px", fontWeight: "600" }}>
                    Exchange {index + 1}
                  </span>

                  <button
                    type="button"
                    onClick={() => removeExchangeItem(ex.id)}
                    title="Remove exchange item"
                    style={deleteButtonStyle}
                  >
                    🗑
                  </button>
                </div>

                <div className="exchange-grid" style={exchangeGridStyle}>
                  <div>
                    <label style={smallLabelStyle}>Description</label>
                    <input
                      type="text"
                      value={ex.description}
                      onChange={(e) => updateExchangeItem(ex.id, "description", e.target.value)}
                      style={inputStyle}
                    />
                  </div>

                  <div>
                    <label style={smallLabelStyle}>Category</label>
                    <select
                      value={ex.category}
                      onChange={(e) => updateExchangeItem(ex.id, "category", e.target.value)}
                      style={{ ...inputStyle, cursor: "pointer" }}
                    >
                      <option value="gold">Gold</option>
                      <option value="silver">Silver</option>
                    </select>
                  </div>

                  <div>
                    <label style={smallLabelStyle}>Purity</label>
                    <input
                      type="text"
                      value={ex.purity}
                      onChange={(e) => updateExchangeItem(ex.id, "purity", e.target.value)}
                      style={inputStyle}
                    />
                  </div>

                  <div>
                    <label style={smallLabelStyle}>Gross Wt. (g)</label>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={ex.grossWeight}
                      onChange={(e) => updateExchangeItem(ex.id, "grossWeight", e.target.value)}
                      ref={(el) => (fieldRefs.current[`exchangeWeight_${index}`] = el)}
                      style={inputStyle}
                    />
                    <SmallError msg={errors[`exchangeWeight_${index}`]} />
                  </div>

                  <div>
                    <label style={smallLabelStyle}>Deduction (g)</label>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={ex.deduction}
                      onChange={(e) => updateExchangeItem(ex.id, "deduction", e.target.value)}
                      style={inputStyle}
                    />
                  </div>

                  <div>
                    <label style={smallLabelStyle}>Net Wt. (g)</label>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={ex.netWeight}
                      onChange={(e) => updateExchangeItem(ex.id, "netWeight", e.target.value)}
                      style={inputStyle}
                    />
                  </div>

                  <div>
                    <label style={smallLabelStyle}>Rate / gram</label>
                    <MoneyInput
                      value={ex.ratePerGram}
                      onChange={(e) => updateExchangeItem(ex.id, "ratePerGram", e.target.value)}
                      compact
                    />
                    <SmallError msg={errors[`exchangeRate_${index}`]} />
                  </div>
                </div>

                <div style={{ marginTop: "8px", textAlign: "right", color: "#ef4444", fontSize: "14px", fontWeight: "700" }}>
                  Exchange Value: -₹{amount.toFixed(2)}
                </div>
              </div>
            );
          })}

          {exchangeItems.length === 0 && (
            <div style={{ color: "#52525b", fontSize: "13px", textAlign: "center", padding: "14px" }}>
              No exchange items added
            </div>
          )}

          {exchangeItems.length > 0 && (
            <div style={subTotalStyle}>
              <span>
                Exchange Total: <b style={{ color: "#ef4444" }}>-₹{exchangeTotal.toFixed(2)}</b>
              </span>
            </div>
          )}
        </SectionCard>

        {/* DISCOUNT / TAX */}
        <SectionCard>
          <SectionHeader title="Discount & Tax" />

          <div className="three-col" style={threeColGridStyle}>
            <div>
              <label style={smallLabelStyle}>Discount</label>
              <MoneyInput value={formData.discount} onChange={(e) => handleChange("discount", e.target.value)} />
              <FieldError msg={errors.discount} />
            </div>

            <div>
              <label style={smallLabelStyle}>CGST (%)</label>
              <input
                type="text"
                inputMode="numeric"
                value={formData.cgstPercent}
                onChange={(e) => handleChange("cgstPercent", e.target.value)}
                style={inputStyle}
              />
            </div>

            <div>
              <label style={smallLabelStyle}>SGST (%)</label>
              <input
                type="text"
                inputMode="numeric"
                value={formData.sgstPercent}
                onChange={(e) => handleChange("sgstPercent", e.target.value)}
                style={inputStyle}
              />
            </div>
          </div>
        </SectionCard>

        {/* PAYMENT */}
        <SectionCard>
          <SectionHeader title="Payment" />

          <div className="two-col" style={twoColGridStyle}>
            <div>
              <label style={smallLabelStyle}>Payment Mode</label>
              <select
                value={formData.paymentMode}
                onChange={(e) => handleChange("paymentMode", e.target.value)}
                style={{ ...inputStyle, cursor: "pointer" }}
              >
                <option value="cash">Cash</option>
                <option value="card">Card</option>
                <option value="upi">UPI</option>
                <option value="cheque">Cheque</option>
                <option value="bank_transfer">Bank Transfer</option>
                <option value="mixed">Mixed</option>
              </select>
            </div>

            <div ref={(el) => (fieldRefs.current.amountPaid = el)}>
              <label style={smallLabelStyle}>Amount Paid</label>
              <MoneyInput value={formData.amountPaid} onChange={(e) => handleChange("amountPaid", e.target.value)} />
              <FieldError msg={errors.amountPaid} />
            </div>
          </div>
        </SectionCard>

        {/* SUMMARY */}
        <div
          style={{
            padding: "20px",
            background: "#111113",
            border: "1px solid #3f3f46",
            borderRadius: "10px",
          }}
        >
          <div style={{ color: "#f97316", fontSize: "15px", fontWeight: "600", marginBottom: "14px" }}>
            Updated Bill Summary
          </div>

          <div
            className="summary-grid"
            style={{ display: "grid", gridTemplateColumns: "repeat(6, minmax(130px, 1fr))", gap: "12px" }}
          >
            <SummaryBox label="Items Subtotal" value={itemsSubtotal} />
            <SummaryBox label="Exchange Total" value={exchangeTotal} color="#ef4444" />
            <SummaryBox label="Taxable Amount" value={taxableAmount} />
            <SummaryBox label="CGST + SGST" value={cgstAmount + sgstAmount} color="#f59e0b" />
            <SummaryBox label="Round Off" value={roundOff} color="#71717a" />
            <SummaryBox label="GRAND TOTAL" value={grandTotal} color="#22c55e" large />
          </div>

          <div
            style={{
              marginTop: "16px",
              paddingTop: "14px",
              borderTop: "1px solid #27272a",
              display: "flex",
              gap: "24px",
              flexWrap: "wrap",
              fontSize: "13px",
              color: "#a1a1aa",
            }}
          >
            <span>
              Amount Paid: <b style={{ color: "#22c55e" }}>₹{amountPaidValue.toFixed(2)}</b>
            </span>
            <span>
              Balance Due: <b style={{ color: "#ef4444" }}>₹{balanceDue.toFixed(2)}</b>
            </span>
          </div>
        </div>

        {/* SOLD BY / NOTES */}
        <div className="two-col" style={twoColGridStyle}>
          <div>
            <label style={labelStyle}>Sold By</label>
            <input
              type="text"
              value={formData.soldBy}
              onChange={(e) => handleChange("soldBy", e.target.value)}
              style={inputStyle}
            />
          </div>
        </div>

        <div>
          <label style={labelStyle}>Notes</label>
          <textarea
            rows="3"
            value={formData.notes}
            onChange={(e) => handleChange("notes", e.target.value)}
            ref={(el) => (fieldRefs.current.notes = el)}
            style={{ ...inputStyle, resize: "vertical" }}
          />
          <FieldError msg={errors.notes} />
        </div>

        <button
          type="submit"
          disabled={loading}
          style={{
            marginTop: "8px",
            padding: "14px",
            borderRadius: "8px",
            border: "none",
            background: loading ? "#52525b" : "#f97316",
            color: "#fff",
            cursor: loading ? "not-allowed" : "pointer",
            fontWeight: "600",
            fontSize: "15px",
          }}
        >
          {loading ? "Saving..." : "Save Changes"}
        </button>
      </form>

      {showConfirm && (
        <ConfirmSaveModal
          customerName={formData.customerName}
          grandTotal={grandTotal}
          amountPaid={amountPaidValue}
          loading={loading}
          onCancel={() => setShowConfirm(false)}
          onConfirm={confirmSubmit}
        />
      )}

      <style>{`
        @media (max-width: 1100px) {
          .summary-grid { grid-template-columns: repeat(3, minmax(120px, 1fr)) !important; }
        }
        @media (max-width: 900px) {
          .two-col { grid-template-columns: 1fr !important; }
          .three-col { grid-template-columns: 1fr !important; }
          .item-grid, .exchange-grid { grid-template-columns: 1fr 1fr !important; }
        }
        @media (max-width: 640px) {
          .summary-grid { grid-template-columns: repeat(2, minmax(120px, 1fr)) !important; }
          .item-grid, .exchange-grid { grid-template-columns: 1fr !important; }
        }
        input[type="date"]::-webkit-calendar-picker-indicator { filter: invert(1); opacity: 0.7; }
        input:focus, textarea:focus, select:focus { border-color: #f97316 !important; }
      `}</style>
    </div>
  );
};

// =========================================================
// COMPONENTS (mirrors AddBillProduct)
// =========================================================

const ConfirmSaveModal = ({ customerName, grandTotal, amountPaid, loading, onCancel, onConfirm }) => (
  <div
    role="dialog"
    aria-modal="true"
    style={{
      position: "fixed",
      inset: 0,
      background: "rgba(0,0,0,0.6)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      zIndex: 1000,
      padding: "16px",
    }}
    onClick={onCancel}
  >
    <div
      onClick={(e) => e.stopPropagation()}
      style={{
        width: "100%",
        maxWidth: "420px",
        background: "#18181b",
        border: "1px solid #27272a",
        borderRadius: "12px",
        padding: "26px",
        boxSizing: "border-box",
      }}
    >
      <div style={{ color: "#f97316", fontSize: "17px", fontWeight: "700", marginBottom: "4px" }}>
        Confirm Changes
      </div>

      <div style={{ color: "#71717a", fontSize: "12.5px", marginBottom: "18px" }}>
        Save updated details for {customerName || "this bill"}?
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginBottom: "22px" }}>
        <ConfirmRow label="Grand Total" value={`₹${grandTotal.toFixed(2)}`} />
        <ConfirmRow label="Amount Paid" value={`₹${amountPaid.toFixed(2)}`} />
      </div>

      <div style={{ display: "flex", gap: "10px" }}>
        <button
          type="button"
          onClick={onCancel}
          disabled={loading}
          style={{
            flex: 1,
            padding: "12px",
            borderRadius: "8px",
            border: "1px solid #3f3f46",
            background: "transparent",
            color: "#e4e4e7",
            fontWeight: "600",
            fontSize: "14px",
            cursor: loading ? "not-allowed" : "pointer",
          }}
        >
          Cancel
        </button>

        <button
          type="button"
          onClick={onConfirm}
          disabled={loading}
          style={{
            flex: 1,
            padding: "12px",
            borderRadius: "8px",
            border: "none",
            background: loading ? "#52525b" : "#f97316",
            color: "#fff",
            fontWeight: "600",
            fontSize: "14px",
            cursor: loading ? "not-allowed" : "pointer",
          }}
        >
          {loading ? "Saving..." : "Confirm & Save"}
        </button>
      </div>
    </div>
  </div>
);

const ConfirmRow = ({ label, value }) => (
  <div
    style={{
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      padding: "10px 12px",
      background: "#09090b",
      border: "1px solid #27272a",
      borderRadius: "7px",
    }}
  >
    <span style={{ color: "#a1a1aa", fontSize: "13px" }}>{label}</span>
    <span style={{ color: "#fff", fontSize: "14px", fontWeight: "600" }}>{value}</span>
  </div>
);

const SectionCard = ({ children }) => (
  <div style={{ padding: "20px", border: "1px solid #27272a", borderRadius: "10px", background: "#111113" }}>
    {children}
  </div>
);

const SectionHeader = ({ title, marginBottom = "12px" }) => (
  <div style={{ color: "#f97316", fontSize: "15px", fontWeight: "600", marginBottom }}>{title}</div>
);

const MoneyInput = ({ value, onChange, compact = false }) => (
  <div style={{ position: "relative" }}>
    <span
      style={{
        position: "absolute",
        left: compact ? "9px" : "12px",
        top: "50%",
        transform: "translateY(-50%)",
        color: "#a1a1aa",
        fontSize: compact ? "12px" : "14px",
        pointerEvents: "none",
      }}
    >
      ₹
    </span>

    <input
      type="text"
      inputMode="numeric"
      value={value}
      onChange={(e) => {
        const value = e.target.value.replace(/[^0-9.]/g, "");
        onChange({ target: { value } });
      }}
      style={{
        ...inputStyle,
        padding: compact ? "10px 8px 10px 25px" : "13px 12px 13px 30px",
        fontSize: compact ? "13px" : "15px",
        minWidth: 0,
      }}
    />
  </div>
);

const AddButton = ({ onClick, text }) => (
  <button
    type="button"
    onClick={onClick}
    style={{
      border: "none",
      background: "#f97316",
      color: "#fff",
      borderRadius: "7px",
      padding: "9px 14px",
      cursor: "pointer",
      fontSize: "13px",
      fontWeight: "600",
      whiteSpace: "nowrap",
    }}
  >
    {text}
  </button>
);

const SummaryBox = ({ label, value, color = "#fff", large = false }) => (
  <div style={{ padding: "14px 12px", background: "#09090b", borderRadius: "8px", border: "1px solid #27272a", minWidth: 0 }}>
    <div
      style={{
        color: "#a1a1aa",
        fontSize: "11px",
        fontWeight: "600",
        letterSpacing: "0.03em",
        marginBottom: "6px",
        whiteSpace: "nowrap",
        overflow: "hidden",
        textOverflow: "ellipsis",
      }}
      title={label}
    >
      {label}
    </div>
    <div style={{ color, fontSize: large ? "19px" : "15px", fontWeight: "700", wordBreak: "break-word" }}>
      ₹{Number(value || 0).toFixed(2)}
    </div>
  </div>
);

const FieldError = ({ msg }) =>
  msg ? <p style={{ color: "#ef4444", fontSize: "0.8rem", margin: "5px 0 0" }}>{msg}</p> : null;

const SmallError = ({ msg }) =>
  msg ? <div style={{ color: "#ef4444", fontSize: "11px", marginTop: "4px" }}>{msg}</div> : null;

// =========================================================
// STYLES
// =========================================================

const inputStyle = {
  width: "100%",
  padding: "13px",
  background: "#09090b",
  border: "1px solid #27272a",
  borderRadius: "7px",
  color: "#fff",
  fontSize: "15px",
  outline: "none",
  boxSizing: "border-box",
};

const labelStyle = {
  display: "block",
  marginBottom: "7px",
  color: "#a1a1aa",
  fontSize: "0.9rem",
  fontWeight: "500",
};

const smallLabelStyle = {
  display: "block",
  marginBottom: "6px",
  color: "#71717a",
  fontSize: "11.5px",
  fontWeight: "600",
  letterSpacing: "0.02em",
  textTransform: "uppercase",
};

const twoColGridStyle = { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "18px" };
const threeColGridStyle = { display: "grid", gridTemplateColumns: "1fr 1.3fr 1fr", gap: "28px" };
const itemGridStyle = { display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "12px" };
const exchangeGridStyle = { display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "12px" };

const subTotalStyle = {
  display: "flex",
  justifyContent: "flex-end",
  gap: "24px",
  flexWrap: "wrap",
  color: "#a1a1aa",
  fontSize: "13px",
  marginTop: "8px",
};

const deleteButtonStyle = {
  border: "none",
  background: "transparent",
  color: "#ef4444",
  cursor: "pointer",
  fontSize: "18px",
  padding: "0",
  lineHeight: 1,
};

export default EditBillProduct;