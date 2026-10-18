"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

/* =========================================================
   TYPES
========================================================= */

type TenantProfile = {
  full_name: string;
  phone: string;
  role: string;
};

type ViewingRequest = {
  id: string;
  property_id: string;
  tenant_id: string;
  message: string;
  status: string;
  created_at: string;
  propertyTitle?: string;
  propertyLocation?: string;
  landlordName?: string;
  landlordPhone?: string;
};

type PropertyImage = {
  id: string;
  property_id: string;
  storage_path: string;
  caption?: string | null;
  sort_order?: number | null;
};

type ApprovedProperty = {
  id: string;
  landlord_id: string;
  title: string;
  location: string;
  property_type: string;
  monthly_rent: number | string;
  bedrooms: number | null;
  description: string;
  status: string;
  created_at: string;
  images: PropertyImage[];
};

const IMAGE_BUCKET = "property-images";

/* =========================================================
   MAIN COMPONENT
========================================================= */

export default function TenantPage() {
  /* =======================================================
     AUTH
  ======================================================= */

  const [mode, setMode] =
    useState<"login" | "register">("login");

  const [authChecking, setAuthChecking] = useState(true);
  const [loading, setLoading] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  const [userId, setUserId] = useState("");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");

  const [profile, setProfile] =
    useState<TenantProfile | null>(null);

  /* =======================================================
     MESSAGES
  ======================================================= */

  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  /* =======================================================
     VIEWING REQUESTS
  ======================================================= */

  const [requests, setRequests] = useState<
    ViewingRequest[]
  >([]);

  const [loadingRequests, setLoadingRequests] =
    useState(false);

  /* =======================================================
     APPROVED PROPERTIES
  ======================================================= */

  const [properties, setProperties] = useState<
    ApprovedProperty[]
  >([]);

  const [loadingProperties, setLoadingProperties] =
    useState(false);

  const [propertySearch, setPropertySearch] =
    useState("");

  const [propertyTypeFilter, setPropertyTypeFilter] =
    useState("All");

  const [selectedProperty, setSelectedProperty] =
    useState<ApprovedProperty | null>(null);

  const [selectedImageIndex, setSelectedImageIndex] =
    useState(0);

  /* =======================================================
     VIEWING REQUEST MODAL
  ======================================================= */

  const [requestProperty, setRequestProperty] =
    useState<ApprovedProperty | null>(null);

  const [requestMessage, setRequestMessage] =
    useState(
      "Hello, I am interested in this property and would like to request a viewing."
    );

  const [submittingRequest, setSubmittingRequest] =
    useState(false);

  /* =======================================================
     REPORT PROPERTY
  ======================================================= */

  const [reportProperty, setReportProperty] =
    useState<ApprovedProperty | null>(null);

  const [reportReason, setReportReason] =
    useState("");

  const [reportDetails, setReportDetails] =
    useState("");

  const [submittingReport, setSubmittingReport] =
    useState(false);

  /* =======================================================
     PROFILE
  ======================================================= */

  async function loadProfile(id: string) {
    const { data, error: profileError } =
      await supabase
        .from("profiles")
        .select("full_name, phone, role")
        .eq("id", id)
        .maybeSingle();

    if (profileError) {
      console.error(
        "Tenant profile error:",
        profileError
      );

      throw new Error(
        "We could not load your tenant profile."
      );
    }

    if (!data) {
      throw new Error(
        "Your account profile could not be found."
      );
    }

    if (data.role !== "tenant") {
      throw new Error(
        "This account is not registered as a tenant."
      );
    }

    setProfile(data);
    return data as TenantProfile;
  }

  function getImageUrl(storagePath: string) {
    if (!storagePath) {
      return "";
    }

    const cleanPath = storagePath.replace(/^\/+/, "");

    const { data } = supabase.storage
      .from(IMAGE_BUCKET)
      .getPublicUrl(cleanPath);

    return data.publicUrl;
  }

  async function loadApprovedProperties() {
    setLoadingProperties(true);

    try {
      const {
        data,
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
            created_at
          `
        )
        .eq("status", "Approved")
        .order("created_at", {
          ascending: false,
        });

      if (propertyError) {
        console.error(
          "Approved properties error:",
          propertyError
        );

        setProperties([]);
        setError(
          "We could not load approved properties right now."
        );

        return;
      }

      const approvedProperties =
        (data || []) as ApprovedProperty[];

      if (approvedProperties.length === 0) {
        setProperties([]);
        return;
      }

      const propertyIds =
        approvedProperties.map(
          (property) => property.id
        );

      const {
        data: imageData,
        error: imageError,
      } = await supabase
        .from("property_images")
        .select(
          `
            id,
            property_id,
            storage_path,
            caption,
            sort_order
          `
        )
        .in("property_id", propertyIds)
        .order("sort_order", {
          ascending: true,
        });

      if (imageError) {
        console.error(
          "Property images error:",
          imageError
        );
      }

      const images =
        (imageData || []) as PropertyImage[];

      const propertiesWithImages =
        approvedProperties.map(
          (property) => ({
            ...property,
            images: images.filter(
              (image) =>
                image.property_id ===
                property.id
            ),
          })
        );

      setProperties(
        propertiesWithImages
      );
    } catch (err) {
      console.error(
        "Unexpected property loading error:",
        err
      );

      setError(
        "Something went wrong while loading properties."
      );
    } finally {
      setLoadingProperties(false);
    }
  }

  async function loadRequests(id?: string) {
    setLoadingRequests(true);

    try {
      let tenantId = id;

      if (!tenantId) {
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
          setRequests([]);
          return;
        }

        tenantId = user.id;
      }

      setUserId(tenantId);

      const {
        data,
        error: requestError,
      } = await supabase
        .from("viewing_requests")
        .select(
          `
            id,
            property_id,
            tenant_id,
            message,
            status,
            created_at
          `
        )
        .eq("tenant_id", tenantId)
        .order("created_at", {
          ascending: false,
        });

      if (requestError) {
        console.error(
          "Tenant requests error:",
          requestError
        );

        setError(
          "We could not load your viewing requests."
        );

        return;
      }

      const requestRows =
        data || [];

      if (requestRows.length === 0) {
        setRequests([]);
        return;
      }

      const propertyIds = [
        ...new Set(
          requestRows.map(
            (request) =>
              request.property_id
          )
        ),
      ];

      let propertiesForRequests: {
        id: string;
        title: string;
        location: string;
        landlord_id: string;
      }[] = [];

      if (propertyIds.length > 0) {
        const {
          data: propertyData,
          error: propertyError,
        } = await supabase
          .from("properties")
          .select(
            "id, title, location, landlord_id"
          )
          .in(
            "id",
            propertyIds
          );

        if (propertyError) {
          console.error(
            "Request property loading error:",
            propertyError
          );
        }

        propertiesForRequests =
          propertyData || [];
      }

      const acceptedLandlordIds =
        requestRows
          .filter(
            (request) =>
              request.status ===
              "Accepted"
          )
          .map((request) => {
            const property =
              propertiesForRequests.find(
                (item) =>
                  item.id ===
                  request.property_id
              );

            return property?.landlord_id;
          })
          .filter(
            (
              id
            ): id is string =>
              Boolean(id)
          );

      const uniqueLandlordIds = [
        ...new Set(
          acceptedLandlordIds
        ),
      ];

      let landlordProfiles: {
        id: string;
        full_name: string;
        phone: string;
      }[] = [];

      if (
        uniqueLandlordIds.length >
        0
      ) {
        const {
          data: landlordData,
          error: landlordError,
        } = await supabase
          .from("profiles")
          .select(
            "id, full_name, phone"
          )
          .in(
            "id",
            uniqueLandlordIds
          );

        if (landlordError) {
          console.error(
            "Landlord contact loading error:",
            landlordError
          );
        } else {
          landlordProfiles =
            landlordData || [];
        }
      }

      const formattedRequests: ViewingRequest[] =
        requestRows.map(
          (request) => {
            const property =
              propertiesForRequests.find(
                (item) =>
                  item.id ===
                  request.property_id
              );

            let landlordName = "";
            let landlordPhone = "";

            if (
              request.status ===
                "Accepted" &&
              property?.landlord_id
            ) {
              const landlord =
                landlordProfiles.find(
                  (item) =>
                    item.id ===
                    property.landlord_id
                );

              if (landlord) {
                landlordName =
                  landlord.full_name ||
                  "";

                landlordPhone =
                  landlord.phone ||
                  "";
              }
            }

            return {
              ...request,
              propertyTitle:
                property?.title ||
                "Property",
              propertyLocation:
                property?.location ||
                "Location unavailable",
              landlordName,
              landlordPhone,
            };
          }
        );

      setRequests(
        formattedRequests
      );
    } catch (err) {
      console.error(
        "Unexpected request loading error:",
        err
      );

      setError(
        "Something went wrong while loading your requests."
      );
    } finally {
      setLoadingRequests(false);
    }
  }

  async function loadTenantDashboard(
    id: string
  ) {
    setUserId(id);

    await loadProfile(id);

    await Promise.all([
      loadRequests(id),
      loadApprovedProperties(),
    ]);
  }

  useEffect(() => {
    let mounted = true;

    async function checkSession() {
      try {
        const {
          data: { user },
          error: sessionError,
        } =
          await supabase.auth.getUser();

        if (sessionError) {
          console.error(
            "Session error:",
            sessionError
          );
        }

        if (!mounted) return;

        if (user) {
          try {
            await loadTenantDashboard(
              user.id
            );
          } catch (profileError) {
            console.error(
              "Tenant session verification error:",
              profileError
            );

            await supabase.auth.signOut();

            if (mounted) {
              setUserId("");
              setProfile(null);
              setError(
                profileError instanceof Error
                  ? profileError.message
                  : "We could not verify your tenant account."
              );
            }
          }
        }
      } catch (err) {
        console.error(
          "Session check error:",
          err
        );
      } finally {
        if (mounted) {
          setAuthChecking(false);
        }
      }
    }

    checkSession();

    const {
      data: authListener,
    } =
      supabase.auth.onAuthStateChange(
        async (
          event,
          session
        ) => {
          if (!mounted) return;

          if (
            event ===
            "SIGNED_OUT"
          ) {
            setUserId("");
            setProfile(null);
            setRequests([]);
            setProperties([]);
            setSelectedProperty(null);
            setRequestProperty(null);
            setReportProperty(null);
            setEmail("");
            setPassword("");
          }
        }
      );

    return () => {
      mounted = false;
      authListener.subscription.unsubscribe();
    };
  }, []);

  async function register() {
    setError("");
    setMessage("");

    const cleanName =
      fullName.trim();

    const cleanEmail =
      email.trim().toLowerCase();

    const cleanPhone =
      phone.replace(/\D/g, "");

    if (!cleanName) {
      setError(
        "Please enter your full name."
      );
      return;
    }

    if (cleanName.length < 2) {
      setError(
        "Please enter a valid full name."
      );
      return;
    }

    if (
      !/^[0-9]{10}$/.test(
        cleanPhone
      )
    ) {
      setError(
        "Please enter a valid 10-digit Ugandan phone number."
      );
      return;
    }

    if (
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
        cleanEmail
      )
    ) {
      setError(
        "Please enter a valid email address."
      );
      return;
    }

    if (password.length < 6) {
      setError(
        "Password must contain at least 6 characters."
      );
      return;
    }

    setLoading(true);

    try {
      const {
        data,
        error: signUpError,
      } =
        await supabase.auth.signUp({
          email: cleanEmail,
          password,
          options: {
            data: {
              full_name:
                cleanName,
              phone: cleanPhone,
              role: "tenant",
            },
          },
        });

      if (signUpError) {
        const lower =
          signUpError.message.toLowerCase();

        if (
          lower.includes(
            "already registered"
          ) ||
          lower.includes(
            "already exists"
          )
        ) {
          setError(
            "An account with this email already exists. Please log in instead."
          );
        } else {
          setError(
            signUpError.message
          );
        }

        return;
      }

      if (!data.user) {
        setError(
          "Account creation failed. Please try again."
        );
        return;
      }

      if (data.session) {
        try {
          await loadTenantDashboard(
            data.user.id
          );

          setMessage(
            "Your tenant account has been created successfully."
          );

          setFullName("");
          setPhone("");
          setPassword("");
        } catch (profileError) {
          console.error(
            "New tenant profile loading error:",
            profileError
          );

          setError(
            "Your account was created, but we could not load your tenant profile. Please try logging in again."
          );

          await supabase.auth.signOut();
        }
      } else {
        setMessage(
          "Registration successful. Please check your email and confirm your account before logging in."
        );

        setMode("login");
        setPassword("");
        setFullName("");
        setPhone("");
      }
    } catch (err) {
      console.error(
        "Tenant registration error:",
        err
      );

      setError(
        "An unexpected error occurred during registration. Please try again."
      );
    } finally {
      setLoading(false);
    }
  }

  async function login() {
    setError("");
    setMessage("");

    const cleanEmail =
      email.trim().toLowerCase();

    if (
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
        cleanEmail
      )
    ) {
      setError(
        "Please enter a valid email address."
      );
      return;
    }

    if (!password) {
      setError(
        "Please enter your password."
      );
      return;
    }

    setLoading(true);

    try {
      const {
        data,
        error: loginError,
      } =
        await supabase.auth.signInWithPassword(
          {
            email: cleanEmail,
            password,
          }
        );

      if (loginError) {
        const lower =
          loginError.message.toLowerCase();

        if (
          lower.includes(
            "email not confirmed"
          )
        ) {
          setError(
            "Your email has not been confirmed yet. Please check your email and confirm your account before logging in."
          );
        } else if (
          lower.includes(
            "invalid login credentials"
          )
        ) {
          setError(
            "Incorrect email or password. Please check your details and try again."
          );
        } else {
          setError(
            loginError.message
          );
        }

        return;
      }

      if (!data.user) {
        setError(
          "Login failed. Please try again."
        );
        return;
      }

      try {
        await loadTenantDashboard(
          data.user.id
        );

        setEmail("");
        setPassword("");
        setMessage(
          "Welcome back to House Connect."
        );
      } catch (profileError) {
        console.error(
          "Tenant verification error:",
          profileError
        );

        await supabase.auth.signOut();

        setUserId("");
        setProfile(null);

        setError(
          profileError instanceof Error
            ? profileError.message
            : "This account could not be verified as a tenant."
        );
      }
    } catch (err) {
      console.error(
        "Tenant login error:",
        err
      );

      setError(
        "An unexpected error occurred during login. Please try again."
      );
    } finally {
      setLoading(false);
    }
  }

  async function forgotPassword() {
    setError("");
    setMessage("");

    const cleanEmail =
      email.trim().toLowerCase();

    if (
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
        cleanEmail
      )
    ) {
      setError(
        "Enter your email address first, then click Forgot password."
      );
      return;
    }

    setLoading(true);

    try {
      const {
        error: resetError,
      } =
        await supabase.auth.resetPasswordForEmail(
          cleanEmail,
          {
            redirectTo:
              `${window.location.origin}/tenant`,
          }
        );

      if (resetError) {
        setError(
          resetError.message
        );
        return;
      }

      setMessage(
        "If an account exists for this email, a password reset link has been sent."
      );
    } catch (err) {
      console.error(
        "Password reset error:",
        err
      );

      setError(
        "We could not send the password reset email. Please try again."
      );
    } finally {
      setLoading(false);
    }
  }

  async function logout() {
    setError("");
    setMessage("");
    setLoggingOut(true);

    try {
      const {
        error: logoutError,
      } =
        await supabase.auth.signOut();

      if (logoutError) {
        console.error(
          "Logout error:",
          logoutError
        );

        setError(
          "We could not complete logout. Please try again."
        );

        return;
      }

      setUserId("");
      setProfile(null);
      setRequests([]);
      setProperties([]);
      setSelectedProperty(null);
      setRequestProperty(null);
      setReportProperty(null);
      setSelectedImageIndex(0);
      setEmail("");
      setPassword("");
      setFullName("");
      setPhone("");

      setReportReason("");
      setReportDetails("");

      setMode("login");

      setMessage(
        "You have been logged out successfully."
      );

      window.scrollTo({
        top: 0,
        behavior: "smooth",
      });
    } catch (err) {
      console.error(
        "Unexpected logout error:",
        err
      );

      setError(
        "Something went wrong while logging out."
      );
    } finally {
      setLoggingOut(false);
    }
  }

  const propertyTypes =
    useMemo(() => {
      const types = properties
        .map(
          (property) =>
            property.property_type
        )
        .filter(Boolean);

      return [
        "All",
        ...Array.from(
          new Set(types)
        ),
      ];
    }, [properties]);

  const filteredProperties =
    useMemo(() => {
      const search =
        propertySearch
          .trim()
          .toLowerCase();

      return properties.filter(
        (property) => {
          const matchesSearch =
            !search ||
            property.title
              .toLowerCase()
              .includes(search) ||
            property.location
              .toLowerCase()
              .includes(search) ||
            property.description
              .toLowerCase()
              .includes(search);

          const matchesType =
            propertyTypeFilter ===
              "All" ||
            property.property_type ===
              propertyTypeFilter;

          return (
            matchesSearch &&
            matchesType
          );
        }
      );
    }, [
      properties,
      propertySearch,
      propertyTypeFilter,
    ]);

  function openProperty(
    property: ApprovedProperty
  ) {
    setSelectedProperty(property);
    setSelectedImageIndex(0);

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  }

  function closeProperty() {
    setSelectedProperty(null);
    setSelectedImageIndex(0);
  }

  function openRequestModal(
    property: ApprovedProperty
  ) {
    setError("");

    const existingRequest =
      requests.find(
        (request) =>
          request.property_id ===
            property.id &&
          (
            request.status ===
              "Pending" ||
            request.status ===
              "Accepted"
          )
      );

    if (existingRequest) {
      if (
        existingRequest.status ===
        "Pending"
      ) {
        setMessage(
          "You already have a pending viewing request for this property."
        );
      } else {
        setMessage(
          "Your viewing request for this property has already been accepted."
        );
      }

      return;
    }

    setRequestProperty(
      property
    );

    setRequestMessage(
      "Hello, I am interested in this property and would like to request a viewing."
    );
  }

  async function submitViewingRequest() {
    if (!userId) {
      setError(
        "Please log in as a tenant before requesting a viewing."
      );
      return;
    }

    if (!requestProperty) {
      return;
    }

    const cleanMessage =
      requestMessage.trim();

    if (!cleanMessage) {
      setError(
        "Please enter a message for the landlord."
      );
      return;
    }

    setSubmittingRequest(true);
    setError("");
    setMessage("");

    try {
      const {
        data: currentProperty,
        error: propertyCheckError,
      } = await supabase
        .from("properties")
        .select("id, status")
        .eq(
          "id",
          requestProperty.id
        )
        .maybeSingle();

      if (propertyCheckError) {
        console.error(
          propertyCheckError
        );

        setError(
          "We could not verify this property. Please try again."
        );

        return;
      }

      if (
        !currentProperty ||
        currentProperty.status !==
          "Approved"
      ) {
        setError(
          "This property is no longer available for viewing."
        );

        await loadApprovedProperties();
        return;
      }

      const {
        data: existingRequests,
        error: existingError,
      } = await supabase
        .from("viewing_requests")
        .select(
          "id, status"
        )
        .eq(
          "property_id",
          requestProperty.id
        )
        .eq(
          "tenant_id",
          userId
        )
        .in(
          "status",
          [
            "Pending",
            "Accepted",
          ]
        );

      if (existingError) {
        console.error(
          "Existing request check error:",
          existingError
        );

        setError(
          "We could not verify your previous requests."
        );

        return;
      }

      if (
        existingRequests &&
        existingRequests.length >
          0
      ) {
        setError(
          "You already have an active viewing request for this property."
        );

        await loadRequests(
          userId
        );

        return;
      }

      const {
        error: insertError,
      } = await supabase
        .from("viewing_requests")
        .insert({
          property_id:
            requestProperty.id,
          tenant_id: userId,
          message:
            cleanMessage,
          status: "Pending",
        });

      if (insertError) {
        console.error(
          "Viewing request insert error:",
          insertError
        );

        setError(
          insertError.message ||
            "We could not submit your viewing request."
        );

        return;
      }

      setRequestProperty(null);

      setMessage(
        "Viewing request sent successfully. The landlord will respond to your request."
      );

      await loadRequests(
        userId
      );

      setSelectedProperty(null);
      setSelectedImageIndex(0);
    } catch (err) {
      console.error(
        "Viewing request error:",
        err
      );

      setError(
        "Something went wrong while sending your viewing request."
      );
    } finally {
      setSubmittingRequest(false);
    }
  }

  /* =======================================================
     REPORT PROPERTY
  ======================================================= */

  function openReportModal(
    property: ApprovedProperty
  ) {
    setError("");
    setMessage("");
    setReportProperty(property);
    setReportReason("");
    setReportDetails("");
  }

  function closeReportModal() {
    if (submittingReport) {
      return;
    }

    setReportProperty(null);
    setReportReason("");
    setReportDetails("");
  }

  async function submitPropertyReport() {
    if (!userId) {
      setError(
        "Please log in as a tenant before reporting a property."
      );
      return;
    }

    if (!reportProperty) {
      return;
    }

    const cleanReason =
      reportReason.trim();

    const cleanDetails =
      reportDetails.trim();

    if (!cleanReason) {
      setError(
        "Please select a reason for reporting this property."
      );
      return;
    }

    if (!cleanDetails) {
      setError(
        "Please explain the problem with this property."
      );
      return;
    }

    setSubmittingReport(true);
    setError("");
    setMessage("");

    try {
      const {
        data: currentProperty,
        error: propertyCheckError,
      } = await supabase
        .from("properties")
        .select("id, status")
        .eq(
          "id",
          reportProperty.id
        )
        .maybeSingle();

      if (propertyCheckError) {
        console.error(
          "Report property verification error:",
          propertyCheckError
        );

        setError(
          "We could not verify this property. Please try again."
        );

        return;
      }

      if (!currentProperty) {
        setError(
          "This property could not be found."
        );
        return;
      }

      /*
       * IMPORTANT:
       * property_reports does NOT have a "details" column.
       * Therefore only the columns that actually exist
       * are sent to Supabase.
       */
      const {
        error: reportError,
      } = await supabase
        .from("property_reports")
        .insert({
          property_id:
            reportProperty.id,
          tenant_id:
            userId,
          reason:
            cleanReason,
        });

      if (reportError) {
        console.error(
          "Property report insert error:",
          reportError
        );

        setError(
          reportError.message ||
            "We could not submit your report. Please try again."
        );

        return;
      }

      /*
       * REPORT SUCCESS
       */
      setReportProperty(null);
      setReportReason("");
      setReportDetails("");

      setSelectedProperty(null);
      setSelectedImageIndex(0);

      setMessage(
        "✅ REPORT SUBMITTED SUCCESSFULLY. Thank you for helping House Connect keep our properties safe."
      );

      setError("");

      window.scrollTo({
        top: 0,
        behavior: "smooth",
      });
    } catch (err) {
      console.error(
        "Property report error:",
        err
      );

      setError(
        "Something went wrong while submitting your report."
      );
    } finally {
      setSubmittingReport(false);
    }
  }

  function statusStyle(
    status: string
  ) {
    if (
      status ===
      "Accepted"
    ) {
      return {
        background: "#D1FAE5",
        color: "#065F46",
      };
    }

    if (
      status ===
      "Rejected"
    ) {
      return {
        background: "#FEE2E2",
        color: "#991B1B",
      };
    }

    return {
      background: "#FFF3CD",
      color: "#856404",
    };
  }

  function formatRent(
    rent: number | string
  ) {
    const numericRent =
      Number(rent);

    if (
      Number.isNaN(
        numericRent
      )
    ) {
      return String(rent);
    }

    return numericRent.toLocaleString(
      "en-UG"
    );
  }

  if (authChecking) {
    return (
      <main
        style={{
          minHeight:
            "100vh",
          background:
            "#F7F9FC",
          fontFamily:
            "Arial, sans-serif",
          display: "flex",
          alignItems:
            "center",
          justifyContent:
            "center",
          color:
            "#0B3B75",
          padding:
            "20px",
        }}
      >
        <div
          style={{
            background:
              "white",
            padding:
              "40px",
            borderRadius:
              "16px",
            border:
              "1px solid #D7E0EA",
            textAlign:
              "center",
            maxWidth:
              "420px",
            width:
              "100%",
          }}
        >
          <div
            style={{
              fontSize:
                "50px",
              marginBottom:
                "15px",
            }}
          >
            🏠
          </div>

          <h2
            style={{
              margin:
                "0 0 10px 0",
            }}
          >
            HOUSE CONNECT
          </h2>

          <p
            style={{
              color:
                "#627D98",
              margin:
                0,
            }}
          >
            Checking your account...
          </p>
        </div>
      </main>
    );
  }

  return (
    <main
      style={{
        minHeight:
          "100vh",
        background:
          "#F7F9FC",
        fontFamily:
          "Arial, sans-serif",
        color:
          "#102A43",
      }}
    >
      {/* HEADER */}

      <header
        style={{
          background:
            "#0B3B75",
          color:
            "white",
          padding:
            "20px",
          position:
            "sticky",
          top:
            0,
          zIndex:
            50,
          boxShadow:
            "0 2px 10px rgba(0,0,0,0.12)",
        }}
      >
        <div
          style={{
            maxWidth:
              "1100px",
            margin:
              "auto",
            display:
              "flex",
            justifyContent:
              "space-between",
            alignItems:
              "center",
            gap:
              "15px",
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
              fontWeight:
                "bold",
              fontSize:
                "21px",
            }}
          >
            🏠 HOUSE CONNECT
          </Link>

          <div
            style={{
              display:
                "flex",
              gap:
                "15px",
              alignItems:
                "center",
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
                fontWeight:
                  "bold",
              }}
            >
              Find Properties
            </Link>

            {userId && (
              <span
                style={{
                  fontSize:
                    "14px",
                  opacity:
                    0.9,
                }}
              >
                {profile?.full_name ||
                  "Tenant"}
              </span>
            )}
          </div>
        </div>
      </header>

      <div
        style={{
          maxWidth:
            "1100px",
          margin:
            "0 auto",
          padding:
            "30px 18px 0",
        }}
      >
        {/* GLOBAL MESSAGE */}

        {error && (
          <div
            style={{
              background:
                "#FEE4E2",
              color:
                "#B42318",
              border:
                "1px solid #FECACA",
              padding:
                "14px 16px",
              borderRadius:
                "10px",
              marginBottom:
                "18px",
              fontWeight:
                "bold",
            }}
          >
            {error}
          </div>
        )}

        {message && (
          <div
            style={{
              background:
                "#D1FAE5",
              color:
                "#065F46",
              border:
                "1px solid #A7F3D0",
              padding:
                "14px 16px",
              borderRadius:
                "10px",
              marginBottom:
                "18px",
              fontWeight:
                "bold",
            }}
          >
            {message}
          </div>
        )}

        {userId ? (
          <>
            <section
              style={{
                background:
                  "white",
                padding:
                  "25px",
                borderRadius:
                  "15px",
                border:
                  "1px solid #D7E0EA",
                marginBottom:
                  "25px",
              }}
            >
              <div
                style={{
                  display:
                    "flex",
                  justifyContent:
                    "space-between",
                  alignItems:
                    "center",
                  gap:
                    "20px",
                  flexWrap:
                    "wrap",
                }}
              >
                <div>
                  <p
                    style={{
                      color:
                        "#627D98",
                      margin:
                        "0 0 5px 0",
                    }}
                  >
                    Welcome back
                  </p>

                  <h1
                    style={{
                      color:
                        "#0B3B75",
                      margin:
                        "0 0 8px 0",
                      fontSize:
                        "30px",
                    }}
                  >
                    👤{" "}
                    {profile?.full_name ||
                      "Tenant"}
                  </h1>

                  <p
                    style={{
                      margin:
                        "5px 0",
                      color:
                        "#627D98",
                    }}
                  >
                    📞{" "}
                    {profile?.phone ||
                      "Phone unavailable"}
                  </p>
                </div>

                <Link
                  href="/"
                  style={{
                    display:
                      "inline-block",
                    padding:
                      "12px 18px",
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
                  FIND A PROPERTY
                </Link>
              </div>
            </section>

            {/* =================================================
                APPROVED PROPERTIES
            ================================================= */}

            <section
              style={{
                marginBottom:
                  "35px",
              }}
            >
              <div
                style={{
                  marginBottom:
                    "18px",
                }}
              >
                <h2
                  style={{
                    color:
                      "#0B3B75",
                    margin:
                      "0 0 6px 0",
                  }}
                >
                  🏠 Approved Properties
                </h2>

                <p
                  style={{
                    color:
                      "#627D98",
                    margin:
                      0,
                  }}
                >
                  Browse properties that
                  have been verified by
                  House Connect.
                </p>
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
                  display:
                    "flex",
                  gap:
                    "12px",
                  flexWrap:
                    "wrap",
                }}
              >
                <input
                  value={
                    propertySearch
                  }
                  onChange={(e) =>
                    setPropertySearch(
                      e.target.value
                    )
                  }
                  placeholder="Search by location, property name..."
                  style={{
                    flex:
                      "1 1 300px",
                    padding:
                      "13px",
                    border:
                      "1px solid #CBD5E1",
                    borderRadius:
                      "8px",
                    boxSizing:
                      "border-box",
                    fontSize:
                      "15px",
                  }}
                />

                <select
                  value={
                    propertyTypeFilter
                  }
                  onChange={(e) =>
                    setPropertyTypeFilter(
                      e.target.value
                    )
                  }
                  style={{
                    flex:
                      "0 1 220px",
                    padding:
                      "13px",
                    border:
                      "1px solid #CBD5E1",
                    borderRadius:
                      "8px",
                    background:
                      "white",
                    fontSize:
                      "15px",
                  }}
                >
                  {propertyTypes.map(
                    (type) => (
                      <option
                        key={
                          type
                        }
                        value={
                          type
                        }
                      >
                        {type ===
                        "All"
                          ? "All property types"
                          : type}
                      </option>
                    )
                  )}
                </select>
              </div>

              {loadingProperties && (
                <div
                  style={{
                    background:
                      "white",
                    padding:
                      "30px",
                    borderRadius:
                      "12px",
                    border:
                      "1px solid #D7E0EA",
                    textAlign:
                      "center",
                  }}
                >
                  <strong>
                    Loading approved properties...
                  </strong>
                </div>
              )}

              {!loadingProperties &&
                properties.length ===
                  0 && (
                  <div
                    style={{
                      background:
                        "white",
                      padding:
                        "45px 25px",
                      borderRadius:
                        "12px",
                      border:
                        "1px solid #D7E0EA",
                      textAlign:
                        "center",
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
                      No approved properties yet
                    </h3>

                    <p
                      style={{
                        color:
                          "#627D98",
                      }}
                    >
                      New properties will
                      appear here after
                      House Connect verifies
                      them.
                    </p>
                  </div>
                )}

              {!loadingProperties &&
                properties.length >
                  0 &&
                filteredProperties.length ===
                  0 && (
                  <div
                    style={{
                      background:
                        "white",
                      padding:
                        "35px",
                      borderRadius:
                        "12px",
                      border:
                        "1px solid #D7E0EA",
                      textAlign:
                        "center",
                    }}
                  >
                    <h3>
                      No matching properties
                    </h3>

                    <p
                      style={{
                        color:
                          "#627D98",
                      }}
                    >
                      Try another location,
                      property name or
                      property type.
                    </p>
                  </div>
                )}

              {!loadingProperties &&
                filteredProperties.length >
                  0 && (
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
                      (property) => {
                        const firstImage =
                          property
                            .images?.[0];

                        const imageUrl =
                          firstImage
                            ? getImageUrl(
                                firstImage.storage_path
                              )
                            : "";

                        const existingRequest =
                          requests.find(
                            (request) =>
                              request.property_id ===
                              property.id
                          );

                        return (
                          <div
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
                                "0 2px 8px rgba(0,0,0,0.04)",
                            }}
                          >
                            <div
                              style={{
                                height:
                                  "190px",
                                background:
                                  "#E8EEF5",
                                position:
                                  "relative",
                                overflow:
                                  "hidden",
                              }}
                            >
                              {imageUrl ? (
                                <img
                                  src={
                                    imageUrl
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
                                    height:
                                      "100%",
                                    display:
                                      "flex",
                                    alignItems:
                                      "center",
                                    justifyContent:
                                      "center",
                                    fontSize:
                                      "55px",
                                  }}
                                >
                                  🏠
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
                                    "#26734D",
                                  color:
                                    "white",
                                  padding:
                                    "6px 10px",
                                  borderRadius:
                                    "20px",
                                  fontSize:
                                    "12px",
                                  fontWeight:
                                    "bold",
                                }}
                              >
                                ✓ VERIFIED
                              </span>
                            </div>

                            <div
                              style={{
                                padding:
                                  "18px",
                              }}
                            >
                              <h3
                                style={{
                                  color:
                                    "#0B3B75",
                                  margin:
                                    "0 0 8px 0",
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
                                    "5px 0",
                                }}
                              >
                                📍{" "}
                                {
                                  property.location
                                }
                              </p>

                              <p
                                style={{
                                  margin:
                                    "10px 0",
                                  fontWeight:
                                    "bold",
                                  color:
                                    "#26734D",
                                  fontSize:
                                    "18px",
                                }}
                              >
                                UGX{" "}
                                {formatRent(
                                  property.monthly_rent
                                )}
                                <span
                                  style={{
                                    fontSize:
                                      "12px",
                                    fontWeight:
                                      "normal",
                                    color:
                                      "#627D98",
                                  }}
                                >
                                  {" "}
                                  / month
                                </span>
                              </p>

                              <div
                                style={{
                                  display:
                                    "flex",
                                  gap:
                                    "8px",
                                  flexWrap:
                                    "wrap",
                                  margin:
                                    "12px 0",
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

                                {property
                                  .images
                                  .length >
                                  0 && (
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
                                    📷{" "}
                                    {
                                      property
                                        .images
                                        .length
                                    }{" "}
                                    photo
                                    {property
                                      .images
                                      .length ===
                                    1
                                      ? ""
                                      : "s"}
                                  </span>
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
                                }}
                              >
                                <button
                                  onClick={() =>
                                    openProperty(
                                      property
                                    )
                                  }
                                  style={{
                                    flex:
                                      "1 1 120px",
                                    padding:
                                      "11px",
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
                                  VIEW DETAILS
                                </button>

                                {existingRequest ? (
                                  <span
                                    style={{
                                      flex:
                                        "1 1 120px",
                                      padding:
                                        "11px",
                                      background:
                                        existingRequest.status ===
                                        "Accepted"
                                          ? "#D1FAE5"
                                          : "#FFF3CD",
                                      color:
                                        existingRequest.status ===
                                        "Accepted"
                                          ? "#065F46"
                                          : "#856404",
                                      borderRadius:
                                        "8px",
                                      textAlign:
                                        "center",
                                      fontWeight:
                                        "bold",
                                      fontSize:
                                        "13px",
                                    }}
                                  >
                                    {existingRequest.status ===
                                    "Accepted"
                                      ? "✓ ACCEPTED"
                                      : "⏳ REQUESTED"}
                                  </span>
                                ) : (
                                  <button
                                    onClick={() =>
                                      openRequestModal(
                                        property
                                      )
                                    }
                                    style={{
                                      flex:
                                        "1 1 120px",
                                      padding:
                                        "11px",
                                      background:
                                        "#26734D",
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
                                    REQUEST VIEWING
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      }
                    )}
                  </div>
                )}
            </section>

            {/* VIEWING REQUESTS */}

            <section
              style={{
                marginBottom:
                  "30px",
              }}
            >
              <div
                style={{
                  marginBottom:
                    "18px",
                }}
              >
                <h2
                  style={{
                    color:
                      "#0B3B75",
                    margin:
                      "0 0 6px 0",
                  }}
                >
                  📅 My Viewing Requests
                </h2>

                <p
                  style={{
                    color:
                      "#627D98",
                    margin:
                      0,
                  }}
                >
                  Track properties you have
                  requested to view.
                </p>
              </div>

              <div
                style={{
                  background:
                    "white",
                  padding:
                    "25px",
                  borderRadius:
                    "15px",
                  border:
                    "1px solid #D7E0EA",
                }}
              >
                {loadingRequests && (
                  <p
                    style={{
                      padding:
                        "14px",
                      background:
                        "#E8F1FA",
                      borderRadius:
                        "9px",
                    }}
                  >
                    Loading your requests...
                  </p>
                )}

                {!loadingRequests &&
                  requests.length ===
                    0 && (
                    <div
                      style={{
                        textAlign:
                          "center",
                        padding:
                          "35px",
                        background:
                          "#F7F9FC",
                        borderRadius:
                          "10px",
                      }}
                    >
                      <div
                        style={{
                          fontSize:
                            "45px",
                        }}
                      >
                        🏠
                      </div>

                      <h3>
                        No viewing requests yet
                      </h3>

                      <p
                        style={{
                          color:
                            "#627D98",
                        }}
                      >
                        Find an approved
                        property above and
                        request a viewing.
                      </p>
                    </div>
                  )}

                {requests.map(
                  (request) => {
                    const colors =
                      statusStyle(
                        request.status
                      );

                    return (
                      <div
                        key={
                          request.id
                        }
                        style={{
                          border:
                            "1px solid #D7E0EA",
                          borderRadius:
                            "12px",
                          padding:
                            "20px",
                          marginTop:
                            "18px",
                        }}
                      >
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
                            flexWrap:
                              "wrap",
                          }}
                        >
                          <div>
                            <h3
                              style={{
                                margin:
                                  "0 0 8px 0",
                                color:
                                  "#0B3B75",
                              }}
                            >
                              {
                                request.propertyTitle
                              }
                            </h3>

                            <p
                              style={{
                                margin:
                                  0,
                                color:
                                  "#627D98",
                              }}
                            >
                              📍{" "}
                              {
                                request.propertyLocation
                              }
                            </p>
                          </div>

                          <span
                            style={{
                              padding:
                                "8px 14px",
                              borderRadius:
                                "20px",
                              fontWeight:
                                "bold",
                              fontSize:
                                "13px",
                              background:
                                colors.background,
                              color:
                                colors.color,
                            }}
                          >
                            {
                              request.status
                            }
                          </span>
                        </div>

                        <hr
                          style={{
                            border:
                              "none",
                            borderTop:
                              "1px solid #E1E8F0",
                            margin:
                              "18px 0",
                          }}
                        />

                        <p
                          style={{
                            whiteSpace:
                              "pre-wrap",
                            lineHeight:
                              "1.6",
                          }}
                        >
                          <strong>
                            Your request:
                          </strong>
                          <br />
                          {
                            request.message
                          }
                        </p>

                        <p
                          style={{
                            color:
                              "#627D98",
                            fontSize:
                              "13px",
                          }}
                        >
                          Submitted:{" "}
                          {new Date(
                            request.created_at
                          ).toLocaleString()}
                        </p>

                        {request.status ===
                          "Accepted" && (
                          <div
                            style={{
                              background:
                                "#ECFDF3",
                              padding:
                                "18px",
                              borderRadius:
                                "9px",
                              color:
                                "#065F46",
                              border:
                                "1px solid #A7F3D0",
                              marginTop:
                                "15px",
                            }}
                          >
                            <strong
                              style={{
                                display:
                                  "block",
                                marginBottom:
                                  "10px",
                                fontSize:
                                  "17px",
                              }}
                            >
                              🎉 Viewing Accepted
                            </strong>

                            <p
                              style={{
                                margin:
                                  "7px 0",
                              }}
                            >
                              👤{" "}
                              <strong>
                                Landlord:
                              </strong>{" "}
                              {request.landlordName ||
                                "Name unavailable"}
                            </p>

                            <p
                              style={{
                                margin:
                                  "7px 0",
                              }}
                            >
                              📞{" "}
                              <strong>
                                Phone:
                              </strong>{" "}
                              {request.landlordPhone ||
                                "Phone unavailable"}
                            </p>

                            <p
                              style={{
                                marginTop:
                                  "12px",
                                fontSize:
                                  "14px",
                              }}
                            >
                              The landlord has
                              accepted your
                              viewing request.
                              You can now
                              contact them using
                              the details above.
                            </p>
                          </div>
                        )}

                        {request.status ===
                          "Pending" && (
                          <div
                            style={{
                              background:
                                "#FFF8E1",
                              padding:
                                "14px",
                              borderRadius:
                                "8px",
                              color:
                                "#856404",
                              fontWeight:
                                "bold",
                            }}
                          >
                            ⏳ Waiting for the
                            landlord to
                            respond.
                            <br />
                            <span
                              style={{
                                fontWeight:
                                  "normal",
                              }}
                            >
                              Landlord contact
                              details will
                              become available
                              after the request
                              is accepted.
                            </span>
                          </div>
                        )}

                        {request.status ===
                          "Rejected" && (
                          <div
                            style={{
                              background:
                                "#FEF2F2",
                              padding:
                                "15px",
                              borderRadius:
                                "8px",
                              color:
                                "#991B1B",
                              fontWeight:
                                "bold",
                            }}
                          >
                            ❌ This viewing
                            request was
                            rejected by the
                            landlord.
                            <br />
                            <span
                              style={{
                                fontWeight:
                                  "normal",
                              }}
                            >
                              Landlord contact
                              details are not
                              available for
                              rejected requests.
                            </span>
                          </div>
                        )}
                      </div>
                    );
                  }
                )}
              </div>
            </section>

            {/* ACCOUNT / LOGOUT */}

            <section
              style={{
                background:
                  "white",
                padding:
                  "25px",
                borderRadius:
                  "15px",
                border:
                  "1px solid #D7E0EA",
                marginBottom:
                  "35px",
              }}
            >
              <h2
                style={{
                  color:
                    "#0B3B75",
                  margin:
                    "0 0 8px 0",
                }}
              >
                Account
              </h2>

              <p
                style={{
                  color:
                    "#627D98",
                  margin:
                    "0 0 20px 0",
                }}
              >
                Finished using House Connect?
                You can safely log out below.
              </p>

              <button
                onClick={
                  logout
                }
                disabled={
                  loggingOut
                }
                style={{
                  width:
                    "100%",
                  padding:
                    "15px",
                  background:
                    loggingOut
                      ? "#94A3B8"
                      : "#B42318",
                  color:
                    "white",
                  border:
                    "none",
                  borderRadius:
                    "9px",
                  cursor:
                    loggingOut
                      ? "not-allowed"
                      : "pointer",
                  fontWeight:
                    "bold",
                  fontSize:
                    "15px",
                }}
              >
                {loggingOut
                  ? "LOGGING OUT..."
                  : "LOG OUT OF HOUSE CONNECT"}
              </button>
            </section>
          </>
        ) : (
          /* LOGIN / REGISTER */

          <section
            style={{
              background:
                "white",
              padding:
                "30px",
              borderRadius:
                "15px",
              border:
                "1px solid #D7E0EA",
              maxWidth:
                "550px",
              margin:
                "10px auto 40px",
            }}
          >
            <div
              style={{
                textAlign:
                  "center",
                marginBottom:
                  "25px",
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

              <h1
                style={{
                  color:
                    "#0B3B75",
                  marginBottom:
                    "8px",
                }}
              >
                Tenant Account
              </h1>

              <p
                style={{
                  color:
                    "#627D98",
                  margin:
                    0,
                  lineHeight:
                    "1.5",
                }}
              >
                {mode ===
                "login"
                  ? "Log in to find verified properties and manage your viewing requests."
                  : "Create your House Connect tenant account and start finding a home."}
              </p>
            </div>

            {mode ===
              "register" && (
              <>
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
                  Full Name
                </label>

                <input
                  value={
                    fullName
                  }
                  onChange={(e) =>
                    setFullName(
                      e.target
                        .value
                    )
                  }
                  placeholder="Your full name"
                  autoComplete="name"
                  style={{
                    width:
                      "100%",
                    padding:
                      "13px",
                    marginBottom:
                      "18px",
                    boxSizing:
                      "border-box",
                    border:
                      "1px solid #CBD5E1",
                    borderRadius:
                      "8px",
                    fontSize:
                      "15px",
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
                  Phone Number
                </label>

                <input
                  value={
                    phone
                  }
                  onChange={(e) =>
                    setPhone(
                      e.target.value.replace(
                        /\D/g,
                        ""
                      )
                    )
                  }
                  maxLength={
                    10
                  }
                  inputMode="numeric"
                  autoComplete="tel"
                  placeholder="07XXXXXXXX"
                  style={{
                    width:
                      "100%",
                    padding:
                      "13px",
                    marginBottom:
                      "18px",
                    boxSizing:
                      "border-box",
                    border:
                      "1px solid #CBD5E1",
                    borderRadius:
                      "8px",
                    fontSize:
                      "15px",
                  }}
                />
              </>
            )}

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
              Email
            </label>

            <input
              type="email"
              value={
                email
              }
              onChange={(e) =>
                setEmail(
                  e.target.value
                )
              }
              placeholder="you@example.com"
              autoComplete="email"
              style={{
                width:
                  "100%",
                padding:
                  "13px",
                marginBottom:
                  "18px",
                boxSizing:
                  "border-box",
                border:
                  "1px solid #CBD5E1",
                borderRadius:
                  "8px",
                fontSize:
                  "15px",
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
              Password
            </label>

            <div
              style={{
                position:
                  "relative",
                marginBottom:
                  "10px",
              }}
            >
              <input
                type={
                  showPassword
                    ? "text"
                    : "password"
                }
                value={
                  password
                }
                onChange={(e) =>
                  setPassword(
                    e.target
                      .value
                  )
                }
                placeholder="At least 6 characters"
                autoComplete={
                  mode ===
                  "login"
                    ? "current-password"
                    : "new-password"
                }
                style={{
                  width:
                    "100%",
                  padding:
                    "13px 80px 13px 13px",
                  boxSizing:
                    "border-box",
                  border:
                    "1px solid #CBD5E1",
                  borderRadius:
                    "8px",
                  fontSize:
                    "15px",
                }}
              />

              <button
                type="button"
                onClick={() =>
                  setShowPassword(
                    (current) =>
                      !current
                  )
                }
                style={{
                  position:
                    "absolute",
                  right:
                    "8px",
                  top:
                    "50%",
                  transform:
                    "translateY(-50%)",
                  background:
                    "none",
                  border:
                    "none",
                  color:
                    "#0B3B75",
                  cursor:
                    "pointer",
                  fontWeight:
                    "bold",
                }}
              >
                {showPassword
                  ? "HIDE"
                  : "SHOW"}
              </button>
            </div>

            {mode ===
              "login" && (
              <div
                style={{
                  textAlign:
                    "right",
                  marginBottom:
                    "20px",
                }}
              >
                <button
                  type="button"
                  onClick={
                    forgotPassword
                  }
                  disabled={
                    loading
                  }
                  style={{
                    background:
                      "none",
                    border:
                      "none",
                    color:
                      "#0B3B75",
                    cursor:
                      loading
                        ? "not-allowed"
                        : "pointer",
                    fontWeight:
                      "bold",
                    padding:
                      0,
                  }}
                >
                  Forgot password?
                </button>
              </div>
            )}

            {mode ===
            "login" ? (
              <button
                onClick={
                  login
                }
                disabled={
                  loading
                }
                style={{
                  width:
                    "100%",
                  padding:
                    "15px",
                  background:
                    loading
                      ? "#94A3B8"
                      : "#0B3B75",
                  color:
                    "white",
                  border:
                    "none",
                  borderRadius:
                    "9px",
                  fontWeight:
                    "bold",
                  cursor:
                    loading
                      ? "not-allowed"
                      : "pointer",
                  fontSize:
                    "15px",
                }}
              >
                {loading
                  ? "LOGGING IN..."
                  : "LOG IN"}
              </button>
            ) : (
              <button
                onClick={
                  register
                }
                disabled={
                  loading
                }
                style={{
                  width:
                    "100%",
                  padding:
                    "15px",
                  background:
                    loading
                      ? "#94A3B8"
                      : "#0B3B75",
                  color:
                    "white",
                  border:
                    "none",
                  borderRadius:
                    "9px",
                  fontWeight:
                    "bold",
                  cursor:
                    loading
                      ? "not-allowed"
                      : "pointer",
                  fontSize:
                    "15px",
                }}
              >
                {loading
                  ? "CREATING ACCOUNT..."
                  : "CREATE TENANT ACCOUNT"}
              </button>
            )}

            <div
              style={{
                textAlign:
                  "center",
                marginTop:
                  "20px",
                paddingTop:
                  "20px",
                borderTop:
                  "1px solid #E1E8F0",
              }}
            >
              {mode ===
              "login" ? (
                <>
                  <span
                    style={{
                      color:
                        "#627D98",
                    }}
                  >
                    Don&apos;t have an
                    account?{" "}
                  </span>

                  <button
                    onClick={() => {
                      setMode(
                        "register"
                      );
                      setError("");
                      setMessage("");
                      setPassword(
                        ""
                      );
                    }}
                    style={{
                      background:
                        "none",
                      border:
                        "none",
                      color:
                        "#0B3B75",
                      cursor:
                        "pointer",
                      fontWeight:
                        "bold",
                    }}
                  >
                    Register
                  </button>
                </>
              ) : (
                <>
                  <span
                    style={{
                      color:
                        "#627D98",
                    }}
                  >
                    Already have an
                    account?{" "}
                  </span>

                  <button
                    onClick={() => {
                      setMode(
                        "login"
                      );
                      setError("");
                      setMessage("");
                      setPassword(
                        ""
                      );
                    }}
                    style={{
                      background:
                        "none",
                      border:
                        "none",
                      color:
                        "#0B3B75",
                      cursor:
                        "pointer",
                      fontWeight:
                        "bold",
                    }}
                  >
                    Log in
                  </button>
                </>
              )}
            </div>
          </section>
        )}
      </div>

      {/* FOOTER */}

      <footer
        style={{
          background:
            "#0B3B75",
          color:
            "white",
          marginTop:
            "30px",
          padding:
            "35px 20px",
        }}
      >
        <div
          style={{
            maxWidth:
              "1100px",
            margin:
              "auto",
            textAlign:
              "center",
          }}
        >
          <strong
            style={{
              fontSize:
                "18px",
            }}
          >
            🏠 HOUSE CONNECT
          </strong>

          <p
            style={{
              margin:
                "8px 0",
              opacity:
                0.85,
              fontSize:
                "14px",
            }}
          >
            FIND • CONNECT • LIVE
          </p>

          {userId && (
            <button
              onClick={
                logout
              }
              disabled={
                loggingOut
              }
              style={{
                marginTop:
                  "18px",
                padding:
                  "12px 24px",
                background:
                  loggingOut
                    ? "#64748B"
                    : "#B42318",
                color:
                  "white",
                border:
                  "none",
                borderRadius:
                  "8px",
                cursor:
                  loggingOut
                    ? "not-allowed"
                    : "pointer",
                fontWeight:
                  "bold",
              }}
            >
              {loggingOut
                ? "LOGGING OUT..."
                : "LOG OUT"}
            </button>
          )}

          <p
            style={{
              margin:
                "22px 0 0",
              opacity:
                0.7,
              fontSize:
                "12px",
            }}
          >
            ©{" "}
            {new Date().getFullYear()}{" "}
            HOUSE CONNECT
          </p>
        </div>
      </footer>

      {/* ===================================================
          PROPERTY DETAILS MODAL
      =================================================== */}

      {selectedProperty && (
        <div
          onClick={
            closeProperty
          }
          style={{
            position:
              "fixed",
            inset:
              0,
            background:
              "rgba(0,0,0,0.65)",
            zIndex:
              100,
            padding:
              "20px",
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
              maxWidth:
                "850px",
              margin:
                "20px auto",
              borderRadius:
                "15px",
              overflow:
                "hidden",
            }}
          >
            {/* IMAGE */}

            <div
              style={{
                position:
                  "relative",
                background:
                  "#E8EEF5",
                minHeight:
                  "320px",
              }}
            >
              {selectedProperty
                .images
                .length >
              0 ? (
                <>
                  <img
                    src={getImageUrl(
                      selectedProperty
                        .images[
                        selectedImageIndex
                      ]
                        ?.storage_path
                    )}
                    alt={
                      selectedProperty.title
                    }
                    style={{
                      width:
                        "100%",
                      height:
                        "400px",
                      objectFit:
                        "cover",
                      display:
                        "block",
                    }}
                  />

                  {selectedProperty
                    .images
                    .length >
                    1 && (
                    <>
                      <button
                        onClick={() =>
                          setSelectedImageIndex(
                            (
                              current
                            ) =>
                              current ===
                              0
                                ? selectedProperty
                                    .images
                                    .length -
                                  1
                                : current -
                                  1
                          )
                        }
                        style={{
                          position:
                            "absolute",
                          left:
                            "15px",
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
                          cursor:
                            "pointer",
                          fontSize:
                            "22px",
                        }}
                      >
                        ‹
                      </button>

                      <button
                        onClick={() =>
                          setSelectedImageIndex(
                            (
                              current
                            ) =>
                              current ===
                              selectedProperty
                                .images
                                .length -
                                1
                                ? 0
                                : current +
                                  1
                          )
                        }
                        style={{
                          position:
                            "absolute",
                          right:
                            "15px",
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
                          cursor:
                            "pointer",
                          fontSize:
                            "22px",
                        }}
                      >
                        ›
                      </button>
                    </>
                  )}

                  <span
                    style={{
                      position:
                        "absolute",
                      bottom:
                        "12px",
                      right:
                        "12px",
                      background:
                        "rgba(0,0,0,0.65)",
                      color:
                        "white",
                      padding:
                        "6px 10px",
                      borderRadius:
                        "20px",
                      fontSize:
                        "13px",
                    }}
                  >
                    {selectedImageIndex +
                      1}{" "}
                    /{" "}
                    {
                      selectedProperty
                        .images
                        .length
                    }
                  </span>
                </>
              ) : (
                <div
                  style={{
                    height:
                      "320px",
                    display:
                      "flex",
                    alignItems:
                      "center",
                    justifyContent:
                      "center",
                    fontSize:
                      "70px",
                  }}
                >
                  🏠
                </div>
              )}

              <button
                onClick={
                  closeProperty
                }
                style={{
                  position:
                    "absolute",
                  top:
                    "12px",
                  right:
                    "12px",
                  width:
                    "40px",
                  height:
                    "40px",
                  borderRadius:
                    "50%",
                  border:
                    "none",
                  background:
                    "rgba(0,0,0,0.7)",
                  color:
                    "white",
                  cursor:
                    "pointer",
                  fontSize:
                    "22px",
                }}
              >
                ×
              </button>
            </div>

            {/* THUMBNAILS */}

            {selectedProperty
              .images
              .length >
              1 && (
              <div
                style={{
                  display:
                    "flex",
                  gap:
                    "8px",
                  padding:
                    "12px",
                  overflowX:
                    "auto",
                }}
              >
                {selectedProperty.images.map(
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
                        width:
                          "70px",
                        height:
                          "55px",
                        padding:
                          0,
                        border:
                          index ===
                          selectedImageIndex
                            ? "3px solid #0B3B75"
                            : "2px solid #CBD5E1",
                        borderRadius:
                          "6px",
                        overflow:
                          "hidden",
                        cursor:
                          "pointer",
                        flexShrink:
                          0,
                      }}
                    >
                      <img
                        src={getImageUrl(
                          image.storage_path
                        )}
                        alt=""
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

            {/* PROPERTY INFORMATION */}

            <div
              style={{
                padding:
                  "25px",
              }}
            >
              <div
                style={{
                  display:
                    "flex",
                  justifyContent:
                    "space-between",
                  gap:
                    "15px",
                  flexWrap:
                    "wrap",
                }}
              >
                <div>
                  <h2
                    style={{
                      color:
                        "#0B3B75",
                      margin:
                        "0 0 8px 0",
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

                <div
                  style={{
                    background:
                      "#D1FAE5",
                    color:
                      "#065F46",
                    padding:
                      "8px 12px",
                    borderRadius:
                      "20px",
                    fontWeight:
                      "bold",
                    height:
                      "fit-content",
                  }}
                >
                  ✓ VERIFIED
                </div>
              </div>

              <h3
                style={{
                  color:
                    "#26734D",
                  margin:
                    "20px 0 10px",
                }}
              >
                UGX{" "}
                {formatRent(
                  selectedProperty.monthly_rent
                )}{" "}
                / month
              </h3>

              <div
                style={{
                  display:
                    "flex",
                  gap:
                    "10px",
                  flexWrap:
                    "wrap",
                  marginBottom:
                    "20px",
                }}
              >
                <span
                  style={{
                    background:
                      "#F0F4F8",
                    padding:
                      "8px 11px",
                    borderRadius:
                      "7px",
                  }}
                >
                  🏠{" "}
                  {
                    selectedProperty.property_type
                  }
                </span>

                {selectedProperty.bedrooms !==
                  null && (
                  <span
                    style={{
                      background:
                        "#F0F4F8",
                      padding:
                        "8px 11px",
                      borderRadius:
                        "7px",
                    }}
                  >
                    🛏️{" "}
                    {
                      selectedProperty.bedrooms
                    }{" "}
                    bedrooms
                  </span>
                )}
              </div>

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
                  whiteSpace:
                    "pre-wrap",
                  lineHeight:
                    "1.7",
                  color:
                    "#334E68",
                }}
              >
                {
                  selectedProperty.description
                }
              </p>

              {/* ACTION BUTTONS */}

              <div
                style={{
                  display:
                    "flex",
                  gap:
                    "10px",
                  marginTop:
                    "25px",
                  flexWrap:
                    "wrap",
                }}
              >
                <button
                  onClick={() =>
                    openRequestModal(
                      selectedProperty
                    )
                  }
                  disabled={Boolean(
                    requests.find(
                      (request) =>
                        request.property_id ===
                        selectedProperty.id &&
                        (
                          request.status ===
                            "Pending" ||
                          request.status ===
                            "Accepted"
                        )
                    )
                  )}
                  style={{
                    flex:
                      "1 1 220px",
                    padding:
                      "14px",
                    background:
                      requests.some(
                        (request) =>
                          request.property_id ===
                            selectedProperty.id &&
                          (
                            request.status ===
                              "Pending" ||
                            request.status ===
                              "Accepted"
                          )
                      )
                        ? "#94A3B8"
                        : "#26734D",
                    color:
                      "white",
                    border:
                      "none",
                    borderRadius:
                      "9px",
                    fontWeight:
                      "bold",
                    cursor:
                      requests.some(
                        (request) =>
                          request.property_id ===
                            selectedProperty.id &&
                          (
                            request.status ===
                              "Pending" ||
                            request.status ===
                              "Accepted"
                          )
                      )
                        ? "not-allowed"
                        : "pointer",
                  }}
                >
                  {requests.some(
                    (request) =>
                      request.property_id ===
                        selectedProperty.id &&
                      request.status ===
                        "Accepted"
                  )
                    ? "✓ VIEWING ACCEPTED"
                    : requests.some(
                        (request) =>
                          request.property_id ===
                            selectedProperty.id &&
                          request.status ===
                            "Pending"
                      )
                    ? "⏳ VIEWING REQUESTED"
                    : "REQUEST A VIEWING"}
                </button>

                {/* REPORT PROPERTY BUTTON */}

                <button
                  onClick={() =>
                    openReportModal(
                      selectedProperty
                    )
                  }
                  style={{
                    flex:
                      "1 1 180px",
                    padding:
                      "14px",
                    background:
                      "#FFF1F2",
                    color:
                      "#B42318",
                    border:
                      "1px solid #FDA4AF",
                    borderRadius:
                      "9px",
                    fontWeight:
                      "bold",
                    cursor:
                      "pointer",
                  }}
                >
                  ⚠ REPORT PROPERTY
                </button>

                <button
                  onClick={
                    closeProperty
                  }
                  style={{
                    flex:
                      "1 1 120px",
                    padding:
                      "14px",
                    background:
                      "#E8EEF5",
                    color:
                      "#0B3B75",
                    border:
                      "none",
                    borderRadius:
                      "9px",
                    fontWeight:
                      "bold",
                    cursor:
                      "pointer",
                  }}
                >
                  CLOSE
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ===================================================
          VIEWING REQUEST MODAL
      =================================================== */}

      {requestProperty && (
        <div
          onClick={() => {
            if (
              !submittingRequest
            ) {
              setRequestProperty(
                null
              );
            }
          }}
          style={{
            position:
              "fixed",
            inset:
              0,
            background:
              "rgba(0,0,0,0.65)",
            zIndex:
              150,
            display:
              "flex",
            alignItems:
              "center",
            justifyContent:
              "center",
            padding:
              "20px",
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
                "550px",
              borderRadius:
                "15px",
              padding:
                "25px",
              boxSizing:
                "border-box",
            }}
          >
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
              <div>
                <h2
                  style={{
                    color:
                      "#0B3B75",
                    margin:
                      "0 0 7px",
                  }}
                >
                  Request a Viewing
                </h2>

                <p
                  style={{
                    color:
                      "#627D98",
                    margin:
                      0,
                  }}
                >
                  {
                    requestProperty.title
                  }
                </p>
              </div>

              <button
                onClick={() => {
                  if (
                    !submittingRequest
                  ) {
                    setRequestProperty(
                      null
                    );
                  }
                }}
                style={{
                  width:
                    "35px",
                  height:
                    "35px",
                  borderRadius:
                    "50%",
                  border:
                    "none",
                  background:
                    "#E8EEF5",
                  color:
                    "#0B3B75",
                  cursor:
                    "pointer",
                  fontSize:
                    "20px",
                }}
              >
                ×
              </button>
            </div>

            <div
              style={{
                background:
                  "#F7F9FC",
                padding:
                  "15px",
                borderRadius:
                  "9px",
                margin:
                  "20px 0",
              }}
            >
              <p
                style={{
                  margin:
                    "0 0 5px",
                  fontWeight:
                    "bold",
                }}
              >
                📍{" "}
                {
                  requestProperty.location
                }
              </p>

              <p
                style={{
                  margin:
                    0,
                  color:
                    "#26734D",
                  fontWeight:
                    "bold",
                }}
              >
                UGX{" "}
                {formatRent(
                  requestProperty.monthly_rent
                )}{" "}
                / month
              </p>
            </div>

            <label
              style={{
                display:
                  "block",
                fontWeight:
                  "bold",
                marginBottom:
                  "8px",
              }}
            >
              Message to landlord
            </label>

            <textarea
              value={
                requestMessage
              }
              onChange={(e) =>
                setRequestMessage(
                  e.target.value
                )
              }
              rows={6}
              placeholder="Tell the landlord why you would like to view the property."
              disabled={
                submittingRequest
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
                resize:
                  "vertical",
                fontFamily:
                  "Arial, sans-serif",
                fontSize:
                  "15px",
              }}
            />

            <p
              style={{
                color:
                  "#627D98",
                fontSize:
                  "13px",
                lineHeight:
                  "1.5",
              }}
            >
              Your phone number and landlord
              contact details are protected.
              The landlord will receive your
              viewing request and you will only
              receive their contact information
              after they accept the request.
            </p>

            <div
              style={{
                display:
                  "flex",
                gap:
                  "10px",
                marginTop:
                  "20px",
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
                  flex:
                    1,
                  padding:
                    "14px",
                  background:
                    submittingRequest
                      ? "#94A3B8"
                      : "#26734D",
                  color:
                    "white",
                  border:
                    "none",
                  borderRadius:
                    "9px",
                  fontWeight:
                    "bold",
                  cursor:
                    submittingRequest
                      ? "not-allowed"
                      : "pointer",
                }}
              >
                {submittingRequest
                  ? "SENDING..."
                  : "SEND VIEWING REQUEST"}
              </button>

              <button
                onClick={() => {
                  if (
                    !submittingRequest
                  ) {
                    setRequestProperty(
                      null
                    );
                  }
                }}
                disabled={
                  submittingRequest
                }
                style={{
                  padding:
                    "14px 18px",
                  background:
                    "#E8EEF5",
                  color:
                    "#0B3B75",
                  border:
                    "none",
                  borderRadius:
                    "9px",
                  fontWeight:
                    "bold",
                  cursor:
                    submittingRequest
                      ? "not-allowed"
                      : "pointer",
                }}
              >
                CANCEL
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===================================================
          REPORT PROPERTY MODAL
      =================================================== */}

      {reportProperty && (
        <div
          onClick={() => {
            if (!submittingReport) {
              closeReportModal();
            }
          }}
          style={{
            position:
              "fixed",
            inset:
              0,
            background:
              "rgba(0,0,0,0.65)",
            zIndex:
              200,
            display:
              "flex",
            alignItems:
              "center",
            justifyContent:
              "center",
            padding:
              "20px",
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
                "560px",
              borderRadius:
                "15px",
              padding:
                "25px",
              boxSizing:
                "border-box",
              boxShadow:
                "0 15px 40px rgba(0,0,0,0.25)",
            }}
          >
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
                marginBottom:
                  "20px",
              }}
            >
              <div>
                <h2
                  style={{
                    color:
                      "#B42318",
                    margin:
                      "0 0 7px",
                  }}
                >
                  ⚠ Report Property
                </h2>

                <p
                  style={{
                    color:
                      "#627D98",
                    margin:
                      0,
                  }}
                >
                  Help House Connect keep the
                  marketplace safe.
                </p>
              </div>

              <button
                onClick={
                  closeReportModal
                }
                disabled={
                  submittingReport
                }
                style={{
                  width:
                    "35px",
                  height:
                    "35px",
                  borderRadius:
                    "50%",
                  border:
                    "none",
                  background:
                    "#E8EEF5",
                  color:
                    "#0B3B75",
                  cursor:
                    submittingReport
                      ? "not-allowed"
                      : "pointer",
                  fontSize:
                    "20px",
                }}
              >
                ×
              </button>
            </div>

            <div
              style={{
                background:
                  "#F7F9FC",
                border:
                  "1px solid #E1E8F0",
                borderRadius:
                  "9px",
                padding:
                  "14px",
                marginBottom:
                  "20px",
              }}
            >
              <strong
                style={{
                  color:
                    "#0B3B75",
                }}
              >
                {reportProperty.title}
              </strong>

              <p
                style={{
                  margin:
                    "5px 0 0",
                  color:
                    "#627D98",
                }}
              >
                📍{" "}
                {reportProperty.location}
              </p>
            </div>

            <label
              style={{
                display:
                  "block",
                fontWeight:
                  "bold",
                marginBottom:
                  "8px",
              }}
            >
              Why are you reporting this property?
            </label>

            <select
              value={
                reportReason
              }
              onChange={(e) =>
                setReportReason(
                  e.target.value
                )
              }
              disabled={
                submittingReport
              }
              style={{
                width:
                  "100%",
                padding:
                  "13px",
                border:
                  "1px solid #CBD5E1",
                borderRadius:
                  "8px",
                boxSizing:
                  "border-box",
                background:
                  "white",
                fontSize:
                  "15px",
                marginBottom:
                  "20px",
              }}
            >
              <option value="">
                Select a reason
              </option>

              <option value="Fake or misleading listing">
                Fake or misleading listing
              </option>

              <option value="Wrong property information">
                Wrong property information
              </option>

              <option value="Suspicious or fraudulent behavior">
                Suspicious or fraudulent behavior
              </option>

              <option value="Property is unavailable">
                Property is unavailable
              </option>

              <option value="Other">
                Other
              </option>
            </select>

            <label
              style={{
                display:
                  "block",
                fontWeight:
                  "bold",
                marginBottom:
                  "8px",
              }}
            >
              Explain the problem
            </label>

            <textarea
              value={
                reportDetails
              }
              onChange={(e) =>
                setReportDetails(
                  e.target.value
                )
              }
              disabled={
                submittingReport
              }
              rows={6}
              placeholder="Tell us what is wrong with this property listing..."
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
                fontFamily:
                  "Arial, sans-serif",
                fontSize:
                  "15px",
                marginBottom:
                  "8px",
              }}
            />

            <p
              style={{
                color:
                  "#627D98",
                fontSize:
                  "13px",
                lineHeight:
                  "1.5",
                marginTop:
                  "5px",
              }}
            >
              Please only report a property when
              you have a genuine concern. Your
              report will be reviewed by House
              Connect administrators.
            </p>

            <div
              style={{
                display:
                  "flex",
                gap:
                  "10px",
                marginTop:
                  "20px",
              }}
            >
              <button
                onClick={
                  submitPropertyReport
                }
                disabled={
                  submittingReport
                }
                style={{
                  flex:
                    1,
                  padding:
                    "14px",
                  background:
                    submittingReport
                      ? "#94A3B8"
                      : "#B42318",
                  color:
                    "white",
                  border:
                    "none",
                  borderRadius:
                    "9px",
                  fontWeight:
                    "bold",
                  cursor:
                    submittingReport
                      ? "not-allowed"
                      : "pointer",
                }}
              >
                {submittingReport
                  ? "SUBMITTING..."
                  : "SUBMIT REPORT"}
              </button>

              <button
                onClick={
                  closeReportModal
                }
                disabled={
                  submittingReport
                }
                style={{
                  padding:
                    "14px 18px",
                  background:
                    "#E8EEF5",
                  color:
                    "#0B3B75",
                  border:
                    "none",
                  borderRadius:
                    "9px",
                  fontWeight:
                    "bold",
                  cursor:
                    submittingReport
                      ? "not-allowed"
                      : "pointer",
                }}
              >
                CANCEL
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}