"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "../../lib/supabase";

type Property = {
  id: string;
  title: string;
  location: string;
  property_type: string;
  monthly_rent: number;
};

function ReportPageContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const propertyId = searchParams.get("property");

  const [property, setProperty] = useState<Property | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [reason, setReason] = useState("");
  const [message, setMessage] = useState("");

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    loadReportPage();
  }, [propertyId]);

  async function loadReportPage() {
    setLoading(true);
    setError("");
    setSuccess("");

    try {
      if (!propertyId) {
        setError("No property was selected for reporting.");
        setLoading(false);
        return;
      }

      // Check logged-in user
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setError("Please log in as a tenant before reporting a property.");
        setLoading(false);
        return;
      }

      // Check user's role
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .maybeSingle();

      if (profileError) {
        throw profileError;
      }

      if (!profile || profile.role !== "tenant") {
        setError("Only tenant accounts can report properties.");
        setLoading(false);
        return;
      }

      // Load the property
      const { data: propertyData, error: propertyError } = await supabase
        .from("properties")
        .select(
          "id, title, location, property_type, monthly_rent"
        )
        .eq("id", propertyId)
        .eq("status", "Approved")
        .maybeSingle();

      if (propertyError) {
        throw propertyError;
      }

      if (!propertyData) {
        setError(
          "This property could not be found or is no longer available."
        );
        setLoading(false);
        return;
      }

      setProperty(propertyData);
    } catch (err: any) {
      console.error("Report page error:", err);

      setError(
        err?.message ||
          "Something went wrong while loading the report page."
      );
    } finally {
      setLoading(false);
    }
  }

  async function submitReport(e: React.FormEvent) {
    e.preventDefault();

    setError("");
    setSuccess("");

    if (!propertyId) {
      setError("No property was selected.");
      return;
    }

    if (!reason) {
      setError("Please select a reason for reporting this property.");
      return;
    }

    if (message.trim().length > 1000) {
      setError("Your message cannot exceed 1000 characters.");
      return;
    }

    setSubmitting(true);

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setError("Your session has expired. Please log in again.");
        setSubmitting(false);
        return;
      }

      const { error: insertError } = await supabase
        .from("property_reports")
        .insert({
          property_id: propertyId,
          reporter_id: user.id,
          reason: reason,
          message: message.trim() || null,
          status: "Pending",
        });

      if (insertError) {
        throw insertError;
      }

      // Success appears BELOW the button
      setSuccess(
        "Your report has been submitted successfully. Thank you for helping us keep House Connect safe."
      );

      // Clear the form
      setReason("");
      setMessage("");
    } catch (err: any) {
      console.error("Submit report error:", err);

      setError(
        err?.message ||
          "We could not submit your report. Please try again."
      );
    } finally {
      setSubmitting(false);
    }
  }

  const formatRent = (rent: number) => {
    return new Intl.NumberFormat("en-UG").format(rent);
  };

  if (loading) {
    return (
      <div
        style={{
          minHeight: "100vh",
          background: "#F7F9FC",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "20px",
          fontFamily: "Arial, sans-serif",
          color: "#0B3B75",
        }}
      >
        <div
          style={{
            background: "white",
            padding: "35px",
            borderRadius: "14px",
            boxShadow: "0 4px 20px rgba(0,0,0,0.08)",
            textAlign: "center",
            width: "100%",
            maxWidth: "500px",
          }}
        >
          <div
            style={{
              fontSize: "18px",
              fontWeight: "bold",
              marginBottom: "8px",
            }}
          >
            HOUSE CONNECT
          </div>

          <div style={{ color: "#666" }}>
            Loading report page...
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#F7F9FC",
        fontFamily: "Arial, sans-serif",
        color: "#222",
      }}
    >
      {/* HEADER */}
      <header
        style={{
          background: "#0B3B75",
          color: "white",
          padding: "18px 20px",
          boxShadow: "0 2px 8px rgba(0,0,0,0.12)",
        }}
      >
        <div
          style={{
            maxWidth: "1100px",
            margin: "0 auto",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: "15px",
            flexWrap: "wrap",
          }}
        >
          <Link
            href="/"
            style={{
              color: "white",
              textDecoration: "none",
              fontWeight: "bold",
              fontSize: "21px",
              letterSpacing: "0.5px",
            }}
          >
            HOUSE CONNECT
          </Link>

          <Link
            href="/"
            style={{
              color: "white",
              textDecoration: "none",
              fontSize: "14px",
              fontWeight: "bold",
            }}
          >
            BACK TO LISTINGS
          </Link>
        </div>
      </header>

      {/* MAIN */}
      <main
        style={{
          maxWidth: "720px",
          margin: "0 auto",
          padding: "35px 20px 60px",
        }}
      >
        {/* PAGE TITLE */}
        <div style={{ marginBottom: "25px" }}>
          <div
            style={{
              color: "#B42318",
              fontSize: "13px",
              fontWeight: "bold",
              letterSpacing: "0.8px",
              marginBottom: "7px",
            }}
          >
            PROPERTY SAFETY
          </div>

          <h1
            style={{
              margin: "0 0 8px",
              color: "#0B3B75",
              fontSize: "30px",
            }}
          >
            Report This Property
          </h1>

          <p
            style={{
              margin: 0,
              color: "#666",
              lineHeight: "1.6",
            }}
          >
            Help us keep House Connect safe by reporting suspicious,
            misleading, or problematic property listings.
          </p>
        </div>

        {/* PROPERTY CARD */}
        {property && (
          <div
            style={{
              background: "white",
              borderRadius: "12px",
              padding: "20px",
              marginBottom: "22px",
              border: "1px solid #E3E8EF",
              boxShadow: "0 3px 12px rgba(0,0,0,0.05)",
            }}
          >
            <div
              style={{
                color: "#0B3B75",
                fontWeight: "bold",
                fontSize: "20px",
                marginBottom: "14px",
              }}
            >
              {property.title}
            </div>

            <div
              style={{
                display: "grid",
                gap: "8px",
                color: "#555",
                fontSize: "14px",
              }}
            >
              <div>
                <strong>Location:</strong> {property.location}
              </div>

              <div>
                <strong>Property Type:</strong>{" "}
                {property.property_type}
              </div>

              <div>
                <strong>Monthly Rent:</strong> UGX{" "}
                {formatRent(property.monthly_rent)}
              </div>
            </div>
          </div>
        )}

        {/* ERROR */}
        {error && (
          <div
            style={{
              background: "#FFF1F0",
              border: "1px solid #F0A7A0",
              color: "#B42318",
              borderRadius: "9px",
              padding: "14px 16px",
              marginBottom: "18px",
              lineHeight: "1.5",
            }}
          >
            <strong>Notice:</strong> {error}

            {!property && (
              <div style={{ marginTop: "12px" }}>
                <Link
                  href="/tenant"
                  style={{
                    color: "#B42318",
                    fontWeight: "bold",
                    textDecoration: "underline",
                  }}
                >
                  GO TO TENANT LOGIN
                </Link>
              </div>
            )}
          </div>
        )}

        {/* REPORT FORM */}
        {property && !success && (
          <form
            onSubmit={submitReport}
            style={{
              background: "white",
              borderRadius: "12px",
              padding: "25px",
              border: "1px solid #E3E8EF",
              boxShadow: "0 3px 12px rgba(0,0,0,0.05)",
            }}
          >
            {/* REASON */}
            <div style={{ marginBottom: "22px" }}>
              <label
                htmlFor="reason"
                style={{
                  display: "block",
                  fontWeight: "bold",
                  color: "#222",
                  marginBottom: "8px",
                }}
              >
                Why are you reporting this property?
              </label>

              <select
                id="reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                style={{
                  width: "100%",
                  padding: "13px 14px",
                  border: "1px solid #B8C2CC",
                  borderRadius: "8px",
                  background: "white",
                  color: reason ? "#222" : "#666",
                  fontSize: "16px",
                  outline: "none",
                }}
              >
                <option value="">
                  Select a reason
                </option>

                <option value="Property does not exist">
                  Property does not exist
                </option>

                <option value="Fake or incorrect information">
                  Fake or incorrect information
                </option>

                <option value="Landlord is suspicious">
                  Landlord is suspicious
                </option>

                <option value="Property already rented">
                  Property already rented
                </option>

                <option value="Other problem">
                  Other problem
                </option>
              </select>
            </div>

            {/* MESSAGE */}
            <div style={{ marginBottom: "22px" }}>
              <label
                htmlFor="message"
                style={{
                  display: "block",
                  fontWeight: "bold",
                  color: "#222",
                  marginBottom: "8px",
                }}
              >
                Additional information
                <span
                  style={{
                    fontWeight: "normal",
                    color: "#777",
                    marginLeft: "6px",
                  }}
                >
                  (Optional)
                </span>
              </label>

              <textarea
                id="message"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                maxLength={1000}
                placeholder="Tell us what you noticed about this property..."
                rows={7}
                style={{
                  width: "100%",
                  minHeight: "160px",
                  padding: "14px",
                  border: "1px solid #B8C2CC",
                  borderRadius: "8px",
                  backgroundColor: "#FFFFFF",
                  color: "#111111",
                  fontSize: "16px",
                  lineHeight: "1.55",
                  resize: "vertical",
                  outline: "none",
                  fontFamily: "Arial, sans-serif",
                  boxSizing: "border-box",
                }}
              />

              <div
                style={{
                  marginTop: "6px",
                  textAlign: "right",
                  color: "#777",
                  fontSize: "12px",
                }}
              >
                {message.length}/1000
              </div>
            </div>

            {/* PRIVACY NOTICE */}
            <div
              style={{
                background: "#F5F8FC",
                borderRadius: "8px",
                padding: "13px 14px",
                marginBottom: "20px",
                color: "#555",
                fontSize: "13px",
                lineHeight: "1.5",
              }}
            >
              Your report will be reviewed by the House Connect
              administration team. Reports are handled confidentially
              and are intended to help protect users from fraudulent
              or misleading listings.
            </div>

            {/* SUBMIT BUTTON */}
            <button
              type="submit"
              disabled={submitting}
              style={{
                width: "100%",
                padding: "14px",
                background: submitting ? "#8C9AA8" : "#B42318",
                color: "white",
                border: "none",
                borderRadius: "8px",
                fontWeight: "bold",
                fontSize: "15px",
                cursor: submitting ? "not-allowed" : "pointer",
                minHeight: "48px",
              }}
            >
              {submitting
                ? "SUBMITTING REPORT..."
                : "SUBMIT REPORT"}
            </button>

            {/* ERROR BELOW BUTTON */}
            {error && (
              <div
                style={{
                  marginTop: "14px",
                  background: "#FFF1F0",
                  border: "1px solid #F0A7A0",
                  color: "#B42318",
                  borderRadius: "8px",
                  padding: "13px 14px",
                  lineHeight: "1.5",
                }}
              >
                {error}
              </div>
            )}

            {/* SUCCESS BELOW BUTTON */}
            {success && (
              <div
                style={{
                  marginTop: "14px",
                  background: "#ECFDF3",
                  border: "1px solid #A7E3C0",
                  color: "#065F46",
                  borderRadius: "8px",
                  padding: "14px",
                  lineHeight: "1.55",
                }}
              >
                <strong>Report submitted successfully.</strong>
                <div style={{ marginTop: "5px" }}>
                  {success}
                </div>
              </div>
            )}
          </form>
        )}

        {/* SUCCESS ACTIONS */}
        {success && (
          <div
            style={{
              background: "white",
              borderRadius: "12px",
              padding: "25px",
              border: "1px solid #E3E8EF",
              boxShadow: "0 3px 12px rgba(0,0,0,0.05)",
            }}
          >
            <div
              style={{
                color: "#065F46",
                fontSize: "18px",
                fontWeight: "bold",
                marginBottom: "15px",
              }}
            >
              Thank you for helping House Connect.
            </div>

            <p
              style={{
                color: "#666",
                lineHeight: "1.6",
                marginTop: 0,
              }}
            >
              Our team will review the report and take appropriate
              action if necessary.
            </p>

            <div
              style={{
                display: "flex",
                gap: "10px",
                flexWrap: "wrap",
                marginTop: "20px",
              }}
            >
              <Link
                href="/"
                style={{
                  flex: "1 1 220px",
                  textAlign: "center",
                  padding: "13px",
                  background: "#0B3B75",
                  color: "white",
                  textDecoration: "none",
                  borderRadius: "8px",
                  fontWeight: "bold",
                  boxSizing: "border-box",
                }}
              >
                RETURN TO LISTINGS
              </Link>

              <Link
                href="/tenant"
                style={{
                  flex: "1 1 220px",
                  textAlign: "center",
                  padding: "13px",
                  background: "white",
                  color: "#0B3B75",
                  textDecoration: "none",
                  border: "1px solid #0B3B75",
                  borderRadius: "8px",
                  fontWeight: "bold",
                  boxSizing: "border-box",
                }}
              >
                TENANT ACCOUNT
              </Link>
            </div>
          </div>
        )}

        {/* BACK LINK */}
        <div
          style={{
            textAlign: "center",
            marginTop: "22px",
          }}
        >
          <Link
            href="/"
            style={{
              color: "#0B3B75",
              textDecoration: "none",
              fontWeight: "bold",
              fontSize: "14px",
            }}
          >
            ← BACK TO HOUSE CONNECT
          </Link>
        </div>
      </main>

      {/* FOOTER */}
      <footer
        style={{
          background: "#0B3B75",
          color: "white",
          textAlign: "center",
          padding: "22px 15px",
          fontSize: "13px",
          marginTop: "20px",
        }}
      >
        HOUSE CONNECT • FIND • CONNECT • LIVE
      </footer>
    </div>
  );
}

export default function ReportPage() {
  return (
    <Suspense
      fallback={
        <div
          style={{
            minHeight: "100vh",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "#F7F9FC",
            color: "#0B3B75",
            fontFamily: "Arial, sans-serif",
          }}
        >
          Loading...
        </div>
      }
    >
      <ReportPageContent />
    </Suspense>
  );
}