import tfmData from "https://raw.githubusercontent.com/takker99/dvi2html/0.3.0/tfm/fonts.json" with {
  type: "json",
};

let filesystem = {};
let files = [];
let showConsole = false;
let consoleBuffer = "";
let memory = null;
let inputBuffer = null;
let callback = null;

let wasmExports = null;
let view = null;
let fileLoader = null;
let finished = null;

export const pages = 1100;

const DATA_ADDR = (pages - 100) * 1024 * 64;
const END_ADDR = pages * 1024 * 64;
let windingDepth = 0;
let sleeping = false;

function startUnwind() {
  if (view) {
    view[DATA_ADDR >> 2] = DATA_ADDR + 8;
    view[DATA_ADDR + 4 >> 2] = END_ADDR;
  }

  wasmExports.asyncify_start_unwind(DATA_ADDR);
  windingDepth = windingDepth + 1;
}

function startRewind() {
  wasmExports.asyncify_start_rewind(DATA_ADDR);
  wasmExports.main();
}

function stopRewind() {
  windingDepth = windingDepth - 1;
  wasmExports.asyncify_stop_rewind();
}

export function deleteEverything() {
  files = [];
  filesystem = {};
  memory = null;
  inputBuffer = null;
  callback = null;
  showConsole = false;
  finished = null;
  wasmExports = null;
  view = null;
  sleeping = false;
}

export function writeFileSync(filename, buffer) {
  filesystem[filename] = buffer;
}

export function readFileSync(filename) {
  for (const f of files) {
    if (f.filename == filename) {
      return f.content.slice(0, f.position);
    }
  }

  throw Error(`Could not find file ${filename}`);
}

function openSync(filename, mode) {
  const initialSleepState = sleeping;
  if (sleeping) {
    stopRewind();
    sleeping = false;
  }

  let buffer = new Uint8Array();

  if (filesystem[filename]) {
    buffer = filesystem[filename];
  } else if (filename.match(/\.tfm$/)) {
    buffer = new Uint8Array(
      new Uint32Array(tfmData[filename.replace(/\.tfm$/, "")]).buffer,
    );
  } else if (mode == "r") {
    // If this file has been opened before without an error, that means it was written to.
    // In that case assume the file can now be opened, so fall through and create a fake file below.
    // Otherwise attempt to find it.
    const descriptor = files.findIndex((element) =>
      element.filename == filename && !element.erstat
    );
    if (descriptor == -1) {
      if (initialSleepState || filename.match(/\.(aux|log|dvi)$/)) {
        // If we are returning from sleep and the file is still not in the filesystem,
        // or it is an aux, log, or dvi file, then report it as not found.
        files.push({
          filename: filename,
          erstat: 1,
        });
        return files.length - 1;
      } else {
        // Pause the web assembly execution, and attempt to load the file.
        startUnwind();
        sleeping = true;
        setTimeout(async () => {
          // Attempt to load the file.
          try {
            const data = await fileLoader(`../tex_files/${filename}.gz`);
            filesystem[filename] = data;
            // deno-lint-ignore no-empty
          } catch (_) {}
          startRewind();
        }, 0);
        return -1;
      }
    }
  }

  files.push({
    filename: filename,
    position: 0,
    position2: 0,
    erstat: 0,
    eoln: false,
    content: buffer,
    descriptor: files.length,
  });

  return files.length - 1;
}

function closeSync() { // ignore this.
}

function writeSync(file, buffer, pointer, length) {
  if (pointer === undefined) pointer = 0;
  if (length === undefined) length = buffer.length - pointer;

  while (length > file.content.length - file.position) {
    const b = new Uint8Array(1 + file.content.length * 2);
    b.set(file.content);
    file.content = b;
  }

  file.content.subarray(file.position).set(
    buffer.subarray(pointer, pointer + length),
  );
  file.position += length;
}

function readSync(file, buffer, pointer, length, seek) {
  if (pointer === undefined) pointer = 0;
  if (length === undefined) length = buffer.length - pointer;

  if (length > file.content.length - seek) {
    length = file.content.length - seek;
  }

  buffer.subarray(pointer).set(file.content.subarray(seek, seek + length));

  return length;
}

function writeToConsole(x) {
  if (!showConsole) return;
  consoleBuffer += x;
  if (consoleBuffer.indexOf("\n") >= 0) {
    const lines = consoleBuffer.split("\n");
    consoleBuffer = lines.pop();
    for (const line of lines) {
      if (line.length) console.log(line);
    }
  }
}

export function setShowConsole() {
  showConsole = true;
}

// setup

export function setMemory(m) {
  memory = m;
  view = new Int32Array(m);
}

export function setInput(input, cb) {
  inputBuffer = input;
  if (cb) callback = cb;
}

export function setFileLoader(c) {
  fileLoader = c;
}

export function executeAsync(_wasmExports) {
  wasmExports = _wasmExports;

  finished = Promise.withResolvers();

  wasmExports.main();
  wasmExports.asyncify_stop_unwind();

  return finished.promise;
}

// print

export function printString(descriptor, x) {
  const file = (descriptor < 0) ? { stdout: true } : files[descriptor];
  const length = new Uint8Array(memory, x, 1)[0];
  const buffer = new Uint8Array(memory, x + 1, length);
  const string = String.fromCharCode.apply(null, buffer);

  if (file.stdout) {
    writeToConsole(string);
    return;
  }

  writeSync(file, new TextEncoder().encode(string));
}

