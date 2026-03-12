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
      <Link href="/api/views/dashboard">[API]</Link>
    </nav>
  );
}
