const TOKEN_KEY = "adminToken";
const USER_KEY = "adminUser";

export const getToken = () => {
  return localStorage.getItem(TOKEN_KEY);
};

export const getAdminUser = () => {
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

export function useAuth() {
  const login = (token, user = null) => {
    localStorage.setItem(TOKEN_KEY, token);

    if (user) {
      localStorage.setItem(USER_KEY, JSON.stringify(user));
    }
  };

  const logout = () => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  };

  return {
    token: getToken(),
    user: getAdminUser(),
    isAuthenticated: Boolean(getToken()),
    login,
    logout
  };
}
