import React, {
  useContext,
  useEffect,
  useState,
} from "react";
import { AuthContext } from "../context/AuthContext";
import { useNavigate } from "react-router-dom";

const People = () => {
  const { user } = useContext(AuthContext);
  const navigate = useNavigate();

  const [people, setPeople] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [limit] = useState(50);
  const [totalPeople, setTotalPeople] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  const [showForm, setShowForm] = useState(false);
  const [editingPerson, setEditingPerson] = useState(null);

  const [form, setForm] = useState({
    customerId: "",
    name: "",
    email: "",
    phone: "",
    address: "",
    dateOfBirth: "",
    gender: "male",
    preferences: "",
    status: "active",
    source: "",
    tags: "",
  });

  // ============================================================
  // ADMIN PROTECTION
  // ============================================================

  useEffect(() => {
    if (!user || user.role !== "admin") {
      navigate("/");
    }
  }, [user, navigate]);

  // ============================================================
  // LOAD PEOPLE
  // ============================================================

  useEffect(() => {
    if (!user || user.role !== "admin") {
      return;
    }

    const timer = setTimeout(() => {
      fetchPeople(page, search);
    }, search.trim() ? 350 : 0);

    return () => clearTimeout(timer);
  }, [user, page, search]);

  const fetchPeople = async (requestedPage = page, requestedSearch = search) => {
    try {
      setLoading(true);
      setError("");

      const params = new URLSearchParams({
        page: String(requestedPage),
        limit: String(limit),
      });

      if (requestedSearch.trim()) {
        params.set("search", requestedSearch.trim());
      }

      const response = await fetch(`/api/people?${params.toString()}`, {
        headers: {
          Authorization: `Bearer ${user.token}`,
        },
      });

      const data = await response.json();

      if (!response.ok) {
        if (response.status === 401) {
          navigate("/login");
          return;
        }

        if (response.status === 403) {
          navigate("/");
          return;
        }

        throw new Error(
          data.message || "Failed to load people"
        );
      }

      // New paginated API response
      if (Array.isArray(data)) {
        // Backward compatibility if old backend is still running
        setPeople(data);
        setTotalPeople(data.length);
        setTotalPages(1);
      } else {
        setPeople(Array.isArray(data.people) ? data.people : []);
        setTotalPeople(
          Number(data.pagination?.total) || 0
        );
        const returnedTotalPages = Math.max(
          1,
          Number(data.pagination?.totalPages) || 1
        );

        setTotalPages(returnedTotalPages);

        // If deleting/searching made the current page invalid,
        // move automatically to the last available page.
        if (requestedPage > returnedTotalPages) {
          setPage(returnedTotalPages);
          return;
        }
      }
    } catch (err) {
      console.error(err);
      setError(
        err.message || "Failed to load people"
      );
    } finally {
      setLoading(false);
    }
  };

  // ============================================================
  // FORM HELPERS
  // ============================================================

  const resetForm = () => {
    setForm({
      customerId: "",
      name: "",
      email: "",
      phone: "",
      address: "",
      dateOfBirth: "",
      gender: "male",
      preferences: "",
      status: "active",
      source: "",
      tags: "",
    });

    setEditingPerson(null);
    setShowForm(false);
  };

  const handleChange = (event) => {
    const { name, value } = event.target;

    setForm((previous) => ({
      ...previous,
      [name]: value,
    }));
  };

  // ============================================================
  // OPEN ADD FORM
  // ============================================================

  const openAddForm = () => {
    setSuccess("");
    setError("");

    setEditingPerson(null);

    setForm({
      customerId: "",
      name: "",
      email: "",
      phone: "",
      address: "",
      dateOfBirth: "",
      gender: "male",
      preferences: "",
      status: "active",
      source: "",
      tags: "",
    });

    setShowForm(true);
  };

  // ============================================================
  // OPEN EDIT FORM
  // ============================================================

  const openEditForm = (person) => {
    setSuccess("");
    setError("");

    setEditingPerson(person);

    setForm({
      customerId: person.customerId || "",
      name: person.name || "",
      email: person.email || "",
      phone: person.phone || "",
      address: person.address || "",
      dateOfBirth: person.dateOfBirth
        ? formatDateForInput(person.dateOfBirth)
        : "",
      gender:
        person.gender || "male",
      preferences: person.preferences || "",
      status: person.status || "active",
      source: person.source || "",
      tags: Array.isArray(person.tags)
        ? person.tags.join(", ")
        : "",
    });

    setShowForm(true);
  };

  // ============================================================
  // CREATE / UPDATE PERSON
  // ============================================================

  const handleSubmit = async (event) => {
    event.preventDefault();

    setError("");
    setSuccess("");

    if (!form.name.trim()) {
      setError("Name is required.");
      return;
    }

    try {
      setSaving(true);

      const payload = {
        customerId:
          form.customerId.trim() || undefined,

        name: form.name.trim(),

        email:
          form.email.trim() || null,

        phone:
          form.phone.trim() || null,

        address:
          form.address.trim() || null,

        dateOfBirth:
          form.dateOfBirth || null,

        gender: form.gender,

        preferences:
          form.preferences.trim() || null,

        status: form.status,

        source:
          form.source.trim() || null,

        tags: form.tags
          ? form.tags
              .split(",")
              .map((tag) => tag.trim())
              .filter(Boolean)
          : [],
      };

      const isEditing = Boolean(editingPerson);

      const url = isEditing
        ? `/api/people/${editingPerson._id}`
        : "/api/people";

      const method = isEditing
        ? "PUT"
        : "POST";

      const response = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${user.token}`,
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (!response.ok) {
        if (response.status === 401) {
          navigate("/login");
          return;
        }

        if (response.status === 403) {
          navigate("/");
          return;
        }

        throw new Error(
          data.message ||
            `Failed to ${
              isEditing ? "update" : "create"
            } person`
        );
      }

      await fetchPeople();

      setSuccess(
        isEditing
          ? "Person updated successfully."
          : "Person added successfully."
      );

      resetForm();
    } catch (err) {
      console.error(err);

      setError(
        err.message ||
          "Something went wrong while saving the person."
      );
    } finally {
      setSaving(false);
    }
  };

  // ============================================================
  // DELETE PERSON
  // ============================================================

  const handleDelete = async (person) => {
    const confirmed = window.confirm(
      `Are you sure you want to delete ${person.name}?`
    );

    if (!confirmed) {
      return;
    }

    try {
      setError("");
      setSuccess("");

      const response = await fetch(
        `/api/people/${person._id}`,
        {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${user.token}`,
          },
        }
      );

      const data = await response.json();

      if (!response.ok) {
        if (response.status === 401) {
          navigate("/login");
          return;
        }

        if (response.status === 403) {
          navigate("/");
          return;
        }

        throw new Error(
          data.message ||
            "Failed to delete person"
        );
      }

      await fetchPeople();

      setSuccess(
        data.message ||
          "Person deleted successfully."
      );
    } catch (err) {
      console.error(err);

      setError(
        err.message ||
          "Failed to delete person."
      );
    }
  };


  // ============================================================
  // OPEN FAMILY TREE
  // ============================================================

  const openFamilyTree = (person) => {
    navigate(
      `/admin/family-tree/${person._id}`
    );
  };

  // ============================================================
  // PROTECTION
  // ============================================================

  if (!user || user.role !== "admin") {
    return null;
  }

  // ============================================================
  // RENDER
  // ============================================================

  return (
    <div style={containerStyle}>
      {/* ======================================================
          HEADER
      ====================================================== */}

      <div style={headerStyle}>
        <div>
          <h2 style={titleStyle}>
            People Directory
          </h2>

          <p style={subtitleStyle}>
            Manage people and their family
            relationships.
          </p>
        </div>

        <button
          type="button"
          onClick={openAddForm}
          style={primaryButtonStyle}
        >
          + Add Person
        </button>
      </div>

      {/* ======================================================
          MESSAGES
      ====================================================== */}

      {error && (
        <div style={errorStyle}>
          <strong>Error:</strong> {error}
        </div>
      )}

      {success && (
        <div style={successStyle}>
          {success}
        </div>
      )}

      {/* ======================================================
          FORM
      ====================================================== */}

      {showForm && (
        <div style={formCardStyle}>
          <div style={formHeaderStyle}>
            <div>
              <h3 style={formTitleStyle}>
                {editingPerson
                  ? "Edit Person"
                  : "Add Person"}
              </h3>

              <p style={subtitleStyle}>
                Enter the person's details below.
              </p>
            </div>

            <button
              type="button"
              onClick={resetForm}
              style={closeButtonStyle}
            >
              ✕
            </button>
          </div>

          <form onSubmit={handleSubmit}>
            <div style={formGridStyle}>
       <FormField
  label="Customer ID"
  name="customerId"
  value={form.customerId}
  onChange={(e) =>
    handleChange({
      target: {
        name: "customerId",
        value: e.target.value
          .toUpperCase()
          .replace(/[^A-Z0-9]/g, "")
          .slice(0, 8),
      },
    })
  }
  placeholder="e.g. CUST001"
  maxLength={8}
/>
             {/* NAME */}

<FormField
  label="Name *"
  name="name"
  value={form.name}
  onChange={(e) =>
    handleChange({
      target: {
        name: "name",
        value: e.target.value
          .toLowerCase()
          .replace(/\b\w/g, (char) => char.toUpperCase()),
      },
    })
  }
  placeholder="Full name"
  required
/>
{/* EMAIL */}

<div>
  <label style={labelStyle}>Email</label>

  <div
    style={{
      display: "flex",
      width: "100%",
      height: "44px",
      background: "#09090b",
      border: "1px solid #27272a",
      borderRadius: "7px",
      overflow: "hidden",
      boxSizing: "border-box",
    }}
  >

    
    <input
      type="text"
      name="email"
      value={form.email}
      onChange={(e) => {
        const value = e.target.value
          .toLowerCase()
          .replace(/\s/g, "")
          .replace(/[^a-z0-9._%+-]/g, "");

        handleChange({
          target: {
            name: "email",
            value,
          },
        });
      }}
      placeholder="username"
      maxLength={64}
      style={{
        flex: 1,
        minWidth: 0,
        padding: "0 12px",
        background: "transparent",
        border: "none",
        outline: "none",
        color: "#fff",
        fontSize: "14px",
      }}
    />

    <div
      style={{
        display: "flex",
        alignItems: "center",
        padding: "0 12px",
        background: "#18181b",
        borderLeft: "1px solid #27272a",
        color: "#71717a",
        fontSize: "13px",
        whiteSpace: "nowrap",
      }}
    >
      @gmail.com
    </div>
  </div>
</div>

              {/* PHONE */}

<FormField
  label="Phone"
  name="phone"
  value={form.phone}
  onChange={(e) =>
    handleChange({
      target: {
        name: "phone",
        value: e.target.value.replace(/\D/g, "").slice(0, 10),
      },
    })
  }
  placeholder="10-digit phone number"
/>

              {/* DATE OF BIRTH */}

              <FormField
                label="Date of Birth"
                name="dateOfBirth"
                value={form.dateOfBirth}
                onChange={handleChange}
                type="date"
              />

              {/* GENDER */}

              <div>
                <label style={labelStyle}>
                  Gender
                </label>

                <select
                  name="gender"
                  value={form.gender}
                  onChange={handleChange}
                  style={inputStyle}
                >

                  <option value="male">
                    Male
                  </option>

                  <option value="female">
                    Female
                  </option>

                  <option value="other">
                    Other
                  </option>
                </select>
              </div>

              {/* STATUS */}

              <div>
                <label style={labelStyle}>
                  Status
                </label>

                <select
                  name="status"
                  value={form.status}
                  onChange={handleChange}
                  style={inputStyle}
                >
                  <option value="active">
                    Active
                  </option>

                  <option value="inactive">
                    Inactive
                  </option>

                  <option value="archived">
                    Archived
                  </option>
                </select>
              </div>

              {/* SOURCE */}

              <FormField
                label="Source"
                name="source"
                value={form.source}
                onChange={handleChange}
                placeholder="Where did this person come from?"
              />

              {/* ADDRESS */}

              <div style={fullWidthStyle}>
                <label style={labelStyle}>
                  Address
                </label>

                <textarea
                  name="address"
                  value={form.address}
                  onChange={handleChange}
                  placeholder="Full address"
                  rows={3}
                  style={textareaStyle}
                />
              </div>

              {/* PREFERENCES */}

              <div style={fullWidthStyle}>
                <label style={labelStyle}>
                  Preferences
                </label>

                <textarea
                  name="preferences"
                  value={form.preferences}
                  onChange={handleChange}
                  placeholder="Preferences or additional information"
                  rows={3}
                  style={textareaStyle}
                />
              </div>

              {/* TAGS */}
{/* TAGS */}

<div style={fullWidthStyle}>
  <label style={labelStyle}>Tags</label>

  <div
    style={{
      display: "flex",
      flexWrap: "wrap",
      gap: "8px",
      padding: "10px",
      background: "#18181b",
      border: "1px solid rgba(255,255,255,0.1)",
      borderRadius: "7px",
    }}
  >
    {[
      "VIP",
      "Regular",
      "Customer",
      "Family",
      "Business",
      "New",
      "Old Customer",
      "Priority",
    ].map((tag) => {
      const selectedTags = form.tags
        ? form.tags.split(",").map((t) => t.trim())
        : [];

      const isSelected = selectedTags.includes(tag);

      return (
        <button
          key={tag}
          type="button"
          onClick={() => {
            let updatedTags;

            if (isSelected) {
              // Remove tag
              updatedTags = selectedTags.filter(
                (t) => t !== tag
              );
            } else {
              // Add tag
              updatedTags = [...selectedTags, tag];
            }

            handleChange({
              target: {
                name: "tags",
                value: updatedTags.join(", "),
              },
            });
          }}
          style={{
            padding: "7px 12px",
            borderRadius: "6px",
            border: isSelected
              ? "1px solid #f97316"
              : "1px solid #3f3f46",
            background: isSelected
              ? "rgba(249,115,22,0.15)"
              : "#09090b",
            color: isSelected
              ? "#f97316"
              : "#a1a1aa",
            cursor: "pointer",
            fontSize: "12px",
            fontWeight: isSelected ? "600" : "400",
            transition: "all 0.15s ease",
          }}
        >
          {isSelected ? "✓ " : ""}
          {tag}
        </button>
      );
    })}
  </div>
</div>
            </div>

            {/* FORM BUTTONS */}

            <div style={formActionsStyle}>
              <button
                type="button"
                onClick={resetForm}
                style={secondaryButtonStyle}
                disabled={saving}
              >
                Cancel
              </button>

              <button
                type="submit"
                style={primaryButtonStyle}
                disabled={saving}
              >
                {saving
                  ? "Saving..."
                  : editingPerson
                  ? "Update Person"
                  : "Add Person"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ======================================================
          SEARCH / SUMMARY
      ====================================================== */}

      <div style={toolbarStyle}>
        <div style={searchWrapperStyle}>
          <span style={searchIconStyle}>
            🔎
          </span>

          <input
            type="text"
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(1);
            }}
            placeholder="Search people..."
            style={searchInputStyle}
          />
        </div>

<div style={countStyle}>
  Showing{" "}
  <strong>
    {people.length}
  </strong>{" "}
  of{" "}
  <strong>{totalPeople}</strong>{" "}
  people
</div>
      </div>

      {/* ======================================================
          LOADING
      ====================================================== */}

      {loading && (
        <div style={loadingStyle}>
          Loading people...
        </div>
      )}

      {/* ======================================================
          EMPTY
      ====================================================== */}

      {!loading &&
        people.length === 0 && (
          <div style={emptyStyle}>
            <div style={emptyIconStyle}>
              👥
            </div>

            <h3 style={{ margin: "0 0 8px" }}>
              {totalPeople === 0
                ? "No people yet"
                : "No matching people"}
            </h3>

            <p style={subtitleStyle}>
              {totalPeople === 0
                ? "Add your first person to start building the family directory."
                : "No people found for this search."}
            </p>

            {totalPeople === 0 && (
              <button
                type="button"
                onClick={openAddForm}
                style={primaryButtonStyle}
              >
                + Add First Person
              </button>
            )}
          </div>
        )}

      {/* ======================================================
          PEOPLE TABLE
      ====================================================== */}

      {!loading &&
        people.length > 0 && (
          <div style={tableContainerStyle}>
            <table style={tableStyle}>
              <thead>
                <tr style={tableRowStyle}>
                  <th style={thStyle}>
                    PERSON
                  </th>

                  <th style={thStyle}>
                    CUSTOMER ID
                  </th>

                  <th style={thStyle}>
                    CONTACT
                  </th>

                  <th style={thStyle}>
                    STATUS
                  </th>

                  <th style={thStyle}>
                    SOURCE
                  </th>

                  <th
                    style={{
                      ...thStyle,
                      textAlign: "right",
                    }}
                  >
                    ACTIONS
                  </th>
                </tr>
              </thead>

              <tbody>
                {people.map(
                  (person) => (
                    <tr
                      key={person._id}
                      style={tableRowStyle}
                    >
                      {/* PERSON */}

                      <td style={tdStyle}>
                        <div
                          style={personCellStyle}
                        >
                          <div
                            style={
                              personAvatarStyle
                            }
                          >
                            {getInitial(
                              person.name
                            )}
                          </div>

                          <div>
                            <div
                              style={
                                personNameStyle
                              }
                            >
                              {person.name}
                            </div>

                            {person.email && (
                              <div
                                style={
                                  secondaryTextStyle
                                }
                              >
                                {person.email}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* CUSTOMER ID */}

                      <td style={tdStyle}>
                        {person.customerId ? (
                          <span
                            style={
                              customerIdBadgeStyle
                            }
                          >
                            {person.customerId}
                          </span>
                        ) : (
                          <span
                            style={
                              mutedTextStyle
                            }
                          >
                            —
                          </span>
                        )}
                      </td>

                      {/* CONTACT */}

                      <td style={tdStyle}>
                        {person.phone ? (
                          <div>
                            📞 {person.phone}
                          </div>
                        ) : (
                          <span
                            style={
                              mutedTextStyle
                            }
                          >
                            No phone
                          </span>
                        )}
                      </td>

                      {/* STATUS */}

                      <td style={tdStyle}>
                        <StatusBadge
                          status={person.status}
                        />
                      </td>

                      {/* SOURCE */}

                      <td style={tdStyle}>
                        {person.source || (
                          <span
                            style={
                              mutedTextStyle
                            }
                          >
                            —
                          </span>
                        )}
                      </td>

                      {/* ACTIONS */}

                      <td
                        style={{
                          ...tdStyle,
                          textAlign: "right",
                        }}
                      >
                        <div
                          style={
                            actionsStyle
                          }
                        >
                          <button
                            type="button"
                            onClick={() =>
                              openFamilyTree(
                                person
                              )
                            }
                            style={
                              treeButtonStyle
                            }
                          >
                            🌳 Tree
                          </button>

                          <button
                            type="button"
                            onClick={() =>
                              openEditForm(
                                person
                              )
                            }
                            style={
                              editButtonStyle
                            }
                          >
                            Edit
                          </button>

                          <button
                            type="button"
                            onClick={() =>
                              handleDelete(
                                person
                              )
                            }
                            style={
                              deleteButtonStyle
                            }
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                )}
              </tbody>
            </table>
          </div>
        )}

      {/* ======================================================
          PAGINATION
      ====================================================== */}

      {!loading && totalPages > 1 && (
        <div style={paginationStyle}>
          <button
            type="button"
            onClick={() => setPage((current) => Math.max(1, current - 1))}
            disabled={page <= 1}
            style={{
              ...paginationButtonStyle,
              opacity: page <= 1 ? 0.45 : 1,
              cursor: page <= 1 ? "not-allowed" : "pointer",
            }}
          >
            ← Previous
          </button>

          <div style={paginationInfoStyle}>
            Page <strong>{page}</strong> of{" "}
            <strong>{totalPages}</strong>
          </div>

          <button
            type="button"
            onClick={() =>
              setPage((current) =>
                Math.min(totalPages, current + 1)
              )
            }
            disabled={page >= totalPages}
            style={{
              ...paginationButtonStyle,
              opacity: page >= totalPages ? 0.45 : 1,
              cursor:
                page >= totalPages ? "not-allowed" : "pointer",
            }}
          >
            Next →
          </button>
        </div>
      )}
    </div>
  );
};

// ============================================================
// FORM FIELD
// ============================================================

const FormField = ({
  label,
  name,
  value,
  onChange,
  placeholder,
  type = "text",
  required = false,
}) => {
  return (
    <div>
      <label style={labelStyle}>
        {label}
      </label>

      <input
        type={type}
        name={name}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        required={required}
        style={inputStyle}
      />
    </div>
  );
};

// ============================================================
// STATUS BADGE
// ============================================================

const StatusBadge = ({ status }) => {
  const statusValue =
    status || "active";

  let style = statusActiveStyle;

  if (statusValue === "inactive") {
    style = statusInactiveStyle;
  }

  if (statusValue === "archived") {
    style = statusArchivedStyle;
  }

  return (
    <span style={style}>
      {statusValue.toUpperCase()}
    </span>
  );
};

// ============================================================
// HELPERS
// ============================================================

const getInitial = (name) => {
  if (!name) {
    return "?";
  }

  return name
    .trim()
    .charAt(0)
    .toUpperCase();
};

const formatDateForInput = (date) => {
  const parsedDate = new Date(date);

  if (Number.isNaN(parsedDate.getTime())) {
    return "";
  }

  return parsedDate
    .toISOString()
    .split("T")[0];
};

// ============================================================
// STYLES
// ============================================================

const containerStyle = {
  maxWidth: "1400px",
  margin: "40px auto",
  padding: "30px",
  background: "#18181b",
  borderRadius: "12px",
  border:
    "1px solid rgba(255,255,255,0.05)",
  color: "#fafafa",
};

const headerStyle = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: "20px",
  marginBottom: "25px",
  flexWrap: "wrap",
};

