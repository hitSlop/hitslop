export class HttpError extends Error {
  constructor(
    message: string,
    readonly status = 400,
  ) {
    super(message);
  }
}

export const fail = (message: string, status = 400): never => {
  throw new HttpError(message, status);
};

export const json = (value: unknown, status = 200, headers: HeadersInit = {}) =>
  Response.json(value, { status, headers });

export const errorResponse = (error: unknown) => {
  const status = error instanceof HttpError ? error.status : 500;
  return json({ error: error instanceof HttpError ? error.message : "Request failed" }, status);
};
