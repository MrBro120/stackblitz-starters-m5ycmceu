"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { getImageUrl as buildImageUrl } from "@/lib/images";

type Property = {
  id: string;
  landlord_id: string;
  landlordName: string;
  landlordPhone: string;
  title: string;
  location: string;
  type: string;
  rent: string;
  bedrooms: string;
  description: string;
  status: string;
  rejectionReason: string;
  created_at: string;
};

type PropertyImage = {
  id: string;
  property_id: string;
  storage_path: string;
  caption: string | null;
  sort_order: number;
  created_at: string;
};

const NAVY = "#0B3B75";
const GREEN = "#26734D";
const RED = "#B42318";
const IMAGE_BUCKET = "property-images";

export default function CEODashboard() {
  const [sessionChecked, setSessionChecked] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginLoading, setLoginLoading] = useState(false);

  const [properties, setProperties] = useState<Property[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState("");

  const [selected, setSelected] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [filter, setFilter] = useState("All");

  const [actionLoading, setActionLoading] = useState<string | null>(null);

  /* PHOTO REVIEW */
  const [reviewProperty, setReviewProperty] =
    useState<Property | null>(null);

  const [reviewImages, setReviewImages] =
    useState<PropertyImage[]>([]);

  const [reviewImagesLoading, setReviewImagesLoading] =
    useState(false);

  const [reviewError, setReviewError] = useState("");

  const [reviewImageIndex, setReviewImageIndex] =
    useState(0);

  async function verifyAdmin() {
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      setIsAdmin(false);
      return false;
    }

    const { data: profile, error: profileError } =
      await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .single();

    if (profileError) {
      setIsAdmin(false);
      setError(
        `Could not verify admin role: ${profileError.message}`
      );
      return false;
    }

    if (profile?.role !== "admin") {
      setIsAdmin(false);
      setError(
        `This account's profile role is "${
          profile?.role ?? "missing"
        }", not "admin".`
      );
      return false;
    }

    setIsAdmin(true);
    setError("");
    return true;
  }

  async function loadProperties() {
    setLoaded(false);

    const {
      data: propertyData,
      error: propertyError,
    } = await supabase
      .from("properties")
      .select(
        `
        id,
        landlord_id,
        title,
        location,
        property_type,
        monthly_rent,
        bedrooms,
        description,
        status,
        rejection_reason,
        created_at
      `
      )
      .order("created_at", { ascending: false });

    if (propertyError) {
      console.error(propertyError);

      setError(
        `Unable to load properties: ${propertyError.message}`
      );

      setProperties([]);
      setLoaded(true);
      return;
    }

    if (!propertyData || propertyData.length === 0) {
      setProperties([]);
      setLoaded(true);
      return;
    }

    const landlordIds = Array.from(new Set(
        propertyData.map(
          (property: any) => property.landlord_id
        )
      ));

    const { data: profiles, error: profilesError } =
      await supabase
        .from("profiles")
        .select("id, full_name, phone")
        .in("id", landlordIds);

    if (profilesError) {
      console.error(profilesError);
    }

    const profileMap = new Map<
      string,
      {
        full_name: string | null;
        phone: string | null;
      }
    >();

    (profiles || []).forEach((profile: any) => {
      profileMap.set(profile.id, {
        full_name: profile.full_name,
        phone: profile.phone,
      });
    });

    const formattedProperties: Property[] =
      propertyData.map((item: any) => {
        const landlord = profileMap.get(
          item.landlord_id
        );

        return {
          id: item.id,
          landlord_id: item.landlord_id,
          landlordName:
            landlord?.full_name || "Landlord",
          landlordPhone:
            landlord?.phone || "Not provided",
          title:
            item.title || "Untitled property",
          location:
            item.location ||
            "Location not provided",
          type:
            item.property_type || "Property",
          rent:
            item.monthly_rent == null
              ? "0"
              : String(item.monthly_rent),
          bedrooms:
            item.bedrooms == null
              ? ""
              : String(item.bedrooms),
          description:
            item.description || "",
          status:
            item.status ||
            "Pending Verification",
          rejectionReason:
            item.rejection_reason || "",
          created_at: item.created_at,
        };
      });

    setProperties(formattedProperties);
    setLoaded(true);
  }

  useEffect(() => {
    let mounted = true;

    async function start() {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!mounted) return;

      if (session?.user) {
        const ok = await verifyAdmin();

        if (ok && mounted) {
          await loadProperties();
        }
      }

      if (mounted) {
        setSessionChecked(true);
      }
    }

    void start();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        if (!mounted) return;

        if (!session?.user) {
          setIsAdmin(false);
          setProperties([]);
          setLoaded(false);
          return;
        }

        const ok = await verifyAdmin();

        if (ok && mounted) {
          await loadProperties();
        }
      }
    );

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();

    setLoginLoading(true);
    setError("");

    const { error: signInError } =
      await supabase.auth.signInWithPassword({
        email: loginEmail.trim(),
        password: loginPassword,
      });

    if (signInError) {
      setError(
        `Login failed: ${signInError.message}`
      );
      setLoginLoading(false);
      return;
    }

    const ok = await verifyAdmin();

    if (ok) {
      await loadProperties();
    }

    setLoginLoading(false);
  }

  async function handleSignOut() {
    await supabase.auth.signOut();

    setIsAdmin(false);
    setProperties([]);
    setLoaded(false);
    setError("");
  }

  /*
    ============================================================
    PHOTO REVIEW
    ============================================================
  */

  function getPropertyImageUrl(storagePath: string) {
    return buildImageUrl(storagePath);
  }

  async function openPropertyReview(
    property: Property
  ) {
    setReviewProperty(property);
    setReviewImages([]);
    setReviewImageIndex(0);
    setReviewError("");
    setReviewImagesLoading(true);

    const {
      data,
      error: imageError,
    } = await supabase
      .from("property_images")
      .select(
        `
        id,
        property_id,
        storage_path,
        caption,
        sort_order,
        created_at
      `
      )
      .eq("property_id", property.id)
      .order("sort_order", {
        ascending: true,
      });

    if (imageError) {
      console.error(
        "Property image query error:",
        imageError
      );

      setReviewError(
        `Unable to load property photos: ${imageError.message}`
      );

      setReviewImages([]);
      setReviewImagesLoading(false);
      return;
    }

    const images = (data || []) as PropertyImage[];

    console.log(
      "Admin property images:",
      images
    );

    images.forEach((image) => {
      console.log(
        "Image URL:",
        getPropertyImageUrl(
          image.storage_path
        )
      );
    });

    setReviewImages(images);
    setReviewImagesLoading(false);
  }

  function closePropertyReview() {
    setReviewProperty(null);
    setReviewImages([]);
    setReviewImageIndex(0);
    setReviewError("");
  }

  function nextReviewImage() {
    if (reviewImages.length === 0) return;

    setReviewImageIndex((current) =>
      current >= reviewImages.length - 1
        ? 0
        : current + 1
    );
  }

  function previousReviewImage() {
    if (reviewImages.length === 0) return;

    setReviewImageIndex((current) =>
      current <= 0
        ? reviewImages.length - 1
        : current - 1
    );
  }

  async function approveProperty(id: string) {
    setError("");
    setActionLoading(id);

    try {
      const ok = await verifyAdmin();

      if (!ok) {
        return;
      }

      const { data, error: updateError } =
        await supabase
          .from("properties")
          .update({
            status: "Approved",
            rejection_reason: null,
          })
          .eq("id", id)
          .select("id, status")
          .maybeSingle();

      if (updateError) {
        setError(
          `Supabase could not approve this property: ${updateError.message}`
        );
        return;
      }

      if (!data) {
        setError(
          "The property was not updated. Your admin account may need an UPDATE policy on the properties table."
        );
        return;
      }

      setProperties((current) =>
        current.map((property) =>
          property.id === id
            ? {
                ...property,
                status: "Approved",
                rejectionReason: "",
              }
            : property
        )
      );

      setSelected(null);
      setReason("");

      if (reviewProperty?.id === id) {
        setReviewProperty((current) =>
          current
            ? {
                ...current,
                status: "Approved",
                rejectionReason: "",
              }
            : null
        );
      }

      setError(
        "Property approved successfully."
      );
    } finally {
      setActionLoading(null);
    }
  }

  async function rejectProperty(id: string) {
    if (!reason.trim()) {
      setError(
        "Enter a rejection reason first."
      );
      return;
    }

    setError("");
    setActionLoading(id);

    try {
      const ok = await verifyAdmin();

      if (!ok) {
        return;
      }

      const rejectionReason =
        reason.trim();

      const {
        data,
        error: updateError,
      } = await supabase
        .from("properties")
        .update({
          status: "Rejected",
          rejection_reason:
            rejectionReason,
        })
        .eq("id", id)
        .select(
          "id, status, rejection_reason"
        )
        .maybeSingle();

      if (updateError) {
        setError(
          `Supabase could not reject this property: ${updateError.message}`
        );
        return;
      }

      if (!data) {
        setError(
          "The property was not updated. Your admin account may need an UPDATE policy on the properties table."
        );
        return;
      }

      setProperties((current) =>
        current.map((property) =>
          property.id === id
            ? {
                ...property,
                status: "Rejected",
                rejectionReason,
              }
            : property
        )
      );

      setSelected(null);
      setReason("");

      if (reviewProperty?.id === id) {
        setReviewProperty((current) =>
          current
            ? {
                ...current,
                status: "Rejected",
                rejectionReason,
              }
            : null
        );
      }

      setError(
        "Property rejected successfully."
      );
    } finally {
      setActionLoading(null);
    }
  }

  const pending = properties.filter(
    (p) =>
      p.status === "Pending Verification"
  ).length;

  const approved = properties.filter(
    (p) => p.status === "Approved"
  ).length;

  const rejected = properties.filter(
    (p) => p.status === "Rejected"
  ).length;

  const visibleProperties =
    properties.filter(
      (p) =>
        filter === "All" ||
        p.status === filter
    );

  const cardStyle: React.CSSProperties = {
    background: "white",
    border: "1px solid #E1E8F0",
    borderRadius: "12px",
    padding: "20px",
  };

  const buttonStyle: React.CSSProperties = {
    border: "none",
    borderRadius: "8px",
    padding: "12px 18px",
    fontWeight: "bold",
    cursor: "pointer",
  };

  if (!sessionChecked) {
    return (
      <main
        style={{
          padding: 40,
          fontFamily:
            "Arial, sans-serif",
        }}
      >
        Loading CEO login...
      </main>
    );
  }

  if (!isAdmin) {
    return (
      <main
        style={{
          background: "#F7F9FC",
          minHeight: "100vh",
          fontFamily:
            "Arial, sans-serif",
          color: "#102A43",
        }}
      >
        <header
          style={{
            background: NAVY,
            color: "white",
            padding: 22,
          }}
        >
          <div
            style={{
              maxWidth: 500,
              margin: "auto",
              display: "flex",
              justifyContent:
                "space-between",
              alignItems: "center",
              gap: 15,
            }}
          >
            <strong
              style={{
                fontSize: 23,
              }}
            >
              🏠 HOUSE CONNECT
            </strong>

            <Link
              href="/"
              style={{
                color: "white",
              }}
            >
              ← Homepage
            </Link>
          </div>
        </header>

        <div
          style={{
            maxWidth: 500,
            margin: "50px auto",
            padding: "0 18px",
          }}
        >
          <div style={cardStyle}>
            <p
              style={{
                color: NAVY,
                fontWeight: "bold",
              }}
            >
              CEO / ADMIN
            </p>

            <h1>CEO Login</h1>

            <p
              style={{
                color: "#627D98",
              }}
            >
              Sign in with the House Connect
              administrator account.
            </p>

            {error && (
              <div
                role="alert"
                style={{
                  background: "#FCE4E4",
                  color: RED,
                  padding: 14,
                  borderRadius: 9,
                  marginBottom: 15,
                }}
              >
                {error}
              </div>
            )}

            <form
              onSubmit={handleLogin}
            >
              <label>Email</label>

              <input
                type="email"
                value={loginEmail}
                onChange={(e) =>
                  setLoginEmail(
                    e.target.value
                  )
                }
                required
                style={{
                  width: "100%",
                  boxSizing:
                    "border-box",
                  padding: 12,
                  margin:
                    "8px 0 16px",
                  border:
                    "1px solid #D7E0EA",
                  borderRadius: 8,
                }}
              />

              <label>Password</label>

              <input
                type="password"
                value={loginPassword}
                onChange={(e) =>
                  setLoginPassword(
                    e.target.value
                  )
                }
                required
                style={{
                  width: "100%",
                  boxSizing:
                    "border-box",
                  padding: 12,
                  margin:
                    "8px 0 18px",
                  border:
                    "1px solid #D7E0EA",
                  borderRadius: 8,
                }}
              />

              <button
                type="submit"
                disabled={loginLoading}
                style={{
                  ...buttonStyle,
                  width: "100%",
                  background: NAVY,
                  color: "white",
                  opacity:
                    loginLoading
                      ? 0.7
                      : 1,
                }}
              >
                {loginLoading
                  ? "Signing in..."
                  : "Sign In"}
              </button>
            </form>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main
      style={{
        background: "#F7F9FC",
        color: "#102A43",
        minHeight: "100vh",
        fontFamily:
          "Arial, sans-serif",
      }}
    >
      <header
        style={{
          background: NAVY,
          color: "white",
          padding: 22,
        }}
      >
        <div
          style={{
            maxWidth: 1100,
            margin: "auto",
            display: "flex",
            justifyContent:
              "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: 15,
          }}
        >
          <strong
            style={{
              fontSize: 23,
            }}
          >
            🏠 HOUSE CONNECT
          </strong>

          <div
            style={{
              display: "flex",
              gap: 15,
              alignItems: "center",
            }}
          >
            <Link
              href="/"
              style={{
                color: "white",
              }}
            >
              ← Homepage
            </Link>

            <button
              type="button"
              onClick={
                handleSignOut
              }
              style={{
                ...buttonStyle,
                background: "white",
                color: NAVY,
                padding:
                  "9px 14px",
              }}
            >
              Sign Out
            </button>
          </div>
        </div>
      </header>

      <div
        style={{
          maxWidth: 1100,
          margin: "auto",
          padding:
            "30px 18px",
        }}
      >
        <p
          style={{
            color: NAVY,
            fontWeight: "bold",
          }}
        >
          CEO / ADMIN
        </p>

        <h1>
          Property Management
          Dashboard
        </h1>

        <p
          style={{
            color: "#627D98",
          }}
        >
          Review and manage properties
          submitted by landlords.
        </p>

        {error && (
          <div
            role="alert"
            style={{
              background:
                error.includes(
                  "successfully"
                )
                  ? "#DFF3E7"
                  : "#FCE4E4",
              color:
                error.includes(
                  "successfully"
                )
                  ? GREEN
                  : RED,
              padding: 14,
              borderRadius: 9,
              marginBottom: 15,
            }}
          >
            {error}
          </div>
        )}

        {/* STATISTICS */}

        <div
          style={{
            display: "grid",
            gridTemplateColumns:
              "repeat(auto-fit, minmax(180px, 1fr))",
            gap: 15,
            margin: "25px 0",
          }}
        >
          {[
            [
              "Total Properties",
              properties.length,
              NAVY,
            ],
            [
              "Pending",
              pending,
              "#A16207",
            ],
            [
              "Approved",
              approved,
              GREEN,
            ],
            [
              "Rejected",
              rejected,
              RED,
            ],
          ].map(
            ([
              label,
              count,
              color,
            ]) => (
              <div
                key={String(label)}
                style={cardStyle}
              >
                <p
                  style={{
                    color:
                      "#627D98",
                  }}
                >
                  {label}
                </p>

                <strong
                  style={{
                    color:
                      String(color),
                    fontSize: 32,
                  }}
                >
                  {count}
                </strong>
              </div>
            )
          )}
        </div>

        {/* FILTERS */}

        <div
          style={{
            display: "flex",
            gap: 10,
            flexWrap: "wrap",
            marginBottom: 25,
          }}
        >
          {[
            "All",
            "Pending Verification",
            "Approved",
            "Rejected",
          ].map((item) => (
            <button
              key={item}
              type="button"
              onClick={() =>
                setFilter(item)
              }
              style={{
                ...buttonStyle,
                background:
                  filter === item
                    ? NAVY
                    : "white",
                color:
                  filter === item
                    ? "white"
                    : NAVY,
                border:
                  "1px solid #D7E0EA",
              }}
            >
              {item}
            </button>
          ))}

          <button
            type="button"
            onClick={() =>
              void loadProperties()
            }
            style={{
              ...buttonStyle,
              background:
                "#E8F1FA",
              color: NAVY,
            }}
          >
            ↻ Refresh
          </button>
        </div>

        {/* PROPERTY LIST */}

        {!loaded ? (
          <p>
            Loading properties...
          </p>
        ) : visibleProperties.length ===
          0 ? (
          <div
            style={cardStyle}
          >
            <h3>
              No properties found
            </h3>

            <p>
              No properties match
              the selected filter.
            </p>
          </div>
        ) : (
          <div
            style={{
              display: "grid",
              gap: 18,
            }}
          >
            {visibleProperties.map(
              (property) => {
                const isSelected =
                  selected ===
                  property.id;

                const isActionLoading =
                  actionLoading ===
                  property.id;

                return (
                  <article
                    key={property.id}
                    style={
                      cardStyle
                    }
                  >
                    <div
                      style={{
                        display:
                          "flex",
                        justifyContent:
                          "space-between",
                        gap: 15,
                        flexWrap:
                          "wrap",
                      }}
                    >
                      <div>
                        <h2
                          style={{
                            marginTop:
                              0,
                          }}
                        >
                          🏠{" "}
                          {
                            property.title
                          }
                        </h2>

                        <p>
                          📍{" "}
                          {
                            property.location
                          }
                        </p>

                        <strong
                          style={{
                            color:
                              NAVY,
                          }}
                        >
                          UGX{" "}
                          {Number(
                            property.rent
                          ).toLocaleString()}
                          /month
                        </strong>
                      </div>

                      <span
                        style={{
                          alignSelf:
                            "flex-start",
                          background:
                            property.status ===
                            "Approved"
                              ? "#DFF3E7"
                              : property.status ===
                                "Rejected"
                              ? "#FCE4E4"
                              : "#FFF3CD",
                          color:
                            property.status ===
                            "Approved"
                              ? GREEN
                              : property.status ===
                                "Rejected"
                              ? RED
                              : "#856404",
                          padding:
                            "9px 13px",
                          borderRadius:
                            20,
                          fontWeight:
                            "bold",
                          fontSize:
                            13,
                        }}
                      >
                        {
                          property.status
                        }
                      </span>
                    </div>

                    <hr
                      style={{
                        border:
                          "none",
                        borderTop:
                          "1px solid #EDF1F5",
                        margin:
                          "20px 0",
                      }}
                    />

                    <p>
                      <strong>
                        Landlord:
                      </strong>{" "}
                      {
                        property.landlordName
                      }
                    </p>

                    <p>
                      <strong>
                        Phone:
                      </strong>{" "}
                      {
                        property.landlordPhone
                      }
                    </p>

                    <p>
                      <strong>
                        Property type:
                      </strong>{" "}
                      {
                        property.type
                      }
                    </p>

                    <p>
                      <strong>
                        Bedrooms:
                      </strong>{" "}
                      {property.bedrooms ||
                        "Not specified"}
                    </p>

                    <p>
                      <strong>
                        Description:
                      </strong>{" "}
                      {
                        property.description ||
                        "None provided"
                      }
                    </p>

                    {property.rejectionReason && (
                      <div
                        style={{
                          background:
                            "#FCE4E4",
                          padding: 14,
                          borderRadius:
                            9,
                          marginBottom:
                            15,
                        }}
                      >
                        <strong>
                          Rejection
                          reason:
                        </strong>

                        <p>
                          {
                            property.rejectionReason
                          }
                        </p>
                      </div>
                    )}

                    {/* VIEW FULL DETAILS */}

                    <button
                      type="button"
                      onClick={() =>
                        void openPropertyReview(
                          property
                        )
                      }
                      style={{
                        ...buttonStyle,
                        width:
                          "100%",
                        background:
                          "#E8F1FA",
                        color: NAVY,
                        marginBottom:
                          12,
                      }}
                    >
                      👁 View Full
                      Details & Photos
                    </button>

                    {/* APPROVE / REJECT */}

                    <div
                      style={{
                        display:
                          "flex",
                        gap: 10,
                        flexWrap:
                          "wrap",
                      }}
                    >
                      {property.status !==
                        "Approved" && (
                        <button
                          type="button"
                          disabled={
                            isActionLoading
                          }
                          onClick={() =>
                            void approveProperty(
                              property.id
                            )
                          }
                          style={{
                            ...buttonStyle,
                            background:
                              GREEN,
                            color:
                              "white",
                            opacity:
                              isActionLoading
                                ? 0.6
                                : 1,
                          }}
                        >
                          {isActionLoading
                            ? "Processing..."
                            : "✓ Approve"}
                        </button>
                      )}

                      {property.status !==
                        "Rejected" && (
                        <button
                          type="button"
                          disabled={
                            isActionLoading
                          }
                          onClick={() => {
                            setSelected(
                              isSelected
                                ? null
                                : property.id
                            );
                            setReason(
                              ""
                            );
                            setError(
                              ""
                            );
                          }}
                          style={{
                            ...buttonStyle,
                            background:
                              "#FCE4E4",
                            color:
                              RED,
                            opacity:
                              isActionLoading
                                ? 0.6
                                : 1,
                          }}
                        >
                          ✕ Reject
                        </button>
                      )}
                    </div>

                    {isSelected && (
                      <div
                        style={{
                          marginTop:
                            18,
                          padding: 18,
                          background:
                            "#FFF8E1",
                          borderRadius:
                            10,
                        }}
                      >
                        <h3>
                          Reason for
                          Rejection
                        </h3>

                        <textarea
                          value={
                            reason
                          }
                          onChange={(
                            e
                          ) =>
                            setReason(
                              e.target
                                .value
                            )
                          }
                          placeholder="Explain why this property is being rejected..."
                          style={{
                            width:
                              "100%",
                            minHeight:
                              100,
                            padding:
                              12,
                            boxSizing:
                              "border-box",
                            border:
                              "1px solid #D7E0EA",
                            borderRadius:
                              8,
                            fontFamily:
                              "inherit",
                          }}
                        />

                        <button
                          type="button"
                          disabled={
                            isActionLoading
                          }
                          onClick={() =>
                            void rejectProperty(
                              property.id
                            )
                          }
                          style={{
                            ...buttonStyle,
                            background:
                              RED,
                            color:
                              "white",
                            marginTop:
                              12,
                            opacity:
                              isActionLoading
                                ? 0.6
                                : 1,
                          }}
                        >
                          {isActionLoading
                            ? "Processing..."
                            : "Confirm Rejection"}
                        </button>
                      </div>
                    )}
                  </article>
                );
              }
            )}
          </div>
        )}
      </div>

      {/* =====================================================
          FULL PROPERTY REVIEW MODAL
          ===================================================== */}

      {reviewProperty && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background:
              "rgba(0,0,0,0.72)",
            zIndex: 9999,
            overflowY: "auto",
            padding: "25px 15px",
          }}
        >
          <div
            style={{
              maxWidth: 1000,
              margin: "0 auto",
              background: "white",
              borderRadius: 16,
              overflow: "hidden",
              boxShadow:
                "0 20px 60px rgba(0,0,0,0.3)",
            }}
          >
            {/* MODAL HEADER */}

            <div
              style={{
                background: NAVY,
                color: "white",
                padding:
                  "18px 22px",
                display: "flex",
                justifyContent:
                  "space-between",
                alignItems:
                  "center",
                gap: 15,
              }}
            >
              <div>
                <div
                  style={{
                    fontSize: 13,
                    opacity: 0.8,
                    marginBottom: 4,
                  }}
                >
                  PROPERTY REVIEW
                </div>

                <h2
                  style={{
                    margin: 0,
                  }}
                >
                  🏠{" "}
                  {
                    reviewProperty.title
                  }
                </h2>
              </div>

              <button
                type="button"
                onClick={
                  closePropertyReview
                }
                style={{
                  background:
                    "rgba(255,255,255,0.15)",
                  color: "white",
                  border:
                    "1px solid rgba(255,255,255,0.3)",
                  borderRadius: 8,
                  padding:
                    "10px 14px",
                  cursor:
                    "pointer",
                  fontWeight:
                    "bold",
                  fontSize: 18,
                }}
              >
                ×
              </button>
            </div>

            <div
              style={{
                padding: 22,
              }}
            >
              {/* PHOTOS */}

              <h3
                style={{
                  color: NAVY,
                  marginTop: 0,
                }}
              >
                Property Photos
              </h3>

              {reviewImagesLoading ? (
                <div
                  style={{
                    background:
                      "#F7F9FC",
                    minHeight: 250,
                    borderRadius: 12,
                    display: "flex",
                    alignItems:
                      "center",
                    justifyContent:
                      "center",
                  }}
                >
                  Loading photos...
                </div>
              ) : reviewError ? (
                <div
                  style={{
                    background:
                      "#FCE4E4",
                    color: RED,
                    padding: 15,
                    borderRadius: 10,
                  }}
                >
                  {reviewError}
                </div>
              ) : reviewImages.length ===
                0 ? (
                <div
                  style={{
                    background:
                      "#F7F9FC",
                    minHeight: 200,
                    borderRadius: 12,
                    display: "flex",
                    flexDirection:
                      "column",
                    alignItems:
                      "center",
                    justifyContent:
                      "center",
                    padding: 20,
                    textAlign:
                      "center",
                  }}
                >
                  <div
                    style={{
                      fontSize: 50,
                      marginBottom: 10,
                    }}
                  >
                    📷
                  </div>

                  <strong>
                    No photos found
                  </strong>

                  <p
                    style={{
                      color:
                        "#627D98",
                    }}
                  >
                    This property does
                    not currently have
                    any photos uploaded.
                  </p>
                </div>
              ) : (
                <div>
                  {/* MAIN IMAGE */}

                  <div
                    style={{
                      position:
                        "relative",
                      width:
                        "100%",
                      height:
                        "min(60vh, 500px)",
                      background:
                        "#101820",
                      borderRadius: 12,
                      overflow:
                        "hidden",
                      display: "flex",
                      alignItems:
                        "center",
                      justifyContent:
                        "center",
                    }}
                  >
                    <img
                      src={getPropertyImageUrl(
                        reviewImages[
                          reviewImageIndex
                        ]
                          .storage_path
                      )}
                      alt={
                        reviewImages[
                          reviewImageIndex
                        ].caption ||
                        reviewProperty.title
                      }
                      style={{
                        width:
                          "100%",
                        height:
                          "100%",
                        objectFit:
                          "contain",
                        display:
                          "block",
                      }}
                      onError={(e) => {
                        console.error(
                          "Image failed to load:",
                          getPropertyImageUrl(
                            reviewImages[
                              reviewImageIndex
                            ]
                              .storage_path
                          )
                        );

                        e.currentTarget.style.display =
                          "none";
                      }}
                    />

                    {reviewImages.length >
                      1 && (
                      <>
                        <button
                          type="button"
                          onClick={
                            previousReviewImage
                          }
                          style={{
                            position:
                              "absolute",
                            left: 12,
                            top: "50%",
                            transform:
                              "translateY(-50%)",
                            width: 45,
                            height: 45,
                            borderRadius:
                              "50%",
                            border:
                              "none",
                            background:
                              "rgba(0,0,0,0.65)",
                            color:
                              "white",
                            fontSize:
                              25,
                            cursor:
                              "pointer",
                          }}
                        >
                          ‹
                        </button>

                        <button
                          type="button"
                          onClick={
                            nextReviewImage
                          }
                          style={{
                            position:
                              "absolute",
                            right: 12,
                            top: "50%",
                            transform:
                              "translateY(-50%)",
                            width: 45,
                            height: 45,
                            borderRadius:
                              "50%",
                            border:
                              "none",
                            background:
                              "rgba(0,0,0,0.65)",
                            color:
                              "white",
                            fontSize:
                              25,
                            cursor:
                              "pointer",
                          }}
                        >
                          ›
                        </button>
                      </>
                    )}

                    <div
                      style={{
                        position:
                          "absolute",
                        bottom: 12,
                        left: "50%",
                        transform:
                          "translateX(-50%)",
                        background:
                          "rgba(0,0,0,0.7)",
                        color: "white",
                        padding:
                          "7px 12px",
                        borderRadius:
                          20,
                        fontSize: 13,
                      }}
                    >
                      {reviewImageIndex +
                        1}{" "}
                      /{" "}
                      {
                        reviewImages.length
                      }
                    </div>
                  </div>

                  {/* THUMBNAILS */}

                  {reviewImages.length >
                    1 && (
                    <div
                      style={{
                        display:
                          "flex",
                        gap: 10,
                        overflowX:
                          "auto",
                        padding:
                          "12px 2px",
                      }}
                    >
                      {reviewImages.map(
                        (
                          image,
                          index
                        ) => (
                          <button
                            key={
                              image.id
                            }
                            type="button"
                            onClick={() =>
                              setReviewImageIndex(
                                index
                              )
                            }
                            style={{
                              flex:
                                "0 0 90px",
                              width: 90,
                              height: 70,
                              padding: 0,
                              borderRadius:
                                8,
                              overflow:
                                "hidden",
                              cursor:
                                "pointer",
                              border:
                                index ===
                                reviewImageIndex
                                  ? `3px solid ${NAVY}`
                                  : "2px solid #D7E0EA",
                              background:
                                "#101820",
                            }}
                          >
                            <img
                              src={getPropertyImageUrl(
                                image.storage_path
                              )}
                              alt={
                                image.caption ||
                                `Photo ${
                                  index +
                                  1
                                }`
                              }
                              style={{
                                width:
                                  "100%",
                                height:
                                  "100%",
                                objectFit:
                                  "cover",
                              }}
                            />
                          </button>
                        )
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* PROPERTY INFORMATION */}

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns:
                    "repeat(auto-fit, minmax(280px, 1fr))",
                  gap: 18,
                  marginTop: 25,
                }}
              >
                <div
                  style={{
                    background:
                      "#F7F9FC",
                    padding: 18,
                    borderRadius: 12,
                  }}
                >
                  <h3
                    style={{
                      color: NAVY,
                      marginTop: 0,
                    }}
                  >
                    Property Information
                  </h3>

                  <p>
                    <strong>
                      Title:
                    </strong>{" "}
                    {
                      reviewProperty.title
                    }
                  </p>

                  <p>
                    <strong>
                      Location:
                    </strong>{" "}
                    {
                      reviewProperty.location
                    }
                  </p>

                  <p>
                    <strong>
                      Type:
                    </strong>{" "}
                    {
                      reviewProperty.type
                    }
                  </p>

                  <p>
                    <strong>
                      Bedrooms:
                    </strong>{" "}
                    {
                      reviewProperty.bedrooms ||
                      "Not specified"
                    }
                  </p>

                  <p>
                    <strong>
                      Monthly Rent:
                    </strong>{" "}
                    UGX{" "}
                    {Number(
                      reviewProperty.rent
                    ).toLocaleString()}
                  </p>

                  <p>
                    <strong>
                      Status:
                    </strong>{" "}
                    {
                      reviewProperty.status
                    }
                  </p>
                </div>

                <div
                  style={{
                    background:
                      "#F7F9FC",
                    padding: 18,
                    borderRadius: 12,
                  }}
                >
                  <h3
                    style={{
                      color: NAVY,
                      marginTop: 0,
                    }}
                  >
                    Landlord Information
                  </h3>

                  <p>
                    <strong>
                      Name:
                    </strong>{" "}
                    {
                      reviewProperty.landlordName
                    }
                  </p>

                  <p>
                    <strong>
                      Phone:
                    </strong>{" "}
                    {
                      reviewProperty.landlordPhone
                    }
                  </p>
                </div>
              </div>

              {/* DESCRIPTION */}

              <div
                style={{
                  marginTop: 18,
                  padding: 18,
                  background:
                    "#F7F9FC",
                  borderRadius: 12,
                }}
              >
                <h3
                  style={{
                    color: NAVY,
                    marginTop: 0,
                  }}
                >
                  Full Description
                </h3>

                <p
                  style={{
                    whiteSpace:
                      "pre-wrap",
                    lineHeight: 1.6,
                    marginBottom: 0,
                  }}
                >
                  {reviewProperty.description ||
                    "No description provided."}
                </p>
              </div>

              {/* REJECTION REASON */}

              {reviewProperty.rejectionReason && (
                <div
                  style={{
                    marginTop: 18,
                    padding: 18,
                    background:
                      "#FCE4E4",
                    color: RED,
                    borderRadius: 12,
                  }}
                >
                  <strong>
                    Current Rejection
                    Reason
                  </strong>

                  <p
                    style={{
                      marginBottom: 0,
                    }}
                  >
                    {
                      reviewProperty.rejectionReason
                    }
                  </p>
                </div>
              )}

              {/* ACTIONS */}

              <div
                style={{
                  display:
                    "flex",
                  gap: 10,
                  flexWrap:
                    "wrap",
                  marginTop: 25,
                  paddingTop: 20,
                  borderTop:
                    "1px solid #E1E8F0",
                }}
              >
                {reviewProperty.status !==
                  "Approved" && (
                  <button
                    type="button"
                    disabled={
                      actionLoading ===
                      reviewProperty.id
                    }
                    onClick={() =>
                      void approveProperty(
                        reviewProperty.id
                      )
                    }
                    style={{
                      ...buttonStyle,
                      background:
                        GREEN,
                      color:
                        "white",
                      flex:
                        "1 1 180px",
                    }}
                  >
                    {actionLoading ===
                    reviewProperty.id
                      ? "Processing..."
                      : "✓ Approve Property"}
                  </button>
                )}

                {reviewProperty.status !==
                  "Rejected" && (
                  <button
                    type="button"
                    onClick={() => {
                      setSelected(
                        reviewProperty.id
                      );
                      setReason("");
                      closePropertyReview();
                    }}
                    style={{
                      ...buttonStyle,
                      background:
                        "#FCE4E4",
                      color:
                        RED,
                      flex:
                        "1 1 180px",
                    }}
                  >
                    ✕ Reject Property
                  </button>
                )}

                <button
                  type="button"
                  onClick={
                    closePropertyReview
                  }
                  style={{
                    ...buttonStyle,
                    background:
                      "#E8F1FA",
                    color: NAVY,
                    flex:
                      "1 1 180px",
                  }}
                >
                  Close Review
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}