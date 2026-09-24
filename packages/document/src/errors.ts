/** Expected rejection before an edit is accepted. Uncaught rejections get host UI. */
export class OperationRejectedError extends Error {
  readonly code = "hitslop_operation_rejected";
  constructor(message: string) {
    super(message);
    this.name = "OperationRejectedError";
  }
}