const titleStyle = {
  margin: 0,
  color: "#f97316",
  fontSize: "1.8rem",
};

const subtitleStyle = {
  margin: "7px 0 0",
  color: "#a1a1aa",
  lineHeight: 1.5,
};

const primaryButtonStyle = {
  padding: "10px 18px",
  border: "none",
  borderRadius: "7px",
  background: "#f97316",
  color: "#fff",
  cursor: "pointer",
  fontWeight: "600",
};

const secondaryButtonStyle = {
  padding: "10px 18px",
  border: "none",
  borderRadius: "7px",
  background: "#3f3f46",
  color: "#fff",
  cursor: "pointer",
};

const errorStyle = {
  marginBottom: "20px",
  padding: "12px 15px",
  borderRadius: "7px",
  background:
    "rgba(239,68,68,0.12)",
  border:
    "1px solid rgba(239,68,68,0.25)",
  color: "#f87171",
};

const successStyle = {
  marginBottom: "20px",
  padding: "12px 15px",
  borderRadius: "7px",
  background:
    "rgba(16,185,129,0.12)",
  border:
    "1px solid rgba(16,185,129,0.25)",
  color: "#34d399",
};

const formCardStyle = {
  marginBottom: "25px",
  padding: "25px",
  background: "#09090b",
  borderRadius: "10px",
  border:
    "1px solid rgba(249,115,22,0.2)",
};

