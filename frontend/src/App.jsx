import { Navigate, Route, Routes } from "react-router-dom";
import AdminLayout from "./layouts/AdminLayout";
import ProtectedRoute from "./components/ProtectedRoute";
import BookingDetail from "./pages/BookingDetail";
import Bookings from "./pages/Bookings";
import Dashboard from "./pages/Dashboard";
import Login from "./pages/Login";
import Gallery from "./pages/Gallery";
import Promos from "./pages/Promos";
import ReservationCalendar from "./pages/ReservationCalendar";
import Rooms from "./pages/Rooms";
import WaitingApproval from "./pages/WaitingApproval";

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
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="dashboard" element={<Dashboard />} />
        <Route path="bookings" element={<Bookings />} />
        <Route path="bookings/:id" element={<BookingDetail />} />
        <Route path="waiting-approval" element={<WaitingApproval />} />
        <Route path="calendar" element={<ReservationCalendar />} />
        <Route path="rooms" element={<Rooms />} />
        <Route path="promos" element={<Promos />} />
        <Route path="gallery" element={<Gallery />} />
      </Route>
      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}

export default App;
