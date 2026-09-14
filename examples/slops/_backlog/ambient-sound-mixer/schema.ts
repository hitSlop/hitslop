import * as Type from "typebox";

export const CHANNEL_IDS = ["rain", "thunder", "wind", "birds", "night"] as const;
export type ChannelID = (typeof CHANNEL_IDS)[number];

const channelLevels = Type.Object({
  rain: Type.Number(),
  thunder: Type.Number(),
  wind: Type.Number(),
  birds: Type.Number(),
  night: Type.Number(),
}, { additionalProperties: true });

const channelFlags = Type.Object({
  rain: Type.Boolean(),
  thunder: Type.Boolean(),
  wind: Type.Boolean(),
  birds: Type.Boolean(),
  night: Type.Boolean(),
}, { additionalProperties: true });

const mixerSchema = Type.Object({
  preset: Type.String(),
  master: Type.Number(),
  playing: Type.Boolean(),
  channels: channelLevels,
  muted: channelFlags,
  soloed: channelFlags,
}, { additionalProperties: true });

export type MixerData = Type.Static<typeof mixerSchema>;
export type ChannelLevels = Type.Static<typeof channelLevels>;
export type ChannelFlags = Type.Static<typeof channelFlags>;
export default mixerSchema;
