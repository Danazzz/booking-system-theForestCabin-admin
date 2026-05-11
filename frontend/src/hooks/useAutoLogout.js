import { useEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  clearAdminSession,
  getAdminToken,
  getAdminIdleTimeoutMs,
  isAdminSessionExpired,
  markAdminSessionActive
} from "../utils/adminSession";

const CHECK_INTERVAL_MS = 30 * 1000;
const ACTIVITY_EVENTS = ["mousedown", "keydown", "touchstart", "scroll", "focus"];

export function useAutoLogout() {
  const navigate = useNavigate();
  const location = useLocation();
  const loggedOutRef = useRef(false);

  useEffect(() => {
    if (location.pathname === "/login") {
      return undefined;
    }

    if (!getAdminToken()) {
      return undefined;
    }

    loggedOutRef.current = false;

    const expireSession = () => {
      if (loggedOutRef.current) {
        return;
      }

      loggedOutRef.current = true;
      clearAdminSession();
      navigate("/login", {
        replace: true,
        state: { sessionExpired: true }
      });
    };

    const checkSession = () => {
      if (!getAdminToken()) {
        return;
      }

      if (isAdminSessionExpired()) {
        expireSession();
      }
    };

    checkSession();

    if (!loggedOutRef.current) {
      markAdminSessionActive();
    }

    const handleActivity = () => {
      if (document.hidden || !getAdminToken()) {
        return;
      }

      markAdminSessionActive();
    };

    const handleVisibilityChange = () => {
      if (document.hidden) {
        markAdminSessionActive();
        return;
      }

      checkSession();

      if (!loggedOutRef.current) {
        markAdminSessionActive();
      }
    };

    ACTIVITY_EVENTS.forEach((eventName) => {
      window.addEventListener(eventName, handleActivity, { passive: true });
    });
    document.addEventListener("visibilitychange", handleVisibilityChange);

    const intervalId = window.setInterval(checkSession, CHECK_INTERVAL_MS);
    const timeoutId = window.setTimeout(checkSession, getAdminIdleTimeoutMs());

    return () => {
      ACTIVITY_EVENTS.forEach((eventName) => {
        window.removeEventListener(eventName, handleActivity);
      });
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.clearInterval(intervalId);
      window.clearTimeout(timeoutId);
    };
  }, [location.pathname, navigate]);
}
