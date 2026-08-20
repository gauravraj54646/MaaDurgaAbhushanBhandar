import React, {
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  useNavigate,
  useParams,
} from "react-router-dom";
import { AuthContext } from "../context/AuthContext";

const relationshipOptions = [
  { value: "parent_child", label: "Parent / Child", role1: "Parent", role2: "Child" },
  { value: "spouse", label: "Spouse", role1: "Spouse", role2: "Spouse" },
  { value: "sibling", label: "Sibling", role1: "Sibling", role2: "Sibling" },
  { value: "guardian_dependent", label: "Guardian / Dependent", role1: "Guardian", role2: "Dependent" },
  { value: "friend", label: "Friend", role1: "Friend", role2: "Friend" },
  { value: "business_partner", label: "Business Partner", role1: "Business Partner", role2: "Business Partner" },
  { value: "other", label: "Other", role1: "Related Person", role2: "Related Person" },
];

const FamilyTree = () => {
  const { user } = useContext(AuthContext);
  const navigate = useNavigate();
  const { personId } = useParams();

  const [tree, setTree] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [people, setPeople] = useState([]);
  const [selectedPersonId, setSelectedPersonId] =
    useState(personId || "");

  const [showRelationshipModal, setShowRelationshipModal] =
    useState(false);
  const [relationshipForm, setRelationshipForm] = useState({
    person1: personId || "",
    person2: "",
    relationshipType: "sibling",
    person1Role: "Sibling",
    person2Role: "Sibling",
  });
  const [savingRelationship, setSavingRelationship] = useState(false);
  const [relationshipError, setRelationshipError] = useState("");

  // ============================================================
  // ADMIN PROTECTION
  // ============================================================

  useEffect(() => {
    if (!user || user.role !== "admin") {
      navigate("/");
    }
  }, [user, navigate]);

  // ============================================================
  // LOAD PEOPLE FOR PERSON SELECTOR
  // ============================================================

  useEffect(() => {
    if (!user || user.role !== "admin") {
      return;
    }

    const loadPeople = async () => {
      try {
        const response = await fetch("/api/people", {
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

        setPeople(Array.isArray(data) ? data : []);
      } catch (err) {
        console.error(err);
        setError(
          err.message || "Failed to load people"
        );
      }
    };

    loadPeople();
  }, [user, navigate]);

  // ============================================================
  // LOAD FAMILY TREE
  // ============================================================

  useEffect(() => {
    if (!user || user.role !== "admin") {
      return;
    }

    if (!selectedPersonId) {
      setTree(null);
      setLoading(false);
      return;
    }

    fetchFamilyTree(selectedPersonId);
  }, [user, selectedPersonId]);

  const fetchFamilyTree = async (id) => {
    try {
      setLoading(true);
      setError("");

      const response = await fetch(
        `/api/relationships/tree/${id}`,
        {
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
          data.message || "Failed to load family tree"
        );
      }

      setTree(data);
    } catch (err) {
      console.error(err);
      setTree(null);
      setError(
        err.message || "Failed to load family tree"
      );
    } finally {
      setLoading(false);
    }
  };

  // ============================================================
  // CHANGE ROOT PERSON
  // ============================================================

  const handlePersonChange = (event) => {
    const id = event.target.value;

    if (!id) {
      setSelectedPersonId("");
      navigate("/admin/family-tree");
      return;
    }

    setSelectedPersonId(id);
    navigate(`/admin/family-tree/${id}`);
  };

  // ============================================================
  // OPEN ANOTHER PERSON'S TREE
  // ============================================================

  const openPersonTree = (person) => {
    if (!person?._id) {
      return;
    }

    setSelectedPersonId(person._id);
    navigate(`/admin/family-tree/${person._id}`);
  };

  // ============================================================
  // SORT PEOPLE
  // ============================================================

  const sortedPeople = useMemo(() => {
    return [...people].sort((a, b) =>
      (a.name || "").localeCompare(b.name || "")
    );
  }, [people]);

  const handleRelationshipChange = (event) => {
    const { name, value } = event.target;
    setRelationshipForm((prev) => ({ ...prev, [name]: value }));
    setRelationshipError("");
  };

  const handleRelationshipTypeChange = (event) => {
    const value = event.target.value;
    const selected = relationshipOptions.find((item) => item.value === value);
    setRelationshipForm((prev) => ({
      ...prev,
      relationshipType: value,
      person1Role: selected?.role1 || "",
      person2Role: selected?.role2 || "",
    }));
    setRelationshipError("");
  };

  const createRelationship = async () => {
    setRelationshipError("");
    const { person1, person2, relationshipType, person1Role, person2Role } = relationshipForm;

    if (!person1) return setRelationshipError("Please select Person 1.");
    if (!person2) return setRelationshipError("Please select Person 2.");
    if (person1 === person2) return setRelationshipError("Person 1 and Person 2 cannot be the same person.");
    if (!relationshipType) return setRelationshipError("Please select a relationship.");

    try {
      setSavingRelationship(true);
      const response = await fetch("/api/relationships", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${user.token}`,
        },
        body: JSON.stringify({
          person1,
          person2,
          relationshipType,
          person1Role,
          person2Role,
        }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Failed to create relationship");

      setShowRelationshipModal(false);
      setRelationshipForm({
        person1: selectedPersonId || "",
        person2: "",
        relationshipType: "sibling",
        person1Role: "Sibling",
        person2Role: "Sibling",
      });

      if (selectedPersonId) await fetchFamilyTree(selectedPersonId);
    } catch (err) {
      console.error(err);
      setRelationshipError(err.message || "Failed to create relationship");
    } finally {
      setSavingRelationship(false);
    }
  };

  // ============================================================
  // ACCESS PROTECTION
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
          <h2 style={titleStyle}>Family Tree</h2>

          <p style={subtitleStyle}>
            Explore family relationships for a person.
          </p>
        </div>

        <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
          <button
            type="button"
            onClick={() => {
              setRelationshipError("");
              setRelationshipForm({
                person1: selectedPersonId || "",
                person2: "",
                relationshipType: "sibling",
                person1Role: "Sibling",
                person2Role: "Sibling",
              });
              setShowRelationshipModal(true);
            }}
            style={primaryButtonStyle}
          >
            + Relationship
          </button>

          <button
            type="button"
            onClick={() => navigate("/admin/people")}
            style={secondaryButtonStyle}
          >
            ← People Directory
          </button>
        </div>
      </div>

      {/* ======================================================
          PERSON SELECTOR
      ====================================================== */}

      <div style={selectorCardStyle}>
        <div style={{ flex: 1 }}>
          <label style={labelStyle}>
            Select Person
          </label>

          <select
            value={selectedPersonId}
            onChange={handlePersonChange}
            style={selectStyle}
          >
            <option value="">
              -- Select a person --
            </option>

            {sortedPeople.map((person) => (
              <option
                key={person._id}
                value={person._id}
              >
                {person.name}
                {person.customerId
                  ? ` — ${person.customerId}`
                  : ""}
              </option>
            ))}
          </select>
        </div>

        {tree?.root && (
          <div style={selectedPersonMiniStyle}>
            <div style={miniAvatarStyle}>
              {getInitial(tree.root.name)}
            </div>

            <div>
              <div style={miniNameStyle}>
                {tree.root.name}
              </div>

              {tree.root.customerId && (
                <div style={smallTextStyle}>
                  {tree.root.customerId}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ======================================================
          ERROR
      ====================================================== */}

      {error && (
        <div style={errorStyle}>
          <strong>Error:</strong> {error}
        </div>
      )}

      {/* ======================================================
          NO PERSON SELECTED
      ====================================================== */}

      {!selectedPersonId && !loading && (
        <div style={emptyStyle}>
          <div style={emptyIconStyle}>🌳</div>

          <h3 style={{ margin: "0 0 8px" }}>
            Select a person
          </h3>

          <p style={subtitleStyle}>
            Choose a person above to view their family
            tree.
          </p>
        </div>
      )}

      {/* ======================================================
          LOADING
      ====================================================== */}

      {loading && (
        <div style={loadingStyle}>
          <div style={loadingIconStyle}>🌳</div>
          <div>Loading family tree...</div>
        </div>
      )}

      {/* ======================================================
          FAMILY TREE
      ====================================================== */}

      {!loading && tree && (
        <>
          {/* ROOT PERSON */}

          <section style={rootSectionStyle}>
            <div style={sectionLabelStyle}>
              CURRENT PERSON
            </div>

            <PersonCard
              person={tree.root}
              root
              onOpen={openPersonTree}
            />
          </section>

          {/* RELATIONSHIP SUMMARY */}

          <div style={summaryGridStyle}>
            <SummaryCard
              icon="👨‍👩‍👧"
              label="Parents"
              count={tree.parents?.length || 0}
            />

            <SummaryCard
              icon="💍"
              label="Spouse"
              count={tree.spouse?.length || 0}
            />

            <SummaryCard
              icon="👫"
              label="Siblings"
              count={tree.siblings?.length || 0}
            />

            <SummaryCard
              icon="👶"
              label="Children"
              count={tree.children?.length || 0}
            />

            <SummaryCard
              icon="🛡️"
              label="Guardians"
              count={tree.guardians?.length || 0}
            />

            <SummaryCard
              icon="🏠"
              label="Dependents"
              count={tree.dependents?.length || 0}
            />
          </div>

          {/* FAMILY SECTIONS */}

          <FamilySection
            title="Parents"
            icon="👨‍👩‍👧"
            people={tree.parents}
            emptyMessage="No parents have been added."
            onOpen={openPersonTree}
          />

          <FamilySection
            title="Spouse"
            icon="💍"
            people={tree.spouse}
            emptyMessage="No spouse relationship has been added."
            onOpen={openPersonTree}
          />

          <FamilySection
            title="Siblings"
            icon="👫"
            people={tree.siblings}
            emptyMessage="No sibling relationships have been added."
            onOpen={openPersonTree}
          />

          <FamilySection
            title="Children"
            icon="👶"
            people={tree.children}
            emptyMessage="No children have been added."
            onOpen={openPersonTree}
          />

          <FamilySection
            title="Guardians"
            icon="🛡️"
            people={tree.guardians}
            emptyMessage="No guardians have been added."
            onOpen={openPersonTree}
          />

          <FamilySection
            title="Dependents"
            icon="🏠"
            people={tree.dependents}
            emptyMessage="No dependents have been added."
            onOpen={openPersonTree}
          />

          <FamilySection
            title="Other Relationships"
            icon="🔗"
            people={tree.other}
            emptyMessage="No other relationships have been added."
            onOpen={openPersonTree}
          />

          {/* RAW RELATIONSHIPS */}

          <RelationshipList
            relationships={tree.relationships}
          />
        </>
      )}

      {showRelationshipModal && (
        <div style={modalOverlayStyle}>
          <div style={modalStyle}>
            <div style={modalHeaderStyle}>
              <div>
                <h3 style={{ margin: 0, color: "#fff" }}>Add Relationship</h3>
                <p style={{ margin: "5px 0 0", color: "#71717a", fontSize: "0.85rem" }}>
                  Connect two existing people
                </p>
              </div>
              <button type="button" onClick={() => setShowRelationshipModal(false)} style={closeButtonStyle}>×</button>
            </div>

            {relationshipError && <div style={modalErrorStyle}>{relationshipError}</div>}

            <div style={modalFieldStyle}>
              <label style={labelStyle}>Person 1</label>
              <select name="person1" value={relationshipForm.person1} onChange={handleRelationshipChange} style={selectStyle}>
                <option value="">-- Select Person 1 --</option>
                {sortedPeople.map((person) => (
                  <option key={person._id} value={person._id}>
                    {person.name}{person.customerId ? ` — ${person.customerId}` : ""}
                  </option>
                ))}
              </select>
            </div>

            <div style={modalFieldStyle}>
              <label style={labelStyle}>Relationship</label>
              <select value={relationshipForm.relationshipType} onChange={handleRelationshipTypeChange} style={selectStyle}>
                <option value="">-- Select Relationship --</option>
                {relationshipOptions.map((item) => (
                  <option key={item.value} value={item.value}>{item.label}</option>
                ))}
              </select>
            </div>

            <div style={modalFieldStyle}>
              <label style={labelStyle}>Person 2</label>
              <select name="person2" value={relationshipForm.person2} onChange={handleRelationshipChange} style={selectStyle}>
                <option value="">-- Select Person 2 --</option>
                {sortedPeople.map((person) => (
                  <option key={person._id} value={person._id}>
                    {person.name}{person.customerId ? ` — ${person.customerId}` : ""}
                  </option>
                ))}
              </select>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
              <div>
                <label style={labelStyle}>Person 1 Role</label>
                <input type="text" value={relationshipForm.person1Role} readOnly style={{ ...inputStyle, opacity: 0.7 }} />
              </div>
              <div>
                <label style={labelStyle}>Person 2 Role</label>
                <input type="text" value={relationshipForm.person2Role} readOnly style={{ ...inputStyle, opacity: 0.7 }} />
              </div>
            </div>

            <div style={modalActionsStyle}>
              <button type="button" onClick={() => setShowRelationshipModal(false)} style={secondaryButtonStyle} disabled={savingRelationship}>Cancel</button>
              <button type="button" onClick={createRelationship} style={primaryButtonStyle} disabled={savingRelationship}>
                {savingRelationship ? "Saving..." : "Create Relationship"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ============================================================
// PERSON CARD
// ============================================================

const PersonCard = ({
  person,
  root = false,
  onOpen,
}) => {
  if (!person) {
    return null;
  }

  return (
    <div
      style={{
        ...personCardStyle,
        ...(root ? rootPersonCardStyle : {}),
      }}
    >
      <div
        style={{
          ...personAvatarStyle,
          ...(root ? rootAvatarStyle : {}),
        }}
      >
        {getInitial(person.name)}
      </div>

      <div style={personInfoStyle}>
        <div style={personNameStyle}>
          {person.name || "Unnamed Person"}
        </div>

        {person.customerId && (
          <div style={customerIdStyle}>
            Customer ID: {person.customerId}
          </div>
        )}

        <div style={personDetailsStyle}>
          {person.phone && (
            <span>📞 {person.phone}</span>
          )}

          {person.email && (
            <span>✉️ {person.email}</span>
          )}

          {person.gender && (
            <span>
              {formatGender(person.gender)}
            </span>
          )}
        </div>
      </div>

      {!root && onOpen && (
        <button
          type="button"
          onClick={() => onOpen(person)}
          style={viewTreeButtonStyle}
        >
          View Tree
        </button>
      )}
    </div>
  );
};

// ============================================================
// FAMILY SECTION
// ============================================================

const FamilySection = ({
  title,
  icon,
  people,
  emptyMessage,
  onOpen,
}) => {
  const items = Array.isArray(people)
    ? people
    : [];

  return (
    <section style={familySectionStyle}>
      <div style={familySectionHeaderStyle}>
        <h3 style={familySectionTitleStyle}>
          <span>{icon}</span>
          {title}
        </h3>

        <span style={sectionCountStyle}>
          {items.length}
        </span>
      </div>

      {items.length === 0 ? (
        <div style={sectionEmptyStyle}>
          {emptyMessage}
        </div>
      ) : (
        <div style={cardsGridStyle}>
          {items.map((item) => (
            <div
              key={
                item.relationshipId ||
                item.person?._id
              }
              style={relationshipCardWrapperStyle}
            >
              <div style={roleBadgeStyle}>
                {formatRole(item.role)}
              </div>

              <PersonCard
                person={item.person}
                onOpen={onOpen}
              />
            </div>
          ))}
        </div>
      )}
    </section>
  );
};

// ============================================================
// SUMMARY CARD
// ============================================================

const SummaryCard = ({
  icon,
  label,
  count,
}) => {
  return (
    <div style={summaryCardStyle}>
      <div style={summaryIconStyle}>
        {icon}
      </div>

      <div>
        <div style={summaryCountStyle}>
          {count}
        </div>

        <div style={summaryLabelStyle}>
          {label}
        </div>
      </div>
    </div>
  );
};

// ============================================================
// RELATIONSHIP LIST
// ============================================================

const RelationshipList = ({
  relationships,
}) => {
  const items = Array.isArray(relationships)
    ? relationships
    : [];

  return (
    <section style={relationshipListStyle}>
      <div style={familySectionHeaderStyle}>
        <h3 style={familySectionTitleStyle}>
          <span>🔗</span>
          All Relationships
        </h3>

        <span style={sectionCountStyle}>
          {items.length}
        </span>
      </div>

      {items.length === 0 ? (
        <div style={sectionEmptyStyle}>
          No relationships have been added yet.
        </div>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table style={tableStyle}>
            <thead>
              <tr style={tableRowStyle}>
                <th style={thStyle}>
                  PERSON 1
                </th>

                <th style={thStyle}>
                  RELATIONSHIP
                </th>

                <th style={thStyle}>
                  PERSON 2
                </th>

                <th style={thStyle}>
                  ROLES
                </th>
              </tr>
            </thead>

            <tbody>
              {items.map((relationship) => (
                <tr
                  key={relationship._id}
                  style={tableRowStyle}
                >
                  <td style={tdStyle}>
                    {relationship.person1?.name ||
                      "—"}
                  </td>

                  <td style={tdStyle}>
                    <span style={relationshipTypeBadge}>
                      {formatRelationshipType(
                        relationship.relationshipType
                      )}
                    </span>
                  </td>

                  <td style={tdStyle}>
                    {relationship.person2?.name ||
                      "—"}
                  </td>

                  <td style={tdStyle}>
                    <span style={roleTextStyle}>
                      {relationship.person1Role ||
                        "—"}
                    </span>

                    {" ↔ "}

                    <span style={roleTextStyle}>
                      {relationship.person2Role ||
                        "—"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
};

// ============================================================
// HELPERS
// ============================================================

const getInitial = (name) => {
  if (!name) {
    return "?";
  }

  return name.trim().charAt(0).toUpperCase();
};

const formatGender = (gender) => {
  if (!gender) {
    return "";
  }

  if (gender === "prefer_not_to_say") {
    return "Not specified";
  }

  return (
    gender.charAt(0).toUpperCase() +
    gender.slice(1)
  );
};

const formatRole = (role) => {
  if (!role) {
    return "Relationship";
  }

  return role
    .replace(/_/g, " ")
    .replace(/\b\w/g, (letter) =>
      letter.toUpperCase()
    );
};

const formatRelationshipType = (type) => {
  if (!type) {
    return "Relationship";
  }

  return type
    .replace(/_/g, " ")
    .replace(/\b\w/g, (letter) =>
      letter.toUpperCase()
    );
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
  border: "1px solid rgba(255,255,255,0.05)",
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
  color: "#f97316",
  margin: 0,
  fontSize: "1.8rem",
};

const subtitleStyle = {
  color: "#a1a1aa",
  margin: "7px 0 0",
  lineHeight: 1.5,
};

const secondaryButtonStyle = {
  padding: "10px 18px",
  border: "none",
  borderRadius: "7px",
  background: "#3f3f46",
  color: "#fff",
  cursor: "pointer",
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

const modalOverlayStyle = {
  position: "fixed",
  inset: 0,
  zIndex: 9999,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "20px",
  background: "rgba(0, 0, 0, 0.72)",
};

const modalStyle = {
  width: "min(560px, 100%)",
  maxHeight: "90vh",
  overflowY: "auto",
  padding: "24px",
  boxSizing: "border-box",
  background: "#18181b",
  border: "1px solid rgba(255,255,255,0.1)",
  borderRadius: "12px",
  boxShadow: "0 20px 60px rgba(0,0,0,0.5)",
};

const modalHeaderStyle = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  marginBottom: "22px",
};

const closeButtonStyle = {
  width: "32px",
  height: "32px",
  border: "none",
  borderRadius: "6px",
  background: "#27272a",
  color: "#a1a1aa",
  fontSize: "22px",
  cursor: "pointer",
};

const modalFieldStyle = { marginBottom: "16px" };

const modalActionsStyle = {
  display: "flex",
  justifyContent: "flex-end",
  gap: "10px",
  marginTop: "24px",
};

const modalErrorStyle = {
  marginBottom: "16px",
  padding: "10px 12px",
  borderRadius: "6px",
  background: "rgba(239,68,68,0.12)",
  border: "1px solid rgba(239,68,68,0.25)",
  color: "#f87171",
  fontSize: "0.85rem",
};

const inputStyle = {
  width: "100%",
  boxSizing: "border-box",
  padding: "11px 13px",
  borderRadius: "7px",
  border: "1px solid rgba(255,255,255,0.1)",
  background: "#09090b",
  color: "#fff",
  outline: "none",
  fontSize: "0.95rem",
};

const selectorCardStyle = {
  display: "flex",
  alignItems: "flex-end",
  gap: "25px",
  padding: "20px",
  marginBottom: "25px",
  background: "#09090b",
  border: "1px solid rgba(255,255,255,0.08)",
  borderRadius: "10px",
  flexWrap: "wrap",
};

const labelStyle = {
  display: "block",
  marginBottom: "7px",
  color: "#a1a1aa",
  fontSize: "0.9rem",
  fontWeight: "600",
};

const selectStyle = {
  width: "100%",
  minWidth: "280px",
  boxSizing: "border-box",
  padding: "11px 13px",
  borderRadius: "7px",
  border: "1px solid rgba(255,255,255,0.1)",
  background: "#18181b",
  color: "#fff",
  outline: "none",
  fontSize: "0.95rem",
};

const selectedPersonMiniStyle = {
  display: "flex",
  alignItems: "center",
  gap: "10px",
  padding: "8px 12px",
  borderRadius: "8px",
  background: "#18181b",
  border: "1px solid rgba(249,115,22,0.2)",
};

const miniAvatarStyle = {
  width: "36px",
  height: "36px",
  borderRadius: "50%",
  background: "rgba(249,115,22,0.15)",
  color: "#f97316",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontWeight: "700",
};

const miniNameStyle = {
  color: "#fff",
  fontWeight: "600",
};

const smallTextStyle = {
  marginTop: "3px",
  color: "#71717a",
  fontSize: "0.8rem",
};

const rootSectionStyle = {
  padding: "25px",
  marginBottom: "25px",
  background:
    "linear-gradient(145deg, #18181b, #09090b)",
  borderRadius: "12px",
  border: "1px solid rgba(249,115,22,0.25)",
};

const sectionLabelStyle = {
  marginBottom: "12px",
  color: "#f97316",
  fontSize: "0.75rem",
  fontWeight: "700",
  letterSpacing: "1px",
};

const personCardStyle = {
  display: "flex",
  alignItems: "center",
  gap: "15px",
  padding: "16px",
  background: "#18181b",
  border: "1px solid rgba(255,255,255,0.08)",
  borderRadius: "10px",
  minWidth: 0,
};

const rootPersonCardStyle = {
  background: "rgba(249,115,22,0.06)",
  border: "1px solid rgba(249,115,22,0.2)",
};

const personAvatarStyle = {
  width: "48px",
  height: "48px",
  borderRadius: "50%",
  background: "rgba(255,255,255,0.06)",
  color: "#d4d4d8",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontSize: "1.1rem",
  fontWeight: "700",
  flexShrink: 0,
};

const rootAvatarStyle = {
  width: "60px",
  height: "60px",
  background: "rgba(249,115,22,0.15)",
  color: "#f97316",
  fontSize: "1.4rem",
};

const personInfoStyle = {
  minWidth: 0,
  flex: 1,
};

const personNameStyle = {
  color: "#fff",
  fontSize: "1rem",
  fontWeight: "700",
};

const customerIdStyle = {
  marginTop: "3px",
  color: "#f97316",
  fontSize: "0.8rem",
};

const personDetailsStyle = {
  display: "flex",
  gap: "12px",
  flexWrap: "wrap",
  marginTop: "7px",
  color: "#a1a1aa",
  fontSize: "0.8rem",
};

const viewTreeButtonStyle = {
  padding: "7px 10px",
  border: "none",
  borderRadius: "6px",
  background: "rgba(249,115,22,0.15)",
  color: "#f97316",
  cursor: "pointer",
  fontSize: "0.8rem",
  fontWeight: "600",
  whiteSpace: "nowrap",
};

const summaryGridStyle = {
  display: "grid",
  gridTemplateColumns:
    "repeat(auto-fit, minmax(150px, 1fr))",
  gap: "15px",
  marginBottom: "30px",
};

const summaryCardStyle = {
  display: "flex",
  alignItems: "center",
  gap: "12px",
  padding: "16px",
  background: "#18181b",
  border: "1px solid rgba(255,255,255,0.05)",
  borderRadius: "9px",
};

const summaryIconStyle = {
  fontSize: "1.5rem",
};

const summaryCountStyle = {
  color: "#fff",
  fontSize: "1.4rem",
  fontWeight: "700",
};

const summaryLabelStyle = {
  color: "#a1a1aa",
  fontSize: "0.8rem",
};

const familySectionStyle = {
  marginBottom: "25px",
  padding: "20px",
  background: "#09090b",
  border: "1px solid rgba(255,255,255,0.05)",
  borderRadius: "10px",
};

const familySectionHeaderStyle = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: "15px",
  marginBottom: "15px",
};

const familySectionTitleStyle = {
  display: "flex",
  alignItems: "center",
  gap: "9px",
  margin: 0,
  color: "#f97316",
  fontSize: "1.05rem",
};

const sectionCountStyle = {
  minWidth: "25px",
  height: "25px",
  padding: "0 7px",
  borderRadius: "20px",
  background: "rgba(249,115,22,0.15)",
  color: "#f97316",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontSize: "0.8rem",
  fontWeight: "700",
};

const cardsGridStyle = {
  display: "grid",
  gridTemplateColumns:
    "repeat(auto-fit, minmax(300px, 1fr))",
  gap: "12px",
};

const relationshipCardWrapperStyle = {
  position: "relative",
  paddingTop: "8px",
};

const roleBadgeStyle = {
  position: "absolute",
  top: 0,
  left: "14px",
  zIndex: 1,
  padding: "3px 8px",
  borderRadius: "5px",
  background: "#27272a",
  color: "#a1a1aa",
  border: "1px solid rgba(255,255,255,0.08)",
  fontSize: "0.7rem",
};

const sectionEmptyStyle = {
  padding: "20px",
  textAlign: "center",
  color: "#71717a",
  border: "1px dashed rgba(255,255,255,0.08)",
  borderRadius: "8px",
};

const relationshipListStyle = {
  marginBottom: "25px",
  padding: "20px",
  background: "#09090b",
  border: "1px solid rgba(255,255,255,0.05)",
  borderRadius: "10px",
};

const tableStyle = {
  width: "100%",
  borderCollapse: "collapse",
};

const tableRowStyle = {
  borderBottom:
    "1px solid rgba(255,255,255,0.08)",
};

const thStyle = {
  padding: "12px",
  textAlign: "left",
  color: "#a1a1aa",
  fontSize: "0.8rem",
  whiteSpace: "nowrap",
};

const tdStyle = {
  padding: "12px",
  color: "#d4d4d8",
  fontSize: "0.9rem",
};

const relationshipTypeBadge = {
  display: "inline-block",
  padding: "4px 8px",
  borderRadius: "5px",
  background: "rgba(249,115,22,0.12)",
  color: "#f97316",
  fontSize: "0.75rem",
  fontWeight: "600",
};

const roleTextStyle = {
  color: "#a1a1aa",
};

const loadingStyle = {
  textAlign: "center",
  padding: "70px 20px",
  color: "#f97316",
};

const loadingIconStyle = {
  fontSize: "2.5rem",
  marginBottom: "10px",
};

const emptyStyle = {
  textAlign: "center",
  padding: "80px 20px",
  border:
    "1px dashed rgba(255,255,255,0.1)",
  borderRadius: "10px",
};

const emptyIconStyle = {
  fontSize: "3.5rem",
  marginBottom: "15px",
};

const errorStyle = {
  marginBottom: "20px",
  padding: "12px 15px",
  borderRadius: "7px",
  background: "rgba(239,68,68,0.12)",
  border:
    "1px solid rgba(239,68,68,0.25)",
  color: "#f87171",
};

export default FamilyTree;
