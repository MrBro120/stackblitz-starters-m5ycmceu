"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import {
  isSoundOn,
  playBeep,
  setSoundOn,
  timeAgo,
  whatsappNumber,
} from "@/lib/alerts";

const NAVY = "#0B3B75";
const GOLD = "#F5B83D";

type RequestRow = {
  id: string;
  property_id: string;
  tenant_id: string;
  message: string | null;
  status: string | null;
  created_at: string;
  followed_up_at: string | null;
};

type PropertyRow = {
  id: string;
  title: string | null;
  location: string | null;
  type: string | null;
  rent: number | string | null;
  bedrooms: number | string | null;
  landlord_id: string | null;
};

type ProfileRow = {
  id: string;
  full_name: string | null;
  phone: string | null;
};

type Card = RequestRow & {
  property?: PropertyRow;
  tenant?: ProfileRow;
  landlord?: ProfileRow;
};

const pill = (bg: string, color: string): React.CSSProperties => ({
  background: bg,
  color,
  borderRadius: 999,
  padding: "4px 10px",
  fontSize: 12,
  fontWeight: 800,
});

const actionBtn = (bg: string, color: string): React.CSSProperties => ({
  background: bg,
  color,
  border: "none",
  borderRadius: 8,
  padding: "10px 14px",
  fontWeight: 700,
  fontSize: 14,
  textDecoration: "none",
  cursor: "pointer",
  display: "inline-block",
});

