"use client";

import { useEffect, useState } from "react";

export default function HookUrl() {
  const [url, setUrl] = useState("");

  useEffect(() => {
    const base = window.location.origin;
    const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";
    setUrl(`${base}${basePath}/api/hooks`);
  }, []);

  return <span style={{ color: "var(--cyan)" }}>{url}</span>;
}
