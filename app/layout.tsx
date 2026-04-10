import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Rainmaker Analytics",
  description: "Internal analytics dashboard for Rainmaker chatbot and operational data."
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
