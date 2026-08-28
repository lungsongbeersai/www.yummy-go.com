interface SearchParamsReader {
  get(name: string): string | null;
}

export function orderCustomerRouteInput(searchParams: SearchParamsReader) {
  return {
    initialTableUuid: searchParams.get("table_uuid")?.trim() ?? "",
    initialTableName: searchParams.get("table_name")?.trim() ?? "",
  };
}
