# TikZJax

The `output-single-file` branch provides async API to render TikZ. The entire
project is compiled into a standalone JS file and CCS file.

Thanks to Jim Fowler for doing all of the hard work. See
https://github.com/kisonecat/tikzjax, https://github.com/kisonecat/web2js, and
https://github.com/kisonecat/dvi2html for his original work.

Also see https://github.com/jhoobergs/web2js and
https://github.com/jhoobergs/web2js for additional changes that were made by
Jesse Hoobergs that were used in this work.

## Example

```html
<head>
    <script src="./TikzJax.js"></script>
    <link rel="stylesheet" type="text/css" href="./TikzJax.css">
</head>

<body>
    <code><pre id="code">\usetikzlibrary{graphs}
\begin{document}
    \begin{tikzpicture}
        \graph[nodes = {circle, draw}, grow right = 1.5cm] {
            A -> B
        };
    \end{tikzpicture}
\end{document}</pre></code>
    <main id="main"></main>
    <script>
        (async function() {
            await TikZJax.initialize();
            const code = document.getElementById('code').innerText;
            const html = await TikZJax.render(code);
            document.getElementById('main').innerHTML = html;
        })();
    </script>
</body>
```

## How does this work?

Using the ww-modifications branch of https://github.com/drgrice1/web2js the
Pascal source of `TeX` is compiled to WebAssembly, and the `LaTeX` format is
loaded (without all the hyphenation data). Then

```tex
\documentclass[margin=0pt]{standalone}
\def\pgfsysdriver{pgfsys-ximera.def}
\usepackage[svgnames]{xcolor}
\usepackage{tikz}
```

is executed. Then the core is dumped and compressed. The WebAssembly and core
are loaded in the browser and executed. An SVG driver for PGF along in the
ww-modifications branch of https://github.com/drgrice1/dvi2html are then
utilized to convert the DVI output into to an SVG image.

All of this happens in the browser.

Note that TeX will only be run the first time that a "text/tikz" script tag
appears in a page. After that run of TeX, the SVG image will be cached, and the
next time the same "text/tikz" script appears the cached SVG image will be
loaded. If the text content of the script tag or any of the `data` attributes
(described below) are changed, then TeX will be run again to update the image.

## Options

There are several data attributes that can be set for a "text/tikz" `<script>`
tag that affect the generation of the resulting SVG image, or change the way the
TikzJax javascript behaves.

The values of the `data-width` and `data-height` attributes set on the
`<script>` tag will be used for the width and height of a loader image. This is
an svg image that is displayed while TeX is being run to generate the svg image,
and contains a spinner to indicate to the user that work is being done. These
dimensions are in points.

Use `data-tex-packages` to load and use TeX packages. The value of this
attribute must be a string that will parse to a valid javascript object via the
javascript JSON.parse method. The keys of the object should be the TeX package
names, and the value of each key should be the package options to set. For
example:

```html
<script type="text/tikz" data-tex-packages="custom-package"
	data-tex-package='{"pgfplots":"","custom-package":"option=special"}'>
```

will add

```tex
\usepackage{array}\usepackage{pgfplots}
\usepackage[option=special]{custom-package}
```

to the preamble of the TeX input. Note that TeX packages must be loaded in this
way. This will ensure that the needed TeX system files are made available to the
TeX WebAssembly for successful compilation. Note that the only TeX packages that
are available at this time are `array`, `pgfplots`, and `tikz-3dplot`.
Additional packages can be made available by adding a file `<package-name>.json`
that contains an array of file names needed by the package to the `tex_packages`
directory, and adding the gzipped files in that array to the `tex_files`
directory.

Use `data-tikz-libraries` to load and use TikZ libraries. For example:

```html
<script type="text/tikz" data-tikz-libraries="arrows.meta,calc">
```

will result in

```tex
\usetikzlibrary{arrows.meta,calc}
```

being added to the preamble of the TeX input. As with TeX packages, TikZ
libraries must be loaded in this way to ensure that the needed TeX system files
are made available to the TeX WebAssembly for successful compilation. Note that
all known TikZ libraries are available (with the exception of some that don't
make sense in this context, like the external library).

Use `data-add-to-preamble="..."` to add to the TeX preamble.

Use `data-show-console="true"` to enable the output of TeX in the console. By
default, console output is disabled and nothing is shown in the browser console.
If this data attribute is set, then you will see

```text
This is e-TeX, Version 3.14159265-2.6 (preloaded format=latex 1776.7.4)
**entering extended mode
(input.tex
LaTeX2e <2020-02-02> patch level 2
...
Transcript written on input.log.
```

output to the console. This is useful when testing your TikZ code to ensure that
it compiles successfully, but should be left disabled for production.

## CSS Classes

For your convenience, some css classes are provided that will apply common
styles to the svg image. To use these classes place the "text/tikz" script tags
inside an html element with one of the following classes.

If you add the css class `tikzjax-container` to the containing element, then
`overflow:visible` will be added to the style of the generated `<svg>` image.

If you add the css class `tikzjax-scaled-container` to the containing element,
then `overflow:visible`, `width:100%`, and `height:100%` will be added to the
style of the generated `<svg>` image.

## Other JavaScript Interactions

Note that once tikzjax completes the generation of an SVG image, the generated
`<svg>` image will emit the `tikzjax-load-finished` event. You can use this
event to do something with the generated SVG image in javascript.

For example:

```javascript
document.addEventListener('tikzjax-load-finished', function(e) {
	var svg = e.srcElement;
	...
});
```

## Building

First clone this GitHub repository (https://github.com/drgrice1/tikzjax) and
switch to the ww-modifications branch.

Then clone my fork of web2js (https://github.com/drgrice1/web2js) and also
switch to the ww-modifications branch. Follow the directions in the README for a
"quick path to generate the tex.wasm and core.dump files". Then copy the
generated core.dump and tex.wasm files to the tikzjax directory, and gzip them.

Finally run

```
npm install
npm run build
```

in the tikzjax directory to build the tikzjax distribution. Note that in order
for this full build to be successful you must have a TeX distribution installed
with the necessary TeX and TikZ files available and locatable by `kpsewhich`.

# Deployment

The `dist` directory that is generated by the build process above will contain
everything needed. Copy the contents to your server for deployment. To use it in
a webpage add

```html
<link rel="stylesheet" type="text/css" href="http[s]://<path to dist contents>/fonts.css">
<script src="http[s]://<path to dist contents>/tikzjax.js"></script>
```

to the html page. Of course use `http:` or `https:` instead of `http[s]:` (or
remove that entirely for a protocol agnostic approach) and adjust
`<path to dist contents>` as needed.

</HEAD>
