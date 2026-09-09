export function activeEmployeeSalesFilterCount(
  filters: { dateFrom: string; dateTo: string; loginUuid: string },
  today: string,
) {
  let count = 0;
  if (filters.dateFrom !== today || filters.dateTo !== today) count += 1;
  if (filters.loginUuid) count += 1;
  return count;
}
