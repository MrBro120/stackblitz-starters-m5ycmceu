import Link from "next/link";
import type { ReactNode } from "react";

// ✏️ EDIT THIS: put your real support email / phone here.
export const SUPPORT_EMAIL = "";
export const SUPPORT_PHONE = "";

export const LAST_UPDATED = "31 October 2026";

export default function LegalPage({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <main style={{ minHeight: "100vh", background: "#F0F4F8" }}>
      <header style={{ background: "#0B3B75", color: "white", padding: "16px 20px" }}>
        <div
          style={{
            maxWidth: 900,
            margin: "auto",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: 10,
          }}
        >
          <Link
            href="/"
            style={{
              color: "white",
              textDecoration: "none",
              fontWeight: 800,
              display: "inline-flex",
              alignItems: "center",
              gap: 10,
            }}
          >
            <img src="/logo-icon.svg" alt="" width={34} height={34} />
            HOUSE CONNECT
          </Link>
          <Link href="/" style={{ color: "white" }}>
            ← Back to home
          </Link>
        </div>
      </header>

      <article
        style={{
          maxWidth: 900,
          margin: "30px auto",
          background: "white",
          borderRadius: 14,
          padding: "30px 24px",
          lineHeight: 1.75,
          color: "#243B53",
        }}
      >
        <h1 style={{ color: "#0B3B75", marginTop: 0 }}>{title}</h1>
        <p style={{ color: "#627D98" }}>Last updated: {LAST_UPDATED}</p>
        {children}

        <h2>Contact us</h2>
        <p>
          Questions about this page? Contact House Connect
          {SUPPORT_EMAIL ? ` at ${SUPPORT_EMAIL}` : ""}
          {SUPPORT_PHONE ? ` or ${SUPPORT_PHONE}` : ""}
          {!SUPPORT_EMAIL && !SUPPORT_PHONE
            ? " through the website at www.houseconnect.site"
            : ""}
          .
        </p>
      </article>

      <footer style={{ textAlign: "center", padding: "10px 20px 40px", color: "#627D98" }}>
        <Link href="/terms">Terms of Service</Link> •{" "}
        <Link href="/privacy">Privacy Policy</Link> • © {new Date().getFullYear()} House Connect
      </footer>
    </main>
  );
}
