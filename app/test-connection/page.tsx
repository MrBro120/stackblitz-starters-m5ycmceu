"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";

export default function TestConnectionPage() {
  const [message, setMessage] = useState("Testing Supabase connection...");

  useEffect(() => {
    async function testConnection() {
      const { data, error } = await supabase
        .from("properties")
        .select("id")
        .limit(1);

      if (error) {
        setMessage("❌ Connection failed: " + error.message);
      } else {
        setMessage("✅ Supabase is connected successfully!");
      }
    }

    testConnection();
  }, []);

  return (
    <main
      style={{
        padding: "40px",
        fontFamily: "Arial, sans-serif",
      }}
    >
      <h1>House Connect - Supabase Test</h1>

      <p>{message}</p>
    </main>
  );
}