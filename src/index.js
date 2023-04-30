import { dvi2html } from 'dvi2html';
import pako from 'pako';
import { Buffer } from 'buffer';
import { Writable } from 'stream-browserify';
import * as library from './library';
import { texFilesBase64 } from './../tex_files/texFilesBase64';
import { optimize } from "./svgo.browser";

var coredump;
var code;

let TikZJax = {
	render: async function (input) {
		library.writeFileSync("input.tex", Buffer.from(input));
	
		// Set up the tex web assembly.
		let memory = new WebAssembly.Memory({ initial: library.pages, maximum: library.pages });
	
		let buffer = new Uint8Array(memory.buffer, 0, library.pages * 65536);
		buffer.set(coredump.slice(0));
	
		library.setMemory(memory.buffer);
		library.setInput(" input.tex \n\\end\n");
		library.setFileLoader(loadDecompress);
	
		let wasm = await WebAssembly.instantiate(code, {
			library: library,
			env: { memory: memory }
		});
	
		// Execute the tex web assembly.
		await library.executeAsync(wasm.instance.exports);
	
		// console.debug(new TextDecoder().decode(library.readFileSync("input.log")));
		
		// Extract the generated dvi file.
		let dvi = library.readFileSync("input.dvi").buffer;
	
		// Clean up the library for the next run.
		library.deleteEverything();
	
		// Use dvi2html to convert the dvi to svg.
		let html = "";
		const page = new Writable({
			write(chunk, encoding, callback) {
				html = html + chunk.toString();
				callback();
			}
		});
	
		async function* streamBuffer() {
			yield Buffer.from(dvi);
			return;
		}
	
		await dvi2html(streamBuffer(), page);
	
		// console.debug(html);
	
		function optimizeSVG(svg) {
			// Optimize the SVG using SVGO
			// Fixes misaligned text nodes on mobile
	
			return optimize(svg, {plugins:
				[
					{
						name: 'preset-default',
						params: {
							overrides: {
								// Don't use the "cleanupIDs" plugin
								// To avoid problems with duplicate IDs ("a", "b", ...)
								// when inlining multiple svgs with IDs
								cleanupIDs: false
							}
						}
					}
				]
			// @ts-ignore
			}).data;
		}
		// svg缺少闭合标签导致svgo解析异常，推测是dvi2html的问题，留待日后修复，暂且这样解决。
		html = html + "</svg>";
		return optimizeSVG(html);
	}
}

async function loadDecompress(file) {
	const prefix = "data:application/gzip;base64,";
	const gzippedString = texFilesBase64[file];
    const gzippedBuffer = Buffer.from(gzippedString.substring(prefix.length), 'base64');

	try {
		const unzippedBuffer = pako.ungzip(gzippedBuffer);

		return unzippedBuffer;

	} catch (e) {
		throw `Unable to load ${file}.  File not available.`;
	}
}

async function initialize() {
	code = await loadDecompress('tex.wasm.gz');
	coredump = new Uint8Array(await loadDecompress('core.dump.gz'), 0, library.pages * 65536);
	window.TikZJax = TikZJax;
}

initialize();
