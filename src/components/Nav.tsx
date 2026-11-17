"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export default function Nav() {
  const path = usePathname();
  return (
    <nav>
      <Link href="/" className={path === "/" ? "active" : ""}>
        [DASHBOARD]
      </Link>
      <Link href="/analytics" className={path === "/analytics" ? "active" : ""}>
        [ANALYTICS]
      </Link>
      <Link href="/prompts" className={path === "/prompts" ? "active" : ""}>
        [PROMPTS]
      </Link>
      <Link href="/api/health">[HEALTH]</Link>
      <Link href="/api/views/dashboard">[API]</Link>
    </nav>
  );
}
