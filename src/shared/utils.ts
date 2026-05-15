export function getTabSessionId(): string {
  let sessionId = sessionStorage.getItem('tab-session-id');
  if (!sessionId) {
    sessionId = Date.now().toString() + Math.random().toString(36).substring(2, 9);
    sessionStorage.setItem('tab-session-id', sessionId);
  }
  return sessionId;
}
