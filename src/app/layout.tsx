import type { Metadata } from "next";
import AsciiLogo from "@/components/AsciiLogo";
import Nav from "@/components/Nav";
import "./globals.css";

export const metadata: Metadata = {
  title: "Claude Logger",
  description: "Claude Code hook event receiver and visualizer",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <div className="container">
          <AsciiLogo />
          <Nav />
          {children}
        </div>
      </body>
    </html>
  );
}
