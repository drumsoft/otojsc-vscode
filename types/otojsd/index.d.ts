declare global {
  var sample_rate: number;
  var frame: number;
  var console: {
    log: (...args: string[]) => void;
    info: (...args: string[]) => void;
    debug: (...args: string[]) => void;
    warn: (...args: string[]) => void;
    error: (...args: string[]) => void;
    assert: (condition: boolean, ...args: string[]) => void;
  }
}

export { };
