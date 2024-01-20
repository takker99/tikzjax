import { JSZip } from "https://deno.land/x/jszip@0.11.0/mod.ts";
import { ensureDir } from "https://deno.land/std@0.212.0/fs/mod.ts";

{
  const res = await fetch(
    "http://mirrors.ctan.org/fonts/cm/ps-type1/bakoma.zip",
  );

  const zip = new JSZip();
  await zip.loadAsync(await res.arrayBuffer());

  await ensureDir(new URL("./dist", import.meta.url));
  zip.unzip("./dist");
}

{
  const res = await fetch("http://mirrors.ctan.org/fonts/amsfonts.zip");

  const zip = new JSZip();
  await zip.loadAsync(await res.arrayBuffer());

  await ensureDir(new URL("./dist", import.meta.url));
  zip.unzip("./dist");
}
