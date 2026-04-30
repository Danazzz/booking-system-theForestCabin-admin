function StatCard({ label, value }) {
  return (
    <div className="rounded-md border border-gray-200 bg-white p-4 shadow-sm">
      <p className="text-sm font-medium text-gray-500">{label}</p>
      <p className="mt-2 text-3xl font-semibold text-gray-900">{value ?? "-"}</p>
    </div>
  );
}

export default StatCard;
