export function getTabSessionId(): string {
  let sessionId = sessionStorage.getItem('tab-session-id');
  if (!sessionId) {
    sessionId =
      crypto.randomUUID();
    sessionStorage.setItem('tab-session-id', sessionId);
  }
  return sessionId;
}
