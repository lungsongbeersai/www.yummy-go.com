"use client";

import { usePublicBrowseWorkflow } from "../hooks/use-public-browse-workflow";
import { PublicPullToRefresh } from "./public-pull-to-refresh";
import { PublicHeader } from "./public-header";
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

  return (
    <>
      <PublicPullToRefresh />
      <PublicHeader
        table={workflow.table}
        canSearch={!workflow.loadingMenu}
        onSearch={workflow.search.openSearchSheet}
      />
      <ProductBrowseContent workflow={workflow} />
    </>
  );
}
