#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const http = require('http');
const { execSync } = require('child_process');

// Default configuration
const DEFAULT_CONFIG = {
  otojsd: {
    host: 'localhost',
    port: null,
    'otojsd_port-file': ''
  },
  'code-splash': {
    enabled: false,
    host: 'localhost',
    port: 8080
  }
};

const DEFAULT_PORT = 14609;

/**
 * Load configuration file
 */
function loadConfig() {
  const configPath = path.join(process.cwd(), 'otojsc-config.json');

  if (fs.existsSync(configPath)) {
    try {
      const configData = fs.readFileSync(configPath, 'utf8');
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
      const content = fs.readFileSync(resolvedPath, 'utf8').trim();
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
  if (config.otojsd['otojsd_port-file']) {
    const port = readPortFile(config.otojsd['otojsd_port-file']);
    if (port) return port;
  }

  // 3. Use default port number
  return DEFAULT_PORT;
}

/**
 * Compile TypeScript file
 */
function compileTypeScript(filePath) {
  const configPath = path.join(process.cwd(), 'tsconfig.json');
  const distDir = path.join(process.cwd(), 'dist');

  // Create dist directory if it doesn't exist
  if (!fs.existsSync(distDir)) {
    fs.mkdirSync(distDir, { recursive: true });
  }

  const fileName = path.basename(filePath, '.ts');
  const outputPath = path.join(distDir, `${fileName}.js`);

  try {
    // Use --project option to compile with tsconfig.json settings
    // This ensures include patterns and all settings are respected
    execSync(`npx tsc --project "${configPath}"`, {
      cwd: process.cwd(),
      stdio: 'inherit'
    });

    if (fs.existsSync(outputPath)) {
      return fs.readFileSync(outputPath, 'utf8');
    } else {
      throw new Error(`Compiled file not found at ${outputPath}`);
    }
  } catch (error) {
    // Error details are already displayed via stderr
    console.error(`\nTypeScript compilation failed for: ${filePath}`);
    process.exit(1);
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
    code = fs.readFileSync(input, 'utf8');

    if (ext === '.ts') {
      // Compile TypeScript file
      return [code, compileTypeScript(input)];
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
      method: 'POST',
      headers: {
        'Content-Type': 'application/octet-stream',
        'Content-Length': Buffer.byteLength(data)
      }
    };

    const req = http.request(options, (res) => {
      let responseData = '';

      res.on('data', (chunk) => {
        responseData += chunk;
      });

      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(responseData);
        } else {
          reject(new Error(`HTTP ${res.statusCode}: ${responseData}`));
        }
      });
    });

    req.on('error', (error) => {
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
    console.error('Usage: otojsc <file|code>');
    console.error('  otojsc <file>: Send entire file');
    console.error('  otojsc <code>: Send code string');
    console.error('  otojsc --selection <file> <code>: Send selected code (with file context for TS)');
    process.exit(1);
  }

  // Load configuration
  const config = loadConfig();

  // Determine port number
  const port = determinePort(config);
  const host = config.otojsd.host || 'localhost';

  let code;
  let compiledCode = undefined;

  // Check for --selection option
  if (args[0] === '--selection' && args.length >= 3) {
    const filePath = args[1];
    const selectedText = args.slice(2).join(' ');

    // Check file extension
    const ext = path.extname(filePath);

    if (ext === '.ts') {
      // For TypeScript files
      // Current implementation sends selected code as-is
      // A more advanced implementation could compile the entire file and extract the corresponding part
      // However, extracting the selected portion is complex, so we send the selected text as-is
      console.error('Warning: Sending selected TypeScript code as-is (not compiled)');
      code = selectedText;
    } else {
      // For JavaScript or other files, send selected text as-is
      code = selectedText;
    }
  } else {
    // Normal mode (entire file or code string)
    const input = args.join(' ');
    [code, compiledCode] = prepareCode(input);
  }

  try {
    // Send to otojsd
    await sendRequest(host, port, '/', compiledCode ?? code);
    console.error(`Code sent to ${host}:${port}`);

    // Send to code-splash (if enabled)
    if (config['code-splash'].enabled) {
      const splashHost = config['code-splash'].host || 'localhost';
      const splashPort = config['code-splash'].port || 8080;

      try {
        await sendRequest(splashHost, splashPort, '/effect', code);
        console.error(`Code sent to code-splash at ${splashHost}:${splashPort}`);
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
