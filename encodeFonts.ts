const toDataURL = (blob: Blob) => {
  const fileReader = new FileReader();
  const promise = new Promise<string>((resolve) =>
    fileReader.onload = () => resolve(fileReader.result as string)
  );
  fileReader.readAsDataURL(blob);
  return promise;
};

const fonts = new Map<string, string>();
for await (
  const entry of Deno.readDir(new URL("./dist/bakoma/ttf/", import.meta.url))
) {
  if (!entry.isFile) continue;
  fonts.set(
    entry.name.slice(0, -4),
    await toDataURL(
      new Blob([
        await Deno.readFile(
          new URL(`./dist/bakoma/ttf/${entry.name}`, import.meta.url),
        ),
      ], { type: "font/truetype" }),
    ),
  );
}
const css = sortBy([...fonts.entries()], ([k]) => k).map(([k, font]) =>
  `@font-face { font-family: ${k}; src: local(${k}), url(${font}) format("truetype"); }.${k} { font-family: ${k}; }`
).join("\n");
// const res = await fetch(
//   "https://raw.githubusercontent.com/artisticat1/obsidian-tikzjax/main/styles.css",
// );
// const css = await res.text() +
//   sortBy([...fonts.entries()], ([k]) => k).map(([k]) =>
//     `.${k} { font-family: ${k}; }`
//   ).join("\n");

await Deno.writeTextFile("dist/TikZJax.css", css);
