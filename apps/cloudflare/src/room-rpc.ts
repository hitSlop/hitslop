import { fail } from "./errors.ts";
import type { SlopRoom, RoomResult } from "./room.ts";
export type Rooms = DurableObjectNamespace<SlopRoom> | undefined;
export const room = (rooms: Rooms, id: string) =>
  rooms?.getByName(id) ?? fail("Rooms are unavailable", 503);
export function unwrap<T>(result: RoomResult<T>): T {
  if (!result.ok) return fail(result.message, result.status);
  return result.value;
}
