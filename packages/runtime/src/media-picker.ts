// Framework-agnostic helpers shared by the media store adapters
// (@hitslop/svelte, @hitslop/react). No reactivity in here: adapters own state.

export const safeMediaName = (name: string, label = "Media"): string => {
  if (!/^[a-z][a-z0-9-]{0,63}$/.test(name)) throw new Error(`${label} store names must use lowercase letters, numbers, and hyphens`);
  return name;
};

/** Reads a File into the base64 payload expected by `slop.media.write`. */
export const fileToBase64 = async (file: File, label = "file"): Promise<string> => {
  let bytes: Uint8Array;
  try {
    bytes = new Uint8Array(await file.arrayBuffer());
  } catch {
    throw new Error(`Could not read that ${label}`);
  }
  let binary = "";
  const chunkSize = 0x8000; // Keep String.fromCharCode argument counts bounded.
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize));
  }
  return btoa(binary);
};

/** Opens the native file picker via a hidden `<input type="file">`. */
export const chooseLocalFile = (accept: string, onFile: (file: File) => void): void => {
  const input = document.createElement("input");
  input.type = "file";
  input.accept = accept;
  input.hidden = true;
  input.addEventListener("change", () => {
    const file = input.files?.[0];
    input.remove();
    if (file) onFile(file);
  }, { once: true });
  document.body.append(input);
  input.click();
};

/** URL for a named media entry, cache-busted by its revision. */
export const mediaSourceURL = (name: string, revision: string | null): string =>
  `/media/${name}?revision=${encodeURIComponent(revision ?? "current")}`;
