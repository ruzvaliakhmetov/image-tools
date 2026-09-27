# Third-party notices

This repository contains the browser-side source code used by Image Tools at:

https://valiakhmetov.com/toolbox/image-tools/

The shared frontend code is used by the Trimmer, Thumbnailer, and PNG Optimiser interfaces.

Some third-party libraries listed below are used only by the PNG Optimiser.  
The server-side PHP implementations of Trimmer and Thumbnailer are separate components and are not included in this repository.

## PNG Optimiser dependencies

### libimagequant / imagequant

- Version used by `libimagequant-wasm 0.3.0`: **imagequant 4.4.1**
- Licence: **GNU GPL v3 or later**, or a separate commercial licence from the copyright holder
- Project: https://github.com/ImageOptim/libimagequant
- Exact 4.4.1 source:
  https://docs.rs/crate/imagequant/4.4.1/source/

`libimagequant` is used only by the PNG Optimiser.

When this project is distributed under the GPL option, the browser-side Image Tools code that integrates the PNG Optimiser is published under **GNU GPL v3 or later**.

### libimagequant-wasm

- Version: **0.3.0**
- Licence: **MIT**
- Project: https://github.com/akshetpandey/libimagequant-wasm

Runtime files used by the PNG Optimiser:

- https://cdn.jsdelivr.net/npm/libimagequant-wasm@0.3.0/dist/wasm/libimagequant_wasm.js
- https://cdn.jsdelivr.net/npm/libimagequant-wasm@0.3.0/dist/wasm/libimagequant_wasm_bg.wasm

`libimagequant-wasm` is an MIT-licensed wrapper around `libimagequant` / `imagequant`.

Its MIT licence does not replace the GPL or commercial licensing requirements of `libimagequant` itself.

### @jsquash/oxipng

- Version: **2.3.0**
- Licence: **Apache License 2.0**
- Project:
  https://github.com/jamsinclair/jSquash/tree/main/packages/oxipng
- Package:
  https://www.npmjs.com/package/@jsquash/oxipng/v/2.3.0

Used only by the PNG Optimiser for lossless PNG optimisation after colour quantisation.

### OxiPNG

- Licence: **MIT**
- Project: https://github.com/oxipng/oxipng

OxiPNG is used through `@jsquash/oxipng`.

## Image Tools source licence

The browser-side Image Tools source code in this repository, including the shared frontend code and the PNG Optimiser integration, is licensed under:

**GNU General Public License v3.0 or later**

See [LICENSE](LICENSE) for the full licence text.

## Components not included in this repository

The following parts of the live Image Tools website are separate from the browser-side source published here:

- Trimmer server-side PHP implementation
- Thumbnailer server-side PHP implementation
- Site-specific styling and other server-side website files

Those components are not declared GPL-licensed by this repository.

## Copyright

Copyright © 2026 Ruz Valiakhmetov

Third-party components remain copyright of their respective authors and contributors and are distributed under their own licence terms.