const formHeaderStyle = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  marginBottom: "25px",
};

const formTitleStyle = {
  margin: 0,
  color: "#fff",
  fontSize: "1.2rem",
};

const closeButtonStyle = {
  width: "34px",
  height: "34px",
  border: "none",
  borderRadius: "6px",
  background: "#27272a",
  color: "#a1a1aa",
  cursor: "pointer",
};

const formGridStyle = {
  display: "grid",
  gridTemplateColumns:
    "repeat(auto-fit, minmax(250px, 1fr))",
  gap: "18px",
};

const fullWidthStyle = {
  gridColumn: "1 / -1",
};

const labelStyle = {
  display: "block",
  marginBottom: "7px",
  color: "#a1a1aa",
  fontSize: "0.85rem",
  fontWeight: "600",
};

const inputStyle = {
  width: "100%",
  boxSizing: "border-box",
  padding: "11px 13px",
  borderRadius: "7px",
  border:
    "1px solid rgba(255,255,255,0.1)",
  background: "#18181b",
  color: "#fff",
  outline: "none",
  fontSize: "0.9rem",
};

const textareaStyle = {
  ...inputStyle,
  resize: "vertical",
  minHeight: "80px",
};

const helpTextStyle = {
  marginTop: "5px",
  color: "#71717a",
  fontSize: "0.75rem",
};

