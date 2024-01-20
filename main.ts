import { compile } from "./src/index.ts";
import { convertToHTML } from "https://raw.githubusercontent.com/takker99/dvi2html/0.3.0/mod.ts";
import {
  Color,
  color,
  Papersize,
  papersize,
  parse,
  ParseInfo,
  PS,
  ps,
  Rule,
  Special,
  SVG,
  svg,
  Text,
} from "https://raw.githubusercontent.com/takker99/dvi2html/0.3.0/dvi/mod.ts";
import { makeFontCSS } from "./makeFontCSS.ts";
import { exists } from "https://deno.land/std@0.212.0/fs/mod.ts";
import { JSZip } from "https://deno.land/x/jszip@0.11.0/mod.ts";
import { ensureDir } from "https://deno.land/std@0.212.0/fs/mod.ts";
import { resolve } from "https://deno.land/std@0.212.0/path/mod.ts";
import { Command } from "https://deno.land/x/cliffy@v0.25.7/command/mod.ts#^";
import { Spinner } from "https://deno.land/std@0.212.0/cli/mod.ts";

if (!await exists("./dist/bakoma/ttf/")) {
  const spinner = new Spinner({ message: "Downloading fonts..." });
  spinner.start();
  const res = await fetch(
    "http://mirrors.ctan.org/fonts/cm/ps-type1/bakoma.zip",
  );
  const data = await res.arrayBuffer();
  spinner.message = "Extracting fonts...";

  const zip = new JSZip();
  await zip.loadAsync(data);

  await ensureDir(new URL("./dist", import.meta.url));
  await zip.unzip("./dist");
  spinner.stop();
}

const { args: [filename, output] } = await new Command()
  .name("tikzjax")
  .description("Compile TeX to HTML")
  .version("v0.1.1")
  .arguments("<input:string> [output:string]")
  .parse(Deno.args);

const loadDecompress = async (file: string) => {
  try {
    if (file.endsWith(".tfm")) {
      return await Deno.readFile(
        new URL(`./dist/bakoma/tfm/${file}`, import.meta.url),
      );
    }
    const fsFile = await Deno.open(
      new URL(`./assets/${file}`, import.meta.url),
    );
    const unzippedStream = fsFile.readable.pipeThrough(
      new DecompressionStream("gzip"),
    );
    return new Uint8Array(await new Response(unzippedStream).arrayBuffer());
  } catch (e: unknown) {
    console.error(e);
    throw e;
  }
};

const { dvi } = await compile(
  await Deno.readTextFile(resolve(Deno.cwd(), filename)),
  loadDecompress,
);

if (dvi) {
const commands:
  (Special | PS | Papersize | SVG | Color | Text | Rule | ParseInfo)[] = [];
const fontNames = new Set<string>();
for await (
  const command of parse(dvi, {
    plugins: [papersize, ps(), svg(), color()],
    tfmLoader: async (fontname) =>
      new Uint32Array((await loadDecompress(`${fontname}.tfm`)).buffer),
  })
) {
  commands.push(command);
  if (command.type !== "text") continue;
  fontNames.add(command.font.name);
}
const page = convertToHTML(commands);

const html =
  `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>TikZJax</title><style>${await makeFontCSS(
    [...fontNames],
  )}</style><style>.page{position:relative;width:100%;height:0;}.text{line-height:0;position:absolute; overflow:visible;}.rect{position:absolute;min-width:1px;min-height:1px;}svg{position:absolute;overflow:visible;}</style></head><body>${page}</body></html>`;

if (output) {
  await Deno.writeTextFile(resolve(Deno.cwd(), output), html);
} else {
  console.log(html);
  }
}
