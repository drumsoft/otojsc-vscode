#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const http = require("http");
const { execSync } = require("child_process");
const { SourceMapConsumer } = require("source-map");

// Default configuration
const DEFAULT_CONFIG = {
  otojsd: {
    host: "localhost",
    port: null,
    "otojsd_port-file": "",
  },
  "code-splash": {
    enabled: false,
    host: "localhost",
    port: 8080,
  },
};

const DEFAULT_PORT = 14609;

/**
 * Load configuration file
 */
function loadConfig() {
  const configPath = path.join(process.cwd(), "otojsc-config.json");

  if (fs.existsSync(configPath)) {
    try {
      const configData = fs.readFileSync(configPath, "utf8");
      return JSON.parse(configData);
    } catch (error) {
      console.error(`Error reading config file: ${error.message}`);
      return DEFAULT_CONFIG;
    }
  }

  return DEFAULT_CONFIG;
}

/**
 * Read port number from otojsd_port file
 */
function readPortFile(portFilePath) {
  if (!portFilePath) return null;

  const resolvedPath = path.resolve(portFilePath);

  if (fs.existsSync(resolvedPath)) {
    try {
      const content = fs.readFileSync(resolvedPath, "utf8").trim();
      const port = parseInt(content, 10);
      if (!isNaN(port) && port > 0 && port <= 65535) {
        return port;
      }
    } catch (error) {
      console.error(`Error reading port file: ${error.message}`);
    }
  }

  return null;
}

/**
 * Determine port number
 */
function determinePort(config) {
  // 1. Use port from config file if specified
  if (config.otojsd.port) {
    return config.otojsd.port;
  }

  // 2. Read from otojsd_port-file if specified
  if (config.otojsd["otojsd_port-file"]) {
    const port = readPortFile(config.otojsd["otojsd_port-file"]);
    if (port) return port;
  }

  // 3. Use default port number
  return DEFAULT_PORT;
}

/**
 * load tsconfig.json
 */
function loadTsConfig() {
  const configPath = path.join(process.cwd(), "tsconfig.json");
  if (!fs.existsSync(configPath)) {
    console.error("tsconfig.json not found in current directory.");
    process.exit(1);
  }
  try {
    const tsConfigData = fs.readFileSync(configPath, "utf8");
    return JSON.parse(tsConfigData);
  } catch (error) {
    console.error(`Error reading tsconfig.json: ${error.message}`);
    process.exit(1);
  }
}

/**
 * Compile TypeScript file
 */
function compileTypeScript() {
  const configPath = path.join(process.cwd(), "tsconfig.json");
  try {
    // Use --project option to compile with tsconfig.json settings
    // This ensures include patterns and all settings are respected
    execSync(`npx tsc --project "${configPath}"`, {
      cwd: process.cwd(),
      stdio: "inherit",
    });
  } catch (error) {
    // Error details are already displayed via stderr
    console.error(
      `\nTypeScript compilation failed for "${filePath}": ${error}`
    );
    process.exit(1);
  }
}

/**
 * Parse selection argument in format: filepath:line:column
 * Returns {filePath, line, column}
 */
function parseSelectionArgument(arg) {
  const match = arg.match(/^(.+):(\d+):(\d+)$/);
  if (!match) {
    throw new Error(
      `Invalid selection argument format: ${arg}. Expected: filepath:line:column`
    );
  }

  return {
    filePath: match[1],
    line: parseInt(match[2], 10),
    column: parseInt(match[3], 10),
  };
}

/**
 * find compiled file path.
 * @param {object} tsConfig - tsconfig.json content
 * @param {string} sourceFilePath - Original TypeScript file path
 */
function findCompiledFilePath(tsConfig, sourceFilePath) {
  const rootDir =
    tsConfig.compilerOptions && tsConfig.compilerOptions.rootDir
      ? path.resolve(process.cwd(), tsConfig.compilerOptions.rootDir)
      : path.join(process.cwd(), "code");
  const outDir =
    tsConfig.compilerOptions && tsConfig.compilerOptions.outDir
      ? path.resolve(process.cwd(), tsConfig.compilerOptions.outDir)
      : path.join(process.cwd(), "dist");

  const relativePath = path.relative(rootDir, path.resolve(sourceFilePath));
  const jsFilePath = path.join(outDir, relativePath.replace(/\.ts$/, ".js"));

  if (!fs.existsSync(jsFilePath)) {
    console.error(
      `Compiled file not found: ${jsFilePath}. Please ensure the TypeScript file has been compiled.`
    );
    process.exit(1);
  }
  return jsFilePath;
}

/**
 * Find compiled JavaScript code corresponding to selected TypeScript code using source maps
 * @param {object} tsConfig - tsconfig.json content
 * @param {string} sourceFilePath - Original TypeScript file path
 * @param {string} selectedText - Selected TypeScript code
 * @param {number} endLine - Line number at end of selection (1-based)
 * @param {number} endColumn - Column number at end of selection (0-based)
 * @returns {string} Corresponding compiled JavaScript code
 */
