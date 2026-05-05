import { useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";

const navItems = [
  { to: "/dashboard", label: "Dashboard" },
  { to: "/bookings", label: "Bookings" },
  { to: "/waiting-approval", label: "Waiting Approval" },
  { to: "/calendar", label: "Calendar" },
  { to: "/rooms", label: "Rooms" },
  { to: "/payments", label: "Payments" },
  { to: "/invoice-settings", label: "Invoice Settings" },
  { to: "/promos", label: "Promos" },
  { to: "/gallery", label: "Gallery" }
];

function AdminLayout() {
  const navigate = useNavigate();
  const { logout } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate("/login", { replace: true });
  };

  const navContent = (
    <>
      <div className="border-b border-gray-200 px-6 py-5">
        <p className="text-lg font-semibold">Forest Cabin</p>
        <p className="text-sm text-gray-500">Admin</p>
      </div>
      <nav className="space-y-1 p-4">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            onClick={() => setMenuOpen(false)}
            className={({ isActive }) =>
              [
                "flex min-h-11 items-center justify-between rounded-md px-3 py-2 text-sm font-medium",
                isActive
                  ? "bg-gray-900 text-white"
                  : "text-gray-700 hover:bg-gray-100"
              ].join(" ")
            }
          >
            <span>{item.label}</span>
          </NavLink>
        ))}
      </nav>
      <div className="mt-auto border-t border-gray-200 p-4">
        <button
          type="button"
          onClick={handleLogout}
          className="min-h-11 w-full rounded-md border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          Logout
        </button>
      </div>
    </>
  );

  return (
    <div className="min-h-screen bg-gray-100 text-gray-900">
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-gray-200 bg-white px-4 py-3 md:hidden">
        <div>
          <p className="font-semibold">Forest Cabin</p>
          <p className="text-xs text-gray-500">Admin</p>
        </div>
        <button
          type="button"
          onClick={() => setMenuOpen((current) => !current)}
          className="min-h-11 rounded-md border border-gray-300 px-4 text-sm font-medium"
        >
          Menu
        </button>
      </header>

      {menuOpen ? (
        <button
          type="button"
          aria-label="Close menu"
          className="fixed inset-0 z-40 bg-black/30 md:hidden"
          onClick={() => setMenuOpen(false)}
        />
      ) : null}

      <aside className="fixed inset-y-0 left-0 z-50 hidden w-64 flex-col border-r border-gray-200 bg-white md:flex">
        {navContent}
      </aside>
      <aside
        className={[
          "fixed inset-y-0 left-0 z-50 flex w-72 max-w-[85vw] flex-col border-r border-gray-200 bg-white transition-transform md:hidden",
          menuOpen ? "translate-x-0" : "-translate-x-full"
        ].join(" ")}
      >
        {navContent}
      </aside>
      <main className="min-h-screen p-4 md:ml-64 md:p-6">
        <Outlet />
      </main>
    </div>
  );
}

export default AdminLayout;
