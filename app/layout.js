import "./globals.css";
import Header from "@/components/Header";

export const metadata = {
  title: "ParkSmart — Singapore Parking Optimizer",
  description: "Find the most optimal parking spot near your destination in Singapore",
  // PWA / mobile web app meta
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "ParkSmart",
  },
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  // Match the app's dark background as the browser chrome colour on Android
  themeColor: "#6366F1",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <link
          rel="stylesheet"
          href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"
          integrity="sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY="
          crossOrigin=""
        />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,500;0,9..40,700;0,9..40,800;1,9..40,400&family=Space+Mono:wght@400;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        {/* Header is a Server Component — rendered once, not part of the client bundle */}
        <Header />
        {children}
      </body>
    </html>
  );
}
