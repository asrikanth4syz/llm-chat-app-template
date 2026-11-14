// FR-07 Announcements — pure helpers (audience targeting + acknowledgement need).
export const AUDIENCES = ["all", "office", "client_site"] as const;
export type Audience = (typeof AUDIENCES)[number];

export function isValidAudience(a: string): a is Audience {
  return (AUDIENCES as readonly string[]).includes(a);
}

/** Does an announcement reach an employee of this segment? "all" reaches everyone;
 *  a segment audience reaches only that segment. */
export function audienceMatches(audience: string, segment: string | null): boolean {
  return audience === "all" || (segment != null && audience === segment);
}

/** Does this announcement still need acknowledgement from the viewer? Only when it
 *  requires one and the viewer has not acknowledged the current version. */
export function needsAck(requiresAck: number | boolean, ackedCurrentVersion: number | boolean): boolean {
  return !!requiresAck && !ackedCurrentVersion;
}
