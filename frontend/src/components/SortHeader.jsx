function SortHeader({ label, sortKey, sortConfig, onSort, className = "px-4 py-3" }) {
  const isActive = sortConfig?.key === sortKey;
  const indicator = isActive ? (sortConfig.direction === "asc" ? "Asc" : "Desc") : "Sort";

  return (
    <th className={className}>
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        className="flex min-h-8 w-full items-center gap-2 text-left font-semibold uppercase tracking-wide text-gray-500"
      >
        <span>{label}</span>
        <span className={isActive ? "text-gray-900" : "text-gray-300"}>{indicator}</span>
      </button>
    </th>
  );
}

export default SortHeader;
