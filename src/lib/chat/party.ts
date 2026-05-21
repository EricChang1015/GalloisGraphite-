import "server-only";

/** Canonical pair key: smaller uuid first (stable for any two users). */
export function canonicalPartyPair(
  userA: string,
  userB: string
): { low: string; high: string } {
  if (userA === userB) {
    throw new Error("Cannot open a chat with yourself.");
  }
  return userA < userB
    ? { low: userA, high: userB }
    : { low: userB, high: userA };
}

export function counterpartyFromPair(
  low: string,
  high: string,
  currentUserId: string
): string {
  if (currentUserId === low) return high;
  if (currentUserId === high) return low;
  throw new Error("User is not a member of this party pair.");
}
