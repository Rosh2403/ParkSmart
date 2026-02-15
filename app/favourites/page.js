"use client";
import { useState, useEffect } from "react";
import { getFavourites, removeFavourite } from "@/lib/favouritesStorage";
import styles from "./favourites.module.css";

function AgencyChip({ agency }) {
  const color =
    agency === "URA" ? "var(--accent-light)"
    : agency === "LTA" ? "var(--yellow)"
    : "var(--text-secondary)";
  return (
    <span className={styles.agencyChip} style={{ color, borderColor: color }}>
      {agency}
    </span>
  );
}

export default function FavouritesPage() {
  const [favs, setFavs] = useState([]);

  useEffect(() => {
    const load = async () => setFavs(await getFavourites());
    load();
    window.addEventListener("favouritesChange", load);
    return () => window.removeEventListener("favouritesChange", load);
  }, []);

  const handleRemove = async (id) => {
    await removeFavourite(id);
    // state updates via favouritesChange event
  };

  const handleNavigate = (fav) => {
    window.open(
      `https://www.google.com/maps/dir/?api=1&destination=${fav.lat},${fav.lng}&travelmode=driving`,
      "_blank"
    );
  };

  const handleSearch = (fav) => {
    // Deep-link to the Find tab with this location pre-filled via query param
    window.location.href = `/?lat=${fav.lat}&lng=${fav.lng}&name=${encodeURIComponent(fav.name)}`;
  };

  // ── Empty state ──
  if (favs.length === 0) {
    return (
      <main className={styles.main}>
        <div className={styles.heroIcon}>⭐</div>
        <h2 className={styles.heroTitle}>No saved carparks</h2>
        <p className={styles.heroSub}>
          Star any carpark in search results to save it here for quick access.
        </p>
      </main>
    );
  }

  return (
    <main className={styles.main}>
      <div className={styles.header}>
        <h2 className={styles.title}>Saved Carparks</h2>
        <span className={styles.count}>{favs.length}</span>
      </div>

      <div className={styles.list}>
        {favs.map((fav) => (
          <div key={fav.id} className={styles.card}>
            <div className={styles.cardTop}>
              <div className={styles.cardInfo}>
                <AgencyChip agency={fav.agency} />
                {fav.isCentral && <span className={styles.centralChip}>Central</span>}
              </div>
              <button
                className={styles.removeBtn}
                onClick={() => handleRemove(fav.id)}
                aria-label={`Remove ${fav.name} from favourites`}
              >
                ✕
              </button>
            </div>
            <div className={styles.cardName}>{fav.name}</div>
            <div className={styles.cardId}>{fav.id}</div>

            <div className={styles.cardActions}>
              <button className={styles.actionBtn} onClick={() => handleSearch(fav)}>
                🔍 Find Parking Here
              </button>
              <button className={styles.actionBtnSecondary} onClick={() => handleNavigate(fav)}>
                🧭 Navigate
              </button>
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}