async function findCompiledCode(
  tsConfig,
  sourceFilePath,
  selectedText,
  endLine,
  endColumn
) {
  const jsFilePath = findCompiledFilePath(tsConfig, sourceFilePath);
  const mapFilePath = `${jsFilePath}.map`;

  if (!fs.existsSync(mapFilePath)) {
    throw new Error(
      `Source map not found: ${mapFilePath}. Please ensure sourceMap is enabled in tsconfig.json`
    );
  }

  // Read source map
  const mapData = JSON.parse(fs.readFileSync(mapFilePath, "utf8"));
  const consumer = await new SourceMapConsumer(mapData);

  try {
    // Read the original source file to find start position
    const sourceCode = fs.readFileSync(sourceFilePath, "utf8");
    const sourceLines = sourceCode.split("\n");

    // Calculate start position of selection by searching backwards from end position
    const lines = selectedText.split("\n");
    const startLine = endLine - lines.length + 1;

    // Find start column by locating the first line of selected text in the source
    const firstSelectedLine = lines[0];
    const sourceLineText = sourceLines[startLine - 1]; // Convert to 0-based index
    const startColumn = sourceLineText.indexOf(firstSelectedLine);

    // Find generated positions for start and end of selection
    // relative path from jsFilePath to sourceFilePath
    const sourceInMap = path.relative(path.dirname(jsFilePath), sourceFilePath);

    const startPos = consumer.generatedPositionFor({
      source: sourceInMap,
      line: startLine,
      column: Math.max(0, startColumn),
    });

    const endPos = consumer.generatedPositionFor({
      source: sourceInMap,
      line: endLine,
      column: endColumn,
    });

    if (!startPos.line || !endPos.line) {
      console.error(
        "Warning: Could not map selection to compiled code. Sending original TypeScript code."
      );
      return selectedText;
    }

    // Read compiled JavaScript file
    const jsCode = fs.readFileSync(jsFilePath, "utf8");
    const jsLines = jsCode.split("\n");

    // Extract corresponding lines from compiled code
    // Note: Source maps provide line-level granularity, but column positions
    // may not be precise due to compilation transformations. For safety,
    // we extract full lines from the compiled code.

    const result = [];
    for (let i = startPos.line; i <= endPos.line; i++) {
      const line = jsLines[i - 1]; // Convert to 0-based index
      if (line !== undefined) {
        result.push(line);
      }
    }

    return result.join("\n");
  } finally {
    consumer.destroy();
  }
}

/**
 * Prepare code (from file or direct code string)
 * Returns [originalCode, compiledCode|undefined]
 * compiledCode is undefined if no compilation is needed.
 */
function prepareCode(input) {
  // Treat as file path
  let code;
  if (fs.existsSync(input)) {
    const ext = path.extname(input);
    code = fs.readFileSync(input, "utf8");

    if (ext === ".ts") {
      const tsConfig = loadTsConfig();
      // First, compile the entire project
      compileTypeScript();
      // Then map filepath to compiled file
      const compiledPath = findCompiledFilePath(tsConfig, input);
      // return compiled code
      return [code, fs.readFileSync(compiledPath, "utf8")];
    } else {
      // Read JavaScript file or other extensions, Send as-is
      return [code, undefined];
    }
  } else {
    // If file doesn't exist, treat input as code string
    return [input, undefined];
  }
}

/**
 * Send HTTP request
 */
function sendRequest(host, port, path, data) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: host,
      port: port,
      path: path,
      method: "POST",
      headers: {
        "Content-Type": "application/octet-stream",
        "Content-Length": Buffer.byteLength(data),
      },
    };

    const req = http.request(options, (res) => {
      let responseData = "";

      res.on("data", (chunk) => {
        responseData += chunk;
      });

      res.on("end", () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(responseData);
        } else {
          reject(new Error(`HTTP ${res.statusCode}: ${responseData}`));
        }
      });
    });

    req.on("error", (error) => {
      reject(error);
    });

    req.write(data);
    req.end();
  });
}

/**
 * Main process
 */
async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.error("Usage: otojsc <file|code>");
    console.error("  otojsc <file>: Send entire file");
    console.error("  otojsc <code>: Send code string");
    console.error(
      "  otojsc --selection <file:line:column> <code>: Send selected code (compiles TS using source maps)"
    );
    process.exit(1);
  }

  // Load configuration
  const config = loadConfig();

  // Determine port number
  const port = determinePort(config);
  const host = config.otojsd.host || "localhost";

  let code;
  let compiledCode = undefined;

  // Check for --selection option
  if (args[0] === "--selection" && args.length >= 3) {
    // Parse filepath:line:column format
    const { filePath, line, column } = parseSelectionArgument(args[1]);

    // Remove quotes from selected text if present
    let selectedText = args.slice(2).join(" ");
    if (selectedText.startsWith("'") && selectedText.endsWith("'")) {
      selectedText = selectedText.slice(1, -1);
    }

    code = selectedText;

    // Check file extension
    const ext = path.extname(filePath);

    if (ext === ".ts") {
      // For TypeScript files, compile and map selection to compiled code
      try {
        const tsConfig = loadTsConfig();
        // First, compile the entire project
        compileTypeScript();
        // Then find the compiled code corresponding to the selection
        compiledCode = await findCompiledCode(
          tsConfig,
          filePath,
          selectedText,
          line,
          column
        );
      } catch (error) {
        console.error(
          `Error processing TypeScript selection: ${error.message}`
        );
        console.error("Sending original TypeScript code as fallback.");
        compiledCode = undefined;
      }
    }
  } else {
    // Normal mode (entire file or code string)
    const input = args.join(" ");
    [code, compiledCode] = prepareCode(input);
  }

  try {
    // Send to otojsd
    await sendRequest(host, port, "/", compiledCode ?? code);
    console.error(`Code sent to ${host}:${port}`);

    // Send to code-splash (if enabled)
    if (config["code-splash"].enabled) {
      const splashHost = config["code-splash"].host || "localhost";
      const splashPort = config["code-splash"].port || 8080;

      try {
        await sendRequest(splashHost, splashPort, "/effect", code);
        console.error(
          `Code sent to code-splash at ${splashHost}:${splashPort}`
        );
      } catch (error) {
        console.error(`Failed to send to code-splash: ${error.message}`);
      }
    }
  } catch (error) {
    console.error(`Error sending code: ${error.message}`);
    process.exit(1);
  }
}

// Execute script
main();
