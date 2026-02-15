import styles from "./Header.module.css";

export default function Header() {
  return (
    <div className={styles.wrapper}>
      <div className={styles.glow} />
      <div className={styles.row}>
        <div className={styles.logoBox}>🅿️</div>
        <div>
          <h1 className={styles.appName}>ParkSmart</h1>
          <p className={styles.subtitle}>SINGAPORE PARKING OPTIMIZER</p>
        </div>
      </div>
    </div>
  );
}
