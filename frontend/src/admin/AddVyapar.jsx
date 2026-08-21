import React, { useState, useContext, useRef, useEffect } from "react";
import { AuthContext } from "../context/AuthContext";
import { useNavigate, useLocation } from "react-router-dom";

const wordCount = (str = "") => str.trim().split(/\s+/).filter(Boolean).length;

// Mirrors the backend's netWeight derivation (grossWeight * tunch / 100)
// so the form can preview it live, before the server ever sees the item.
const computeNetWeight = (item) => {
  const gross = Number(item.grossWeight);
  const tunch = Number(item.tunch);

  if (!Number.isFinite(gross) || !Number.isFinite(tunch)) {
    return 0;
  }

  return gross * (tunch / 100);
};

const AddVyapar = () => {
  const { user } = useContext(AuthContext);
  const navigate = useNavigate();
  const location = useLocation();

  // =========================================================
  // LOAN PREFILL
  // =========================================================
  // A Vyapar record must be linked to a Loan. Same pattern as
  // AddLoanProduct's person prefill: either the loan doc was handed
  // over via navigation state (coming from the loan detail page), or
  // only its id was passed in the query string and needs fetching.

  const selectedLoanFromState = location.state?.loan || null;
  const loanIdFromQuery = new URLSearchParams(location.search).get("loanId");
  const [selectedLoan, setSelectedLoan] = useState(selectedLoanFromState);
  const [loanLoading, setLoanLoading] = useState(false);

  // =========================================================
  // REFS (for scroll-to-error on invalid submit)
  // =========================================================

  const fieldRefs = useRef({});

  // =========================================================
  // FORM DATA
  // =========================================================

  const [formData, setFormData] = useState({
    name: "",
    address: "",
    customerId: "",
    mobileNo: "",
    description: "",

    // Mongo _id of the linked Loan document
    loan: "",

    // Pledged items — each carries its own weighing/purity/labour,
    // plus a dated fine-payment ledger (usually left empty here and
    // added later via the item's "Record Payment" action, since
    // payments happen over time as the customer settles the loan).
    items: [],
  });

  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});
  const [showConfirm, setShowConfirm] = useState(false);

  // =========================================================
  // LOAD LOAN DETAILS WHEN OPENED FROM A LOAN RECORD
  // =========================================================

  useEffect(() => {
    let cancelled = false;

    const applyLoan = (loan) => {
      if (!loan || cancelled) return;

      setSelectedLoan(loan);

      setFormData((prev) => ({
        ...prev,
        name: loan.name || "",
        address: loan.address || "",
        customerId: loan.customerId || "",
        mobileNo: loan.mobileNo || "",
        loan: loan._id || "",
      }));
    };

    if (selectedLoanFromState) {
      applyLoan(selectedLoanFromState);
    }

    if (!loanIdFromQuery || !user?.token) {
      return () => {
        cancelled = true;
      };
    }

    const loadLoan = async () => {
      try {
        setLoanLoading(true);

        const response = await fetch(`/api/loans/${loanIdFromQuery}`, {
          headers: {
            Authorization: `Bearer ${user.token}`,
          },
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.message || "Failed to load loan details");
        }

        applyLoan(data);
      } catch (error) {
        console.error("Failed to load loan:", error);
      } finally {
        if (!cancelled) {
          setLoanLoading(false);
        }
      }
    };

    loadLoan();

    return () => {
      cancelled = true;
    };
  }, [loanIdFromQuery, user?.token, selectedLoanFromState]);

  // =========================================================
  // ITEM TOTALS (mirrors the model's totalGoldNetWeight /
  // totalSilverNetWeight virtuals, computed client-side for preview)
  // =========================================================

  const totalGoldNetWeight = formData.items
    .filter((item) => item.metal === "gold")
    .reduce((sum, item) => sum + computeNetWeight(item), 0);

  const totalSilverNetWeight = formData.items
    .filter((item) => item.metal === "silver")
    .reduce((sum, item) => sum + computeNetWeight(item), 0);

  const totalLabour = formData.items.reduce(
    (sum, item) => sum + Number(item.labour || 0),
    0,
  );

  // =========================================================
  // HANDLE NORMAL FIELD
  // =========================================================

  const handleChange = (field, value) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));

    if (errors[field]) {
      setErrors((prev) => ({
        ...prev,
        [field]: "",
      }));
    }
  };

  // =========================================================
  // ADD ITEM
  // =========================================================

  const addItem = () => {
    if (formData.items.length >= 50) {
      alert("Maximum 50 items are allowed.");
      return;
    }

    setFormData((prev) => ({
      ...prev,

      items: [
        ...prev.items,

        {
          id: Date.now(),
          metal: "gold",
          grossWeight: "",
          tunch: "",
          labour: "0",
          description: "",
        },
      ],
    }));
  };

  // =========================================================
  // REMOVE ITEM
  // =========================================================

  const removeItem = (id) => {
    setFormData((prev) => ({
      ...prev,

      items: prev.items.filter((item) => item.id !== id),
    }));
  };

  // =========================================================
  // UPDATE ITEM
  // =========================================================

  const updateItem = (id, field, value) => {
    setFormData((prev) => ({
      ...prev,

      items: prev.items.map((item) =>
        item.id === id
          ? {
              ...item,
              [field]: value,
            }
          : item,
      ),
    }));
  };

  // =========================================================
  // SCROLL / FOCUS TO FIRST INVALID FIELD
  // =========================================================

  const scrollToFirstError = (errs) => {
    const errorKeys = Object.keys(errs).filter((k) => errs[k]);

    if (errorKeys.length === 0) return;

    const firstErrorKey = errorKeys[0];
    const node = fieldRefs.current[firstErrorKey];

    if (!node) return;

    node.scrollIntoView({ behavior: "smooth", block: "center" });

    window.setTimeout(() => {
      if (typeof node.focus === "function") {
        node.focus({ preventScroll: true });
      }
    }, 350);
  };

  // =========================================================
  // VALIDATION
  // =========================================================

  const validate = () => {
    const errs = {};

    // Name
    if (!formData.name.trim()) {
      errs.name = "Name is required.";
    }

    if (wordCount(formData.name) > 60) {
      errs.name = "Name must be 60 words or fewer.";
    }

    // Address
    if (!formData.address.trim()) {
      errs.address = "Address is required.";
    }

    if (wordCount(formData.address) > 100) {
      errs.address = "Address must be 100 words or fewer.";
    }

    // Customer ID
    if (!/^[A-Z0-9]{1,8}$/.test(formData.customerId)) {
      errs.customerId =
        "Customer ID must contain letters and numbers only, max 8 characters.";
    }

    // Mobile
    if (!/^\d{10}$/.test(formData.mobileNo)) {
      errs.mobileNo = "Mobile No. must be exactly 10 digits.";
    }

    // Description
    if (!formData.description.trim()) {
      errs.description = "Description is required.";
    }

    if (wordCount(formData.description) > 300) {
      errs.description = "Description must be 300 words or fewer.";
    }

    // Linked loan
    // if (!formData.loan) {
    //   errs.loan =
    //     "No loan is linked. Open this form from a loan record so it can be linked correctly.";
    // }

    // Items
    if (formData.items.length === 0) {
      errs.items = "At least one item (gold/silver) is required.";
    }

    formData.items.forEach((item, index) => {
      const gross = Number(item.grossWeight);

      if (item.grossWeight === "" || !Number.isFinite(gross) || gross <= 0) {
        errs[`itemGrossWeight_${index}`] =
          `Enter a valid gross weight for Item ${index + 1}.`;
      }

      const tunch = Number(item.tunch);

      if (
        item.tunch === "" ||
        !Number.isFinite(tunch) ||
        tunch < 0 ||
        tunch > 100
      ) {
        errs[`itemTunch_${index}`] =
          `Enter a valid tunch % (0-100) for Item ${index + 1}.`;
      }

      const labour = Number(item.labour || 0);

      if (!Number.isFinite(labour) || labour < 0) {
        errs[`itemLabour_${index}`] =
          `Enter a valid labour charge for Item ${index + 1}.`;
      }

      if (item.description && wordCount(item.description) > 50) {
        errs[`itemDescription_${index}`] =
          `Item description must be 50 words or fewer (Item ${index + 1}).`;
      }
    });

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

    if (!validate()) {
      return;
    }

    setShowConfirm(true);
  };

  const confirmSubmit = async () => {
    setShowConfirm(false);
    setLoading(true);

    try {
      const cleanedItems = formData.items.map((item) => ({
        metal: item.metal,
        grossWeight: Number(item.grossWeight),
        tunch: Number(item.tunch),
        labour: Number(item.labour || 0),
        description: item.description,
      }));

      const submitData = {
        name: formData.name,
        address: formData.address,
        customerId: formData.customerId,
        mobileNo: formData.mobileNo.trim(),
        description: formData.description,
        loan: formData.loan,
        items: cleanedItems,
      };

      const res = await fetch("/api/vyapars", {
        method: "POST",

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
        alert("Vyapar record created successfully!");

        navigate("/admin/vyapar/products");
      } else {
        alert(responseData.message || "Error creating Vyapar record");
      }
    } catch (error) {
      console.error("Error creating Vyapar record:", error);

      alert(error.message || "Something went wrong while creating the record.");
    } finally {
      setLoading(false);
    }
  };

  // =========================================================
  // ADMIN CHECK
  // =========================================================

  if (!user || user.role !== "admin") {
    navigate("/");
    return null;
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
        <h2
          style={{
            color: "#f97316",
            margin: 0,
            fontSize: "22px",
          }}
        >
          Add Pledged Items
        </h2>

        <button
          type="button"
          onClick={() => navigate("/admin/vyapar/products")}
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
          📄 Manage Vyapars
        </button>
      </div>

      <div
        ref={(el) => (fieldRefs.current.loan = el)}
        style={{
          marginBottom: "18px",
          padding: "12px 14px",
          borderRadius: "8px",
          border: `1px solid ${
            errors.loan ? "rgba(239,68,68,0.4)" : "rgba(59,130,246,0.25)"
          }`,
          background: errors.loan
            ? "rgba(239,68,68,0.08)"
            : "rgba(59,130,246,0.08)",
          color: errors.loan ? "#fca5a5" : "#93c5fd",
          fontSize: "13px",
        }}
      >
        {loanLoading
          ? "Loading loan details..."
          : selectedLoan
            ? `Linking pledged items to Loan ${selectedLoan.loanId || ""} for ${
                selectedLoan.name || "this customer"
              }. Name, address, customer ID and mobile are copied from the loan.`
            : errors.loan ||
              "No loan linked yet — open this form from a loan record."}
      </div>

      <form
        onSubmit={handleSubmit}
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "18px",
        }}
      >
        {/* =====================================================
            NAME
        ====================================================== */}
        <div>
          <label style={labelStyle}>Name</label>

          <input
            type="text"
            placeholder="Full name"
            required
            readOnly={Boolean(selectedLoan)}
            value={formData.name}
            onChange={(e) => {
              const value = e.target.value
                .toLowerCase()
                .replace(/\b\w/g, (char) => char.toUpperCase());

              handleChange("name", value);
            }}
            ref={(el) => (fieldRefs.current.name = el)}
            style={inputStyle}
          />

          <FieldError msg={errors.name} />
        </div>
        {/* =====================================================
            ADDRESS
        ====================================================== */}
        <div>
          <label style={labelStyle}>Address</label>

          <textarea
            placeholder="Address"
            required
            rows="2"
            readOnly={Boolean(selectedLoan)}
            value={formData.address}
            onChange={(e) => {
              const value = e.target.value
                .toLowerCase()
                .replace(/\b\w/g, (char) => char.toUpperCase());

              handleChange("address", value);
            }}
            ref={(el) => (fieldRefs.current.address = el)}
            style={{ ...inputStyle, resize: "vertical" }}
          />

          <FieldError msg={errors.address} />
        </div>
        {/* =====================================================
            CUSTOMER ID + MOBILE
        ====================================================== */}
        <div className="two-col" style={twoColGridStyle}>
          <div>
            <label style={labelStyle}>Customer ID (max 8 characters)</label>

            <input
              type="text"
              placeholder="Customer ID"
              required
              maxLength={8}
              readOnly={Boolean(selectedLoan)}
              value={formData.customerId}
              onChange={(e) => {
                const value = e.target.value
                  .toUpperCase()
                  .replace(/[^A-Z0-9]/g, "")
                  .slice(0, 8);

                handleChange("customerId", value);
              }}
              ref={(el) => (fieldRefs.current.customerId = el)}
              style={inputStyle}
            />

            <FieldError msg={errors.customerId} />
          </div>

          <div>
            <label style={labelStyle}>Mobile No.</label>

            <input
              type="text"
              placeholder="10-digit mobile number"
              required
              maxLength={10}
              readOnly={Boolean(selectedLoan && selectedLoan.mobileNo)}
              value={formData.mobileNo}
              onChange={(e) =>
                handleChange("mobileNo", e.target.value.replace(/[^0-9]/g, ""))
              }
              ref={(el) => (fieldRefs.current.mobileNo = el)}
              style={inputStyle}
            />

            <FieldError msg={errors.mobileNo} />
          </div>
        </div>
        {/* =====================================================
            DESCRIPTION
        ====================================================== */}
        <div>
          <label style={labelStyle}>Description</label>

          <textarea
            placeholder="Description of this record / overall pledge"
            required
            rows="4"
            value={formData.description}
            onChange={(e) => handleChange("description", e.target.value)}
            ref={(el) => (fieldRefs.current.description = el)}
            style={{ ...inputStyle, resize: "vertical" }}
          />

          <FieldError msg={errors.description} />
        </div>
        {/* =====================================================
            ITEMS (GOLD / SILVER)
        ====================================================== */}
        <div ref={(el) => (fieldRefs.current.items = el)}>
          <SectionCard>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                flexWrap: "wrap",
                gap: "10px",
                marginBottom: formData.items.length ? "16px" : "0",
              }}
            >
              <div>
                <SectionHeader title="Items" marginBottom="2px" />

                <div
                  style={{
                    color: "#71717a",
                    fontSize: "12.5px",
                  }}
                >
                  {formData.items.length}/50 added — net weight is
                  auto-calculated from gross weight × tunch
                </div>
              </div>

              <AddButton
                onClick={addItem}
                disabled={formData.items.length >= 50}
                text="+ Add Item"
              />
            </div>

            {formData.items.map((item, index) => {
              const netWeight = computeNetWeight(item);

              return (
                <div key={item.id} style={itemCardStyle}>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      marginBottom: "12px",
                    }}
                  >
                    <div
                      style={{
                        color: "#a1a1aa",
                        fontSize: "13px",
                        fontWeight: "600",
                      }}
                    >
                      Item #{index + 1}
                    </div>

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
                      <label style={smallLabelStyle}>Metal</label>

                      <select
                        value={item.metal}
                        onChange={(e) =>
                          updateItem(item.id, "metal", e.target.value)
                        }
                        style={{ ...inputStyle, cursor: "pointer" }}
                      >
                        <option value="gold">Gold</option>
                        <option value="silver">Silver</option>
                      </select>
                    </div>

                    <div
                      ref={(el) =>
                        (fieldRefs.current[`itemGrossWeight_${index}`] = el)
                      }
                    >
                      <label style={smallLabelStyle}>Gross Wt (g)</label>

                      <input
                        type="text"
                        inputMode="decimal"
                        placeholder="0.000"
                        value={item.grossWeight}
                        onChange={(e) =>
                          updateItem(
                            item.id,
                            "grossWeight",
                            e.target.value.replace(/[^0-9.]/g, ""),
                          )
                        }
                        style={inputStyle}
                      />

                      {errors[`itemGrossWeight_${index}`] && (
                        <SmallError msg={errors[`itemGrossWeight_${index}`]} />
                      )}
                    </div>

                    <div
                      ref={(el) =>
                        (fieldRefs.current[`itemTunch_${index}`] = el)
                      }
                    >
                      <label style={smallLabelStyle}>Tunch (%)</label>

                      <input
                        type="text"
                        inputMode="decimal"
                        placeholder="0-100"
                        value={item.tunch}
                        onChange={(e) =>
                          updateItem(
                            item.id,
                            "tunch",
                            e.target.value.replace(/[^0-9.]/g, ""),
                          )
                        }
                        style={inputStyle}
                      />

                      {errors[`itemTunch_${index}`] && (
                        <SmallError msg={errors[`itemTunch_${index}`]} />
                      )}
                    </div>

                    <div>
                      <label style={smallLabelStyle}>Net Wt (g)</label>

                      <input
                        type="text"
                        readOnly
                        placeholder="Auto"
                        value={netWeight ? netWeight.toFixed(3) : ""}
                        style={{
                          ...inputStyle,
                          cursor: "not-allowed",
                          opacity: 0.85,
                        }}
                      />
                    </div>

                    <div
                      ref={(el) =>
                        (fieldRefs.current[`itemLabour_${index}`] = el)
                      }
                    >
                      <label style={smallLabelStyle}>Labour (₹)</label>

                      <input
                        type="text"
                        inputMode="numeric"
                        placeholder="0"
                        value={item.labour}
                        onChange={(e) =>
                          updateItem(
                            item.id,
                            "labour",
                            e.target.value.replace(/[^0-9.]/g, ""),
                          )
                        }
                        style={inputStyle}
                      />

                      {errors[`itemLabour_${index}`] && (
                        <SmallError msg={errors[`itemLabour_${index}`]} />
                      )}
                    </div>
                  </div>

                  <div style={{ marginTop: "12px" }}>
                    <label style={smallLabelStyle}>Item Description</label>

                    <textarea
                      rows="2"
                      placeholder="e.g. Gold chain with pendant"
                      value={item.description}
                      onChange={(e) =>
                        updateItem(item.id, "description", e.target.value)
                      }
                      style={{ ...inputStyle, resize: "vertical" }}
                    />

                    {errors[`itemDescription_${index}`] && (
                      <SmallError msg={errors[`itemDescription_${index}`]} />
                    )}
                  </div>
                </div>
              );
            })}

            {formData.items.length === 0 && (
              <div
                style={{
                  color: "#52525b",
                  fontSize: "13px",
                  textAlign: "center",
                  padding: "14px",
                }}
              >
                No item added
              </div>
            )}

            {errors.items && <SmallError msg={errors.items} />}
          </SectionCard>
        </div>
        {/* =====================================================
            ITEM TOTALS SUMMARY
        ====================================================== */}
        <div
          style={{
            padding: "20px",
            background: "#111113",
            border: "1px solid #3f3f46",
            borderRadius: "10px",
          }}
        >
          <div
            style={{
              color: "#f97316",
              fontSize: "15px",
              fontWeight: "600",
              marginBottom: "14px",
            }}
          >
            Item Totals
          </div>

          <div
            className="summary-grid"
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(3, minmax(140px, 1fr))",
              gap: "12px",
            }}
          >
            <SummaryBox
              label="Total Gold Net Wt (g)"
              value={totalGoldNetWeight}
              color="#facc15"
              decimals={3}
            />

            <SummaryBox
              label="Total Silver Net Wt (g)"
              value={totalSilverNetWeight}
              color="#d4d4d8"
              decimals={3}
            />

            <SummaryBox
              label="Total Labour"
              value={totalLabour}
              color="#22c55e"
              prefix="₹"
            />
          </div>
        </div>
        {/* =====================================================
            SUBMIT
        ====================================================== */}
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
          {loading ? "Creating..." : "Publish Vyapar"}
        </button>
      </form>

      {/* =====================================================
          CONFIRM PUBLISH MODAL
      ====================================================== */}

      {showConfirm && (
        <ConfirmPublishModal
          name={formData.name}
          customerId={formData.customerId}
          loanId={selectedLoan?.loanId}
          itemCount={formData.items.length}
          totalGoldNetWeight={totalGoldNetWeight}
          totalSilverNetWeight={totalSilverNetWeight}
          loading={loading}
          onCancel={() => setShowConfirm(false)}
          onConfirm={confirmSubmit}
        />
      )}

      {/* =====================================================
          RESPONSIVE CSS
      ====================================================== */}

      <style>{`
        input[type="number"]::-webkit-inner-spin-button,
        input[type="number"]::-webkit-outer-spin-button {
          -webkit-appearance: none;
          margin: 0;
        }

        input[type="number"] {
          -moz-appearance: textfield;
        }

        @media (max-width: 900px) {
          .two-col {
            grid-template-columns: 1fr !important;
          }

          .item-grid {
            grid-template-columns: 1fr 1fr !important;
          }
        }

        @media (max-width: 640px) {
          .summary-grid {
            grid-template-columns: repeat(2, minmax(120px, 1fr)) !important;
          }

          .item-grid {
            grid-template-columns: 1fr !important;
          }
        }

        input:focus,
        textarea:focus,
        select:focus {
          border-color: #f97316 !important;
        }
      `}</style>
    </div>
  );
};

