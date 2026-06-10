type SidebarMenuLoader = (companyUuid: string, roleId: number, lang?: string) => Promise<void>;

interface RefreshPermissionSidebarMenuInput {
  language?: string;
  loadSidebarMenu: SidebarMenuLoader;
  status: number | null | undefined;
  storeUuid: string;
}

export async function refreshPermissionSidebarMenu({
  language,
  loadSidebarMenu,
  status,
  storeUuid
}: RefreshPermissionSidebarMenuInput) {
  const companyUuid = storeUuid.trim();
  if (!companyUuid || typeof status !== "number" || !Number.isFinite(status)) return false;

  try {
    await loadSidebarMenu(companyUuid, status, language);
    return true;
  } catch {
    return false;
  }
}
