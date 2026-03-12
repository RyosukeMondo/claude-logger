"use client";

import { useRouter, useSearchParams } from "next/navigation";

export default function UserFilter({ users }: { users: string[] }) {
  const router = useRouter();
  const params = useSearchParams();
  const current = params.get("user");

  if (users.length <= 1) return null;

  function select(user: string | null) {
    const url = user ? `/?user=${encodeURIComponent(user)}` : "/";
    router.push(url);
  }

  return (
    <div className="panel">
      <div className="panel-header">USER</div>
      <div className="panel-body" style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button
          className={`btn ${!current ? "active" : ""}`}
          onClick={() => select(null)}
          style={!current ? { background: "var(--green)", color: "var(--bg)" } : {}}
        >
          [ALL]
        </button>
        {users.map((u) => (
          <button
            key={u}
            className={`btn ${current === u ? "active" : ""}`}
            onClick={() => select(u)}
            style={current === u ? { background: "var(--cyan)", color: "var(--bg)" } : {}}
          >
            [{u}]
          </button>
        ))}
      </div>
    </div>
  );
}
