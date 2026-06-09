"use client";

import { usePublicBrowseWorkflow } from "../hooks/use-public-browse-workflow";
import { ProductBrowseContent } from "./product-browse-content";

export function ProductBrowse({
  token,
  lang,
  cartOpen,
  onCartOpenChange,
}: {
  token: string;
  lang: string;
  cartOpen: boolean;
  onCartOpenChange: (open: boolean) => void;
}) {
  const workflow = usePublicBrowseWorkflow({
    cartOpen,
    lang,
    onCartOpenChange,
    token,
  });

  return <ProductBrowseContent workflow={workflow} />;
}