const formActionsStyle = {
  display: "flex",
  justifyContent: "flex-end",
  gap: "10px",
  marginTop: "25px",
};

const toolbarStyle = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "15px",
  marginBottom: "20px",
  flexWrap: "wrap",
};

const searchWrapperStyle = {
  position: "relative",
  flex: 1,
  minWidth: "250px",
};

const searchIconStyle = {
  position: "absolute",
  left: "12px",
  top: "50%",
  transform: "translateY(-50%)",
  color: "#71717a",
};

const searchInputStyle = {
  width: "100%",
  boxSizing: "border-box",
  padding: "11px 13px 11px 38px",
  borderRadius: "7px",
  border:
    "1px solid rgba(255,255,255,0.1)",
  background: "#09090b",
  color: "#fff",
  outline: "none",
};

const countStyle = {
  color: "#a1a1aa",
  fontSize: "0.85rem",
};

const loadingStyle = {
  padding: "60px 20px",
  textAlign: "center",
  color: "#f97316",
};

const emptyStyle = {
  padding: "70px 20px",
  textAlign: "center",
  border:
    "1px dashed rgba(255,255,255,0.1)",
  borderRadius: "10px",
};

const emptyIconStyle = {
  fontSize: "3rem",
  marginBottom: "15px",
};

const tableContainerStyle = {
  overflowX: "auto",
  borderRadius: "10px",
  border:
    "1px solid rgba(255,255,255,0.05)",
};

