import {
  clearAdminSession,
  getAdminToken,
  getStoredAdminUser,
  setAdminSession
} from "../utils/adminSession";

export const getToken = () => {
  return getAdminToken();
};

export const getAdminUser = () => {
  return getStoredAdminUser();
};

export function useAuth() {
  const login = (token, user = null) => {
    setAdminSession(token, user);
  };

  const logout = () => {
    clearAdminSession();
  };

  return {
    token: getToken(),
    user: getAdminUser(),
    isAuthenticated: Boolean(getToken()),
    login,
    logout
  };
}
