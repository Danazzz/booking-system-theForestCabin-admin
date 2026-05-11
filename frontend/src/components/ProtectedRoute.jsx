import { Navigate, useLocation } from "react-router-dom";
import { getToken } from "../hooks/useAuth";
import { clearAdminSession, isAdminSessionExpired } from "../utils/adminSession";

function ProtectedRoute({ children }) {
  const location = useLocation();

  if (isAdminSessionExpired()) {
    clearAdminSession();
    return (
      <Navigate
        to="/login"
        replace
        state={{ from: location, sessionExpired: true }}
      />
    );
  }

  if (!getToken()) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  return children;
}

export default ProtectedRoute;
