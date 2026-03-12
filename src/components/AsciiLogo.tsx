const ART = ` ╔═╗╦  ╔═╗╦ ╦╔╦╗╔═╗  ╦  ╔═╗╔═╗╔═╗╔═╗╦═╗
 ║  ║  ╠═╣║ ║ ║║║╣   ║  ║ ║║ ╦║ ╦║╣ ╠╦╝
 ╚═╝╩═╝╩ ╩╚═╝═╩╝╚═╝  ╩═╝╚═╝╚═╝╚═╝╚═╝╩╚═`.replaceAll(" ", "\u00A0");

export default function AsciiLogo() {
  return (
    <div className="logo" aria-label="Claude Logger">
      <pre style={{ whiteSpace: "pre", fontFamily: "'DejaVu Sans Mono', 'Consolas', 'Courier New', monospace", margin: 0, textAlign: "left", display: "inline-block" }}>{ART}</pre>
      <div className="sub">HOOK EVENT RECEIVER</div>
    </div>
  );
}
