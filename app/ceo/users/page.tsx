"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import AdminRequestsLink from "@/components/AdminRequestsLink";
import { supabase } from "@/lib/supabase";

type UserProfile = {
  id: string;
  full_name: string | null;
  phone: string | null;
  role: string | null;
};

const NAVY = "#0f172a";
const GREEN = "#16a34a";
const RED = "#dc2626";
const YELLOW = "#ca8a04";
const BORDER = "#e2e8f0";
const MUTED = "#64748b";

export default function AdminUsersPage() {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("All");

  const [adminName, setAdminName] = useState("");

  useEffect(() => {
    verifyAdminAndLoadUsers();
  }, []);

  const verifyAdminAndLoadUsers = async () => {
    try {
      setLoading(true);
      setError("");

      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError || !user) {
        setError("You must be logged in as an administrator.");
        return;
      }

      const { data: adminProfile, error: profileError } = await supabase
        .from("profiles")
        .select("id, full_name, phone, role")
        .eq("id", user.id)
        .maybeSingle();

      if (profileError) {
        throw profileError;
      }

      if (!adminProfile || adminProfile.role !== "admin") {
        setError("Access denied. This page is only available to administrators.");
        return;
      }

      setAdminName(adminProfile.full_name || "Administrator");

      const { data: profileData, error: usersError } = await supabase
        .from("profiles")
        .select("id, full_name, phone, role")
        .order("full_name", { ascending: true });

      if (usersError) {
        throw usersError;
      }

      setUsers(profileData || []);
    } catch (err: any) {
      console.error("Error loading users:", err);
      setError(
        err?.message || "Something went wrong while loading users."
      );
    } finally {
      setLoading(false);
    }
  };

  const filteredUsers = useMemo(() => {
    const searchText = search.trim().toLowerCase();

    return users.filter((user) => {
      const matchesRole =
        roleFilter === "All" ||
        (user.role || "").toLowerCase() === roleFilter.toLowerCase();

      const matchesSearch =
        !searchText ||
        (user.full_name || "").toLowerCase().includes(searchText) ||
        (user.phone || "").toLowerCase().includes(searchText) ||
        (user.role || "").toLowerCase().includes(searchText);

      return matchesRole && matchesSearch;
    });
  }, [users, search, roleFilter]);

  const totalUsers = users.length;

  const totalTenants = users.filter(
    (user) => user.role === "tenant"
  ).length;

  const totalLandlords = users.filter(
    (user) => user.role === "landlord"
  ).length;

  const totalAgents = users.filter(
    (user) => user.role === "agent"
  ).length;

  const totalAdmins = users.filter(
    (user) => user.role === "admin"
  ).length;

  const getRoleStyle = (role: string | null) => {
    switch ((role || "").toLowerCase()) {
      case "admin":
        return {
          background: "#ede9fe",
          color: "#6d28d9",
        };

      case "landlord":
        return {
          background: "#dcfce7",
          color: "#166534",
        };

      case "tenant":
        return {
          background: "#dbeafe",
          color: "#1d4ed8",
        };

      case "agent":
        return {
          background: "#fef3c7",
          color: "#92400e",
        };

      default:
        return {
          background: "#f1f5f9",
          color: "#475569",
        };
    }
  };

  const formatRole = (role: string | null) => {
    if (!role) return "Unknown";

    return role.charAt(0).toUpperCase() + role.slice(1);
  };

  const logout = async () => {
    await supabase.auth.signOut();
    window.location.href = "/ceo";
  };

  if (loading) {
    return (
      <main
        style={{
          minHeight: "100vh",
          background: "#f8fafc",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "Arial, sans-serif",
          color: NAVY,
          padding: 20,
        }}
      >
        <div
          style={{
            background: "white",
            padding: 30,
            borderRadius: 16,
            border: `1px solid ${BORDER}`,
            textAlign: "center",
            boxShadow: "0 10px 30px rgba(0,0,0,0.06)",
          }}
        >
          <div style={{ fontSize: 34, marginBottom: 12 }}>⏳</div>
          <h2 style={{ margin: 0 }}>Loading users...</h2>
          <p style={{ color: MUTED, marginBottom: 0 }}>
            Please wait while the admin portal loads.
          </p>
        </div>
      </main>
    );
  }

  if (error) {
    return (
      <main
        style={{
          minHeight: "100vh",
          background: "#f8fafc",
          fontFamily: "Arial, sans-serif",
          padding: 20,
        }}
      >
        <div
          style={{
            maxWidth: 700,
            margin: "80px auto",
            background: "white",
            borderRadius: 18,
            padding: 32,
            border: `1px solid ${BORDER}`,
            textAlign: "center",
            boxShadow: "0 10px 30px rgba(0,0,0,0.06)",
          }}
        >
          <div style={{ fontSize: 44, marginBottom: 12 }}>🔒</div>

          <h1 style={{ marginTop: 0, color: NAVY }}>
            Admin Access Required
          </h1>

          <p style={{ color: RED, lineHeight: 1.6 }}>{error}</p>

          <Link
            href="/ceo"
            style={{
              display: "inline-block",
              marginTop: 16,
              padding: "12px 20px",
              background: NAVY,
              color: "white",
              textDecoration: "none",
              borderRadius: 10,
              fontWeight: 700,
            }}
          >
            Back to Admin Dashboard
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#f8fafc",
        fontFamily: "Arial, sans-serif",
        color: NAVY,
      }}
    >
      {/* HEADER */}
      <header
        style={{
          background: NAVY,
          color: "white",
          padding: "16px 24px",
          position: "sticky",
          top: 0,
          zIndex: 20,
          boxShadow: "0 4px 15px rgba(0,0,0,0.12)",
        }}
      >
        <div
          style={{
            maxWidth: 1250,
            margin: "0 auto",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 20,
            flexWrap: "wrap",
          }}
        >
          <div>
            <div
              style={{
                fontSize: 22,
                fontWeight: 900,
                letterSpacing: 1,
              }}
            >
              HOUSE CONNECT
            </div>

            <div
              style={{
                fontSize: 12,
                opacity: 0.75,
                marginTop: 3,
              }}
            >
              ADMINISTRATION • USER MANAGEMENT
            </div>
          </div>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              flexWrap: "wrap",
            }}
          >
            <span
              style={{
                fontSize: 14,
                opacity: 0.9,
              }}
            >
              👑 {adminName}
            </span>

            <AdminRequestsLink />

            <Link
              href="/ceo"
              style={{
                padding: "9px 14px",
                borderRadius: 8,
                background: "white",
                color: NAVY,
                textDecoration: "none",
                fontWeight: 700,
                fontSize: 14,
              }}
            >
              Dashboard
            </Link>

            <button
              onClick={logout}
              style={{
                border: "1px solid rgba(255,255,255,0.3)",
                background: "transparent",
                color: "white",
                padding: "9px 14px",
                borderRadius: 8,
                cursor: "pointer",
                fontWeight: 700,
              }}
            >
              Log Out
            </button>
          </div>
        </div>
      </header>

      {/* CONTENT */}
      <div
        style={{
          maxWidth: 1250,
          margin: "0 auto",
          padding: "30px 20px 60px",
        }}
      >
        {/* PAGE TITLE */}
        <section style={{ marginBottom: 25 }}>
          <h1
            style={{
              margin: 0,
              fontSize: 32,
              fontWeight: 900,
            }}
          >
            User Management
          </h1>

          <p
            style={{
              marginTop: 8,
              color: MUTED,
              fontSize: 16,
            }}
          >
            View and monitor House Connect user accounts.
          </p>
        </section>

        {/* STATISTICS */}
        <section
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
            gap: 15,
            marginBottom: 25,
          }}
        >
          <StatCard
            title="Total Users"
            value={totalUsers}
            icon="👥"
          />

          <StatCard
            title="Tenants"
            value={totalTenants}
            icon="🔎"
          />

          <StatCard
            title="Landlords"
            value={totalLandlords}
            icon="🏠"
          />

          <StatCard
            title="Agents"
            value={totalAgents}
            icon="🧑‍💼"
          />

          <StatCard
            title="Admins"
            value={totalAdmins}
            icon="👑"
          />
        </section>

        {/* FILTERS */}
        <section
          style={{
            background: "white",
            border: `1px solid ${BORDER}`,
            borderRadius: 16,
            padding: 20,
            marginBottom: 20,
          }}
        >
          <div
            style={{
              display: "flex",
              gap: 12,
              flexWrap: "wrap",
              alignItems: "center",
            }}
          >
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name, phone or role..."
              style={{
                flex: "1 1 280px",
                minWidth: 240,
                padding: "13px 14px",
                border: `1px solid ${BORDER}`,
                borderRadius: 10,
                outline: "none",
                fontSize: 14,
              }}
            />

            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              style={{
                padding: "13px 14px",
                border: `1px solid ${BORDER}`,
                borderRadius: 10,
                background: "white",
                fontSize: 14,
                minWidth: 160,
              }}
            >
              <option value="All">All Roles</option>
              <option value="tenant">Tenants</option>
              <option value="landlord">Landlords</option>
              <option value="agent">Agents</option>
              <option value="admin">Admins</option>
            </select>

            <button
              onClick={verifyAdminAndLoadUsers}
              style={{
                padding: "13px 18px",
                border: "none",
                borderRadius: 10,
                background: NAVY,
                color: "white",
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              Refresh
            </button>
          </div>

          <div
            style={{
              marginTop: 14,
              color: MUTED,
              fontSize: 14,
            }}
          >
            Showing <strong>{filteredUsers.length}</strong> of{" "}
            <strong>{users.length}</strong> users
          </div>
        </section>

        {/* USERS TABLE */}
        <section
          style={{
            background: "white",
            border: `1px solid ${BORDER}`,
            borderRadius: 16,
            overflow: "hidden",
            boxShadow: "0 8px 25px rgba(15,23,42,0.04)",
          }}
        >
          <div
            style={{
              padding: "20px 22px",
              borderBottom: `1px solid ${BORDER}`,
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: 10,
              flexWrap: "wrap",
            }}
          >
            <div>
              <h2
                style={{
                  margin: 0,
                  fontSize: 20,
                }}
              >
                Registered Users
              </h2>

              <p
                style={{
                  margin: "5px 0 0",
                  color: MUTED,
                  fontSize: 13,
                }}
              >
                House Connect accounts currently listed in the profiles table.
              </p>
            </div>

            <div
              style={{
                fontSize: 13,
                color: MUTED,
              }}
            >
              {filteredUsers.length} result
              {filteredUsers.length === 1 ? "" : "s"}
            </div>
          </div>

          {filteredUsers.length === 0 ? (
            <div
              style={{
                padding: 50,
                textAlign: "center",
                color: MUTED,
              }}
            >
              <div style={{ fontSize: 40, marginBottom: 10 }}>🔍</div>

              <h3
                style={{
                  margin: 0,
                  color: NAVY,
                }}
              >
                No users found
              </h3>

              <p>
                Try changing the search text or role filter.
              </p>
            </div>
          ) : (
            <>
              {/* DESKTOP TABLE */}
              <div style={{ overflowX: "auto" }}>
                <table
                  style={{
                    width: "100%",
                    borderCollapse: "collapse",
                    minWidth: 700,
                  }}
                >
                  <thead>
                    <tr
                      style={{
                        background: "#f8fafc",
                        textAlign: "left",
                      }}
                    >
                      <th style={thStyle}>USER</th>
                      <th style={thStyle}>PHONE</th>
                      <th style={thStyle}>ROLE</th>
                      <th style={thStyle}>USER ID</th>
                    </tr>
                  </thead>

                  <tbody>
                    {filteredUsers.map((user) => {
                      const roleStyle = getRoleStyle(user.role);

                      return (
                        <tr key={user.id}>
                          <td style={tdStyle}>
                            <div
                              style={{
                                display: "flex",
                                alignItems: "center",
                                gap: 12,
                              }}
                            >
                              <div
                                style={{
                                  width: 42,
                                  height: 42,
                                  borderRadius: "50%",
                                  background: "#e2e8f0",
                                  display: "flex",
                                  alignItems: "center",
                                  justifyContent: "center",
                                  fontWeight: 900,
                                  color: NAVY,
                                  flexShrink: 0,
                                }}
                              >
                                {(user.full_name || "?")
                                  .charAt(0)
                                  .toUpperCase()}
                              </div>

                              <div>
                                <div
                                  style={{
                                    fontWeight: 800,
                                  }}
                                >
                                  {user.full_name || "Unnamed User"}
                                </div>

                                <div
                                  style={{
                                    fontSize: 12,
                                    color: MUTED,
                                    marginTop: 3,
                                  }}
                                >
                                  {user.id}
                                </div>
                              </div>
                            </div>
                          </td>

                          <td style={tdStyle}>
                            {user.phone || "Not provided"}
                          </td>

                          <td style={tdStyle}>
                            <span
                              style={{
                                display: "inline-block",
                                padding: "7px 11px",
                                borderRadius: 999,
                                background: roleStyle.background,
                                color: roleStyle.color,
                                fontWeight: 800,
                                fontSize: 12,
                              }}
                            >
                              {formatRole(user.role)}
                            </span>
                          </td>

                          <td
                            style={{
                              ...tdStyle,
                              fontSize: 11,
                              color: MUTED,
                              maxWidth: 220,
                              wordBreak: "break-all",
                            }}
                          >
                            {user.id}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* MOBILE CARDS */}
              <div
                style={{
                  display: "none",
                }}
              >
                {filteredUsers.map((user) => {
                  const roleStyle = getRoleStyle(user.role);

                  return (
                    <div
                      key={user.id}
                      style={{
                        padding: 18,
                        borderBottom: `1px solid ${BORDER}`,
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 12,
                        }}
                      >
                        <div
                          style={{
                            width: 44,
                            height: 44,
                            borderRadius: "50%",
                            background: "#e2e8f0",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontWeight: 900,
                          }}
                        >
                          {(user.full_name || "?")
                            .charAt(0)
                            .toUpperCase()}
                        </div>

                        <div>
                          <strong>
                            {user.full_name || "Unnamed User"}
                          </strong>

                          <div
                            style={{
                              color: MUTED,
                              fontSize: 13,
                              marginTop: 3,
                            }}
                          >
                            {user.phone || "No phone"}
                          </div>
                        </div>
                      </div>

                      <div style={{ marginTop: 14 }}>
                        <span
                          style={{
                            display: "inline-block",
                            padding: "7px 11px",
                            borderRadius: 999,
                            background: roleStyle.background,
                            color: roleStyle.color,
                            fontWeight: 800,
                            fontSize: 12,
                          }}
                        >
                          {formatRole(user.role)}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </section>

        {/* FOOTER NOTE */}
        <div
          style={{
            textAlign: "center",
            marginTop: 30,
            color: MUTED,
            fontSize: 13,
          }}
        >
          HOUSE CONNECT • FIND • CONNECT • LIVE
        </div>
      </div>
    </main>
  );
}

function StatCard({
  title,
  value,
  icon,
}: {
  title: string;
  value: number;
  icon: string;
}) {
  return (
    <div
      style={{
        background: "white",
        border: `1px solid ${BORDER}`,
        borderRadius: 16,
        padding: 20,
        boxShadow: "0 6px 20px rgba(15,23,42,0.04)",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 10,
        }}
      >
        <div
          style={{
            fontSize: 13,
            color: MUTED,
            fontWeight: 700,
          }}
        >
          {title}
        </div>

        <div style={{ fontSize: 24 }}>{icon}</div>
      </div>

      <div
        style={{
          fontSize: 30,
          fontWeight: 900,
          marginTop: 8,
        }}
      >
        {value}
      </div>
    </div>
  );
}

const thStyle: React.CSSProperties = {
  padding: "15px 18px",
  fontSize: 12,
  color: MUTED,
  fontWeight: 900,
  borderBottom: `1px solid ${BORDER}`,
};

const tdStyle: React.CSSProperties = {
  padding: "16px 18px",
  borderBottom: `1px solid ${BORDER}`,
  fontSize: 14,
};