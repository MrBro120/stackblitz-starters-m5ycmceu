"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "../../lib/supabase";

export default function AuthPage() {
  const router = useRouter();

  const [mode, setMode] = useState<"register" | "login">(
    "register"
  );

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(
    event: React.FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    setMessage("");
    setError("");

    if (!email.trim() || !password) {
      setError("Please enter your email and password.");
      return;
    }

    if (mode === "register") {
      if (!name.trim()) {
        setError("Please enter your full name.");
        return;
      }

      if (!/^[0-9]{10}$/.test(phone)) {
        setError("Please enter a valid 10-digit phone number.");
        return;
      }

      if (password.length < 6) {
        setError("Your password must have at least 6 characters.");
        return;
      }
    }

    setLoading(true);

    try {
      if (mode === "register") {
        const { data, error: signUpError } =
          await supabase.auth.signUp({
            email: email.trim(),
            password,
            options: {
              data: {
                full_name: name.trim(),
                phone: phone,
                role: "landlord",
              },
            },
          });

        if (signUpError) {
          throw signUpError;
        }

        if (data.session) {
          setMessage("Account created successfully!");
          router.push("/landlord");
          router.refresh();
          return;
        }

        setMode("login");

        setMessage(
          "Account created! Check your email and confirm your account before logging in."
        );

        setPassword("");
      } else {
        const { data, error: loginError } =
          await supabase.auth.signInWithPassword({
            email: email.trim(),
            password,
          });

        if (loginError) {
          throw loginError;
        }

        if (!data.user) {
          throw new Error(
            "We could not identify your account. Please try again."
          );
        }

        const { data: profile, error: profileError } =
          await supabase
            .from("profiles")
            .select("role")
            .eq("id", data.user.id)
            .single();

        if (profileError) {
          await supabase.auth.signOut();

          throw new Error(
            "We couldn't verify your account role. Please try again."
          );
        }

        if (profile.role !== "landlord") {
          await supabase.auth.signOut();

          throw new Error(
            "This account is not registered as a landlord."
          );
        }

        setMessage(
          "Login successful! Opening your landlord page..."
        );

        router.push("/landlord");
        router.refresh();
        return;
      }
    } catch (err) {
      console.error("Landlord authentication error:", err);

      setError(
        err instanceof Error
          ? err.message
          : "Something went wrong. Please try again."
      );
    } finally {
      setLoading(false);
    }
  }

  const inputStyle: React.CSSProperties = {
    width: "100%",
    padding: "13px",
    marginTop: "7px",
    marginBottom: "18px",
    border: "1px solid #CBD5E1",
    borderRadius: "9px",
    fontSize: "15px",
    boxSizing: "border-box",
  };

  const labelStyle: React.CSSProperties = {
    display: "block",
    fontWeight: "bold",
    fontSize: "14px",
  };

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#F7F9FC",
        fontFamily: "Arial, sans-serif",
        color: "#102A43",
      }}
    >
      <header
        style={{
          background: "#0B3B75",
          color: "white",
          padding: "22px",
        }}
      >
        <div
          style={{
            maxWidth: "900px",
            margin: "auto",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: "15px",
            flexWrap: "wrap",
          }}
        >
          <strong style={{ fontSize: "22px" }}>
            🏠 HOUSE CONNECT
          </strong>

          <Link href="/" style={{ color: "white" }}>
            ← Home
          </Link>
        </div>
      </header>

      <section
        style={{
          maxWidth: "480px",
          margin: "45px auto",
          padding: "0 18px",
        }}
      >
        <div
          style={{
            background: "white",
            padding: "28px",
            borderRadius: "15px",
            border: "1px solid #D7E0EA",
          }}
        >
          <h1
            style={{
              color: "#0B3B75",
              textAlign: "center",
            }}
          >
            {mode === "register"
              ? "Create Landlord Account"
              : "Welcome Back"}
          </h1>

          <p
            style={{
              textAlign: "center",
              color: "#627D98",
              lineHeight: "1.6",
            }}
          >
            {mode === "register"
              ? "Register to list and manage your properties."
              : "Log in to continue to your landlord account."}
          </p>

          <form onSubmit={handleSubmit}>
            {mode === "register" && (
              <>
                <label style={labelStyle}>
                  Full Name
                  <input
                    style={inputStyle}
                    type="text"
                    value={name}
                    onChange={(e) =>
                      setName(e.target.value)
                    }
                    placeholder="Enter your full name"
                    autoComplete="name"
                    required
                  />
                </label>

                <label style={labelStyle}>
                  Phone Number
                  <input
                    style={inputStyle}
                    type="tel"
                    inputMode="numeric"
                    maxLength={10}
                    value={phone}
                    onChange={(e) =>
                      setPhone(
                        e.target.value.replace(/\D/g, "")
                      )
                    }
                    placeholder="07XXXXXXXX"
                    autoComplete="tel"
                    required
                  />
                </label>
              </>
            )}

            <label style={labelStyle}>
              Email Address
              <input
                style={inputStyle}
                type="email"
                value={email}
                onChange={(e) =>
                  setEmail(e.target.value)
                }
                placeholder="you@example.com"
                autoComplete="email"
                required
              />
            </label>

            <label style={labelStyle}>
              Password
              <input
                style={inputStyle}
                type="password"
                value={password}
                onChange={(e) =>
                  setPassword(e.target.value)
                }
                placeholder={
                  mode === "register"
                    ? "At least 6 characters"
                    : "Enter your password"
                }
                autoComplete={
                  mode === "register"
                    ? "new-password"
                    : "current-password"
                }
                minLength={
                  mode === "register" ? 6 : undefined
                }
                required
              />
            </label>

            {error && (
              <p
                role="alert"
                style={{
                  color: "#B42318",
                  background: "#FEE4E2",
                  padding: "12px",
                  borderRadius: "8px",
                  lineHeight: "1.5",
                }}
              >
                {error}
              </p>
            )}

            {message && (
              <p
                role="status"
                style={{
                  color: "#166534",
                  background: "#DCFCE7",
                  padding: "12px",
                  borderRadius: "8px",
                  lineHeight: "1.5",
                }}
              >
                {message}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              style={{
                width: "100%",
                padding: "15px",
                background: loading
                  ? "#627D98"
                  : "#0B3B75",
                color: "white",
                border: "none",
                borderRadius: "9px",
                fontSize: "15px",
                fontWeight: "bold",
                cursor: loading
                  ? "wait"
                  : "pointer",
              }}
            >
              {loading
                ? "PLEASE WAIT..."
                : mode === "register"
                ? "CREATE LANDLORD ACCOUNT"
                : "LOG IN"}
            </button>
          </form>

          <div
            style={{
              textAlign: "center",
              marginTop: "22px",
              lineHeight: "1.8",
            }}
          >
            {mode === "register" ? (
              <>
                Already have an account?{" "}
                <button
                  type="button"
                  onClick={() => {
                    setMode("login");
                    setError("");
                    setMessage("");
                  }}
                  style={{
                    border: "none",
                    background: "none",
                    color: "#0B3B75",
                    fontWeight: "bold",
                    cursor: "pointer",
                  }}
                >
                  Log in
                </button>
              </>
            ) : (
              <>
                Don&apos;t have an account?{" "}
                <button
                  type="button"
                  onClick={() => {
                    setMode("register");
                    setError("");
                    setMessage("");
                  }}
                  style={{
                    border: "none",
                    background: "none",
                    color: "#0B3B75",
                    fontWeight: "bold",
                    cursor: "pointer",
                  }}
                >
                  Register
                </button>
              </>
            )}
          </div>
        </div>
      </section>
    </main>
  );
}