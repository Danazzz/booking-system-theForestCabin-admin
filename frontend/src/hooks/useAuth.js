const TOKEN_KEY = "adminToken";

export const getToken = () => {
  return localStorage.getItem(TOKEN_KEY);
};

export function useAuth() {
  const login = (token) => {
    localStorage.setItem(TOKEN_KEY, token);
  };

  const logout = () => {
    localStorage.removeItem(TOKEN_KEY);
  };

  return {
    token: getToken(),
    isAuthenticated: Boolean(getToken()),
    login,
    logout
  };
}
