# Image Tools

Browser-side source code for the image tools published at:

https://valiakhmetov.com/toolbox/image-tools/

The site includes a PNG optimiser that uses `libimagequant`/`imagequant` and OxiPNG in the browser.

## Source files

- `app.js` — shared browser UI and integration with the PNG optimiser.
- `optimizer.js` — PNG quantisation, OxiPNG optimisation, and ZIP generation.

The JavaScript files in this repository are licensed under **GNU GPL v3 or later**.

## Third-party software

See [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) for the libraries used by the PNG optimiser, their versions, licences, and source links.

Server-side PHP used by the other image tools and the site's CSS are not included in this repository and are not declared GPL-licensed here.

## No warranty

This software is provided without warranty, to the extent permitted by applicable law.