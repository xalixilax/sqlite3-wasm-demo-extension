# sqlite3-wasm-demo-extension

This repository takes the sample code from https://github.com/tomayac/sqlite3-wasm-demo/tree/main/public and converts it to run in an MV3 Chrome extension.

## Building

This project is written in TypeScript and needs to be compiled before use:

1. Install dependencies:
   ```bash
   npm install
   ```

2. Build the extension:
   ```bash
   npm run build
   ```

This will compile the TypeScript source files from `src/` into JavaScript in the `dist/` directory.

## Running

To run this extension:
* Load it as an unpacked extension into Chrome, pointing to the `dist/` directory.
* Click the extension's icon to open the extension in a new tab.

## Development

- Source files are in `src/` (TypeScript)
- Built files are in `dist/` (JavaScript)
- Run `npm run watch` to automatically recompile when source files change
- Run `npm run clean` to remove the dist directory
