import { basename } from "https://deno.land/std@0.210.0/url/basename.ts";
import { encodeBase64Url } from "https://deno.land/std@0.210.0/encoding/base64url.ts";

// Add TeX package files
const files =
  (await Array.fromAsync(Deno.readDir(new URL("tex_files/", import.meta.url))))
    .flatMap((dir) =>
      dir.isFile && dir.name.endsWith(".gz")
        ? [new URL(`tex_files/${dir.name}`, import.meta.url)]
        : []
    );

// Add core.dump and tex.wasm
files.unshift(
  new URL("core.dump.gz", import.meta.url),
  new URL("tex.wasm.gz", import.meta.url),
);

const dict = Object.fromEntries(
  await Promise.all(
    files.map(async (file) => {
      const data = await Deno.readFile(file);
      return [basename(file), encodeBase64Url(data)];
    }),
  ),
);

Deno.writeTextFile(
  new URL("tex_files/texFilesBase64.ts", import.meta.url),
  `export const texFilesBase64 = ${JSON.stringify(dict)}`,
);
