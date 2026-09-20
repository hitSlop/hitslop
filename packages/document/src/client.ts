import { connect } from "node:net";
import { validate } from "../../schema/src/validation";
import { SocketRequestSchema, SocketReplySchema } from "../../schema/src/socket";
export async function callHost(socketPath: string, request: Record<string, unknown>): Promise<any> {
  const payload = JSON.stringify(request);
  validate(SocketRequestSchema, JSON.parse(payload));
  if (Buffer.byteLength(payload) > 1_048_576) throw new Error("Oversized socket request");
  return new Promise((resolve, reject) => {
    const socket = connect(socketPath);
    let input = Buffer.alloc(0), settled = false;
    const finish = (error?: Error, value?: unknown) => {
      if (settled) return;
      settled = true;
      socket.destroy();
      error ? reject(error) : resolve(value);
    };
    socket.setTimeout(35000, () =>
      finish(
        new Error(
          "Host timeout; outcome may be unknown.",
        ),
      ),
    );
    socket.on("error", (error) => finish(error));
    socket.on("connect", () => socket.write(payload + "\n"));
    socket.on("end", () => {
      if (!settled) finish(new Error("Host disconnected; outcome may be unknown"));
    });
    socket.on("data", (chunk) => {
      input = Buffer.concat([input, typeof chunk === "string" ? Buffer.from(chunk) : chunk]);
      const end = input.indexOf(10);
      if ((end < 0 ? input.length : end) > 16 * 1024 * 1024) {
        finish(new Error("Oversized host response"));
        return;
      }
      if (end >= 0) {
        try {
          const reply = validate(SocketReplySchema, JSON.parse(input.subarray(0, end).toString("utf8")));
          finish(undefined, reply);
        } catch (error) {
          finish(error as Error);
        }
      }
    });
  });
}
