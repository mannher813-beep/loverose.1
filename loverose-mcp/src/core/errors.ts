/**
 * Erreurs partagées entre tous les domaines.
 *
 * Objectif : que chaque outil MCP retourne des erreurs cohérentes, au même
 * format que les réponses d'erreur déjà utilisées dans les Edge Functions
 * existantes (`{ error: string }`), pour rester prévisible côté client MCP.
 */

export class DomainError extends Error {
  constructor(
    message: string,
    public readonly code: string = "domain_error"
  ) {
    super(message);
    this.name = "DomainError";
  }
}

export class NotFoundError extends DomainError {
  constructor(message = "Resource not found") {
    super(message, "not_found");
  }
}

export class ForbiddenError extends DomainError {
  constructor(message = "Forbidden") {
    super(message, "forbidden");
  }
}

export class ValidationError extends DomainError {
  constructor(message = "Invalid input") {
    super(message, "validation_error");
  }
}
