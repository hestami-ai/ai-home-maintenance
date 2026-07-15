import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://janumi.example"),
  title: {
    default: "Janumi — Professional capability, governed",
    template: "%s · Janumi",
  },
  description:
    "Janumi is infrastructure for governed, evidence-bearing professional work across humans, AI, organizations, and time.",
  applicationName: "Janumi",
  keywords: [
    "professional work",
    "assurance engineering",
    "human-agent systems",
    "professional capability",
    "governed AI",
  ],
  openGraph: {
    title: "Janumi — Infrastructure for humanity’s professional capability",
    description:
      "Governed, evidence-bearing work architectures for consequential human-agent execution.",
    type: "website",
    siteName: "Janumi",
    images: [{ url: "/og.png", width: 1731, height: 909, alt: "Janumi professional capability field rendered as a living topographic architecture" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Janumi — Professional capability, governed",
    description:
      "Infrastructure for humanity’s professional capability.",
    images: ["/og.png"],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#f0ecdf",
  colorScheme: "light",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