export default function ViewingRequestsPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [adminId, setAdminId] = useState("");
  const [adminName, setAdminName] = useState("");
  const [cards, setCards] = useState<Card[]>([]);
  const [search, setSearch] = useState("");
  const [sound, setSound] = useState(true);
  const [busyId, setBusyId] = useState("");
  const previousNew = useRef<number | null>(null);
  const allowed = useRef(false);

  useEffect(() => {
    setSound(isSoundOn());
  }, []);

  const loadRequests = useCallback(async () => {
    const { data: reqs, error: reqError } = await supabase
      .from("viewing_requests")
      .select(
        "id, property_id, tenant_id, message, status, created_at, followed_up_at"
      )
      .order("created_at", { ascending: false })
      .limit(200);

    if (reqError) {
      const text = reqError.message || "";
      if (text.includes("followed_up_at")) {
        setError(
          "The database needs one small update first. Open Supabase → SQL Editor and run the SQL-1 file, then refresh this page."
        );
      } else {
        setError("Could not load viewing requests: " + text);
      }
      return;
    }

    const requests = (reqs || []) as RequestRow[];

    const propertyIds = Array.from(
      new Set(requests.map((r) => r.property_id).filter(Boolean))
    );
    const propertyMap = new Map<string, PropertyRow>();
    if (propertyIds.length > 0) {
      const { data: props } = await supabase
        .from("properties")
        .select("id, title, location, type, rent, bedrooms, landlord_id")
        .in("id", propertyIds);
      ((props || []) as PropertyRow[]).forEach((p) =>
        propertyMap.set(p.id, p)
      );
    }

    const profileIds = new Set<string>();
    requests.forEach((r) => r.tenant_id && profileIds.add(r.tenant_id));
    propertyMap.forEach(
      (p) => p.landlord_id && profileIds.add(p.landlord_id)
    );

    const profileMap = new Map<string, ProfileRow>();
    if (profileIds.size > 0) {
      const { data: profs } = await supabase
        .from("profiles")
        .select("id, full_name, phone")
        .in("id", Array.from(profileIds));
      ((profs || []) as ProfileRow[]).forEach((p) =>
        profileMap.set(p.id, p)
      );
    }

    const built: Card[] = requests.map((r) => {
      const property = propertyMap.get(r.property_id);
      return {
        ...r,
        property,
        tenant: profileMap.get(r.tenant_id),
        landlord: property?.landlord_id
          ? profileMap.get(property.landlord_id)
          : undefined,
      };
    });

    const newCount = built.filter((c) => !c.followed_up_at).length;
    if (
      previousNew.current !== null &&
      newCount > previousNew.current &&
      isSoundOn()
    ) {
      playBeep();
    }
    previousNew.current = newCount;

    setError("");
    setCards(built);
  }, []);

  // Check admin, then load.
  useEffect(() => {
    let cancelled = false;

    async function start() {
      setLoading(true);
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setError("You must be logged in as an administrator.");
        setLoading(false);
        return;
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("id, full_name, role")
        .eq("id", user.id)
        .maybeSingle();

      if (!profile || profile.role !== "admin") {
        setError(
          "Access denied. This page is only available to administrators."
        );
        setLoading(false);
        return;
      }

      if (cancelled) return;
      allowed.current = true;
      setAdminId(user.id);
      setAdminName(profile.full_name || "Administrator");
      await loadRequests();
      if (!cancelled) setLoading(false);
    }

    start();

    const timer = setInterval(() => {
      if (allowed.current) loadRequests();
    }, 30000);
    const onFocus = () => {
      if (allowed.current) loadRequests();
    };
    window.addEventListener("focus", onFocus);

    return () => {
      cancelled = true;
      clearInterval(timer);
      window.removeEventListener("focus", onFocus);
    };
  }, [loadRequests]);

  const newCount = cards.filter((c) => !c.followed_up_at).length;

  // Show the number in the browser tab, e.g. "(3) Viewing Requests".
  useEffect(() => {
    document.title =
      newCount > 0
        ? `(${newCount}) Viewing Requests – House Connect`
        : "Viewing Requests – House Connect";
  }, [newCount]);

  async function setFollowedUp(id: string, done: boolean) {
    setBusyId(id);
    const { error: updError } = await supabase
      .from("viewing_requests")
      .update({
        followed_up_at: done ? new Date().toISOString() : null,
        followed_up_by: done ? adminId : null,
      })
      .eq("id", id);

    if (updError) {
      setError("Could not update: " + updError.message);
    } else {
      await loadRequests();
    }
    setBusyId("");
  }

  function toggleSound() {
    const next = !sound;
    setSound(next);
    setSoundOn(next);
    if (next) playBeep();
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return cards;
    return cards.filter((c) =>
      [
        c.property?.title,
        c.property?.location,
        c.tenant?.full_name,
        c.tenant?.phone,
        c.landlord?.full_name,
        c.message,
      ]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q))
    );
  }, [cards, search]);

  const pending = filtered.filter((c) => !c.followed_up_at);
  const done = filtered.filter((c) => !!c.followed_up_at);

  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);

  const followedToday = cards.filter(
    (c) =>
      c.followed_up_at && new Date(c.followed_up_at) >= startOfToday
  ).length;
  const thisMonth = cards.filter(
    (c) => new Date(c.created_at) >= monthStart
  ).length;
  const accepted = cards.filter(
    (c) => (c.status || "").toLowerCase() === "accepted"
  ).length;

  function renderCard(c: Card) {
    const isNew = !c.followed_up_at;
    const tenantPhone = c.tenant?.phone || "";
    const wa = whatsappNumber(tenantPhone);
    const text = encodeURIComponent(
      `Hello ${c.tenant?.full_name || ""}, this is House Connect. ` +
        `We received your viewing request for "${
          c.property?.title || "the property"
        }"${
          c.property?.location ? " in " + c.property.location : ""
        }. How can we help you arrange the viewing?`
    );

    return (
      <div
        key={c.id}
        style={{
          background: "white",
          borderRadius: 14,
          padding: 18,
          boxShadow: "0 2px 10px rgba(0,0,0,0.07)",
          borderLeft: `6px solid ${isNew ? "#E5484D" : "#16A34A"}`,
          marginBottom: 14,
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            gap: 10,
            flexWrap: "wrap",
            alignItems: "center",
          }}
        >
          <strong style={{ fontSize: 18, color: NAVY }}>
            {c.property?.title || "Property no longer available"}
          </strong>
          {isNew ? (
            <span style={pill("#FDE8E8", "#B42318")}>NEW</span>
          ) : (
            <span style={pill("#DCFCE7", "#166534")}>FOLLOWED UP</span>
          )}
        </div>

        <div style={{ color: "#52606D", marginTop: 6, lineHeight: 1.6 }}>
          {[c.property?.location, c.property?.type]
            .filter(Boolean)
            .join(" • ")}
          {c.property?.rent
            ? ` • UGX ${Number(c.property.rent).toLocaleString()}`
            : ""}
          {c.property?.bedrooms ? ` • ${c.property.bedrooms} bed` : ""}
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            gap: 12,
            marginTop: 14,
          }}
        >
          <div
            style={{ background: "#F0F4F8", borderRadius: 10, padding: 12 }}
          >
            <div style={{ fontSize: 12, color: "#627D98", fontWeight: 700 }}>
              TENANT
            </div>
            <div style={{ fontWeight: 700 }}>
              {c.tenant?.full_name || "Unknown"}
            </div>
            <div>{tenantPhone || "No phone"}</div>
          </div>

          <div
            style={{ background: "#F0F4F8", borderRadius: 10, padding: 12 }}
          >
            <div style={{ fontSize: 12, color: "#627D98", fontWeight: 700 }}>
              LANDLORD
            </div>
            <div style={{ fontWeight: 700 }}>
              {c.landlord?.full_name || "Unknown"}
            </div>
            <div>{c.landlord?.phone || "No phone"}</div>
          </div>
        </div>

        {c.message && (
          <p
            style={{
              background: "#FFF6E0",
              borderRadius: 10,
              padding: 12,
              margin: "14px 0 0",
              lineHeight: 1.5,
            }}
          >
            “{c.message}”
          </p>
        )}

        <div style={{ color: "#627D98", fontSize: 13, marginTop: 12 }}>
          Requested {timeAgo(c.created_at)}
          {c.status ? ` • Landlord status: ${c.status}` : ""}
          {c.followed_up_at
            ? ` • Followed up ${timeAgo(c.followed_up_at)}`
            : ""}
        </div>

        <div
          style={{
            display: "flex",
            gap: 10,
            flexWrap: "wrap",
            marginTop: 14,
          }}
        >
          {wa && (
            <a
              href={`https://wa.me/${wa}?text=${text}`}
              target="_blank"
              rel="noreferrer"
              style={actionBtn("#25D366", "white")}
            >
              WhatsApp tenant
            </a>
          )}
          {tenantPhone && (
            <a
              href={`tel:${tenantPhone}`}
              style={actionBtn(NAVY, "white")}
            >
              Call tenant
            </a>
          )}
          {isNew ? (
            <button
              type="button"
              disabled={busyId === c.id}
              onClick={() => setFollowedUp(c.id, true)}
              style={actionBtn(GOLD, NAVY)}
            >
              {busyId === c.id ? "Saving..." : "Mark followed up"}
            </button>
          ) : (
            <button
              type="button"
              disabled={busyId === c.id}
              onClick={() => setFollowedUp(c.id, false)}
              style={actionBtn("#E4E7EB", "#323F4B")}
            >
              Undo
            </button>
          )}
        </div>
      </div>
    );
  }

  const stat = (label: string, value: number, color: string) => (
    <div
      style={{
        background: "white",
        borderRadius: 12,
        padding: 16,
        boxShadow: "0 2px 10px rgba(0,0,0,0.06)",
      }}
    >
      <div style={{ fontSize: 28, fontWeight: 800, color }}>{value}</div>
      <div style={{ fontSize: 13, color: "#627D98", fontWeight: 700 }}>
        {label}
      </div>
    </div>
  );

  return (
    <main style={{ minHeight: "100vh", background: "#F0F4F8" }}>
      <header style={{ background: NAVY, color: "white", padding: 22 }}>
        <div
          style={{
            maxWidth: 1000,
            margin: "auto",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: 12,
          }}
        >
          <div>
            <div style={{ fontWeight: 800, fontSize: 22 }}>
              🔔 Viewing Requests
            </div>
            <div style={{ opacity: 0.8, fontSize: 13 }}>
              ADMIN • {adminName}
            </div>
          </div>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button
              type="button"
              onClick={toggleSound}
              style={{
                background: "transparent",
                color: "white",
                border: "1px solid rgba(255,255,255,0.4)",
                borderRadius: 8,
                padding: "9px 14px",
                cursor: "pointer",
                fontWeight: 700,
              }}
            >
              {sound ? "🔊 Sound on" : "🔇 Sound off"}
            </button>
            <Link
              href="/ceo"
              style={{
                background: "white",
                color: NAVY,
                borderRadius: 8,
                padding: "9px 14px",
                textDecoration: "none",
                fontWeight: 700,
              }}
            >
              Dashboard
            </Link>
          </div>
        </div>
      </header>

      <div style={{ maxWidth: 1000, margin: "auto", padding: "24px 16px 60px" }}>
        {loading && <p>Loading viewing requests...</p>}

        {error && (
          <p
            role="alert"
            style={{
              background: "#FDE8E8",
              color: "#B42318",
              padding: 14,
              borderRadius: 10,
              lineHeight: 1.5,
            }}
          >
            {error}
          </p>
        )}

        {!loading && allowed.current && (
          <>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
                gap: 12,
                marginBottom: 18,
              }}
            >
              {stat("New (to follow up)", newCount, "#E5484D")}
              {stat("Followed up today", followedToday, "#16A34A")}
              {stat("Requests this month", thisMonth, NAVY)}
              {stat("Accepted by landlords", accepted, "#B7791F")}
            </div>

            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by property, tenant, landlord, phone..."
              style={{
                width: "100%",
                boxSizing: "border-box",
                padding: 13,
                borderRadius: 10,
                border: "1px solid #CBD2D9",
                fontSize: 15,
                marginBottom: 20,
              }}
            />

            <h2 style={{ color: NAVY }}>
              New requests ({pending.length})
            </h2>
            {pending.length === 0 && (
              <p style={{ color: "#627D98" }}>
                Nothing waiting. New requests appear here automatically.
              </p>
            )}
            {pending.map(renderCard)}

            <h2 style={{ color: NAVY, marginTop: 30 }}>
              Followed up ({done.length})
            </h2>
            {done.length === 0 && (
              <p style={{ color: "#627D98" }}>No followed-up requests yet.</p>
            )}
            {done.map(renderCard)}
          </>
        )}
      </div>
    </main>
  );
}
