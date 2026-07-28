/**
 * Logger minimal. Le serveur MCP tourne en dehors du navigateur (Node.js
 * indépendant), donc pas d'accès à `console` orienté DevTools : on garde
 * un format simple et structuré, facile à rediriger vers un fichier ou un
 * service de logs plus tard.
 */

type LogLevel = "debug" | "info" | "warn" | "error";

function emit(level: LogLevel, domain: string, message: string, extra?: Record<string, unknown>) {
  const entry = {
    ts: new Date().toISOString(),
    level,
    domain,
    message,
    ...(extra ?? {}),
  };
  const line = JSON.stringify(entry);
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
}

export function createLogger(domain: string) {
  return {
    debug: (message: string, extra?: Record<string, unknown>) => emit("debug", domain, message, extra),
    info: (message: string, extra?: Record<string, unknown>) => emit("info", domain, message, extra),
    warn: (message: string, extra?: Record<string, unknown>) => emit("warn", domain, message, extra),
    error: (message: string, extra?: Record<string, unknown>) => emit("error", domain, message, extra),
  };
}
