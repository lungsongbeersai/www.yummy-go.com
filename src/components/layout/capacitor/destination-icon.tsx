import { MenuIcon } from "@/components/common/menu-icon";
import type { MenuItem } from "@/config/menu";

export function DestinationIcon({
  className = "size-5 shrink-0",
  item,
}: {
  className?: string;
  item: MenuItem;
}) {
  const Icon = item.icon;
  if (Icon) return <Icon className={className} />;
  if (item.iconName) return <MenuIcon value={item.iconName} className={className} />;
  return null;
}
