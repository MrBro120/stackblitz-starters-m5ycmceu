"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "../lib/supabase";
import { getImageUrl } from "@/lib/images";

type Property = {
  id: string;
  title: string;
  location: string;
  property_type: string;
  monthly_rent: number;
  bedrooms: number | null;
  description: string | null;
  status: string;
  created_at: string;
};

type PropertyImage = {
  id: string;
  property_id: string;
  storage_path: string;
  caption: string | null;
  sort_order: number;
  created_at: string;
  public_url: string;
};

type PropertyFilter =
  | "All"
  | "House"
  | "Apartment"
  | "Room"
  | "Studio"
  | "Commercial";

export default function HomePage() {
  const router = useRouter();

  // ==================================================
  // PROPERTY STATE
  // ==================================================

  const [properties, setProperties] =
    useState<Property[]>([]);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState("");

  const [search, setSearch] =
    useState("");

  const [filter, setFilter] =
    useState<PropertyFilter>("All");

  // ==================================================
  // EXTRA FILTERS
  // ==================================================

  const [maxRent, setMaxRent] =
    useState("");

  const [bedroomFilter, setBedroomFilter] =
    useState("All");

  // ==================================================
  // PROPERTY IMAGE STATE
  // ==================================================

  const [propertyImages, setPropertyImages] =
    useState<Record<string, PropertyImage[]>>({});

  const [imagesLoading, setImagesLoading] =
    useState(false);

  // ==================================================
  // PROPERTY DETAILS
  // ==================================================

  const [selectedProperty, setSelectedProperty] =
    useState<Property | null>(null);

  const [selectedImageIndex, setSelectedImageIndex] =
    useState(0);

  const [showFullPhoto, setShowFullPhoto] =
    useState(false);

  const [touchStartX, setTouchStartX] =
    useState<number | null>(null);

  // ==================================================
  // VIEWING REQUEST
  // ==================================================

  const [showViewingForm, setShowViewingForm] =
    useState(false);

  const [preferredDate, setPreferredDate] =
    useState("");

  const [preferredTime, setPreferredTime] =
    useState("");

  const [viewingMessage, setViewingMessage] =
    useState("");

  const [submittingRequest, setSubmittingRequest] =
    useState(false);

  const [requestMessage, setRequestMessage] =
    useState("");

  const [requestError, setRequestError] =
    useState("");

  // ==================================================
  // LOGIN / ACCOUNT STATE
  // ==================================================

  const [checkingAccount, setCheckingAccount] =
    useState(false);

  // ==================================================
  // LOAD PROPERTY IMAGES
  // ==================================================

  async function loadPropertyImages(
    propertyList: Property[]
  ) {
    if (!propertyList.length) {
      setPropertyImages({});
      return;
    }

    setImagesLoading(true);

    try {
      const propertyIds = propertyList.map(
        (property) => property.id
      );

      const {
        data,
        error: imageError,
      } = await supabase
        .from("property_images")
        .select(
          "id, property_id, storage_path, caption, sort_order, created_at"
        )
        .in("property_id", propertyIds)
        .order("sort_order", {
          ascending: true,
        });

      if (imageError) {
        console.error(
          "Property image loading error:",
          imageError
        );

        setPropertyImages({});
        setImagesLoading(false);
        return;
      }

      const groupedImages: Record<
        string,
        PropertyImage[]
      > = {};

      (data || []).forEach((image) => {
        const imageWithUrl: PropertyImage = {
          ...image,
          public_url:
            getImageUrl(
              image.storage_path
            ),
        };

        if (
          !groupedImages[
            image.property_id
          ]
        ) {
          groupedImages[
            image.property_id
          ] = [];
        }

        groupedImages[
          image.property_id
        ].push(imageWithUrl);
      });

      setPropertyImages(
        groupedImages
      );
    } catch (err) {
      console.error(
        "Unexpected property image error:",
        err
      );

      setPropertyImages({});
    }

    setImagesLoading(false);
  }

  // ==================================================
  // LOAD APPROVED PROPERTIES
  // ==================================================

  async function loadProperties() {
    setLoading(true);
    setError("");

    try {
      const {
        data,
        error: propertyError,
      } = await supabase
        .from("properties")
        .select(
          "id, title, location, property_type, monthly_rent, bedrooms, description, status, created_at"
        )
        .eq(
          "status",
          "Approved"
        )
        .order(
          "created_at",
          {
            ascending: false,
          }
        );

      if (propertyError) {
        console.error(
          "Property loading error:",
          propertyError
        );

        setError(
          "We could not load properties right now. Please try again."
        );

        setProperties([]);
        setPropertyImages({});
        setLoading(false);
        return;
      }

      const loadedProperties =
        data || [];

      setProperties(
        loadedProperties
      );

      await loadPropertyImages(
        loadedProperties
      );
    } catch (err) {
      console.error(
        "Unexpected property loading error:",
        err
      );

      setError(
        "Something went wrong while loading properties."
      );
    }

    setLoading(false);
  }

  // ==================================================
  // INITIAL LOAD
  // ==================================================

  useEffect(() => {
    loadProperties();
  }, []);

  // ==================================================
  // FILTER PROPERTIES
  // ==================================================

  const filteredProperties =
    useMemo(() => {
      const searchText =
        search.trim().toLowerCase();

      const maximumRent =
        maxRent.trim()
          ? Number(maxRent)
          : null;

      return properties.filter(
        (property) => {
          const matchesSearch =
            !searchText ||
            property.title
              .toLowerCase()
              .includes(searchText) ||
            property.location
              .toLowerCase()
              .includes(searchText) ||
            property.property_type
              .toLowerCase()
              .includes(searchText);

          const matchesType =
            filter === "All" ||
            property.property_type
              .toLowerCase() ===
              filter.toLowerCase();

          const matchesRent =
            maximumRent === null ||
            (!Number.isNaN(
              maximumRent
            ) &&
              property.monthly_rent <=
                maximumRent);

          const matchesBedrooms =
            bedroomFilter === "All" ||
            (bedroomFilter === "5+" &&
              property.bedrooms !== null &&
              property.bedrooms >= 5) ||
            (bedroomFilter !== "5+" &&
              property.bedrooms !== null &&
              property.bedrooms ===
                Number(
                  bedroomFilter
                ));

          return (
            matchesSearch &&
            matchesType &&
            matchesRent &&
            matchesBedrooms
          );
        }
      );
    }, [
      properties,
      search,
      filter,
      maxRent,
      bedroomFilter,
    ]);

  // ==================================================
  // GET PROPERTY IMAGES
  // ==================================================

  function getImagesForProperty(
    propertyId: string
  ) {
    return (
      propertyImages[propertyId] ||
      []
    );
  }

  // ==================================================
  // OPEN PROPERTY
  // ==================================================

  function openProperty(
    property: Property
  ) {
    setSelectedProperty(
      property
    );

    setSelectedImageIndex(0);

    setShowFullPhoto(false);

    setShowViewingForm(false);

    setRequestMessage("");

    setRequestError("");

    setPreferredDate("");

    setPreferredTime("");

    setViewingMessage("");
  }

  // ==================================================
  // CLOSE PROPERTY
  // ==================================================

  function closeProperty() {
    if (submittingRequest) {
      return;
    }

    setSelectedProperty(null);

    setSelectedImageIndex(0);

    setShowFullPhoto(false);

    setShowViewingForm(false);

    setRequestMessage("");

    setRequestError("");

    setPreferredDate("");

    setPreferredTime("");

    setViewingMessage("");
  }

  // ==================================================
  // OPEN VIEWING REQUEST FORM
  // ==================================================

  async function openViewingForm() {
    setRequestMessage("");
    setRequestError("");

    setCheckingAccount(true);

    try {
      const {
        data: { user },
      } =
        await supabase.auth.getUser();

      if (!user) {
        router.push(
          "/tenant"
        );

        return;
      }

      const {
        data: profile,
        error: profileError,
      } = await supabase
        .from("profiles")
        .select("role")
        .eq(
          "id",
          user.id
        )
        .maybeSingle();

      if (profileError) {
        console.error(
          "Account verification error:",
          profileError
        );

        setRequestError(
          "We could not verify your account. Please try again."
        );

        return;
      }

      if (
        !profile ||
        profile.role !== "tenant"
      ) {
        setRequestError(
          "Please use a tenant account to request a property viewing."
        );

        return;
      }

      setShowViewingForm(true);
    } catch (err) {
      console.error(
        "Unexpected account check error:",
        err
      );

      setRequestError(
        "We could not verify your account. Please try again."
      );
    } finally {
      setCheckingAccount(false);
    }
  }

  // ==================================================
  // NEXT IMAGE
  // ==================================================

  function nextImage() {
    if (!selectedProperty) {
      return;
    }

    const images =
      getImagesForProperty(
        selectedProperty.id
      );

    if (images.length <= 1) {
      return;
    }

    setSelectedImageIndex(
      (current) =>
        (current + 1) %
        images.length
    );
  }

  // ==================================================
  // PREVIOUS IMAGE
  // ==================================================

  function previousImage() {
    if (!selectedProperty) {
      return;
    }

    const images =
      getImagesForProperty(
        selectedProperty.id
      );

    if (images.length <= 1) {
      return;
    }

    setSelectedImageIndex(
      (current) =>
        current === 0
          ? images.length - 1
          : current - 1
    );
  }

  // ==================================================
  // SUBMIT VIEWING REQUEST
  // ==================================================

  async function submitViewingRequest() {
    setRequestMessage("");
    setRequestError("");

    if (!selectedProperty) {
      setRequestError(
        "Please select a property first."
      );
      return;
    }

    if (
      selectedProperty.status !==
      "Approved"
    ) {
      setRequestError(
        "This property is no longer available for viewing requests."
      );
      return;
    }

    if (!preferredDate) {
      setRequestError(
        "Please select your preferred viewing date."
      );
      return;
    }

    if (!preferredTime) {
      setRequestError(
        "Please select your preferred viewing time."
      );
      return;
    }

    setSubmittingRequest(true);

    try {
      const {
        data: { user },
      } =
        await supabase.auth.getUser();

      if (!user) {
        router.push(
          "/tenant"
        );

        return;
      }

      const {
        data: profile,
        error: profileError,
      } = await supabase
        .from("profiles")
        .select("role")
        .eq(
          "id",
          user.id
        )
        .maybeSingle();

      if (profileError) {
        console.error(
          "Tenant profile error:",
          profileError
        );

        setRequestError(
          "We could not verify your account."
        );

        return;
      }

      if (
        !profile ||
        profile.role !== "tenant"
      ) {
        setRequestError(
          "Only tenant accounts can request property viewings."
        );

        return;
      }

      const {
        data: existingRequests,
        error:
          existingRequestError,
      } = await supabase
        .from("viewing_requests")
        .select(
          "id, status, created_at"
        )
        .eq(
          "property_id",
          selectedProperty.id
        )
        .eq(
          "tenant_id",
          user.id
        )
        .in(
          "status",
          [
            "Pending",
            "Accepted",
          ]
        )
        .order(
          "created_at",
          {
            ascending: false,
          }
        )
        .limit(1);

      if (existingRequestError) {
        console.error(
          "Existing request check error:",
          existingRequestError
        );

        setRequestError(
          "We could not check your previous viewing requests. Please try again."
        );

        return;
      }

      const existingRequest =
        existingRequests?.[0];

      if (
        existingRequest?.status ===
        "Pending"
      ) {
        setRequestError(
          "You already have a pending viewing request for this property. Please wait for the landlord to respond."
        );

        return;
      }

      if (
        existingRequest?.status ===
        "Accepted"
      ) {
        setRequestError(
          "Your viewing request for this property has already been accepted. Please check your Tenant Account for the landlord's contact details."
        );

        return;
      }

      const fullMessage =
        `Preferred viewing date: ${preferredDate}\n` +
        `Preferred viewing time: ${preferredTime}\n` +
        `Tenant message: ${
          viewingMessage.trim() ||
          "I would like to view this property."
        }`;

      const {
        error: insertError,
      } = await supabase
        .from("viewing_requests")
        .insert({
          property_id:
            selectedProperty.id,
          tenant_id:
            user.id,
          message:
            fullMessage,
          status:
            "Pending",
        });

      if (insertError) {
        console.error(
          "Viewing request error:",
          insertError
        );

        setRequestError(
          "We could not submit your viewing request. Please try again."
        );

        return;
      }

      setRequestMessage(
        "Viewing request submitted successfully. The landlord will review your request."
      );

      setPreferredDate("");
      setPreferredTime("");
      setViewingMessage("");
      setShowViewingForm(false);
    } catch (err) {
      console.error(
        "Unexpected viewing request error:",
        err
      );

      setRequestError(
        "Something went wrong while submitting your request."
      );
    } finally {
      setSubmittingRequest(
        false
      );
    }
  }

  // ==================================================
  // FORMAT RENT
  // ==================================================

  function formatRent(
    amount: number
  ) {
    return new Intl.NumberFormat(
      "en-UG"
    ).format(amount);
  }

  // ==================================================
  // FORMAT DATE
  // ==================================================

  function formatDate(
    date: string
  ) {
    return new Date(
      date
    ).toLocaleDateString(
      "en-UG",
      {
        day: "numeric",
        month: "short",
        year: "numeric",
      }
    );
  }

  // ==================================================
  // CLEAR FILTERS
  // ==================================================

  function clearFilters() {
    setSearch("");
    setFilter("All");
    setMaxRent("");
    setBedroomFilter("All");
  }

  // ==================================================
  // MAIN PAGE
  // ==================================================

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#F7F9FC",
        fontFamily:
          "Arial, sans-serif",
        color: "#102A43",
      }}
    >
      {/* ==================================================
          HEADER
      ================================================== */}

      <header
        style={{
          background: "#0B3B75",
          color: "white",
          padding: "18px 22px",
          position: "sticky",
          top: 0,
          zIndex: 50,
          boxShadow:
            "0 2px 10px rgba(0,0,0,0.12)",
        }}
      >
        <div
          style={{
            maxWidth: "1150px",
            margin: "auto",
            display: "flex",
            justifyContent:
              "space-between",
            alignItems: "center",
            gap: "15px",
            flexWrap: "wrap",
          }}
        >
          <Link
            href="/"
            style={{
              color: "white",
              textDecoration:
                "none",
            }}
          >
            <div
              style={{
                fontWeight:
                  "bold",
                fontSize:
                  "22px",
              }}
            >
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "10px",
                }}
              >
                <img
                  src="/logo-icon.svg"
                  alt="House Connect logo"
                  width={34}
                  height={34}
                  style={{ borderRadius: "8px" }}
                />
                HOUSE CONNECT
              </span>
            </div>

            <div
              style={{
                fontSize:
                  "11px",
                letterSpacing:
                  "1.5px",
                opacity:
                  0.85,
                marginTop:
                  "3px",
              }}
            >
              FIND • CONNECT • LIVE
            </div>
          </Link>

          <nav
            style={{
              display:
                "flex",
              alignItems:
                "center",
              gap: "8px",
              flexWrap:
                "wrap",
            }}
          >
            <Link
              href="/"
              style={{
                color:
                  "white",
                textDecoration:
                  "none",
                padding:
                  "9px 12px",
                borderRadius:
                  "7px",
                background:
                  "rgba(255,255,255,0.12)",
              }}
            >
              Home
            </Link>

            <Link
              href="/landlord"
              style={{
                color:
                  "white",
                textDecoration:
                  "none",
                padding:
                  "9px 12px",
              }}
            >
              List Property
            </Link>

            <Link
              href="/tenant"
              style={{
                color:
                  "white",
                textDecoration:
                  "none",
                padding:
                  "9px 12px",
              }}
            >
              Tenant Account
            </Link>

            <Link
              href="/auth?mode=login"
              style={{
                color: "#0B3B75",
                background: "white",
                fontWeight: "bold",
                textDecoration: "none",
                padding: "9px 14px",
                borderRadius: "7px",
              }}
            >
              Landlord Login
            </Link>
          </nav>
        </div>
      </header>

      {/* ==================================================
          HERO
      ================================================== */}

      <section
        style={{
          background:
            "linear-gradient(135deg, rgba(11,59,117,0.78) 0%, rgba(21,90,168,0.60) 100%), url('/images/hero.jpg') center/cover, linear-gradient(135deg, #0B3B75 0%, #155AA8 100%)",
          color:
            "white",
          padding:
            "55px 20px 130px",
          position: "relative",
          overflow: "hidden",
        }}
      >
        <svg
          aria-hidden="true"
          viewBox="0 0 1440 190"
          preserveAspectRatio="xMidYMax slice"
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            bottom: 0,
            width: "100%",
            height: "150px",
            pointerEvents: "none",
          }}
        >
          <circle cx="1180" cy="60" r="38" fill="#F5B83D" opacity="0.22" />
          <path
            d="M0 150 Q240 90 480 135 T960 120 T1440 135 L1440 190 L0 190Z"
            fill="#155AA8"
            opacity="0.55"
          />
          <path
            d="M0 170 Q300 130 620 160 T1200 150 T1440 160 L1440 190 L0 190Z"
            fill="#0B3B75"
            opacity="0.85"
          />
          {[120, 330, 540, 760, 980, 1190, 1350].map((x, i) => {
            const h = 34 + ((i * 13) % 22);
            const w = 50 + ((i * 7) % 18);
            const y = 176 - h;
            return (
              <g key={x}>
                <rect x={x} y={y} width={w} height={h} fill="#082B54" />
                <polygon
                  points={`${x - 5},${y} ${x + w / 2},${y - 20} ${x + w + 5},${y}`}
                  fill="#082B54"
                />
                <rect x={x + 10} y={y + 10} width="9" height="11" fill="#F5B83D" />
                <rect x={x + w - 19} y={y + 10} width="9" height="11" fill="#F5B83D" opacity="0.7" />
              </g>
            );
          })}
          <rect x="0" y="176" width="1440" height="14" fill="#082B54" />
        </svg>

        <div
          style={{
            maxWidth:
              "950px",
            margin:
              "auto",
            textAlign:
              "center",
            position: "relative",
            zIndex: 1,
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "center",
              marginBottom: "16px",
            }}
          >
            <img
              src="/logo-icon.svg"
              alt="House Connect logo"
              width={84}
              height={84}
              style={{
                display: "block",
                borderRadius: "20px",
                boxShadow: "0 8px 24px rgba(0,0,0,0.25)",
              }}
            />
          </div>

          <h1
            style={{
              fontSize:
                "clamp(30px, 6vw, 48px)",
              margin:
                "0 0 12px",
            }}
          >
            Find a place you
            can trust.
          </h1>

          <p
            style={{
              maxWidth:
                "680px",
              margin:
                "0 auto 25px",
              fontSize:
                "18px",
              lineHeight:
                "1.6",
              opacity:
                0.92,
            }}
          >
            Discover verified
            properties on House
            Connect and request
            viewings directly.
          </p>

          <div
            style={{
              display:
                "flex",
              justifyContent:
                "center",
              gap:
                "12px",
              flexWrap:
                "wrap",
            }}
          >
            <a
              href="#properties"
              style={{
                display:
                  "inline-block",
                padding:
                  "13px 22px",
                background:
                  "white",
                color:
                  "#0B3B75",
                borderRadius:
                  "9px",
                textDecoration:
                  "none",
                fontWeight:
                  "bold",
              }}
            >
              FIND A PROPERTY
            </a>

            <Link
              href="/landlord"
              style={{
                display:
                  "inline-block",
                padding:
                  "13px 22px",
                background:
                  "transparent",
                color:
                  "white",
                border:
                  "1px solid rgba(255,255,255,0.7)",
                borderRadius:
                  "9px",
                textDecoration:
                  "none",
                fontWeight:
                  "bold",
              }}
            >
              LIST YOUR PROPERTY
            </Link>
          </div>
        </div>
      </section>

      {/* ==================================================
          PROPERTY AREA
      ================================================== */}

      <section
        id="properties"
        style={{
          maxWidth:
            "1150px",
          margin:
            "35px auto",
          padding:
            "0 20px",
        }}
      >
        <div
          style={{
            display:
              "flex",
            justifyContent:
              "space-between",
            alignItems:
              "flex-end",
            gap:
              "15px",
            flexWrap:
              "wrap",
            marginBottom:
              "20px",
          }}
        >
          <div>
            <h2
              style={{
                color:
                  "#0B3B75",
                margin:
                  "0 0 6px",
              }}
            >
              Available Properties
            </h2>

            <p
              style={{
                color:
                  "#627D98",
                margin:
                  0,
              }}
            >
              Browse properties
              verified by House
              Connect.
            </p>
          </div>

          <button
            onClick={
              loadProperties
            }
            disabled={
              loading
            }
            style={{
              padding:
                "10px 16px",
              background:
                "white",
              color:
                "#0B3B75",
              border:
                "1px solid #CBD5E1",
              borderRadius:
                "8px",
              cursor:
                loading
                  ? "not-allowed"
                  : "pointer",
              fontWeight:
                "bold",
            }}
          >
            {loading
              ? "REFRESHING..."
              : "↻ REFRESH"}
          </button>
        </div>

        <div
          style={{
            background:
              "white",
            padding:
              "18px",
            borderRadius:
              "12px",
            border:
              "1px solid #D7E0EA",
            marginBottom:
              "20px",
          }}
        >
          <div
            style={{
              marginBottom:
                "15px",
            }}
          >
            <label
              style={{
                display:
                  "block",
                fontWeight:
                  "bold",
                marginBottom:
                  "7px",
              }}
            >
              Search
            </label>

            <input
              value={
                search
              }
              onChange={(
                e
              ) =>
                setSearch(
                  e.target.value
                )
              }
              placeholder="Search by property name, location or type..."
              style={{
                width:
                  "100%",
                boxSizing:
                  "border-box",
                padding:
                  "14px",
                border:
                  "1px solid #CBD5E1",
                borderRadius:
                  "8px",
                fontSize:
                  "15px",
              }}
            />
          </div>

          <div
            style={{
              display:
                "grid",
              gridTemplateColumns:
                "repeat(auto-fit, minmax(190px, 1fr))",
              gap:
                "12px",
            }}
          >
            <div>
              <label
                style={{
                  display:
                    "block",
                  fontWeight:
                    "bold",
                  marginBottom:
                    "7px",
                }}
              >
                Maximum Monthly Rent
              </label>

              <input
                type="number"
                min="0"
                value={
                  maxRent
                }
                onChange={(e) =>
                  setMaxRent(
                    e.target.value
                  )
                }
                placeholder="e.g. 500000"
                style={{
                  width:
                    "100%",
                  boxSizing:
                    "border-box",
                  padding:
                    "12px",
                  border:
                    "1px solid #CBD5E1",
                  borderRadius:
                    "8px",
                }}
              />
            </div>

            <div>
              <label
                style={{
                  display:
                    "block",
                  fontWeight:
                    "bold",
                  marginBottom:
                    "7px",
                }}
              >
                Bedrooms
              </label>

              <select
                value={
                  bedroomFilter
                }
                onChange={(e) =>
                  setBedroomFilter(
                    e.target.value
                  )
                }
                style={{
                  width:
                    "100%",
                  boxSizing:
                    "border-box",
                  padding:
                    "12px",
                  border:
                    "1px solid #CBD5E1",
                  borderRadius:
                    "8px",
                  background:
                    "white",
                }}
              >
                <option value="All">
                  Any number
                </option>
                <option value="1">
                  1 bedroom
                </option>
                <option value="2">
                  2 bedrooms
                </option>
                <option value="3">
                  3 bedrooms
                </option>
                <option value="4">
                  4 bedrooms
                </option>
                <option value="5+">
                  5+ bedrooms
                </option>
              </select>
            </div>
          </div>

          {(search ||
            maxRent ||
            filter !==
              "All" ||
            bedroomFilter !==
              "All") && (
            <button
              onClick={
                clearFilters
              }
              style={{
                marginTop:
                  "15px",
                padding:
                  "9px 15px",
                background:
                  "#F0F4F8",
                color:
                  "#102A43",
                border:
                  "1px solid #CBD5E1",
                borderRadius:
                  "7px",
                cursor:
                  "pointer",
                fontWeight:
                  "bold",
              }}
            >
              CLEAR FILTERS
            </button>
          )}
        </div>

        <div
          style={{
            display:
              "flex",
            gap:
              "8px",
            flexWrap:
              "wrap",
            marginBottom:
              "25px",
          }}
        >
          {[
            "All",
            "House",
            "Apartment",
            "Room",
            "Studio",
            "Commercial",
          ].map(
            (item) => (
              <button
                key={
                  item
                }
                onClick={() =>
                  setFilter(
                    item as PropertyFilter
                  )
                }
                style={{
                  padding:
                    "9px 15px",
                  borderRadius:
                    "20px",
                  border:
                    "1px solid #CBD5E1",
                  background:
                    filter ===
                    item
                      ? "#0B3B75"
                      : "white",
                  color:
                    filter ===
                    item
                      ? "white"
                      : "#102A43",
                  cursor:
                    "pointer",
                  fontWeight:
                    "bold",
                }}
              >
                {
                  item
                }
              </button>
            )
          )}
        </div>

        {error && (
          <div
            style={{
              background:
                "#FEE4E2",
              color:
                "#B42318",
              padding:
                "15px",
              borderRadius:
                "9px",
              marginBottom:
                "20px",
              fontWeight:
                "bold",
            }}
          >
            {error}

            <button
              onClick={
                loadProperties
              }
              style={{
                display:
                  "block",
                marginTop:
                  "10px",
                padding:
                  "9px 14px",
                background:
                  "#B42318",
                color:
                  "white",
                border:
                  "none",
                borderRadius:
                  "7px",
                cursor:
                  "pointer",
              }}
            >
              TRY AGAIN
            </button>
          </div>
        )}

        {loading && (
          <div
            style={{
              background:
                "white",
              padding:
                "45px",
              borderRadius:
                "12px",
              textAlign:
                "center",
              border:
                "1px solid #D7E0EA",
            }}
          >
            <div
              style={{
                fontSize:
                  "35px",
                marginBottom:
                  "10px",
              }}
            >
              🏠
            </div>

            <strong>
              Loading available
              properties...
            </strong>
          </div>
        )}

        {!loading &&
          filteredProperties.length ===
            0 && (
            <div
              style={{
                background:
                  "white",
                padding:
                  "50px 25px",
                borderRadius:
                  "12px",
                textAlign:
                  "center",
                border:
                  "1px solid #D7E0EA",
              }}
            >
              <div
                style={{
                  fontSize:
                    "50px",
                }}
              >
                🏠
              </div>

              <h3>
                {properties.length ===
                0
                  ? "No properties available yet"
                  : "No properties found"}
              </h3>

              <p
                style={{
                  color:
                    "#627D98",
                }}
              >
                {properties.length ===
                0
                  ? "New verified properties will appear here once landlords submit them and House Connect approves them."
                  : "Try another search or filter."}
              </p>

              {(search ||
                maxRent ||
                filter !==
                  "All" ||
                bedroomFilter !==
                  "All") && (
                <button
                  onClick={
                    clearFilters
                  }
                  style={{
                    padding:
                      "11px 18px",
                    background:
                      "#0B3B75",
                    color:
                      "white",
                    border:
                      "none",
                    borderRadius:
                      "8px",
                    cursor:
                      "pointer",
                    fontWeight:
                      "bold",
                  }}
                >
                  CLEAR FILTERS
                </button>
              )}
            </div>
          )}

        {!loading &&
          filteredProperties.length >
            0 && (
            <>
              <p
                style={{
                  color:
                    "#627D98",
                  marginBottom:
                    "15px",
                }}
              >
                Showing{" "}
                <strong>
                  {
                    filteredProperties.length
                  }
                </strong>{" "}
                {filteredProperties.length ===
                1
                  ? "property"
                  : "properties"}
              </p>

              <div
                style={{
                  display:
                    "grid",
                  gridTemplateColumns:
                    "repeat(auto-fit, minmax(280px, 1fr))",
                  gap:
                    "20px",
                }}
              >
                {filteredProperties.map(
                  (
                    property
                  ) => {
                    const images =
                      getImagesForProperty(
                        property.id
                      );

                    const firstImage =
                      images[0];

                    return (
                      <article
                        key={
                          property.id
                        }
                        style={{
                          background:
                            "white",
                          border:
                            "1px solid #D7E0EA",
                          borderRadius:
                            "14px",
                          overflow:
                            "hidden",
                          boxShadow:
                            "0 4px 14px rgba(16,42,67,0.06)",
                        }}
                      >
                        <div
                          style={{
                            height:
                              "200px",
                            background:
                              "#E8F1FA",
                            position:
                              "relative",
                            overflow:
                              "hidden",
                          }}
                        >
                          {firstImage ? (
                            <img
                              src={
                                firstImage.public_url
                              }
                              alt={
                                property.title
                              }
                              style={{
                                width:
                                  "100%",
                                height:
                                  "100%",
                                objectFit:
                                  "cover",
                                display:
                                  "block",
                              }}
                            />
                          ) : (
                            <div
                              style={{
                                width:
                                  "100%",
                                height:
                                  "100%",
                                display:
                                  "flex",
                                alignItems:
                                  "center",
                                justifyContent:
                                  "center",
                                flexDirection:
                                  "column",
                                fontSize:
                                  "55px",
                              }}
                            >
                              🏠

                              <span
                                style={{
                                  fontSize:
                                    "12px",
                                  color:
                                    "#627D98",
                                  marginTop:
                                    "5px",
                                }}
                              >
                                Photo
                                unavailable
                              </span>
                            </div>
                          )}

                          <span
                            style={{
                              position:
                                "absolute",
                              top:
                                "12px",
                              left:
                                "12px",
                              background:
                                "#0B3B75",
                              color:
                                "white",
                              padding:
                                "6px 10px",
                              borderRadius:
                                "6px",
                              fontSize:
                                "11px",
                              fontWeight:
                                "bold",
                            }}
                          >
                            ✓ VERIFIED
                          </span>

                          {images.length >
                            0 && (
                            <span
                              style={{
                                position:
                                  "absolute",
                                bottom:
                                  "12px",
                                right:
                                  "12px",
                                background:
                                  "rgba(0,0,0,0.7)",
                                color:
                                  "white",
                                padding:
                                  "6px 9px",
                                borderRadius:
                                  "6px",
                                fontSize:
                                  "12px",
                                fontWeight:
                                  "bold",
                              }}
                            >
                              📷{" "}
                              {
                                images.length
                              }{" "}
                              photo
                              {images.length ===
                              1
                                ? ""
                                : "s"}
                            </span>
                          )}
                        </div>

                        <div
                          style={{
                            padding:
                              "20px",
                          }}
                        >
                          <h3
                            style={{
                              color:
                                "#0B3B75",
                              margin:
                                "0 0 8px",
                              fontSize:
                                "20px",
                            }}
                          >
                            {
                              property.title
                            }
                          </h3>

                          <p
                            style={{
                              color:
                                "#627D98",
                              margin:
                                "0 0 8px",
                            }}
                          >
                            📍{" "}
                            {
                              property.location
                            }
                          </p>

                          <div
                            style={{
                              display:
                                "flex",
                              gap:
                                "8px",
                              flexWrap:
                                "wrap",
                              marginBottom:
                                "15px",
                            }}
                          >
                            <span
                              style={{
                                background:
                                  "#F0F4F8",
                                padding:
                                  "6px 9px",
                                borderRadius:
                                  "6px",
                                fontSize:
                                  "13px",
                              }}
                            >
                              🏠{" "}
                              {
                                property.property_type
                              }
                            </span>

                            {property.bedrooms !==
                              null && (
                              <span
                                style={{
                                  background:
                                    "#F0F4F8",
                                  padding:
                                    "6px 9px",
                                  borderRadius:
                                    "6px",
                                  fontSize:
                                    "13px",
                                }}
                              >
                                🛏️{" "}
                                {
                                  property.bedrooms
                                }{" "}
                                bedroom
                                {property.bedrooms ===
                                1
                                  ? ""
                                  : "s"}
                              </span>
                            )}
                          </div>

                          <div
                            style={{
                              marginBottom:
                                "15px",
                            }}
                          >
                            <span
                              style={{
                                fontSize:
                                  "12px",
                                color:
                                  "#627D98",
                              }}
                            >
                              MONTHLY RENT
                            </span>

                            <div
                              style={{
                                color:
                                  "#0B3B75",
                                fontWeight:
                                  "bold",
                                fontSize:
                                  "20px",
                              }}
                            >
                              UGX{" "}
                              {formatRent(
                                property.monthly_rent
                              )}
                            </div>
                          </div>

                          <button
                            onClick={() =>
                              openProperty(
                                property
                              )
                            }
                            style={{
                              width:
                                "100%",
                              padding:
                                "13px",
                              background:
                                "#0B3B75",
                              color:
                                "white",
                              border:
                                "none",
                              borderRadius:
                                "8px",
                              cursor:
                                "pointer",
                              fontWeight:
                                "bold",
                            }}
                          >
                            VIEW PROPERTY
                          </button>
                        </div>
                      </article>
                    );
                  }
                )}
              </div>
            </>
          )}

        {imagesLoading &&
          !loading && (
            <p
              style={{
                textAlign:
                  "center",
                color:
                  "#627D98",
                fontSize:
                  "13px",
                marginTop:
                  "15px",
              }}
            >
              Loading property photos...
            </p>
          )}
      </section>

      {/* ==================================================
          HOW HOUSE CONNECT WORKS
      ================================================== */}

      <section
        style={{
          background:
            "white",
          borderTop:
            "1px solid #E1E8F0",
          borderBottom:
            "1px solid #E1E8F0",
          padding:
            "50px 20px",
          marginTop:
            "20px",
        }}
      >
        <div
          style={{
            maxWidth:
              "1000px",
            margin:
              "auto",
            textAlign:
              "center",
          }}
        >
          <h2
            style={{
              color:
                "#0B3B75",
            }}
          >
            How House Connect
            Works
          </h2>

          <p
            style={{
              color:
                "#627D98",
              marginBottom:
                "30px",
            }}
          >
            A simple way to find
            and connect with
            legitimate property
            owners.
          </p>

          <div
            style={{
              display:
                "grid",
              gridTemplateColumns:
                "repeat(auto-fit, minmax(220px, 1fr))",
              gap:
                "20px",
            }}
          >
            <div
              style={{
                padding:
                  "25px",
                border:
                  "1px solid #D7E0EA",
                borderRadius:
                  "12px",
              }}
            >
              <div
                style={{
                  fontSize:
                    "35px",
                }}
              >
                🔎
              </div>

              <h3>
                1. Find
              </h3>

              <p
                style={{
                  color:
                    "#627D98",
                  lineHeight:
                    "1.5",
                }}
              >
                Search approved
                properties by
                location, type,
                bedrooms or rent.
              </p>
            </div>

            <div
              style={{
                padding:
                  "25px",
                border:
                  "1px solid #D7E0EA",
                borderRadius:
                  "12px",
              }}
            >
              <div
                style={{
                  fontSize:
                    "35px",
                }}
              >
                🤝
              </div>

              <h3>
                2. Connect
              </h3>

              <p
                style={{
                  color:
                    "#627D98",
                  lineHeight:
                    "1.5",
                }}
              >
                Create a tenant
                account and request
                a viewing directly
                through House
                Connect.
              </p>
            </div>

            <div
              style={{
                padding:
                  "25px",
                border:
                  "1px solid #D7E0EA",
                borderRadius:
                  "12px",
              }}
            >
              <div
                style={{
                  fontSize:
                    "35px",
                }}
              >
                🏡
              </div>

              <h3>
                3. Live
              </h3>

              <p
                style={{
                  color:
                    "#627D98",
                  lineHeight:
                    "1.5",
                }}
              >
                Once your request
                is accepted, connect
                with the landlord
                and arrange your
                viewing.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ==================================================
          TENANT CTA
      ================================================== */}

      <section
        style={{
          maxWidth:
            "1000px",
          margin:
            "45px auto",
          padding:
            "0 20px",
        }}
      >
        <div
          style={{
            background:
              "#E8F1FA",
            border:
              "1px solid #CBD5E1",
            borderRadius:
              "15px",
            padding:
              "35px",
            textAlign:
              "center",
          }}
        >
          <div
            style={{
              fontSize:
                "40px",
            }}
          >
            👤
          </div>

          <h2
            style={{
              marginTop:
                "10px",
              color:
                "#0B3B75",
            }}
          >
            Looking for a home?
          </h2>

          <p
            style={{
              maxWidth:
                "650px",
              margin:
                "0 auto 20px",
              lineHeight:
                "1.6",
              color:
                "#486581",
            }}
          >
            Create your free
            tenant account to
            request viewings and
            track responses from
            landlords.
          </p>

          <Link
            href="/tenant"
            style={{
              display:
                "inline-block",
              padding:
                "13px 22px",
              background:
                "#0B3B75",
              color:
                "white",
              borderRadius:
                "8px",
              textDecoration:
                "none",
              fontWeight:
                "bold",
            }}
          >
            TENANT ACCOUNT
          </Link>
        </div>
      </section>

      {/* ==================================================
          LANDLORD CTA
      ================================================== */}

      <section
        style={{
          maxWidth:
            "1000px",
          margin:
            "45px auto",
          padding:
            "0 20px",
        }}
      >
        <div
          style={{
            background:
              "#0B3B75",
            color:
              "white",
            borderRadius:
              "15px",
            padding:
              "35px",
            textAlign:
              "center",
          }}
        >
          <h2
            style={{
              marginTop:
                0,
            }}
          >
            Have a property
            to rent?
          </h2>

          <p
            style={{
              maxWidth:
                "650px",
              margin:
                "0 auto 20px",
              lineHeight:
                "1.6",
              opacity:
                0.9,
            }}
          >
            List your property on
            House Connect and let
            genuine property
            seekers discover it.
          </p>

          <Link
            href="/landlord"
            style={{
              display:
                "inline-block",
              padding:
                "13px 22px",
              background:
                "white",
              color:
                "#0B3B75",
              borderRadius:
                "8px",
              textDecoration:
                "none",
              fontWeight:
                "bold",
            }}
          >
            LIST YOUR PROPERTY
          </Link>
        </div>
      </section>

      {/* ==================================================
          PROPERTY DETAILS MODAL
      ================================================== */}

      {selectedProperty && (
        <div
          onClick={
            closeProperty
          }
          style={{
            position:
              "fixed",
            inset: 0,
            background:
              "rgba(0,0,0,0.55)",
            display:
              "flex",
            alignItems:
              "center",
            justifyContent:
              "center",
            padding:
              "12px",
            zIndex:
              100,
            overflowY:
              "auto",
          }}
        >
          <div
            onClick={(e) =>
              e.stopPropagation()
            }
            style={{
              background:
                "white",
              width:
                "100%",
              maxWidth:
                "700px",
              maxHeight:
                "calc(100vh - 24px)",
              overflowY:
                "auto",
              borderRadius:
                "15px",
              padding:
                "clamp(18px, 4vw, 28px)",
              boxSizing:
                "border-box",
            }}
          >
            {/* MODAL HEADER */}

            <div
              style={{
                display:
                  "flex",
                justifyContent:
                  "space-between",
                alignItems:
                  "flex-start",
                gap:
                  "15px",
              }}
            >
              <div
                style={{
                  minWidth:
                    0,
                }}
              >
                <span
                  style={{
                    display:
                      "inline-block",
                    background:
                      "#E8F1FA",
                    color:
                      "#0B3B75",
                    padding:
                      "6px 9px",
                    borderRadius:
                      "6px",
                    fontSize:
                      "11px",
                    fontWeight:
                      "bold",
                    marginBottom:
                      "10px",
                  }}
                >
                  ✓ HOUSE CONNECT
                  VERIFIED
                </span>

                <h2
                  style={{
                    color:
                      "#0B3B75",
                    margin:
                      "0 0 8px",
                    overflowWrap:
                      "anywhere",
                  }}
                >
                  {
                    selectedProperty.title
                  }
                </h2>

                <p
                  style={{
                    color:
                      "#627D98",
                    margin:
                      0,
                  }}
                >
                  📍{" "}
                  {
                    selectedProperty.location
                  }
                </p>
              </div>

              <button
                onClick={
                  closeProperty
                }
                disabled={
                  submittingRequest
                }
                aria-label="Close property"
                style={{
                  border:
                    "none",
                  background:
                    "#F0F4F8",
                  borderRadius:
                    "50%",
                  width:
                    "38px",
                  height:
                    "38px",
                  cursor:
                    submittingRequest
                      ? "not-allowed"
                      : "pointer",
                  fontSize:
                    "20px",
                  flexShrink:
                    0,
                }}
              >
                ×
              </button>
            </div>

            {/* ==================================================
                PHOTO GALLERY
            ================================================== */}

            {(() => {
              const images =
                getImagesForProperty(
                  selectedProperty.id
                );

              const currentImage =
                images[
                  selectedImageIndex
                ];

              return (
                <div
                  style={{
                    marginTop:
                      "25px",
                  }}
                >
                  {images.length >
                  0 ? (
                    <>
                      <div
                        style={{
                          position:
                            "relative",
                          width:
                            "100%",
                          height:
                            "clamp(230px, 55vw, 350px)",
                          background:
                            "#E8F1FA",
                          borderRadius:
                            "12px",
                          overflow:
                            "hidden",
                        }}
                      >
                        <img
                          src={
                            currentImage
                              ?.public_url
                          }
                          alt={
                            currentImage
                              ?.caption ||
                            selectedProperty.title
                          }
                          onClick={() =>
                            setShowFullPhoto(
                              true
                            )
                          }
                          style={{
                            width:
                              "100%",
                            height:
                              "100%",
                            objectFit:
                              "cover",
                            display:
                              "block",
                            cursor:
                              "zoom-in",
                          }}
                        />

                        <button
                          type="button"
                          onClick={() =>
                            setShowFullPhoto(
                              true
                            )
                          }
                          aria-label="View photo full screen"
                          style={{
                            position:
                              "absolute",
                            left:
                              "12px",
                            bottom:
                              "12px",
                            background:
                              "rgba(0,0,0,0.7)",
                            color:
                              "white",
                            border:
                              "none",
                            padding:
                              "8px 12px",
                            borderRadius:
                              "7px",
                            fontSize:
                              "12px",
                            fontWeight:
                              "bold",
                            cursor:
                              "pointer",
                          }}
                        >
                          ⤢ Full screen
                        </button>

                        <div
                          style={{
                            position:
                              "absolute",
                            top:
                              "12px",
                            right:
                              "12px",
                            background:
                              "rgba(0,0,0,0.7)",
                            color:
                              "white",
                            padding:
                              "7px 10px",
                            borderRadius:
                              "7px",
                            fontSize:
                              "12px",
                            fontWeight:
                              "bold",
                          }}
                        >
                          {selectedImageIndex +
                            1}{" "}
                          /{" "}
                          {
                            images.length
                          }
                        </div>

                        {images.length >
                          1 && (
                          <button
                            onClick={
                              previousImage
                            }
                            aria-label="Previous photo"
                            style={{
                              position:
                                "absolute",
                              left:
                                "12px",
                              top:
                                "50%",
                              transform:
                                "translateY(-50%)",
                              width:
                                "42px",
                              height:
                                "42px",
                              borderRadius:
                                "50%",
                              border:
                                "none",
                              background:
                                "rgba(0,0,0,0.65)",
                              color:
                                "white",
                              fontSize:
                                "25px",
                              cursor:
                                "pointer",
                            }}
                          >
                            ‹
                          </button>
                        )}

                        {images.length >
                          1 && (
                          <button
                            onClick={
                              nextImage
                            }
                            aria-label="Next photo"
                            style={{
                              position:
                                "absolute",
                              right:
                                "12px",
                              top:
                                "50%",
                              transform:
                                "translateY(-50%)",
                              width:
                                "42px",
                              height:
                                "42px",
                              borderRadius:
                                "50%",
                              border:
                                "none",
                              background:
                                "rgba(0,0,0,0.65)",
                              color:
                                "white",
                              fontSize:
                                "25px",
                              cursor:
                                "pointer",
                            }}
                          >
                            ›
                          </button>
                        )}
                      </div>

                      {images.length >
                        1 && (
                        <div
                          style={{
                            display:
                              "flex",
                            gap:
                              "8px",
                            overflowX:
                              "auto",
                            padding:
                              "10px 0 3px",
                          }}
                        >
                          {images.map(
                            (
                              image,
                              index
                            ) => (
                              <button
                                key={
                                  image.id
                                }
                                onClick={() =>
                                  setSelectedImageIndex(
                                    index
                                  )
                                }
                                style={{
                                  padding:
                                    0,
                                  border:
                                    index ===
                                    selectedImageIndex
                                      ? "3px solid #0B3B75"
                                      : "3px solid transparent",
                                  borderRadius:
                                    "8px",
                                  background:
                                    "transparent",
                                  cursor:
                                    "pointer",
                                  flexShrink:
                                    0,
                                }}
                              >
                                <img
                                  src={
                                    image.public_url
                                  }
                                  alt={`Photo ${
                                    index +
                                    1
                                  }`}
                                  style={{
                                    width:
                                      "75px",
                                    height:
                                      "60px",
                                    objectFit:
                                      "cover",
                                    borderRadius:
                                      "5px",
                                    display:
                                      "block",
                                  }}
                                />
                              </button>
                            )
                          )}
                        </div>
                      )}

                      {showFullPhoto && (
                        <div
                          tabIndex={-1}
                          ref={(el) => {
                            if (el) el.focus();
                          }}
                          onKeyDown={(e) => {
                            if (e.key === "Escape") setShowFullPhoto(false);
                            if (e.key === "ArrowRight") nextImage();
                            if (e.key === "ArrowLeft") previousImage();
                          }}
                          onTouchStart={(e) =>
                            setTouchStartX(e.touches[0].clientX)
                          }
                          onTouchEnd={(e) => {
                            if (touchStartX === null) return;
                            const dx =
                              e.changedTouches[0].clientX - touchStartX;
                            setTouchStartX(null);
                            if (dx < -50) nextImage();
                            if (dx > 50) previousImage();
                          }}
                          style={{
                            position: "fixed",
                            inset: 0,
                            zIndex: 5000,
                            background: "rgba(0,0,0,0.95)",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            outline: "none",
                          }}
                        >
                          <img
                            src={currentImage?.public_url}
                            alt={
                              currentImage?.caption ||
                              selectedProperty.title
                            }
                            style={{
                              maxWidth: "100%",
                              maxHeight: "100%",
                              objectFit: "contain",
                              display: "block",
                              touchAction: "pinch-zoom",
                            }}
                          />

                          <button
                            type="button"
                            onClick={() => setShowFullPhoto(false)}
                            aria-label="Close full screen"
                            style={{
                              position: "absolute",
                              top: "16px",
                              right: "16px",
                              width: "46px",
                              height: "46px",
                              borderRadius: "50%",
                              border: "none",
                              background: "rgba(255,255,255,0.2)",
                              color: "white",
                              fontSize: "26px",
                              cursor: "pointer",
                            }}
                          >
                            ✕
                          </button>

                          <div
                            style={{
                              position: "absolute",
                              top: "24px",
                              left: "16px",
                              color: "white",
                              fontWeight: "bold",
                              fontSize: "14px",
                            }}
                          >
                            {selectedImageIndex + 1} / {images.length}
                          </div>

                          {images.length > 1 && (
                            <>
                              <button
                                type="button"
                                onClick={previousImage}
                                aria-label="Previous photo"
                                style={{
                                  position: "absolute",
                                  left: "14px",
                                  top: "50%",
                                  transform: "translateY(-50%)",
                                  width: "48px",
                                  height: "48px",
                                  borderRadius: "50%",
                                  border: "none",
                                  background: "rgba(255,255,255,0.2)",
                                  color: "white",
                                  fontSize: "30px",
                                  cursor: "pointer",
                                }}
                              >
                                ‹
                              </button>

                              <button
                                type="button"
                                onClick={nextImage}
                                aria-label="Next photo"
                                style={{
                                  position: "absolute",
                                  right: "14px",
                                  top: "50%",
                                  transform: "translateY(-50%)",
                                  width: "48px",
                                  height: "48px",
                                  borderRadius: "50%",
                                  border: "none",
                                  background: "rgba(255,255,255,0.2)",
                                  color: "white",
                                  fontSize: "30px",
                                  cursor: "pointer",
                                }}
                              >
                                ›
                              </button>
                            </>
                          )}
                        </div>
                      )}

                      {currentImage
                        ?.caption && (
                        <p
                          style={{
                            color:
                              "#627D98",
                            fontSize:
                              "13px",
                            marginTop:
                              "8px",
                          }}
                        >
                          {
                            currentImage.caption
                          }
                        </p>
                      )}
                    </>
                  ) : (
                    <div
                      style={{
                        height:
                          "250px",
                        background:
                          "#E8F1FA",
                        borderRadius:
                          "12px",
                        display:
                          "flex",
                        flexDirection:
                          "column",
                        alignItems:
                          "center",
                        justifyContent:
                          "center",
                        color:
                          "#627D98",
                      }}
                    >
                      <div
                        style={{
                          fontSize:
                            "65px",
                          marginBottom:
                            "10px",
                        }}
                      >
                        🏠
                      </div>

                      <strong>
                        No property
                        photos available
                      </strong>
                    </div>
                  )}
                </div>
              );
            })()}

            {/* PROPERTY INFORMATION */}

            <div
              style={{
                display:
                  "grid",
                gridTemplateColumns:
                  "repeat(auto-fit, minmax(150px, 1fr))",
                gap:
                  "12px",
                margin:
                  "25px 0",
              }}
            >
              <div
                style={{
                  background:
                    "#F7F9FC",
                  padding:
                    "15px",
                  borderRadius:
                    "9px",
                }}
              >
                <small
                  style={{
                    color:
                      "#627D98",
                  }}
                >
                  PROPERTY TYPE
                </small>

                <strong
                  style={{
                    display:
                      "block",
                    marginTop:
                      "5px",
                  }}
                >
                  {
                    selectedProperty.property_type
                  }
                </strong>
              </div>

              <div
                style={{
                  background:
                    "#F7F9FC",
                  padding:
                    "15px",
                  borderRadius:
                    "9px",
                }}
              >
                <small
                  style={{
                    color:
                      "#627D98",
                  }}
                >
                  BEDROOMS
                </small>

                <strong
                  style={{
                    display:
                      "block",
                    marginTop:
                      "5px",
                  }}
                >
                  {selectedProperty.bedrooms ??
                    "Not specified"}
                </strong>
              </div>

              <div
                style={{
                  background:
                    "#F7F9FC",
                  padding:
                    "15px",
                  borderRadius:
                    "9px",
                }}
              >
                <small
                  style={{
                    color:
                      "#627D98",
                  }}
                >
                  MONTHLY RENT
                </small>

                <strong
                  style={{
                    display:
                      "block",
                    marginTop:
                      "5px",
                    color:
                      "#0B3B75",
                  }}
                >
                  UGX{" "}
                  {formatRent(
                    selectedProperty.monthly_rent
                  )}
                </strong>
              </div>
            </div>

            {/* DESCRIPTION */}

            <h3
              style={{
                color:
                  "#0B3B75",
              }}
            >
              Description
            </h3>

            <p
              style={{
                color:
                  "#486581",
                lineHeight:
                  "1.7",
                whiteSpace:
                  "pre-wrap",
              }}
            >
              {selectedProperty.description ||
                "No description has been provided for this property."}
            </p>

            <p
              style={{
                color:
                  "#627D98",
                fontSize:
                  "13px",
              }}
            >
              Listed on{" "}
              {formatDate(
                selectedProperty.created_at
              )}
            </p>

            {/* ==================================================
                REQUEST SUCCESS
            ================================================== */}

            {requestMessage && (
              <div
                style={{
                  background:
                    "#D1FAE5",
                  color:
                    "#065F46",
                  padding:
                    "15px",
                  borderRadius:
                    "9px",
                  fontWeight:
                    "bold",
                  marginTop:
                    "20px",
                }}
              >
                <div
                  style={{
                    fontSize:
                      "18px",
                    marginBottom:
                      "5px",
                  }}
                >
                  ✓ Request Submitted
                </div>

                {requestMessage}

                <div
                  style={{
                    marginTop:
                      "10px",
                    fontWeight:
                      "normal",
                    fontSize:
                      "14px",
                  }}
                >
                  You can track the
                  landlord&apos;s response
                  from your Tenant
                  Account.
                </div>

                <Link
                  href="/tenant"
                  style={{
                    display:
                      "inline-block",
                    marginTop:
                      "12px",
                    padding:
                      "9px 14px",
                    background:
                      "#065F46",
                    color:
                      "white",
                    borderRadius:
                      "7px",
                    textDecoration:
                      "none",
                    fontSize:
                      "13px",
                  }}
                >
                  VIEW MY REQUESTS
                </Link>
              </div>
            )}

            {/* ==================================================
                REQUEST ERROR
            ================================================== */}

            {requestError && (
              <div
                style={{
                  background:
                    "#FEE4E2",
                  color:
                    "#B42318",
                  padding:
                    "15px",
                  borderRadius:
                    "9px",
                  fontWeight:
                    "bold",
                  marginTop:
                    "20px",
                }}
              >
                {requestError}

                <div
                  style={{
                    marginTop:
                      "10px",
                    fontWeight:
                      "normal",
                    fontSize:
                      "14px",
                  }}
                >
                  If you are looking
                  for a property, make
                  sure you are using a
                  tenant account.
                </div>

                <Link
                  href="/tenant"
                  style={{
                    display:
                      "inline-block",
                    marginTop:
                      "10px",
                    color:
                      "#0B3B75",
                    fontWeight:
                      "bold",
                  }}
                >
                  GO TO TENANT ACCOUNT →
                </Link>
              </div>
            )}

            {/* ==================================================
                VIEWING FORM
            ================================================== */}

            {showViewingForm ? (
              <div
                style={{
                  marginTop:
                    "25px",
                  borderTop:
                    "1px solid #E1E8F0",
                  paddingTop:
                    "25px",
                }}
              >
                <h3
                  style={{
                    color:
                      "#0B3B75",
                    marginTop:
                      0,
                  }}
                >
                  Request a Viewing
                </h3>

                <p
                  style={{
                    color:
                      "#627D98",
                  }}
                >
                  Choose when you
                  would like to view
                  this property. Your
                  preferred date and
                  time will be sent to
                  the landlord.
                </p>

                <label
                  style={{
                    display:
                      "block",
                    fontWeight:
                      "bold",
                    marginBottom:
                      "7px",
                  }}
                >
                  Preferred Date
                </label>

                <input
                  type="date"
                  value={
                    preferredDate
                  }
                  onChange={(e) =>
                    setPreferredDate(
                      e.target.value
                    )
                  }
                  min={
                    new Date()
                      .toISOString()
                      .split("T")[0]
                  }
                  style={{
                    width:
                      "100%",
                    boxSizing:
                      "border-box",
                    padding:
                      "13px",
                    border:
                      "1px solid #CBD5E1",
                    borderRadius:
                      "8px",
                    marginBottom:
                      "18px",
                  }}
                />

                <label
                  style={{
                    display:
                      "block",
                    fontWeight:
                      "bold",
                    marginBottom:
                      "7px",
                  }}
                >
                  Preferred Time
                </label>

                <input
                  type="time"
                  value={
                    preferredTime
                  }
                  onChange={(e) =>
                    setPreferredTime(
                      e.target.value
                    )
                  }
                  style={{
                    width:
                      "100%",
                    boxSizing:
                      "border-box",
                    padding:
                      "13px",
                    border:
                      "1px solid #CBD5E1",
                    borderRadius:
                      "8px",
                    marginBottom:
                      "18px",
                  }}
                />

                <label
                  style={{
                    display:
                      "block",
                    fontWeight:
                      "bold",
                    marginBottom:
                      "7px",
                  }}
                >
                  Message
                </label>

                <textarea
                  value={
                    viewingMessage
                  }
                  onChange={(e) =>
                    setViewingMessage(
                      e.target.value
                    )
                  }
                  placeholder="Add any information you would like the landlord to know..."
                  rows={4}
                  maxLength={1000}
                  style={{
                    width:
                      "100%",
                    boxSizing:
                      "border-box",
                    padding:
                      "13px",
                    border:
                      "1px solid #CBD5E1",
                    borderRadius:
                      "8px",
                    resize:
                      "vertical",
                    marginBottom:
                      "8px",
                  }}
                />

                <p
                  style={{
                    textAlign:
                      "right",
                    color:
                      "#627D98",
                    fontSize:
                      "12px",
                    marginTop:
                      0,
                    marginBottom:
                      "18px",
                  }}
                >
                  {
                    viewingMessage.length
                  }{" "}
                  / 1000
                </p>

                <div
                  style={{
                    background:
                      "#F7F9FC",
                    padding:
                      "13px",
                    borderRadius:
                      "8px",
                    marginBottom:
                      "18px",
                    color:
                      "#486581",
                    fontSize:
                      "13px",
                  }}
                >
                  🔒 Your contact
                  information will
                  remain private until
                  the landlord accepts
                  your viewing request.
                </div>

                <div
                  style={{
                    display:
                      "flex",
                    gap:
                      "10px",
                    flexWrap:
                      "wrap",
                  }}
                >
                  <button
                    onClick={
                      submitViewingRequest
                    }
                    disabled={
                      submittingRequest
                    }
                    style={{
                      flex: 1,
                      minWidth:
                        "180px",
                      padding:
                        "14px",
                      background:
                        submittingRequest
                          ? "#627D98"
                          : "#0B3B75",
                      color:
                        "white",
                      border:
                        "none",
                      borderRadius:
                        "8px",
                      cursor:
                        submittingRequest
                          ? "not-allowed"
                          : "pointer",
                      fontWeight:
                        "bold",
                    }}
                  >
                    {submittingRequest
                      ? "SUBMITTING..."
                      : "SUBMIT REQUEST"}
                  </button>

                  <button
                    onClick={() =>
                      setShowViewingForm(
                        false
                      )
                    }
                    disabled={
                      submittingRequest
                    }
                    style={{
                      padding:
                        "14px 20px",
                      background:
                        "#F0F4F8",
                      color:
                        "#102A43",
                      border:
                        "1px solid #CBD5E1",
                      borderRadius:
                        "8px",
                      cursor:
                        submittingRequest
                          ? "not-allowed"
                          : "pointer",
                      fontWeight:
                        "bold",
                    }}
                  >
                    CANCEL
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={
                  openViewingForm
                }
                disabled={
                  checkingAccount
                }
                style={{
                  width:
                    "100%",
                  padding:
                    "15px",
                  marginTop:
                    "20px",
                  background:
                    checkingAccount
                      ? "#627D98"
                      : "#0B3B75",
                  color:
                    "white",
                  border:
                    "none",
                  borderRadius:
                    "9px",
                  cursor:
                    checkingAccount
                      ? "not-allowed"
                      : "pointer",
                  fontWeight:
                    "bold",
                  fontSize:
                    "15px",
                }}
              >
                {checkingAccount
                  ? "CHECKING ACCOUNT..."
                  : "REQUEST VIEWING"}
              </button>
            )}

            {/* ==================================================
                REPORT THIS PROPERTY
            ================================================== */}

            <div
              style={{
                marginTop: "14px",
                paddingTop: "14px",
                borderTop:
                  "1px solid #E1E8F0",
              }}
            >
              <button
                type="button"
                onClick={() => {
                  if (
                    selectedProperty
                  ) {
                    router.push(
                      `/report?property=${selectedProperty.id}`
                    );
                  }
                }}
                style={{
                  width: "100%",
                  padding: "14px",
                  background:
                    "#FFF5F5",
                  color:
                    "#B42318",
                  border:
                    "1px solid #F0A7A0",
                  borderRadius:
                    "9px",
                  cursor:
                    "pointer",
                  fontWeight:
                    "bold",
                  fontSize:
                    "14px",
                  boxSizing:
                    "border-box",
                }}
              >
                🚩 REPORT THIS PROPERTY
              </button>

              <p
                style={{
                  margin:
                    "7px 0 0",
                  textAlign:
                    "center",
                  color:
                    "#7B8794",
                  fontSize:
                    "12px",
                }}
              >
                See something suspicious
                or incorrect? Tell House
                Connect.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================
          FOOTER
      ================================================== */}

      <footer
        style={{
          background:
            "#082B54",
          color:
            "white",
          padding:
            "40px 20px",
          marginTop:
            "50px",
        }}
      >
        <div
          style={{
            maxWidth:
              "1100px",
            margin:
              "auto",
            display:
              "grid",
            gridTemplateColumns:
              "repeat(auto-fit, minmax(220px, 1fr))",
            gap:
              "30px",
            textAlign:
              "center",
          }}
        >
          <div>
            <h3
              style={{
                marginTop:
                  0,
              }}
            >
              <span
                style={{
                  display: "inline-flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: "10px",
                }}
              >
                <img
                  src="/logo-icon.svg"
                  alt="House Connect logo"
                  width={56}
                  height={56}
                  style={{ borderRadius: "14px" }}
                />
                HOUSE CONNECT
              </span>
            </h3>

            <p
              style={{
                opacity:
                  0.8,
                lineHeight:
                  "1.6",
              }}
            >
              Find trusted
              properties, connect
              with landlords and
              find your next home.
            </p>
          </div>

          <div>
            <h4>
              QUICK LINKS
            </h4>

            <p>
              <Link
                href="/"
                style={{
                  color:
                    "white",
                }}
              >
                Find Properties
              </Link>
            </p>

            <p>
              <Link
                href="/tenant"
                style={{
                  color:
                    "white",
                }}
              >
                Tenant Account
              </Link>
            </p>

            <p>
              <Link
                href="/landlord"
                style={{
                  color:
                    "white",
                }}
              >
                List Property
              </Link>
            </p>

            <p>
              <Link
                href="/auth?mode=login"
                style={{ color: "white" }}
              >
                Landlord Login
              </Link>
            </p>
          </div>

          <div>
            <h4>LEGAL</h4>

            <p>
              <Link href="/terms" style={{ color: "white" }}>
                Terms of Service
              </Link>
            </p>

            <p>
              <Link href="/privacy" style={{ color: "white" }}>
                Privacy Policy
              </Link>
            </p>
          </div>

          <div>
            <h4>
              HOUSE CONNECT
            </h4>

            <p
              style={{
                opacity:
                  0.8,
              }}
            >
              FIND • CONNECT • LIVE
            </p>

            <p
              style={{
                opacity:
                  0.7,
                fontSize:
                  "13px",
              }}
            >
              ©{" "}
              {new Date().getFullYear()}{" "}
              House Connect
            </p>
          </div>
        </div>
      </footer>
    </main>
  );
}