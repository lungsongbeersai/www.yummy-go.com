interface UnauthorizedSessionInput {
  currentToken: string | null | undefined;
  isLoggedIn: boolean;
  requestToken: string | null | undefined;
  status: number | undefined;
}

export function shouldLogoutForUnauthorized({
  currentToken,
  isLoggedIn,
  requestToken,
  status,
}: UnauthorizedSessionInput) {
  return Boolean(
    status === 401 &&
      isLoggedIn &&
      currentToken &&
      requestToken === currentToken,
  );
}