// =========================================================
// COMPONENTS
// =========================================================

const ConfirmPublishModal = ({
  name,
  customerId,
  loanId,
  itemCount,
  totalGoldNetWeight,
  totalSilverNetWeight,
  loading,
  onCancel,
  onConfirm,
}) => (
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
        maxWidth: "440px",
        background: "#18181b",
        border: "1px solid #27272a",
        borderRadius: "12px",
        padding: "26px",
        boxSizing: "border-box",
      }}
    >
      <div
        style={{
          color: "#f97316",
          fontSize: "17px",
          fontWeight: "700",
          marginBottom: "4px",
        }}
      >
        Confirm Vyapar Details
      </div>

      <div
        style={{
          color: "#71717a",
          fontSize: "12.5px",
          marginBottom: "18px",
        }}
      >
        Please review before publishing this record.
      </div>

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "10px",
          marginBottom: "22px",
        }}
      >
        <ConfirmRow label="Name" value={name || "-"} />
        <ConfirmRow label="Customer ID" value={customerId || "-"} />
        <ConfirmRow label="Linked Loan" value={loanId || "-"} />
        <ConfirmRow label="Item Count" value={String(itemCount)} />
        <ConfirmRow
          label="Total Gold Net Wt"
          value={`${totalGoldNetWeight.toFixed(3)} g`}
        />
        <ConfirmRow
          label="Total Silver Net Wt"
          value={`${totalSilverNetWeight.toFixed(3)} g`}
        />
      </div>

      <div
        style={{
          display: "flex",
          gap: "10px",
        }}
      >
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
          {loading ? "Publishing..." : "Confirm & Publish"}
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
    <span
      style={{
        color: "#a1a1aa",
        fontSize: "13px",
      }}
    >
      {label}
    </span>

    <span
      style={{
        color: "#fff",
        fontSize: "14px",
        fontWeight: "600",
      }}
    >
      {value}
    </span>
  </div>
);

