export class AuthenticationConfigurationError extends Error {
  constructor(message = "Authentication configuration is invalid.") {
    super(message);
    this.name = "AuthenticationConfigurationError";
  }
}

export class InvalidCredentialsError extends Error {
  constructor() {
    super("Invalid credentials.");
    this.name = "InvalidCredentialsError";
  }
}
