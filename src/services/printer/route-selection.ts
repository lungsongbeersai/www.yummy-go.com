interface SharedPrintRouteState {
  pendingRemoteShared?: boolean;
  queuedRemoteShared?: boolean;
}

export function shouldDeferSharedPrintToOwner({
  pendingRemoteShared,
  queuedRemoteShared,
}: SharedPrintRouteState) {
  return pendingRemoteShared === true || queuedRemoteShared === true;
}
