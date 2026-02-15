"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import styles from "./BottomNav.module.css";

const TABS = [
  { href: "/",       icon: "🔍", label: "Find"    },
  { href: "/parked", icon: "🅿️", label: "Parked"  },
  { href: "/stats",  icon: "💰", label: "Tracker" },
];

export default function BottomNav() {
  const pathname = usePathname();
  const [isParked, setIsParked] = useState(false);

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

  return (
    <nav className={styles.nav} aria-label="Main navigation">
      <div className={styles.tabList}>
        {TABS.map((tab) => {
          const isActive = pathname === tab.href;
          const showDot = tab.href === "/parked" && isParked && !isActive;
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`${styles.tab} ${isActive ? styles.tabActive : ""}`}
              aria-current={isActive ? "page" : undefined}
            >
              <span className={styles.tabIconWrap}>
                <span className={styles.tabIcon}>{tab.icon}</span>
                {showDot && <span className={styles.parkedDot} aria-hidden="true" />}
              </span>
              <span className={styles.tabLabel}>{tab.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
