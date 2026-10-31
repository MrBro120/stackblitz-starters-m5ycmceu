"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import AdminRequestsLink from "@/components/AdminRequestsLink";
import { supabase } from "@/lib/supabase";

type Property = {
  id: string;
  landlord_id: string;
  title: string;
  location: string;
  property_type: string;
  monthly_rent: number | string;
  bedrooms: number | null;
  description: string | null;
  status: string;
  rejection_reason: string | null;
  created_at: string;
};

type Landlord = {
  id: string;
  full_name: string | null;
  phone: string | null;
};

export default function AdminPropertiesPage() {
  const [loading, setLoading] = useState(true);
  const [properties, setProperties] = useState<Property[]>([]);
  const [landlords, setLandlords] = useState<Record<string, Landlord>>({});
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [selectedProperty, setSelectedProperty] =
    useState<Property | null>(null);

  const [message, setMessage] = useState("");
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    verifyAdmin();
  }, []);

  async function verifyAdmin() {
    setLoading(true);

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setIsAdmin(false);
        setLoading(false);
        return;
      }

      const { data: profile, error } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .maybeSingle();

      if (error) {
        console.error("Admin verification error:", error);
        setIsAdmin(false);
        setLoading(false);
        return;
      }

      if (profile?.role !== "admin") {
        setIsAdmin(false);
        setLoading(false);
        return;
      }

      setIsAdmin(true);
      await loadProperties();
    } catch (error) {
      console.error(error);
      setIsAdmin(false);
    }

    setLoading(false);
  }

  async function loadProperties() {
    setMessage("");

    const { data, error } = await supabase
      .from("properties")
      .select(
        "id, landlord_id, title, location, property_type, monthly_rent, bedrooms, description, status, rejection_reason, created_at"
      )
      .order("created_at", { ascending: false });

    if (error) {
      console.error(error);
      setMessage(error.message);
      return;
    }

    const propertyList = (data || []) as Property[];

    setProperties(propertyList);

    const landlordIds = Array.from(
      new Set(propertyList.map((property) => property.landlord_id))
    );

    if (landlordIds.length === 0) {
      setLandlords({});
      return;
    }

    const { data: landlordData, error: landlordError } = await supabase
      .from("profiles")
      .select("id, full_name, phone")
      .in("id", landlordIds);

    if (landlordError) {
      console.error(landlordError);
      return;
    }

    const landlordMap: Record<string, Landlord> = {};

    (landlordData || []).forEach((landlord) => {
      landlordMap[landlord.id] = landlord;
    });

    setLandlords(landlordMap);
  }

  async function approveProperty(property: Property) {
    if (actionLoading) return;

    setActionLoading(true);
    setMessage("");

    const { error } = await supabase
      .from("properties")
      .update({
        status: "Approved",
        rejection_reason: null,
      })
      .eq("id", property.id);

    if (error) {
      setMessage(`Could not approve property: ${error.message}`);
      setActionLoading(false);
      return;
    }

    setMessage("Property approved successfully.");
    setSelectedProperty(null);

    await loadProperties();

    setActionLoading(false);
  }

  async function rejectProperty(property: Property) {
    if (actionLoading) return;

    const reason = window.prompt(
      "Enter the reason for rejecting this property:"
    );

    if (reason === null) return;

    if (!reason.trim()) {
      window.alert("Please enter a rejection reason.");
      return;
    }

    setActionLoading(true);
    setMessage("");

    const { error } = await supabase
      .from("properties")
      .update({
        status: "Rejected",
        rejection_reason: reason.trim(),
      })
      .eq("id", property.id);

    if (error) {
      setMessage(`Could not reject property: ${error.message}`);
      setActionLoading(false);
      return;
    }

    setMessage("Property rejected successfully.");
    setSelectedProperty(null);

    await loadProperties();

    setActionLoading(false);
  }

  async function sendToPending(property: Property) {
    if (actionLoading) return;

    if (
      !window.confirm(
        "Send this property back to Pending Verification?"
      )
    ) {
      return;
    }

    setActionLoading(true);
    setMessage("");

    const { error } = await supabase
      .from("properties")
      .update({
        status: "Pending Verification",
        rejection_reason: null,
      })
      .eq("id", property.id);

    if (error) {
      setMessage(`Could not update property: ${error.message}`);
      setActionLoading(false);
      return;
    }

    setMessage("Property returned to Pending Verification.");
    setSelectedProperty(null);

    await loadProperties();

    setActionLoading(false);
  }

  async function deleteProperty(property: Property) {
    if (actionLoading) return;

    const confirmed = window.confirm(
      `Delete "${property.title}"?\n\nOnly do this for fraudulent, duplicate, or invalid listings.`
    );

    if (!confirmed) return;

    setActionLoading(true);
    setMessage("");

    const { error } = await supabase
      .from("properties")
      .delete()
      .eq("id", property.id);

    if (error) {
      setMessage(`Could not delete property: ${error.message}`);
      setActionLoading(false);
      return;
    }

    setMessage("Property deleted successfully.");
    setSelectedProperty(null);

    await loadProperties();

    setActionLoading(false);
  }

  function formatRent(value: number | string) {
    const number = Number(value);

    if (Number.isNaN(number)) return String(value);

    return new Intl.NumberFormat("en-UG").format(number);
  }

  function formatDate(value: string) {
    return new Date(value).toLocaleString("en-UG", {
      dateStyle: "medium",
      timeStyle: "short",
    });
  }

  const filteredProperties = useMemo(() => {
    const query = search.trim().toLowerCase();

    return properties.filter((property) => {
      const landlord = landlords[property.landlord_id];

      const matchesSearch =
        !query ||
        property.title.toLowerCase().includes(query) ||
        property.location.toLowerCase().includes(query) ||
        property.property_type.toLowerCase().includes(query) ||
        (landlord?.full_name || "").toLowerCase().includes(query) ||
        (landlord?.phone || "").toLowerCase().includes(query);

      const matchesStatus =
        statusFilter === "All" ||
        property.status === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [properties, landlords, search, statusFilter]);

  const total = properties.length;

  const pending = properties.filter(
    (p) => p.status === "Pending Verification"
  ).length;

  const approved = properties.filter(
    (p) => p.status === "Approved"
  ).length;

  const rejected = properties.filter(
    (p) => p.status === "Rejected"
  ).length;

  if (loading || isAdmin === null) {
    return (
      <main style={pageStyle}>
        <div style={centerBox}>
          <h2>Checking admin access...</h2>
        </div>
      </main>
    );
  }

  if (!isAdmin) {
    return (
      <main style={pageStyle}>
        <div style={centerBox}>
          <div style={{ fontSize: 45 }}>🔒</div>

          <h1>Admin Access Required</h1>

          <p style={{ color: "#64748b" }}>
            You must be signed in with an administrator account
            to access property management.
          </p>

          <Link href="/ceo" style={darkButton}>
            Go to CEO Dashboard
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main style={pageStyle}>
      <header
        style={{
          background: "#0f172a",
          color: "#fff",
          padding: "18px 20px",
        }}
      >
        <div
          style={{
            maxWidth: 1250,
            margin: "auto",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 15,
            flexWrap: "wrap",
          }}
        >
          <div>
            <div
              style={{
                fontSize: 12,
                letterSpacing: 2,
                opacity: 0.7,
                fontWeight: 700,
              }}
            >
              HOUSE CONNECT
            </div>

            <h1 style={{ margin: "5px 0 0" }}>
              Property Management
            </h1>
          </div>

          <div style={{ display: "flex", gap: 10 }}>
            <AdminRequestsLink />

            <Link href="/ceo" style={navButton}>
              Dashboard
            </Link>

            <Link href="/ceo/users" style={navButton}>
              Users
            </Link>
          </div>
        </div>
      </header>

      <div
        style={{
          maxWidth: 1250,
          margin: "auto",
          padding: "25px 18px 50px",
        }}
      >
        {message && (
          <div
            style={{
              background: "#e0f2fe",
              color: "#075985",
              padding: 13,
              borderRadius: 10,
              marginBottom: 20,
            }}
          >
            {message}
          </div>
        )}

        <div style={statsGrid}>
          <Stat title="Total Properties" value={total} />
          <Stat title="Pending" value={pending} />
          <Stat title="Approved" value={approved} />
          <Stat title="Rejected" value={rejected} />
        </div>

        <section style={panel}>
          <div
            style={{
              display: "grid",
              gridTemplateColumns:
                "minmax(200px, 1fr) 220px auto",
              gap: 12,
            }}
          >
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search property, location, landlord..."
              style={inputStyle}
            />

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              style={inputStyle}
            >
              <option value="All">All Statuses</option>
              <option value="Pending Verification">
                Pending Verification
              </option>
              <option value="Approved">Approved</option>
              <option value="Rejected">Rejected</option>
            </select>

            <button
              onClick={loadProperties}
              style={darkButton}
            >
              Refresh
            </button>
          </div>
        </section>

        {filteredProperties.length === 0 ? (
          <div style={emptyBox}>
            <div style={{ fontSize: 45 }}>🏠</div>
            <h2>No properties found</h2>
            <p style={{ color: "#64748b" }}>
              There are no properties matching the current filter.
            </p>
          </div>
        ) : (
          <div style={cardGrid}>
            {filteredProperties.map((property) => {
              const landlord = landlords[property.landlord_id];

              return (
                <article key={property.id} style={propertyCard}>
                  <div
                    style={{
                      height: 7,
                      background:
                        property.status === "Approved"
                          ? "#16a34a"
                          : property.status === "Rejected"
                          ? "#dc2626"
                          : "#f59e0b",
                    }}
                  />

                  <div style={{ padding: 20 }}>
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        gap: 10,
                      }}
                    >
                      <h2 style={{ margin: 0 }}>
                        {property.title}
                      </h2>

                      <span
                        style={{
                          padding: "5px 8px",
                          borderRadius: 15,
                          fontSize: 11,
                          fontWeight: 700,
                          background:
                            property.status === "Approved"
                              ? "#dcfce7"
                              : property.status === "Rejected"
                              ? "#fee2e2"
                              : "#fef3c7",
                          color:
                            property.status === "Approved"
                              ? "#166534"
                              : property.status === "Rejected"
                              ? "#991b1b"
                              : "#92400e",
                        }}
                      >
                        {property.status}
                      </span>
                    </div>

                    <p>📍 {property.location}</p>
                    <p>🏠 {property.property_type}</p>
                    <p>
                      🛏️ {property.bedrooms ?? "—"} bedrooms
                    </p>

                    <h3>
                      UGX {formatRent(property.monthly_rent)}
                      <span
                        style={{
                          fontSize: 12,
                          color: "#64748b",
                          fontWeight: 400,
                        }}
                      >
                        {" "}
                        / month
                      </span>
                    </h3>

                    <hr
                      style={{
                        border: 0,
                        borderTop: "1px solid #e2e8f0",
                      }}
                    />

                    <strong>Landlord</strong>

                    <p style={{ margin: "6px 0" }}>
                      {landlord?.full_name ||
                        "Name unavailable"}
                    </p>

                    <p style={{ margin: "6px 0" }}>
                      {landlord?.phone ||
                        "Phone unavailable"}
                    </p>

                    <button
                      onClick={() =>
                        setSelectedProperty(property)
                      }
                      style={{
                        ...darkButton,
                        width: "100%",
                        marginTop: 10,
                      }}
                    >
                      REVIEW PROPERTY
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>

      {selectedProperty && (
        <div
          onClick={() => {
            if (!actionLoading) {
              setSelectedProperty(null);
            }
          }}
          style={modalBackdrop}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={modal}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                gap: 15,
              }}
            >
              <div>
                <h2 style={{ marginTop: 0 }}>
                  {selectedProperty.title}
                </h2>

                <p style={{ color: "#64748b" }}>
                  Property ID: {selectedProperty.id}
                </p>
              </div>

              <button
                onClick={() => setSelectedProperty(null)}
                disabled={actionLoading}
              >
                ✕
              </button>
            </div>

            <div style={detailGrid}>
              <Detail
                label="Location"
                value={selectedProperty.location}
              />

              <Detail
                label="Property Type"
                value={selectedProperty.property_type}
              />

              <Detail
                label="Monthly Rent"
                value={`UGX ${formatRent(
                  selectedProperty.monthly_rent
                )}`}
              />

              <Detail
                label="Bedrooms"
                value={String(
                  selectedProperty.bedrooms ?? "—"
                )}
              />

              <Detail
                label="Status"
                value={selectedProperty.status}
              />

              <Detail
                label="Submitted"
                value={formatDate(
                  selectedProperty.created_at
                )}
              />
            </div>

            <div style={infoSection}>
              <h3>Landlord</h3>

              <p>
                <strong>Name:</strong>{" "}
                {landlords[selectedProperty.landlord_id]
                  ?.full_name || "Unavailable"}
              </p>

              <p>
                <strong>Phone:</strong>{" "}
                {landlords[selectedProperty.landlord_id]
                  ?.phone || "Unavailable"}
              </p>
            </div>

            <div style={{ marginTop: 20 }}>
              <h3>Description</h3>

              <div style={descriptionBox}>
                {selectedProperty.description ||
                  "No description provided."}
              </div>
            </div>

            {selectedProperty.rejection_reason && (
              <div
                style={{
                  marginTop: 20,
                  background: "#fef2f2",
                  color: "#991b1b",
                  padding: 15,
                  borderRadius: 10,
                }}
              >
                <strong>Rejection Reason</strong>

                <p>
                  {selectedProperty.rejection_reason}
                </p>
              </div>
            )}

            <div style={actions}>
              {selectedProperty.status !== "Approved" && (
                <button
                  disabled={actionLoading}
                  onClick={() =>
                    approveProperty(selectedProperty)
                  }
                  style={{
                    ...actionButton,
                    background: "#16a34a",
                  }}
                >
                  APPROVE
                </button>
              )}

              {selectedProperty.status !== "Rejected" && (
                <button
                  disabled={actionLoading}
                  onClick={() =>
                    rejectProperty(selectedProperty)
                  }
                  style={{
                    ...actionButton,
                    background: "#dc2626",
                  }}
                >
                  REJECT
                </button>
              )}

              {selectedProperty.status !==
                "Pending Verification" && (
                <button
                  disabled={actionLoading}
                  onClick={() =>
                    sendToPending(selectedProperty)
                  }
                  style={{
                    ...actionButton,
                    background: "#f59e0b",
                  }}
                >
                  SEND TO PENDING
                </button>
              )}

              <button
                disabled={actionLoading}
                onClick={() =>
                  deleteProperty(selectedProperty)
                }
                style={{
                  ...actionButton,
                  background: "#7f1d1d",
                }}
              >
                DELETE
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

function Stat({
  title,
  value,
}: {
  title: string;
  value: number;
}) {
  return (
    <div style={statCard}>
      <div style={{ color: "#64748b", fontSize: 13 }}>
        {title}
      </div>

      <div
        style={{
          fontSize: 30,
          fontWeight: 800,
          marginTop: 5,
        }}
      >
        {value}
      </div>
    </div>
  );
}

function Detail({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div
      style={{
        background: "#f8fafc",
        padding: 14,
        borderRadius: 10,
      }}
    >
      <div
        style={{
          color: "#64748b",
          fontSize: 12,
          fontWeight: 700,
        }}
      >
        {label}
      </div>

      <div style={{ marginTop: 5, fontWeight: 700 }}>
        {value}
      </div>
    </div>
  );
}

const pageStyle: React.CSSProperties = {
  minHeight: "100vh",
  background: "#f5f7fa",
  color: "#0f172a",
  fontFamily: "Arial, sans-serif",
};

const centerBox: React.CSSProperties = {
  background: "#fff",
  padding: 35,
  borderRadius: 16,
  textAlign: "center",
  maxWidth: 500,
  width: "calc(100% - 30px)",
  margin: "100px auto",
  boxShadow: "0 10px 30px rgba(0,0,0,0.08)",
};

const panel: React.CSSProperties = {
  background: "#fff",
  borderRadius: 14,
  padding: 18,
  marginBottom: 20,
  boxShadow: "0 4px 15px rgba(0,0,0,0.05)",
};

const statsGrid: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns:
    "repeat(auto-fit, minmax(180px, 1fr))",
  gap: 15,
  marginBottom: 25,
};

const statCard: React.CSSProperties = {
  background: "#fff",
  padding: 20,
  borderRadius: 14,
  boxShadow: "0 4px 15px rgba(0,0,0,0.05)",
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "12px",
  border: "1px solid #cbd5e1",
  borderRadius: 8,
  fontSize: 14,
};

const darkButton: React.CSSProperties = {
  display: "inline-block",
  background: "#0f172a",
  color: "#fff",
  border: "none",
  padding: "12px 16px",
  borderRadius: 8,
  fontWeight: 700,
  textDecoration: "none",
  cursor: "pointer",
};

const navButton: React.CSSProperties = {
  background: "#334155",
  color: "#fff",
  padding: "10px 14px",
  borderRadius: 8,
  textDecoration: "none",
  fontWeight: 700,
};

const cardGrid: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns:
    "repeat(auto-fill, minmax(310px, 1fr))",
  gap: 18,
};

const propertyCard: React.CSSProperties = {
  background: "#fff",
  borderRadius: 14,
  overflow: "hidden",
  boxShadow: "0 4px 15px rgba(0,0,0,0.06)",
  border: "1px solid #e2e8f0",
};

const emptyBox: React.CSSProperties = {
  background: "#fff",
  padding: 45,
  borderRadius: 14,
  textAlign: "center",
};

const modalBackdrop: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  background: "rgba(15,23,42,0.72)",
  display: "flex",
  justifyContent: "center",
  alignItems: "center",
  padding: 18,
  zIndex: 1000,
  overflowY: "auto",
};

const modal: React.CSSProperties = {
  background: "#fff",
  borderRadius: 16,
  width: "100%",
  maxWidth: 800,
  maxHeight: "92vh",
  overflowY: "auto",
  padding: 25,
};

const detailGrid: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns:
    "repeat(auto-fit, minmax(200px, 1fr))",
  gap: 15,
  marginTop: 20,
};

const infoSection: React.CSSProperties = {
  marginTop: 20,
  background: "#f8fafc",
  borderRadius: 12,
  padding: 18,
};

const descriptionBox: React.CSSProperties = {
  background: "#f8fafc",
  padding: 18,
  borderRadius: 12,
  whiteSpace: "pre-wrap",
  lineHeight: 1.6,
  color: "#334155",
};

const actions: React.CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: 10,
  marginTop: 25,
  paddingTop: 20,
  borderTop: "1px solid #e2e8f0",
};

const actionButton: React.CSSProperties = {
  flex: 1,
  minWidth: 140,
  border: "none",
  color: "#fff",
  padding: "12px 15px",
  borderRadius: 8,
  fontWeight: 800,
  cursor: "pointer",
};