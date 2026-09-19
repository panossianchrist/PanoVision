export class ServiceError extends Error {
  constructor(
    public code: string,
    public status = 400,
    message = "The request could not be completed.",
  ) {
    super(message);
    this.name = "ServiceError";
  }
}
export class TechnicalError extends Error {
  constructor(public code: string) {
    super(code);
    this.name = "TechnicalError";
  }
}
