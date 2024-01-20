const toDataURL = (blob: Blob) => {
  const fileReader = new FileReader();
  const promise = new Promise<string>((resolve) =>
    fileReader.onload = () => resolve(fileReader.result as string)
  );
  fileReader.readAsDataURL(blob);
  return promise;
};

export const makeFontCSS = async (fontNames: string[]): Promise<string> =>
  (await Promise.all(
    fontNames.sort().map(async (fontName) => [
      fontName,
      await toDataURL(
        new Blob([
          await Deno.readFile(
            new URL(`./dist/bakoma/ttf/${fontName}.ttf`, import.meta.url),
          ),
        ], { type: "font/truetype" }),
      ),
    ]),
  )).map(([k, font]) =>
    `@font-face { font-family: ${k}; src: local(${k}), url(${font}) format("truetype"); }.${k} { font-family: ${k}; }`
  ).join("\n");
