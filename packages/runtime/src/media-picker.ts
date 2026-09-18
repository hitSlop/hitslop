// Framework-agnostic helpers shared by the media store adapters
// (such as @hitslop/svelte). No reactivity in here: adapters own state.

/** Reads a File into the base64 payload expected by `slop.media.add`. */
export const fileToBase64 = async (file: File, label = "file"): Promise<string> => {
  if (file.size > 25 * 1024 * 1024) throw new Error("Choose a file no larger than 25 MiB");
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
  input.addEventListener(
    "change",
    () => {
      const file = input.files?.[0];
      input.remove();
      if (file) onFile(file);
    },
    { once: true },
  );
  input.addEventListener("cancel", () => input.remove(), { once: true });
  document.body.append(input);
  input.click();
};