const SectionCard = ({ children }) => (
  <div
    style={{
      padding: "20px",
      border: "1px solid #27272a",
      borderRadius: "10px",
      background: "#111113",
    }}
  >
    {children}
  </div>
);

const SectionHeader = ({ title, marginBottom = "12px" }) => (
  <div
    style={{
      color: "#f97316",
      fontSize: "15px",
      fontWeight: "600",
      marginBottom,
    }}
  >
    {title}
  </div>
);

const AddButton = ({ onClick, disabled = false, text }) => (
  <button
    type="button"
    onClick={onClick}
    disabled={disabled}
    style={{
      border: "none",
      background: disabled ? "#27272a" : "#f97316",
      color: "#fff",
      borderRadius: "7px",
      padding: "9px 14px",
      cursor: disabled ? "not-allowed" : "pointer",
      fontSize: "13px",
      fontWeight: "600",
      whiteSpace: "nowrap",
    }}
  >
    {text}
  </button>
);

const SummaryBox = ({
  label,
  value,
  color = "#fff",
  large = false,
  decimals = 2,
  prefix = "",
}) => (
  <div
    style={{
      padding: "14px 12px",
      background: "#09090b",
      borderRadius: "8px",
      border: "1px solid #27272a",
      minWidth: 0,
    }}
  >
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

    <div
      style={{
        color,
        fontSize: large ? "19px" : "15px",
        fontWeight: "700",
        wordBreak: "break-word",
      }}
    >
      {prefix}
      {Number(value || 0).toFixed(decimals)}
    </div>
  </div>
);

const FieldError = ({ msg }) =>
  msg ? (
    <p
      style={{
        color: "#ef4444",
        fontSize: "0.8rem",
        margin: "5px 0 0",
      }}
    >
      {msg}
    </p>
  ) : null;

const SmallError = ({ msg }) =>
  msg ? (
    <div
      style={{
        color: "#ef4444",
        fontSize: "11px",
        marginTop: "4px",
      }}
    >
      {msg}
    </div>
  ) : null;

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

const twoColGridStyle = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: "18px",
};

const itemCardStyle = {
  padding: "16px",
  border: "1px solid #27272a",
  borderRadius: "8px",
  background: "#09090b",
  marginBottom: "12px",
};

const itemGridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(5, 1fr)",
  gap: "14px",
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

export default AddVyapar;