export function printBoolean(descriptor, x) {
  const file = (descriptor < 0) ? { stdout: true } : files[descriptor];

  const result = x ? "TRUE" : "FALSE";

  if (file.stdout) {
    writeToConsole(result);
    return;
  }

  writeSync(file, new TextEncoder().encode(result));
}
export function printChar(descriptor, x) {
  const file = (descriptor < 0) ? { stdout: true } : files[descriptor];
  if (file.stdout) {
    writeToConsole(String.fromCharCode(x));
    return;
  }

  const b = new Uint8Array(1);
  b[0] = x;
  writeSync(file, b);
}

export function printInteger(descriptor, x) {
  const file = (descriptor < 0) ? { stdout: true } : files[descriptor];
  if (file.stdout) {
    writeToConsole(x.toString());
    return;
  }

  writeSync(file, new TextEncoder().encode(`${x}`));
}

export function printFloat(descriptor, x) {
  const file = (descriptor < 0) ? { stdout: true } : files[descriptor];
  if (file.stdout) {
    writeToConsole(x.toString());
    return;
  }

  writeSync(file, new TextEncoder().encode(`${x}`));
}

export function printNewline(descriptor, _) {
  const file = (descriptor < 0) ? { stdout: true } : files[descriptor];

  if (file.stdout) {
    writeToConsole("\n");
    return;
  }

  writeSync(file, new TextEncoder().encode("\n"));
}

export function reset(length, pointer) {
  const buffer = new Uint8Array(memory, pointer, length);
  let filename = String.fromCharCode.apply(null, buffer);

  filename = filename.replace(/\000+$/g, "");

  if (filename.startsWith("{")) {
    filename = filename.replace(/^{/g, "");
    filename = filename.replace(/}.*/g, "");
  }

  if (filename.startsWith('"')) {
    filename = filename.replace(/^"/g, "");
    filename = filename.replace(/".*/g, "");
  }

  filename = filename.replace(/ +$/g, "");
  filename = filename.replace(/^\*/, "");
  filename = filename.replace(/^TeXfonts:/, "");

  if (filename == "TeXformats:TEX.POOL") {
    filename = "tex.pool";
  }

  if (filename == "TTY:") {
    files.push({
      filename: "stdin",
      stdin: true,
      position: 0,
      position2: 0,
      erstat: 0,
      eoln: false,
      content: new TextEncoder().encode(inputBuffer),
    });
    return files.length - 1;
  }

  return openSync(filename, "r");
}

export function rewrite(length, pointer) {
  const buffer = new Uint8Array(memory, pointer, length);
  let filename = String.fromCharCode.apply(null, buffer);

  filename = filename.replace(/ +$/g, "");

  if (filename.startsWith('"')) {
    filename = filename.replace(/^"/g, "");
    filename = filename.replace(/".*/g, "");
  }

  if (filename == "TTY:") {
    files.push({
      filename: "stdout",
      stdout: true,
      erstat: 0,
    });
    return files.length - 1;
  }

  return openSync(filename, "w");
}

export function close(descriptor) {
  const file = files[descriptor];

  if (file.descriptor) {
    closeSync(file.descriptor);
  }
}

export function eof(descriptor) {
  const file = files[descriptor];

  if (file.eof) return 1;
  else return 0;
}

export function erstat(descriptor) {
  const file = files[descriptor];
  return file.erstat;
}

export function eoln(descriptor) {
  const file = files[descriptor];

  if (file.eoln) return 1;
  else return 0;
}

export function inputln(
  descriptor,
  bypass_eoln,
  bufferp,
  firstp,
  lastp,
  _,
  buf_size,
) {
  const file = files[descriptor];

  const buffer = new Uint8Array(memory, bufferp, buf_size);
  const first = new Uint32Array(memory, firstp, 4);
  const last = new Uint32Array(memory, lastp, 4);

  // cf. Matthew 19:30
  last[0] = first[0];

  // Input the first character of the line into |f^|
  if (bypass_eoln && !file.eof && file.eoln) {
    file.position2 = file.position2 + 1;
  }

  let endOfLine = file.content.indexOf(10, file.position2);
  if (endOfLine < 0) endOfLine = file.content.length;

  if (file.position2 >= file.content.length) {
    if (file.stdin) {
      if (callback) callback();
      tex_final_end();
    }

    file.eof = true;
    return false;
  } else {
    buffer.subarray(first[0]).set(
      file.content.subarray(file.position2, endOfLine),
    );

    last[0] = first[0] + endOfLine - file.position2;

    while (buffer[last[0] - 1] == 32) {
      last[0] = last[0] - 1;
    }

    file.position2 = endOfLine;
    file.eoln = true;
  }

  return true;
}

export function get(descriptor, pointer, length) {
  const file = files[descriptor];

  const buffer = new Uint8Array(memory);

  if (file.stdin) {
    if (file.position >= inputBuffer.length) {
      buffer[pointer] = 13;
      file.eof = true;
      if (callback) callback();
      tex_final_end();
    } else {
      buffer[pointer] = inputBuffer[file.position].charCodeAt(0);
    }
  } else {
    if (file.descriptor) {
      if (readSync(file, buffer, pointer, length, file.position) == 0) {
        buffer[pointer] = 0;
        file.eof = true;
        file.eoln = true;
        return;
      }
    } else {
      file.eof = true;
      file.eoln = true;
      return;
    }
  }

  file.eoln = false;
  if (buffer[pointer] == 10) file.eoln = true;
  if (buffer[pointer] == 13) file.eoln = true;

  file.position = file.position + length;
}

export function put(descriptor, pointer, length) {
  const file = files[descriptor];

  const buffer = new Uint8Array(memory);

  writeSync(file, buffer, pointer, length);
}

export function tex_final_end() {
  if (consoleBuffer.length) writeToConsole("\n");
  if (finished) finished.resolve();
}
