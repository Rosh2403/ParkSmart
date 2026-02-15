"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import styles from "./BottomNav.module.css";

const TABS = [
  { href: "/",           icon: "🔍", label: "Find"    },
  { href: "/parked",     icon: "🅿️", label: "Parked"  },
  { href: "/stats",      icon: "💰", label: "Tracker" },
  { href: "/favourites", icon: "⭐", label: "Saved"   },
];

export default function BottomNav() {
  const pathname = usePathname();
  const [isParked, setIsParked] = useState(false);
  const [savedCount, setSavedCount] = useState(0);

  // Read parked state from localStorage; update when parkedSessionChange fires
  useEffect(() => {
    const check = () => {
      try {
        setIsParked(!!localStorage.getItem("parksmart_parked_session"));
      } catch {
        setIsParked(false);
      }
    };
    check();
    window.addEventListener("parkedSessionChange", check);
    return () => window.removeEventListener("parkedSessionChange", check);
  }, []);

  // Track number of saved carparks for the dot badge on the Saved tab
  useEffect(() => {
    const sync = async () => {
      try {
        const { getFavourites } = await import("@/lib/favouritesStorage");
        const favs = await getFavourites();
        setSavedCount(favs.length);
      } catch {
        setSavedCount(0);
      }
    };
    sync();
    window.addEventListener("favouritesChange", sync);
    return () => window.removeEventListener("favouritesChange", sync);
  }, []);

  return (
    <nav className={styles.nav} aria-label="Main navigation">
      <div className={styles.tabList}>
        {TABS.map((tab) => {
          const isActive = pathname === tab.href;
          const showParkedDot = tab.href === "/parked" && isParked && !isActive;
          const showSavedDot = tab.href === "/favourites" && savedCount > 0 && !isActive;
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`${styles.tab} ${isActive ? styles.tabActive : ""}`}
              aria-current={isActive ? "page" : undefined}
            >
              <span className={styles.tabIconWrap}>
                <span className={styles.tabIcon}>{tab.icon}</span>
                {showParkedDot && <span className={styles.parkedDot} aria-hidden="true" />}
                {showSavedDot && (
                  <span className={styles.savedCount} aria-hidden="true">
                    {savedCount > 9 ? "9+" : savedCount}
                  </span>
                )}
              </span>
              <span className={styles.tabLabel}>{tab.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
