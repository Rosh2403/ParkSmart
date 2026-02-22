import "./globals.css";
import Header from "@/components/Header";
import BottomNav from "@/components/BottomNav";
import AuthProvider from "@/components/AuthProvider";

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
  themeColor: "#0E1014",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <meta name="mobile-web-app-capable" content="yes" />
        <link
          rel="stylesheet"
          href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"
          integrity="sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY="
          crossOrigin=""
        />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=Rajdhani:wght@400;600;700&family=IBM+Plex+Mono:wght@400;600&family=Outfit:wght@400;600&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        {/* AuthProvider: generates device ID + runs one-time localStorage migration */}
        <AuthProvider>
          {/* Header is a Server Component — rendered once, not part of the client bundle */}
          <Header />
          {children}
          {/* BottomNav is a Client Component (needs usePathname) rendered in the layout
              so it persists across tab navigations without unmounting */}
          <BottomNav />
        </AuthProvider>
      </body>
    </html>
  );
}
