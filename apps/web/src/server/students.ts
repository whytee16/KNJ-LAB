/** Students sign in with a username; GoTrue needs an e-mail, so we map to a non-deliverable one. */
export function usernameToEmail(username: string, domain: string): string {
  return `${username.toLowerCase()}@${domain}`;
}

export function isStudentEmail(email: string, domain: string): boolean {
  return email.toLowerCase().endsWith(`@${domain}`);
}

/** Login form accepts either a parent's e-mail or a student's username. */
export function identifierToEmail(identifier: string, domain: string): string {
  const value = identifier.trim();
  return value.includes('@') ? value.toLowerCase() : usernameToEmail(value, domain);
}
