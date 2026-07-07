import type { Metadata, Viewport } from "next";
import "./globals.css";
import { AmtBriefProvider } from "@/components/AmtBriefProvider";
import { LanguageProvider } from "@/components/LanguageProvider";
import { NativeBridge } from "@/components/NativeBridge";

export const metadata: Metadata = {
  title: "AmtBrief AI",
  description:
    "A Deutschland App MiniApp that explains German official letters and turns them into clear next steps.",
  applicationName: "AmtBrief AI",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  minimumScale: 1,
  userScalable: false,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <LanguageProvider>
          <AmtBriefProvider>
            <NativeBridge />
            {children}
          </AmtBriefProvider>
        </LanguageProvider>
      </body>
    </html>
  );
}
