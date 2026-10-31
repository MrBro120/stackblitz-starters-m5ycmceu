"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { isSoundOn, playBeep } from "@/lib/alerts";

// Bell with a red count of viewing requests the admin has not followed up yet.
export default function AdminRequestsLink() {
  const [count, setCount] = useState(0);
  const previous = useRef<number | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const { count: c, error } = await supabase
        .from("viewing_requests")
        .select("id", { count: "exact", head: true })
        .is("followed_up_at", null);

      if (cancelled || error || c === null) return;

      if (previous.current !== null && c > previous.current && isSoundOn()) {
        playBeep();
      }
      previous.current = c;
      setCount(c);
    }

    load();
    const timer = setInterval(load, 30000);
    const onFocus = () => load();
    window.addEventListener("focus", onFocus);

    return () => {
      cancelled = true;
      clearInterval(timer);
      window.removeEventListener("focus", onFocus);
    };
  }, []);

  return (
    <Link
      href="/ceo/requests"
      title="Viewing requests"
      style={{
        position: "relative",
        color: "white",
        textDecoration: "none",
        padding: "9px 14px",
        border: "1px solid rgba(255,255,255,0.4)",
        borderRadius: 8,
        fontSize: 14,
        fontWeight: 700,
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
      }}
    >
      🔔 Viewing Requests
      {count > 0 && (
        <span
          style={{
            background: "#E5484D",
            color: "white",
            borderRadius: 999,
            minWidth: 22,
            height: 22,
            padding: "0 6px",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 12,
            fontWeight: 800,
          }}
        >
          {count > 99 ? "99+" : count}
        </span>
      )}
    </Link>
  );
}
