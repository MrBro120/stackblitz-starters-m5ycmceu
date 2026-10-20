"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "../../../lib/supabase";

type Report = {
  id: string;
  property_id: string;
  reporter_id: string;
  reason: string;
  message: string | null;
  status: "Pending" | "Reviewed" | "Resolved" | "Dismissed";
  created_at: string;

  property?: {
    id: string;
    title: string;
    location: string;
    property_type: string;
    monthly_rent: number;
    bedrooms: number;
    description: string;
    status: string;
    landlord_id: string;
  } | null;

  reporter?: {
    id: string;
    full_name: string | null;
    phone: string | null;
    role: string;
  } | null;

  landlord?: {
    id: string;
    full_name: string | null;
    phone: string | null;
  } | null;
};

const NAVY = "#0B3B75";
const RED = "#B42318";
const GREEN = "#065F46";
const ORANGE = "#B54708";
const GRAY = "#667085";
const LIGHT = "#F7F9FC";

export default function AdminReportsPage() {
  const [adminChecking, setAdminChecking] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(false);

  const [selectedReport, setSelectedReport] =
    useState<Report | null>(null);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");

  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    verifyAdmin();
  }, []);

  async function verifyAdmin() {
    setAdminChecking(true);
    setError("");

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setIsAdmin(false);
        setAdminChecking(false);
        return;
      }

      const { data: profile, error: profileError } =
        await supabase
          .from("profiles")
          .select("role")
          .eq("id", user.id)
          .maybeSingle();

      if (profileError) {
        throw profileError;
      }

      if (profile?.role === "admin") {
        setIsAdmin(true);
        await loadReports();
      } else {
        setIsAdmin(false);
      }
    } catch (err: any) {
      console.error("Admin verification error:", err);

      setError(
        err?.message ||
          "Unable to verify your administrator account."
      );
    } finally {
      setAdminChecking(false);
    }
  }

  async function loadReports() {
    setLoading(true);
    setError("");

    try {
      const { data: reportData, error: reportError } =
        await supabase
          .from("property_reports")
          .select("*")
          .order("created_at", { ascending: false });

      if (reportError) {
        throw reportError;
      }

      if (!reportData || reportData.length === 0) {
        setReports([]);
        setLoading(false);
        return;
      }

      const propertyIds = Array.from(new Set(
          reportData.map((report) => report.property_id)
        ));

      const reporterIds = Array.from(new Set(
          reportData.map((report) => report.reporter_id)
        ));

      // Load properties
      const { data: propertyData, error: propertyError } =
        await supabase
          .from("properties")
          .select(
            "id, title, location, property_type, monthly_rent, bedrooms, description, status, landlord_id"
          )
          .in("id", propertyIds);

      if (propertyError) {
        throw propertyError;
      }

      // Load reporters
      const { data: reporterData, error: reporterError } =
        await supabase
          .from("profiles")
          .select("id, full_name, phone, role")
          .in("id", reporterIds);

      if (reporterError) {
        throw reporterError;
      }

      // Get landlord IDs from properties
      const landlordIds = Array.from(new Set(
          (propertyData || [])
            .map((property) => property.landlord_id)
            .filter(Boolean)
        ));

      let landlordData: any[] = [];

      if (landlordIds.length > 0) {
        const { data, error: landlordError } =
          await supabase
            .from("profiles")
            .select("id, full_name, phone")
            .in("id", landlordIds);

        if (landlordError) {
          throw landlordError;
        }

        landlordData = data || [];
      }

      const combinedReports: Report[] = reportData.map(
        (report) => {
          const property =
            propertyData?.find(
              (item) => item.id === report.property_id
            ) || null;

          const reporter =
            reporterData?.find(
              (item) => item.id === report.reporter_id
            ) || null;

          const landlord =
            property
              ? landlordData.find(
                  (item) =>
                    item.id === property.landlord_id
                ) || null
              : null;

          return {
            ...report,
            property,
            reporter,
            landlord,
          };
        }
      );

      setReports(combinedReports);
    } catch (err: any) {
      console.error("Load reports error:", err);

      setError(
        err?.message ||
          "Unable to load property reports."
      );
    } finally {
      setLoading(false);
    }
  }

  async function changeReportStatus(
    reportId: string,
    newStatus:
      | "Pending"
      | "Reviewed"
      | "Resolved"
      | "Dismissed"
  ) {
    setActionLoading(true);
    setError("");
    setSuccess("");

    try {
      const { error: updateError } = await supabase
        .from("property_reports")
        .update({
          status: newStatus,
        })
        .eq("id", reportId);

      if (updateError) {
        throw updateError;
      }

      setReports((currentReports) =>
        currentReports.map((report) =>
          report.id === reportId
            ? {
                ...report,
                status: newStatus,
              }
            : report
        )
      );

      setSelectedReport((current) =>
        current
          ? {
              ...current,
              status: newStatus,
            }
          : null
      );

      setSuccess(
        `Report marked as ${newStatus}.`
      );
    } catch (err: any) {
      console.error(
        "Change report status error:",
        err
      );

      setError(
        err?.message ||
          "Unable to update the report status."
      );
    } finally {
      setActionLoading(false);
    }
  }

  async function signOut() {
    await supabase.auth.signOut();
    window.location.href = "/ceo";
  }

  const filteredReports = useMemo(() => {
    const searchText = search.trim().toLowerCase();

    return reports.filter((report) => {
      const matchesStatus =
        statusFilter === "All" ||
        report.status === statusFilter;

      if (!matchesStatus) {
        return false;
      }

      if (!searchText) {
        return true;
      }

      const searchableText = [
        report.reason,
        report.message || "",
        report.status,
        report.property?.title || "",
        report.property?.location || "",
        report.reporter?.full_name || "",
        report.reporter?.phone || "",
        report.landlord?.full_name || "",
        report.landlord?.phone || "",
      ]
        .join(" ")
        .toLowerCase();

      return searchableText.includes(searchText);
    });
  }, [reports, search, statusFilter]);

  const totalReports = reports.length;

  const pendingReports = reports.filter(
    (report) => report.status === "Pending"
  ).length;

  const reviewedReports = reports.filter(
    (report) => report.status === "Reviewed"
  ).length;

  const resolvedReports = reports.filter(
    (report) => report.status === "Resolved"
  ).length;

  const dismissedReports = reports.filter(
    (report) => report.status === "Dismissed"
  ).length;

  function formatDate(date: string) {
    return new Date(date).toLocaleString("en-UG", {
      dateStyle: "medium",
      timeStyle: "short",
    });
  }

  function formatRent(rent: number) {
    return new Intl.NumberFormat("en-UG").format(
      Number(rent || 0)
    );
  }

  function statusStyle(status: string) {
    if (status === "Pending") {
      return {
        background: "#FFF4E5",
        color: ORANGE,
      };
    }

    if (status === "Reviewed") {
      return {
        background: "#EEF4FF",
        color: NAVY,
      };
    }

    if (status === "Resolved") {
      return {
        background: "#ECFDF3",
        color: GREEN,
      };
    }

    return {
      background: "#F2F4F7",
      color: "#475467",
    };
  }

  if (adminChecking) {
    return (
      <div
        style={{
          minHeight: "100vh",
          background: LIGHT,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "Arial, sans-serif",
          color: NAVY,
        }}
      >
        Checking administrator access...
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div
        style={{
          minHeight: "100vh",
          background: LIGHT,
          fontFamily: "Arial, sans-serif",
          padding: "40px 20px",
        }}
      >
        <div
          style={{
            maxWidth: "500px",
            margin: "60px auto",
            background: "white",
            padding: "35px",
            borderRadius: "14px",
            textAlign: "center",
            boxShadow:
              "0 4px 20px rgba(0,0,0,0.08)",
          }}
        >
          <h1
            style={{
              color: NAVY,
              marginTop: 0,
            }}
          >
            ADMIN ACCESS REQUIRED
          </h1>

          <p
            style={{
              color: "#667085",
              lineHeight: 1.6,
            }}
          >
            You must be signed in with an administrator
            account to view property reports.
          </p>

          <Link
            href="/ceo"
            style={{
              display: "inline-block",
              marginTop: "15px",
              background: NAVY,
              color: "white",
              padding: "13px 22px",
              borderRadius: "8px",
              textDecoration: "none",
              fontWeight: "bold",
            }}
          >
            GO TO ADMIN LOGIN
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        background: LIGHT,
        fontFamily: "Arial, sans-serif",
        color: "#222",
      }}
    >
      {/* HEADER */}
      <header
        style={{
          background: NAVY,
          color: "white",
          padding: "18px 20px",
          boxShadow:
            "0 2px 8px rgba(0,0,0,0.12)",
        }}
      >
        <div
          style={{
            maxWidth: "1200px",
            margin: "0 auto",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "15px",
            flexWrap: "wrap",
          }}
        >
          <div>
            <div
              style={{
                fontSize: "21px",
                fontWeight: "bold",
              }}
            >
              HOUSE CONNECT
            </div>

            <div
              style={{
                fontSize: "12px",
                opacity: 0.85,
                marginTop: "3px",
              }}
            >
              ADMIN • REPORT MANAGEMENT
            </div>
          </div>

          <div
            style={{
              display: "flex",
              gap: "10px",
              flexWrap: "wrap",
            }}
          >
            <Link
              href="/ceo"
              style={{
                color: "white",
                textDecoration: "none",
                padding: "10px 13px",
                border: "1px solid rgba(255,255,255,0.4)",
                borderRadius: "7px",
                fontSize: "13px",
                fontWeight: "bold",
              }}
            >
              DASHBOARD
            </Link>

            <Link
              href="/ceo/users"
              style={{
                color: "white",
                textDecoration: "none",
                padding: "10px 13px",
                border: "1px solid rgba(255,255,255,0.4)",
                borderRadius: "7px",
                fontSize: "13px",
                fontWeight: "bold",
              }}
            >
              USERS
            </Link>

            <Link
              href="/ceo/properties"
              style={{
                color: "white",
                textDecoration: "none",
                padding: "10px 13px",
                border: "1px solid rgba(255,255,255,0.4)",
                borderRadius: "7px",
                fontSize: "13px",
                fontWeight: "bold",
              }}
            >
              PROPERTIES
            </Link>

            <button
              onClick={signOut}
              style={{
                color: "white",
                background: "transparent",
                padding: "10px 13px",
                border:
                  "1px solid rgba(255,255,255,0.4)",
                borderRadius: "7px",
                fontSize: "13px",
                fontWeight: "bold",
                cursor: "pointer",
              }}
            >
              LOG OUT
            </button>
          </div>
        </div>
      </header>

      {/* MAIN */}
      <main
        style={{
          maxWidth: "1200px",
          margin: "0 auto",
          padding: "30px 20px 60px",
        }}
      >
        <div style={{ marginBottom: "25px" }}>
          <div
            style={{
              color: RED,
              fontSize: "12px",
              fontWeight: "bold",
              letterSpacing: "0.8px",
              marginBottom: "6px",
            }}
          >
            FRAUD & SAFETY
          </div>

          <h1
            style={{
              margin: 0,
              color: NAVY,
              fontSize: "30px",
            }}
          >
            Property Reports
          </h1>

          <p
            style={{
              color: GRAY,
              marginTop: "8px",
              lineHeight: 1.5,
            }}
          >
            Review reports submitted by tenants and
            take appropriate action.
          </p>
        </div>

        {/* ERROR */}
        {error && (
          <div
            style={{
              background: "#FFF1F0",
              border: "1px solid #F0A7A0",
              color: RED,
              padding: "13px 15px",
              borderRadius: "8px",
              marginBottom: "18px",
            }}
          >
            {error}
          </div>
        )}

        {/* SUCCESS */}
        {success && (
          <div
            style={{
              background: "#ECFDF3",
              border: "1px solid #A7E3C0",
              color: GREEN,
              padding: "13px 15px",
              borderRadius: "8px",
              marginBottom: "18px",
            }}
          >
            {success}
          </div>
        )}

        {/* STATISTICS */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns:
              "repeat(auto-fit, minmax(170px, 1fr))",
            gap: "15px",
            marginBottom: "25px",
          }}
        >
          <StatCard
            title="Total Reports"
            value={totalReports}
          />

          <StatCard
            title="Pending"
            value={pendingReports}
          />

          <StatCard
            title="Reviewed"
            value={reviewedReports}
          />

          <StatCard
            title="Resolved"
            value={resolvedReports}
          />

          <StatCard
            title="Dismissed"
            value={dismissedReports}
          />
        </div>

        {/* SEARCH / FILTER */}
        <div
          style={{
            background: "white",
            border: "1px solid #E3E8EF",
            borderRadius: "12px",
            padding: "18px",
            marginBottom: "20px",
          }}
        >
          <div
            style={{
              display: "grid",
              gridTemplateColumns:
                "minmax(220px, 1fr) 200px auto",
              gap: "12px",
            }}
          >
            <input
              value={search}
              onChange={(e) =>
                setSearch(e.target.value)
              }
              placeholder="Search property, reporter, reason..."
              style={{
                width: "100%",
                padding: "12px 13px",
                border: "1px solid #CBD5E1",
                borderRadius: "8px",
                fontSize: "15px",
                color: "#111",
                background: "white",
                boxSizing: "border-box",
              }}
            />

            <select
              value={statusFilter}
              onChange={(e) =>
                setStatusFilter(e.target.value)
              }
              style={{
                width: "100%",
                padding: "12px 13px",
                border: "1px solid #CBD5E1",
                borderRadius: "8px",
                fontSize: "15px",
                color: "#111",
                background: "white",
                boxSizing: "border-box",
              }}
            >
              <option value="All">
                All Statuses
              </option>
              <option value="Pending">
                Pending
              </option>
              <option value="Reviewed">
                Reviewed
              </option>
              <option value="Resolved">
                Resolved
              </option>
              <option value="Dismissed">
                Dismissed
              </option>
            </select>

            <button
              onClick={loadReports}
              disabled={loading}
              style={{
                padding: "12px 18px",
                border: "none",
                borderRadius: "8px",
                background: NAVY,
                color: "white",
                fontWeight: "bold",
                cursor: loading
                  ? "not-allowed"
                  : "pointer",
              }}
            >
              {loading ? "LOADING..." : "REFRESH"}
            </button>
          </div>
        </div>

        {/* REPORTS */}
        <div
          style={{
            background: "white",
            border: "1px solid #E3E8EF",
            borderRadius: "12px",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              padding: "18px",
              borderBottom:
                "1px solid #E3E8EF",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: "10px",
              flexWrap: "wrap",
            }}
          >
            <h2
              style={{
                margin: 0,
                color: NAVY,
                fontSize: "19px",
              }}
            >
              Submitted Reports
            </h2>

            <span
              style={{
                color: GRAY,
                fontSize: "13px",
              }}
            >
              Showing {filteredReports.length} of{" "}
              {reports.length}
            </span>
          </div>

          {loading ? (
            <div
              style={{
                padding: "45px 20px",
                textAlign: "center",
                color: GRAY,
              }}
            >
              Loading reports...
            </div>
          ) : filteredReports.length === 0 ? (
            <div
              style={{
                padding: "50px 20px",
                textAlign: "center",
                color: GRAY,
              }}
            >
              <div
                style={{
                  fontSize: "40px",
                  marginBottom: "10px",
                }}
              >
                ✓
              </div>

              <div
                style={{
                  fontWeight: "bold",
                  color: NAVY,
                  fontSize: "18px",
                  marginBottom: "6px",
                }}
              >
                No reports found
              </div>

              <div>
                There are no reports matching your
                current search or filter.
              </div>
            </div>
          ) : (
            <div
              style={{
                overflowX: "auto",
              }}
            >
              <table
                style={{
                  width: "100%",
                  borderCollapse: "collapse",
                  minWidth: "900px",
                }}
              >
                <thead>
                  <tr
                    style={{
                      background: "#F8FAFC",
                      textAlign: "left",
                    }}
                  >
                    <th style={thStyle}>
                      PROPERTY
                    </th>

                    <th style={thStyle}>
                      REPORTER
                    </th>

                    <th style={thStyle}>
                      REASON
                    </th>

                    <th style={thStyle}>
                      DATE
                    </th>

                    <th style={thStyle}>
                      STATUS
                    </th>

                    <th style={thStyle}>
                      ACTION
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {filteredReports.map((report) => {
                    const badge =
                      statusStyle(report.status);

                    return (
                      <tr key={report.id}>
                        <td style={tdStyle}>
                          <div
                            style={{
                              fontWeight: "bold",
                              color: NAVY,
                              marginBottom: "4px",
                            }}
                          >
                            {report.property?.title ||
                              "Unknown property"}
                          </div>

                          <div
                            style={{
                              color: GRAY,
                              fontSize: "13px",
                            }}
                          >
                            {report.property?.location ||
                              "Unknown location"}
                          </div>
                        </td>

                        <td style={tdStyle}>
                          <div
                            style={{
                              fontWeight: "bold",
                            }}
                          >
                            {report.reporter
                              ?.full_name ||
                              "Unknown user"}
                          </div>

                          <div
                            style={{
                              color: GRAY,
                              fontSize: "13px",
                              marginTop: "4px",
                            }}
                          >
                            {report.reporter?.phone ||
                              "No phone"}
                          </div>
                        </td>

                        <td style={tdStyle}>
                          {report.reason}
                        </td>

                        <td style={tdStyle}>
                          {formatDate(
                            report.created_at
                          )}
                        </td>

                        <td style={tdStyle}>
                          <span
                            style={{
                              display:
                                "inline-block",
                              padding:
                                "6px 10px",
                              borderRadius: "999px",
                              background:
                                badge.background,
                              color: badge.color,
                              fontSize: "12px",
                              fontWeight: "bold",
                            }}
                          >
                            {report.status}
                          </span>
                        </td>

                        <td style={tdStyle}>
                          <button
                            onClick={() => {
                              setSelectedReport(
                                report
                              );
                              setError("");
                              setSuccess("");
                            }}
                            style={{
                              padding:
                                "9px 13px",
                              background: NAVY,
                              color: "white",
                              border: "none",
                              borderRadius: "7px",
                              fontWeight: "bold",
                              cursor: "pointer",
                            }}
                          >
                            VIEW REPORT
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>

      {/* REPORT DETAILS MODAL */}
      {selectedReport && (
        <div
          onClick={() =>
            setSelectedReport(null)
          }
          style={{
            position: "fixed",
            inset: 0,
            background:
              "rgba(0,0,0,0.55)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "20px",
            zIndex: 1000,
            overflowY: "auto",
          }}
        >
          <div
            onClick={(e) =>
              e.stopPropagation()
            }
            style={{
              width: "100%",
              maxWidth: "800px",
              maxHeight: "90vh",
              overflowY: "auto",
              background: "white",
              borderRadius: "14px",
              boxShadow:
                "0 15px 50px rgba(0,0,0,0.25)",
            }}
          >
            {/* MODAL HEADER */}
            <div
              style={{
                padding: "20px",
                borderBottom:
                  "1px solid #E3E8EF",
                display: "flex",
                justifyContent:
                  "space-between",
                alignItems: "center",
                gap: "15px",
              }}
            >
              <div>
                <div
                  style={{
                    color: RED,
                    fontSize: "12px",
                    fontWeight: "bold",
                    marginBottom: "5px",
                  }}
                >
                  PROPERTY REPORT
                </div>

                <h2
                  style={{
                    margin: 0,
                    color: NAVY,
                  }}
                >
                  {selectedReport.property
                    ?.title ||
                    "Reported Property"}
                </h2>
              </div>

              <button
                onClick={() =>
                  setSelectedReport(null)
                }
                style={{
                  width: "38px",
                  height: "38px",
                  borderRadius: "50%",
                  border: "1px solid #CBD5E1",
                  background: "white",
                  fontSize: "20px",
                  cursor: "pointer",
                  color: "#333",
                }}
              >
                ×
              </button>
            </div>

            <div style={{ padding: "20px" }}>
              {/* STATUS */}
              <div
                style={{
                  marginBottom: "22px",
                }}
              >
                <span
                  style={{
                    display:
                      "inline-block",
                    padding:
                      "7px 12px",
                    borderRadius:
                      "999px",
                    background:
                      statusStyle(
                        selectedReport.status
                      ).background,
                    color:
                      statusStyle(
                        selectedReport.status
                      ).color,
                    fontSize: "12px",
                    fontWeight: "bold",
                  }}
                >
                  {selectedReport.status}
                </span>
              </div>

              {/* REASON */}
              <Section title="REPORT REASON">
                <div
                  style={{
                    color: RED,
                    fontWeight: "bold",
                    fontSize: "16px",
                  }}
                >
                  {selectedReport.reason}
                </div>
              </Section>

              {/* MESSAGE */}
              <Section title="REPORTER'S MESSAGE">
                <div
                  style={{
                    background: "#F8FAFC",
                    border:
                      "1px solid #E2E8F0",
                    borderRadius: "8px",
                    padding: "15px",
                    color: "#344054",
                    lineHeight: "1.6",
                    whiteSpace: "pre-wrap",
                  }}
                >
                  {selectedReport.message ||
                    "The reporter did not provide additional information."}
                </div>
              </Section>

              {/* PROPERTY */}
              <Section title="PROPERTY INFORMATION">
                <InfoGrid>
                  <InfoItem
                    label="Property"
                    value={
                      selectedReport.property
                        ?.title ||
                      "Unknown"
                    }
                  />

                  <InfoItem
                    label="Location"
                    value={
                      selectedReport.property
                        ?.location ||
                      "Unknown"
                    }
                  />

                  <InfoItem
                    label="Type"
                    value={
                      selectedReport.property
                        ?.property_type ||
                      "Unknown"
                    }
                  />

                  <InfoItem
                    label="Bedrooms"
                    value={String(
                      selectedReport
                        .property
                        ?.bedrooms ||
                        0
                    )}
                  />

                  <InfoItem
                    label="Monthly Rent"
                    value={`UGX ${formatRent(
                      selectedReport
                        .property
                        ?.monthly_rent ||
                        0
                    )}`}
                  />

                  <InfoItem
                    label="Property Status"
                    value={
                      selectedReport.property
                        ?.status ||
                      "Unknown"
                    }
                  />
                </InfoGrid>

                <div
                  style={{
                    marginTop: "15px",
                  }}
                >
                  <div
                    style={{
                      fontWeight: "bold",
                      color: NAVY,
                      marginBottom: "6px",
                    }}
                  >
                    Description
                  </div>

                  <div
                    style={{
                      color: "#555",
                      lineHeight: "1.6",
                      background:
                        "#F8FAFC",
                      padding: "13px",
                      borderRadius:
                        "8px",
                    }}
                  >
                    {selectedReport
                      .property
                      ?.description ||
                      "No description available."}
                  </div>
                </div>
              </Section>

              {/* REPORTER */}
              <Section title="REPORTER">
                <InfoGrid>
                  <InfoItem
                    label="Full Name"
                    value={
                      selectedReport
                        .reporter
                        ?.full_name ||
                      "Unknown"
                    }
                  />

                  <InfoItem
                    label="Phone"
                    value={
                      selectedReport
                        .reporter
                        ?.phone ||
                      "Not provided"
                    }
                  />

                  <InfoItem
                    label="Account Type"
                    value={
                      selectedReport
                        .reporter
                        ?.role ||
                      "Unknown"
                    }
                  />

                  <InfoItem
                    label="Reported On"
                    value={formatDate(
                      selectedReport.created_at
                    )}
                  />
                </InfoGrid>
              </Section>

              {/* LANDLORD */}
              <Section title="LANDLORD">
                <InfoGrid>
                  <InfoItem
                    label="Full Name"
                    value={
                      selectedReport
                        .landlord
                        ?.full_name ||
                      "Unknown"
                    }
                  />

                  <InfoItem
                    label="Phone"
                    value={
                      selectedReport
                        .landlord
                        ?.phone ||
                      "Not provided"
                    }
                  />
                </InfoGrid>
              </Section>

              {/* ACTIONS */}
              <Section title="ADMIN ACTION">
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns:
                      "repeat(auto-fit, minmax(160px, 1fr))",
                    gap: "10px",
                  }}
                >
                  <button
                    onClick={() =>
                      changeReportStatus(
                        selectedReport.id,
                        "Pending"
                      )
                    }
                    disabled={actionLoading}
                    style={{
                      padding: "12px",
                      border:
                        "1px solid #CBD5E1",
                      borderRadius: "8px",
                      background:
                        "white",
                      color: "#344054",
                      fontWeight:
                        "bold",
                      cursor:
                        actionLoading
                          ? "not-allowed"
                          : "pointer",
                    }}
                  >
                    SEND TO PENDING
                  </button>

                  <button
                    onClick={() =>
                      changeReportStatus(
                        selectedReport.id,
                        "Reviewed"
                      )
                    }
                    disabled={actionLoading}
                    style={{
                      padding: "12px",
                      border:
                        "1px solid #9CB8E5",
                      borderRadius: "8px",
                      background:
                        "#EEF4FF",
                      color: NAVY,
                      fontWeight:
                        "bold",
                      cursor:
                        actionLoading
                          ? "not-allowed"
                          : "pointer",
                    }}
                  >
                    MARK REVIEWED
                  </button>

                  <button
                    onClick={() =>
                      changeReportStatus(
                        selectedReport.id,
                        "Resolved"
                      )
                    }
                    disabled={actionLoading}
                    style={{
                      padding: "12px",
                      border:
                        "1px solid #A7E3C0",
                      borderRadius: "8px",
                      background:
                        "#ECFDF3",
                      color: GREEN,
                      fontWeight:
                        "bold",
                      cursor:
                        actionLoading
                          ? "not-allowed"
                          : "pointer",
                    }}
                  >
                    MARK RESOLVED
                  </button>

                  <button
                    onClick={() =>
                      changeReportStatus(
                        selectedReport.id,
                        "Dismissed"
                      )
                    }
                    disabled={actionLoading}
                    style={{
                      padding: "12px",
                      border:
                        "1px solid #D0D5DD",
                      borderRadius: "8px",
                      background:
                        "#F2F4F7",
                      color: "#475467",
                      fontWeight:
                        "bold",
                      cursor:
                        actionLoading
                          ? "not-allowed"
                          : "pointer",
                    }}
                  >
                    DISMISS REPORT
                  </button>
                </div>

                {actionLoading && (
                  <div
                    style={{
                      marginTop: "12px",
                      color: GRAY,
                      fontSize: "13px",
                    }}
                  >
                    Updating report...
                  </div>
                )}
              </Section>

              {/* CLOSE */}
              <button
                onClick={() =>
                  setSelectedReport(null)
                }
                style={{
                  width: "100%",
                  marginTop: "10px",
                  padding: "13px",
                  border: "none",
                  borderRadius: "8px",
                  background: NAVY,
                  color: "white",
                  fontWeight: "bold",
                  cursor: "pointer",
                }}
              >
                CLOSE
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------------- COMPONENTS ---------------- */

function StatCard({
  title,
  value,
}: {
  title: string;
  value: number;
}) {
  return (
    <div
      style={{
        background: "white",
        border: "1px solid #E3E8EF",
        borderRadius: "12px",
        padding: "18px",
        boxShadow:
          "0 2px 8px rgba(0,0,0,0.03)",
      }}
    >
      <div
        style={{
          color: "#667085",
          fontSize: "13px",
          marginBottom: "7px",
        }}
      >
        {title}
      </div>

      <div
        style={{
          color: "#0B3B75",
          fontSize: "28px",
          fontWeight: "bold",
        }}
      >
        {value}
      </div>
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        marginBottom: "24px",
        paddingBottom: "20px",
        borderBottom:
          "1px solid #E3E8EF",
      }}
    >
      <h3
        style={{
          margin: "0 0 12px",
          color: "#0B3B75",
          fontSize: "14px",
          letterSpacing: "0.4px",
        }}
      >
        {title}
      </h3>

      {children}
    </div>
  );
}

function InfoGrid({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns:
          "repeat(auto-fit, minmax(180px, 1fr))",
        gap: "12px",
      }}
    >
      {children}
    </div>
  );
}

function InfoItem({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div
      style={{
        background: "#F8FAFC",
        borderRadius: "8px",
        padding: "12px",
      }}
    >
      <div
        style={{
          color: "#667085",
          fontSize: "12px",
          marginBottom: "5px",
        }}
      >
        {label}
      </div>

      <div
        style={{
          color: "#222",
          fontWeight: "bold",
          fontSize: "14px",
        }}
      >
        {value}
      </div>
    </div>
  );
}

const thStyle: React.CSSProperties = {
  padding: "13px 14px",
  borderBottom: "1px solid #E3E8EF",
  color: "#475467",
  fontSize: "12px",
  fontWeight: "bold",
  whiteSpace: "nowrap",
};

const tdStyle: React.CSSProperties = {
  padding: "15px 14px",
  borderBottom: "1px solid #E3E8EF",
  verticalAlign: "top",
  fontSize: "14px",
};