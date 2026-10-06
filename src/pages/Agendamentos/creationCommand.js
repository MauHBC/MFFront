// Origin, not recurrence or timing left in a draft, chooses the write command.
export default function creationCommand({ ready, origin, own, packageId, sharing, repeat, later, replacementId }) {
  if (!ready || !origin) return null;
  if (origin === "replacement") return replacementId && !own && !sharing ? "/sessions" : null;
  if (replacementId) return null;
  if (origin === "own") return own && packageId && !sharing ? "/sessions" : null;
  if (origin === "shared") return sharing && !own ? "/sessions" : null;
  if (origin !== "new" || own || sharing) return null;
  if (later) return "/package-purchases";
  return repeat ? "/session-series" : "/sessions";
}
