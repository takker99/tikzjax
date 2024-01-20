import files from "./tex_files.json" with { type: "json" };
import { red } from "https://deno.land/std@0.212.0/fmt/colors.ts";

await Deno.mkdir(new URL("./tex_files", import.meta.url), { recursive: true });

const processedFiles = new Set<string>();

for (const texFile of files) {
  if (!texFile || processedFiles.has(texFile)) continue;
  console.log(`\tAttempting to locate ${texFile}.`);

  const kpsewhich = new Deno.Command("kpsewhich", {
    args: [texFile],
  });
  const { stdout } = await kpsewhich.output();
  const sysFile = new TextDecoder().decode(stdout).trim();
  if (sysFile == "") {
    console.log(red(`\tUnable to locate ${texFile}.`));
    continue;
  }

  processedFiles.add(texFile);

  console.log(`\tResolved ${texFile} to ${sysFile}`);
  await Deno.writeFile(
    new URL(`./tex_files/${texFile}.gz`, import.meta.url),
    (await Deno.open(sysFile)).readable.pipeThrough(
      new CompressionStream("gzip"),
    ),
  );
}
