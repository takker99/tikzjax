import * as library from "./library.js";
import * as timeback from "./timeBack.ts";

let coredump: Uint8Array | undefined;
let code: Uint8Array | undefined;

export const compile = async (
  input: string,
  fileLoader: (filename: string) => Promise<Uint8Array>,
): Promise<Uint8Array> => {
  code ??= await fileLoader("tex.wasm.gz");
  coredump ??= new Uint8Array(
    await fileLoader("core.dump.gz"),
    0,
    library.pages * 65536,
  );
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
  library.setFileLoader(fileLoader);
  library.setShowConsole();

  const wasm = await WebAssembly.instantiate(code!, {
    library: { ...library, ...timeback },
    env: { memory },
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
