import { useEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { getToken, useAuth } from "./useAuth";

const LAST_ACTIVE_KEY = "adminLastActiveAt";
const DEFAULT_TIMEOUT_MINUTES = 10;
const CHECK_INTERVAL_MS = 30 * 1000;
const ACTIVITY_EVENTS = ["mousedown", "keydown", "touchstart", "scroll", "focus"];

const getTimeoutMs = () => {
  const minutes = Number(import.meta.env.VITE_ADMIN_IDLE_TIMEOUT_MINUTES || DEFAULT_TIMEOUT_MINUTES);

  return Math.max(1, minutes) * 60 * 1000;
};

const getLastActiveAt = () => {
  const value = Number(localStorage.getItem(LAST_ACTIVE_KEY) || Date.now());

  return Number.isFinite(value) ? value : Date.now();
};

const markActive = () => {
  localStorage.setItem(LAST_ACTIVE_KEY, String(Date.now()));
};

export function useAutoLogout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { logout } = useAuth();
  const loggedOutRef = useRef(false);

  useEffect(() => {
    if (location.pathname === "/login") {
      return undefined;
    }

    if (!getToken()) {
      return undefined;
    }

    loggedOutRef.current = false;
    markActive();

    const expireSession = () => {
      if (loggedOutRef.current) {
        return;
      }

      loggedOutRef.current = true;
      logout();
      navigate("/login", {
        replace: true,
        state: { sessionExpired: true }
      });
    };

    const checkSession = () => {
      if (!getToken()) {
        return;
      }

      if (Date.now() - getLastActiveAt() >= getTimeoutMs()) {
        expireSession();
      }
    };

    const handleActivity = () => {
      if (document.hidden || !getToken()) {
        return;
      }

      markActive();
    };

    const handleVisibilityChange = () => {
      if (document.hidden) {
        markActive();
        return;
      }

      checkSession();

      if (!loggedOutRef.current) {
        markActive();
      }
    };

    ACTIVITY_EVENTS.forEach((eventName) => {
      window.addEventListener(eventName, handleActivity, { passive: true });
    });
    document.addEventListener("visibilitychange", handleVisibilityChange);

    const intervalId = window.setInterval(checkSession, CHECK_INTERVAL_MS);

    return () => {
      ACTIVITY_EVENTS.forEach((eventName) => {
        window.removeEventListener(eventName, handleActivity);
      });
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.clearInterval(intervalId);
    };
  }, [location.pathname, logout, navigate]);
}
