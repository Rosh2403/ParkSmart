"use client";
import { Component } from "react";
import styles from "./ErrorBoundary.module.css";

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, message: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, message: error?.message || "Something went wrong" };
  }

  componentDidCatch(error, info) {
    console.error("ParkSmart error boundary caught:", error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className={styles.container}>
          <div className={styles.icon}>⚠️</div>
          <p className={styles.title}>Something went wrong</p>
          <p className={styles.message}>{this.state.message}</p>
          <button
            onClick={() => this.setState({ hasError: false, message: null })}
            className={styles.retryBtn}
          >
            Try again
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
