import { compile } from "./mod.ts";
import { convertToHTML } from "https://raw.githubusercontent.com/takker99/dvi2html/0.4.2/mod.ts";
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
} from "https://raw.githubusercontent.com/takker99/dvi2html/0.4.2/dvi/mod.ts";
import { exists } from "https://deno.land/std@0.212.0/fs/mod.ts";
import { JSZip } from "https://deno.land/x/jszip@0.11.0/mod.ts";
import { ensureDir } from "https://deno.land/std@0.212.0/fs/mod.ts";
import { resolve } from "https://deno.land/std@0.212.0/path/mod.ts";
import { Command } from "https://deno.land/x/cliffy@v0.25.7/command/mod.ts#^";
import { Spinner } from "https://deno.land/std@0.212.0/cli/mod.ts";

if (
  !await exists("./dist/bakoma/tfm/") || !await exists("./dist/amsfonts/tfm")
) {
  const spinner = new Spinner({ message: "Downloading fonts..." });
  spinner.start();
  const [bakoma, amsfonts] = await Promise.all([
    fetch(
      "http://mirrors.ctan.org/fonts/cm/ps-type1/bakoma.zip",
    ).then((res) => res.arrayBuffer()),

    fetch("http://mirrors.ctan.org/fonts/amsfonts.zip").then((res) =>
      res.arrayBuffer()
    ),
  ]);
  spinner.message = "Extracting fonts...";

  await ensureDir(new URL("./dist", import.meta.url));
  await Promise.all([
    new JSZip().loadAsync(bakoma).then((zip) => zip.unzip("./dist")),
    new JSZip().loadAsync(amsfonts).then((zip) => zip.unzip("./dist")),
  ]);

  spinner.stop();
}

const { args: [filename, output], options } = await new Command()
  .name("tikzjax")
  .description("Compile TeX to HTML")
  .version("v0.1.1")
  .arguments("<input:string> [output:string]")
  .option("--dvi", "Output DVI file")
  .option("--svg", "Output standalone SVG file")
  .option("-q, --quiet", "Disable logging")
  .parse(Deno.args);

const loadDecompress = async (file: string) => {
  try {
    if (file.endsWith(".tfm")) {
      try {
        return await Deno.readFile(
          new URL(`./dist/bakoma/tfm/${file}`, import.meta.url),
        );
      } catch (e: unknown) {
        if (!(e instanceof Deno.errors.NotFound)) throw e;
        return await Deno.readFile(
          new URL(`./dist/amsfonts/tfm/${file}`, import.meta.url),
        );
      }
    }
    if (file.endsWith(".ttf")) {
      return await Deno.readFile(
        new URL(`./dist/bakoma/ttf/${file}`, import.meta.url),
      );
    }
    const fsFile = await Deno.open(
      new URL(`./assets/${file}.gz`, import.meta.url),
    );
    const unzippedStream = fsFile.readable.pipeThrough(
      new DecompressionStream("gzip"),
    );
    return new Uint8Array(await new Response(unzippedStream).arrayBuffer());
  } catch (e: unknown) {
    if (!options.quiet) console.error(e);
    throw e;
  }
};

const { dvi } = await compile(
  await Deno.readTextFile(resolve(Deno.cwd(), filename)),
  {
    fileLoader: loadDecompress,
    console: options.quiet ? undefined : (x: string) => console.log(x),
  },
);

if (dvi) {
  if (options.dvi) {
    if (output) {
      await Deno.writeFile(resolve(Deno.cwd(), output), dvi);
    } else {
      console.log(dvi);
    }
  } else {
    const commands:
      (Special | PS | Papersize | SVG | Color | Text | Rule | ParseInfo)[] = [];
    const fontNames = new Set<string>();
    for await (
      const command of parse(dvi, {
        plugins: [papersize, ps(), svg(), color()],
        tfmLoader: loadDecompress,
      })
    ) {
      commands.push(command);
      if (command.type !== "text") continue;
      fontNames.add(command.font.name);
    }
    const xml = await convertToHTML(commands, {
      fileLoader: loadDecompress,
      svg: options.svg,
    });

    if (output) {
      await Deno.writeTextFile(resolve(Deno.cwd(), output), xml);
    } else {
      console.log(xml);
    }
  }
}
