# otojsc-vscode

Otojs client as a project folder for Visual Studio Code.

## Overview

* Otojs is a programming execution environment for real-time audio generation.
* otojsd is a server program that receives JavaScript code from clients, executes it, and outputs audio.
* otojsc-vscode is an environment for sending code from VSCode to otojsd.
* code-splash support.
* TypeScript support.

## Installation

```bash
npm install
```

## Usage

### 1. Open the project in VSCode

Open this folder in VSCode.

### 2. Write JavaScript or TypeScript code in the code folder

Create and edit JavaScript or TypeScript files in the `code/` folder.

### 3. Send code using tasks

Use VSCode's task feature to send code:

- **Send entire file**: `Command+Shift+P` → "Tasks: Run Task" → "Post file to the server"
- **Send selected code**: Select code → `Command+Shift+P` → "Tasks: Run Task" → "Post selection to the server"

### 4. Send from command line

You can also send directly from the command line:

```bash
# Send entire file
node bin/otojsc.js code/otojs-basic.js

# Send TypeScript file (automatically compiled)
node bin/otojsc.js code/test.ts

# Send code string directly
node bin/otojsc.js "console.log('Hello World')"

# Send selected text (with file name specified)
node bin/otojsc.js --selection code/test.ts "console.log('Selected')"
```

## Configuration

Configure the destination in `otojsc-config.json`:

```json
{
    "otojsd": {
        "host": "localhost",
        "port": 14609,
        "otojsd_port-file": ""
    },
    "code-splash": {
        "enabled": true,
        "host": "localhost",
        "port": 8080
    }
}
```

### Configuration Options

#### otojsd
- **host**: Destination host (default: localhost)
- **port**: Destination port number (default: 14609)
- **otojsd_port-file**: Path to `.otojsd_port` file
  - otojsd writes its listening port number to a `.otojsd_port` file
  - If the port number is empty and this file is specified, the port number will be read from that file

#### code-splash
- **enabled**: Enable sending to code-splash (default: false)
- **host**: code-splash host (default: localhost)
- **port**: code-splash port (default: 8080)

code-splash is a program that displays the code string being sent on the screen with visual effects.

## TypeScript Support

TypeScript files (`.ts`) are automatically compiled before being sent. Compilation results are saved in the `dist/` folder.

### Notes

- **Sending entire file**: TypeScript files are automatically compiled and sent
- **Sending selected text**: Selected TypeScript code is sent as-is without compilation (a warning will be displayed)

## Copyright

Copyright (C) 2025 Haruka Kataoka

## License

otojsc-vscode is free software: you can redistribute it and/or modify it under the terms of the GNU General Public License as published by the Free Software Foundation, either version 3 of the License, or (at your option) any later version.

This program is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU General Public License for more details.

You should have received a copy of the GNU General Public License along with this program. If not, see <https://www.gnu.org/licenses/>. 