const tableStyle = {
  width: "100%",
  borderCollapse: "collapse",
  minWidth: "900px",
};

const tableRowStyle = {
  borderBottom:
    "1px solid rgba(255,255,255,0.08)",
};

const thStyle = {
  padding: "14px",
  textAlign: "left",
  color: "#a1a1aa",
  fontSize: "0.75rem",
  fontWeight: "700",
  whiteSpace: "nowrap",
  background: "#09090b",
};

const tdStyle = {
  padding: "14px",
  color: "#d4d4d8",
  fontSize: "0.85rem",
  verticalAlign: "middle",
};

const personCellStyle = {
  display: "flex",
  alignItems: "center",
  gap: "11px",
};

const personAvatarStyle = {
  width: "40px",
  height: "40px",
  flexShrink: 0,
  borderRadius: "50%",
  background:
    "rgba(249,115,22,0.15)",
  color: "#f97316",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontWeight: "700",
};

const personNameStyle = {
  color: "#fff",
  fontWeight: "600",
};

const secondaryTextStyle = {
  marginTop: "3px",
  color: "#71717a",
  fontSize: "0.75rem",
};

const customerIdBadgeStyle = {
  display: "inline-block",
  padding: "4px 7px",
  borderRadius: "5px",
  background:
    "rgba(249,115,22,0.1)",
  color: "#f97316",
  fontSize: "0.75rem",
  fontWeight: "600",
};

