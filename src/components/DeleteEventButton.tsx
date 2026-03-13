"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function DeleteEventButton({ eventId }: { eventId: number }) {
  const [pending, setPending] = useState(false);
  const router = useRouter();

  async function handleDelete() {
    if (!confirm("Delete this event?")) return;
    setPending(true);
    const base = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
    await fetch(`${base}/api/events/${eventId}`, { method: "DELETE" });
    router.refresh();
  }

  return (
    <button
      className="btn-del"
      onClick={handleDelete}
      disabled={pending}
      title="Delete event"
    >
      {pending ? "..." : "×"}
    </button>
  );
}
