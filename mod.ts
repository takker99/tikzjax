import * as library from "./library.js";
import * as timeback from "./timeBack.ts";

let coredump: Uint8Array | undefined;
let code: Uint8Array | undefined;

export interface CompileInit {
  fileLoader: (filename: string) => Promise<Uint8Array>;
  console?: (message: string) => void;
}

export interface CompileResult {
  dvi?: Uint8Array;
  log: Uint8Array;
}

export const compile = async (
  input: string,
  init: CompileInit,
): Promise<CompileResult> => {
  code ??= await init.fileLoader("tex.wasm.gz");
  coredump ??= new Uint8Array(
    await init.fileLoader("core.dump.gz"),
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
  library.setFileLoader(init.fileLoader);
  if (init.console) library.setConsole(init.console);

  const wasm = await WebAssembly.instantiate(code!, {
    library: { ...library, ...timeback },
    env: { memory },
  });

  // Execute the tex web assembly.
  await library.executeAsync(wasm.instance.exports);

  const log = library.readFileSync("input.log");
  try {
    // Extract the generated dvi file.
    const dvi = library.readFileSync("input.dvi");
    return { dvi, log };
  } catch (_) {
    return { log };
  } finally {
    // Clean up the library for the next run.
    library.deleteEverything();
  }
};
