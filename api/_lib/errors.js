// HTTP error type shared by API routes and pure helpers (no dependencies).
export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}
