import { useMemo, useState } from "react";

const normalizeValue = (value) => {
  if (value === null || value === undefined) {
    return "";
  }

  if (value instanceof Date) {
    return value.getTime();
  }

  if (typeof value === "boolean") {
    return value ? 1 : 0;
  }

  if (typeof value === "number") {
    return value;
  }

  const dateValue = Date.parse(value);

  if (!Number.isNaN(dateValue) && /^\d{4}-\d{2}-\d{2}|^\d{4}-\d{2}-\d{2}T/.test(String(value))) {
    return dateValue;
  }

  return String(value).toLowerCase();
};

export function useSortableData(items, accessors, initialSort) {
  const [sortConfig, setSortConfig] = useState(initialSort);

  const sortedItems = useMemo(() => {
    if (!sortConfig?.key) {
      return items;
    }

    const accessor = accessors[sortConfig.key];

    if (!accessor) {
      return items;
    }

    return [...items].sort((left, right) => {
      const leftValue = normalizeValue(accessor(left));
      const rightValue = normalizeValue(accessor(right));

      if (leftValue < rightValue) {
        return sortConfig.direction === "asc" ? -1 : 1;
      }

      if (leftValue > rightValue) {
        return sortConfig.direction === "asc" ? 1 : -1;
      }

      return 0;
    });
  }, [accessors, items, sortConfig]);

  const requestSort = (key) => {
    setSortConfig((current) => ({
      key,
      direction: current?.key === key && current.direction === "asc" ? "desc" : "asc"
    }));
  };

  return { sortedItems, sortConfig, requestSort };
}
