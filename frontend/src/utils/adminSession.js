const TOKEN_KEY = "adminToken";
const USER_KEY = "adminUser";
const LAST_ACTIVE_KEY = "adminLastActiveAt";
const DEFAULT_TIMEOUT_MINUTES = 10;

export const getAdminToken = () => localStorage.getItem(TOKEN_KEY);

export const getStoredAdminUser = () => {
  const rawUser = localStorage.getItem(USER_KEY);

  if (!rawUser) {
    return null;
  }

  try {
    return JSON.parse(rawUser);
  } catch {
    localStorage.removeItem(USER_KEY);
    return null;
  }
};

export const getAdminIdleTimeoutMs = () => {
  const minutes = Number(
    import.meta.env.VITE_ADMIN_IDLE_TIMEOUT_MINUTES || DEFAULT_TIMEOUT_MINUTES
  );

  return Math.max(1, minutes) * 60 * 1000;
};

export const markAdminSessionActive = () => {
  localStorage.setItem(LAST_ACTIVE_KEY, String(Date.now()));
};

export const setAdminSession = (token, user = null) => {
  localStorage.setItem(TOKEN_KEY, token);

  if (user) {
    localStorage.setItem(USER_KEY, JSON.stringify(user));
  }

  markAdminSessionActive();
};

export const clearAdminSession = () => {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
  localStorage.removeItem(LAST_ACTIVE_KEY);
};

export const isAdminSessionExpired = () => {
  if (!getAdminToken()) {
    return false;
  }

  const lastActiveAt = Number(localStorage.getItem(LAST_ACTIVE_KEY));

  if (!Number.isFinite(lastActiveAt) || lastActiveAt <= 0) {
    markAdminSessionActive();
    return false;
  }

  return Date.now() - lastActiveAt >= getAdminIdleTimeoutMs();
};