const mutedTextStyle = {
  color: "#52525b",
};

const statusActiveStyle = {
  display: "inline-block",
  padding: "4px 8px",
  borderRadius: "5px",
  background:
    "rgba(16,185,129,0.12)",
  color: "#34d399",
  fontSize: "0.7rem",
  fontWeight: "700",
};

const statusInactiveStyle = {
  display: "inline-block",
  padding: "4px 8px",
  borderRadius: "5px",
  background:
    "rgba(234,179,8,0.12)",
  color: "#facc15",
  fontSize: "0.7rem",
  fontWeight: "700",
};

const statusArchivedStyle = {
  display: "inline-block",
  padding: "4px 8px",
  borderRadius: "5px",
  background:
    "rgba(113,113,122,0.15)",
  color: "#a1a1aa",
  fontSize: "0.7rem",
  fontWeight: "700",
};

const actionsStyle = {
  display: "flex",
  justifyContent: "flex-end",
  alignItems: "center",
  gap: "7px",
  flexWrap: "wrap",
};

const treeButtonStyle = {
  padding: "7px 10px",
  border: "none",
  borderRadius: "5px",
  background:
    "rgba(249,115,22,0.15)",
  color: "#f97316",
  cursor: "pointer",
  fontSize: "0.75rem",
  fontWeight: "600",
};

const editButtonStyle = {
  padding: "7px 10px",
  border: "none",
  borderRadius: "5px",
  background: "#3f3f46",
  color: "#fff",
  cursor: "pointer",
  fontSize: "0.75rem",
};

const deleteButtonStyle = {
  padding: "7px 10px",
  border: "none",
  borderRadius: "5px",
  background:
    "rgba(239,68,68,0.12)",
  color: "#f87171",
  cursor: "pointer",
  fontSize: "0.75rem",
};

export default People;
