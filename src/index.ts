import * as library from "./library.js";

let coredump: Uint8Array | undefined;
let code: Uint8Array | undefined;

const initialize = async () => {
  code ??= await loadDecompress("../tex.wasm.gz");
  coredump ??= new Uint8Array(
    await loadDecompress("../core.dump.gz"),
    0,
    library.pages * 65536,
  );
};
export const compile = async (input: string): Promise<Uint8Array> => {
  await initialize();
  library.writeFileSync("input.tex", new TextEncoder().encode(input));

  // Set up the tex web assembly.
  const memory = new WebAssembly.Memory({
    initial: library.pages,
    maximum: library.pages,
  });

  const buffer = new Uint8Array(memory.buffer, 0, library.pages * 65536);
  buffer.set(coredump!.slice(0));

  library.setMemory(memory.buffer);
  library.setInput(" input.tex \n\\end\n");
  library.setFileLoader(loadDecompress);
  library.setShowConsole();

  const wasm = await WebAssembly.instantiate(code!, {
    library: library,
    env: { memory: memory },
  });

  // Execute the tex web assembly.
  await library.executeAsync(wasm.instance.exports);

  // console.debug(new TextDecoder().decode(library.readFileSync("input.log")));

  // Extract the generated dvi file.
  const dvi = library.readFileSync("input.dvi");

  // Clean up the library for the next run.
  library.deleteEverything();

  // Use dvi2html to convert the dvi to svg.

  return dvi;
};

const loadDecompress = async (file: string) => {
  const fsFile = await Deno.open(new URL(file, import.meta.url));
  const unzippedStream = fsFile.readable.pipeThrough(
    new DecompressionStream("gzip"),
  );
  return new Uint8Array(await new Response(unzippedStream).arrayBuffer());
};
