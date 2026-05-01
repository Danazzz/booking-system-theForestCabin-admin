import { Navigate, Route, Routes } from "react-router-dom";
import AdminLayout from "./layouts/AdminLayout";
import ProtectedRoute from "./components/ProtectedRoute";
import Alerts from "./pages/Alerts";
import Bookings from "./pages/Bookings";
import Channels from "./pages/Channels";
import Configs from "./pages/Configs";
import Dashboard from "./pages/Dashboard";
import Login from "./pages/Login";
import Promos from "./pages/Promos";
import Rooms from "./pages/Rooms";
import Sync from "./pages/Sync";

function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        element={
          <ProtectedRoute>
            <AdminLayout />
          </ProtectedRoute>
        }
      >
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/bookings" element={<Bookings />} />
        <Route path="/rooms" element={<Rooms />} />
        <Route path="/promos" element={<Promos />} />
        <Route path="/channels" element={<Channels />} />
        <Route path="/configs" element={<Configs />} />
        <Route path="/alerts" element={<Alerts />} />
        <Route path="/sync" element={<Sync />} />
      </Route>
      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}

export default App;
