/**
 * Otojs basic modules.
 */
var Otojs = {
  /** global delta-time (in seconds) per frame */
  dtime: 1 / sample_rate,
  /** 2 x pi */
  PI2: Math.PI * 2,

  /** oscillator modules */
  osc: {
    /**
     * Create a sine wave oscillator.
     * @returns sine wave oscillator function.
     */
    sin: () => {
      let phase = 0;
      return (frequency: number): number => {
        phase = (phase + frequency * Otojs.dtime) % 1;
        return Math.sin(Otojs.PI2 * phase);
      };
    },
    /**
     * Create a square wave oscillator.
     * @returns square wave oscillator function.
     */
    sqr: () => {
      let phase = 0;
      return (frequency: number): number => {
        phase = (phase + frequency * Otojs.dtime) % 1;
        return phase < 0.5 ? 1 : -1;
      };
    },
    /**
     * Create a square wave with pulse width param oscillator.
     * @returns square wave + pw oscillator function. pw: pulse width (0.0 - 1.0)
     */
    sqr_pw: () => {
      let phase = 0;
      // pw: pulse width (0.0 - 1.0)
      return (frequency: number, pw: number): number => {
        phase = (phase + frequency * Otojs.dtime) % 1;
        return phase < pw ? 1 : -1;
      };
    },
    /**
     * Create a triangle wave oscillator.
     * @returns triangle wave oscillator function.
     */
    tri: () => {
      let phase = 0;
      return (frequency: number): number => {
        phase = (phase + frequency * Otojs.dtime) % 1;
        return phase < 0.25
          ? 4 * phase
          : phase < 0.75
            ? -4 * phase + 2
            : 4 * phase - 4;
      };
    },
    /**
     * Create a triangle/saw wave oscillator with morphing param.
     * @returns triangle/saw wave oscillator function. morph: 0.0(saw) .. 0.5(tri) .. 1.0(rev-saw)
     */
    tri_saw: () => {
      let phase = 0;
      return (frequency: number, morph: number): number => {
        phase = (phase + frequency * Otojs.dtime) % 1;
        if (morph == 0) {
          return -2 * (phase - 0.5);
        } else if (morph == 1.0) {
          return phase < 0.5 ? 2 * phase : 2 * (phase - 1);
        } else {
          let mhalf = morph / 2;
          return phase < mhalf ? phase / mhalf
            : phase < 1 - mhalf ? (phase - 0.5) * -2 / (1 - morph)
              : (phase - 1) / mhalf;
        }
      };
    },
    /**
     * Create a saw wave oscillator.
     * @returns saw wave oscillator function.
     */
    saw: () => {
      let phase = 0;
      return (frequency: number): number => {
        phase = (phase + frequency * Otojs.dtime) % 1;
        return phase < 0.5 ? -2 * phase : -2 * phase + 2;
      };
    },
    /**
     * Create a white noise oscillator.
     * @returns white noise oscillator function.
     */
    noise: () => {
      return (): number => {
        return Math.random() * 2 - 1;
      };
    },
    /**
     * Create a silent oscillator.
     * @returns silent oscillator function.
     */
    mute: () => {
      return (): number => {
        return 0;
      };
    },
  },

  /** filter modules */
  filt: {
    /**
     * Create a low-pass filter with cut-off frequency and resonance param.
     * @returns low-pass filter function.
     */
    lpf_sv: () => {
      let buf0 = 0;
      let buf1 = 0;
      return (input: number, frequency: number, resonance: number): number => {
        let f = 2 * Math.sin(Math.PI * Math.min(frequency / sample_rate, 0.25));
        buf0 += f * (input - buf0 + resonance * (buf0 - buf1));
        buf1 += f * (buf0 - buf1);
        return buf1;
      };
    },
    /**
     * Create a bi-quad low-pass filter with cut-off frequency and Q (resonance) param.
     * @returns low-pass filter function.
     */
    lpf_biquad: () => {
      let x = 0, x1 = 0, x2 = 0, y = 0, y1 = 0, y2 = 0;
      let freq_unit = Otojs.PI2 / sample_rate;
      return (input: number, frequency: number, q: number): number => {
        let w0 = frequency * freq_unit;
        let alpha = Math.sin(w0) / (2 * q);
        let cs = Math.cos(w0);
        let b1 = 1 - cs;
        let b0 = b1 / 2;

        x2 = x1; x1 = x; x = input;
        y2 = y1; y1 = y;
        y = (b0 * x + b1 * x1 + b0 * x2 + 2 * cs * y1 - (1 - alpha) * y2) / (1 + alpha);
        return y;
      };
    },
    /**
     * Create bi-quad high-pass filter with cut-off frequency and Q (resonance) param.
     * @returns high-pass filter function.
     */
    hpf_biquad: () => {
      let x = 0, x1 = 0, x2 = 0, y = 0, y1 = 0, y2 = 0;
      let freq_unit = Otojs.PI2 / sample_rate;
      return (input: number, frequency: number, q: number): number => {
        let w0 = frequency * freq_unit;
        let alpha = Math.sin(w0) / (2 * q);
        let cs = Math.cos(w0);
        let b1m = (1 + cs);
        let b0 = b1m / 2;

        x2 = x1; x1 = x; x = input;
        y2 = y1; y1 = y;
        y = (b0 * x - b1m * x1 + b0 * x2 - (-2 * cs) * y1 - (1 - alpha) * y2) / (1 + alpha);
        return y;
      };
    },
    /**
     * Create bi-quad band-pass filter with cut-off frequency and Q (resonance) param.
     * @returns band-pass filter function.
     */
    bpf_biquad: () => {
      let x = 0, x1 = 0, x2 = 0, y = 0, y1 = 0, y2 = 0;
      let freq_unit = Otojs.PI2 / sample_rate;
      return (input: number, frequency: number, q: number): number => {
        let w0 = frequency * freq_unit;
        let b0 = Math.sin(w0) / 2;
        let alpha = b0 / q;

        x2 = x1; x1 = x; x = input;
        y2 = y1; y1 = y;
        y = (b0 * x - b0 * x2 + 2 * Math.cos(w0) * y1 - (1 - alpha) * y2) / (1 + alpha);
        return y;
      };
    }
  },

  /** eg modules */
  eg: {
    /**
     * Create an ADSR envelope generator.
     * @param attack time in seconds
     * @param decay time in seconds
     * @param sustain level 0.0 .. 1.0
     * @param release time in seconds
     * @returns ADSR envelope generator function.
     */
    adsr: (attack: number, decay: number, sustain: number, release: number) => {
      const min_time = 0.0005; // minimum time for each phase (in seconds)
      let is_on = false;
      let level = 0;
      let start_level = 0;
      let elapsed = 0;
      attack = Math.max(attack, min_time);
      decay = Math.max(decay, min_time);
      release = Math.max(release, min_time);
      let s_attack = (1 - start_level) / attack;
      let s_decay = -(1 - sustain) / decay;
      let s_release = -start_level / release;
      return (trigger: boolean): number => {
        if (trigger !== is_on) {
          // note on/off state changed
          is_on = trigger;
          start_level = level;
          s_attack = (1 - start_level) / attack;
          s_release = -start_level / release;
          elapsed = 0;
        }
        switch (is_on) {
          case true:
            level = elapsed <= attack ? s_attack * elapsed + start_level // attack phase
              : elapsed < attack + decay ? s_decay * (elapsed - attack) + 1 // decay phase
                : sustain; // sustain phase
            break;
          case false:
            level = elapsed < release ? s_release * elapsed + start_level // release phase
              : 0; // off
            break;
        }
        elapsed += Otojs.dtime;
        return level;
      };
    }, // adsr
    /**
     * Create an exponential decay envelope generator. (a rough simulation of a capacitor discharge)
     * @param decay time in seconds until the envelope decays to 1/10 of the current value.
     * @returns exponential decay envelope generator function.
     */
    exp: (decay: number) => {
      const minValue = 0.001;
      const decayRatio = Math.exp(Otojs.dtime * Math.log(0.1) / decay);
      let isOn = false;
      let level = 0;
      return (trigger: boolean): number => {
        if (trigger && !isOn) {
          level = 1;
        } else if (level < minValue) {
          level = 0;
        } else {
          level *= decayRatio;
        }
        isOn = trigger;
        return level;
      };
    }, // exp
    /**
     * Create an exponential attack+decay envelope generator. (a rough simulation of capacitor charge+discharge)
     * @param attack time in seconds until the envelope incleases x10 of the current value.
     * @param decay time in seconds until the envelope decays to 1/10 of the current value.
     * @returns linear attack + exponential decay envelope generator function.
     */
    exp_ad: (attack: number, decay: number) => {
      const minValue = 0.001;
      const attackRatio = Math.exp(Otojs.dtime * Math.log(10) / attack);
      const decayRatio = Math.exp(Otojs.dtime * Math.log(0.1) / decay);
      let isOn = false;
      let level = 0;
      let elapsed = 0;
      return (trigger: boolean): number => {
        if (trigger && !isOn) {
          elapsed = 0;
          level = 0.1;
        } else if (elapsed < attack) {
          level *= attackRatio;
        } else if (level < minValue) {
          level = 0;
        } else {
          level *= decayRatio;
        }
        isOn = trigger;
        elapsed += Otojs.dtime;
        return level;
      };
    } // exp_ad
  }, // eg

  /** controller modules */
  ctl: {
    /**
     * a portamento controller.
     * frequency and trigger come from sequencer.
     * @returns portamento frequency.
     */
    portamento: () => {
      let cv = 0;
      let isOn = false;
      return (frequency: number, trigger: boolean, time: number): number => {
        const tv = Math.log2(frequency / 261.626);
        const triggered = trigger && !isOn;
        isOn = trigger;
        if (triggered || time === 0) {
          cv = tv;
          return frequency;
        } else {
          cv = tv + (cv - tv) * Math.exp(-Otojs.dtime / time);
          return 261.626 * Math.pow(2, cv);
        }
      }
    },
    /**
     * a light-weight version of portamento controller.
     * @param time for portamento in seconds
     * @returns portamento frequency.
     */
    portamento_light: (time: number) => {
      let cf = 0;
      let isOn = false;
      let decay = Math.exp(-Otojs.dtime / time);
      return (frequency: number, trigger: boolean): number => {
        if ((trigger && !isOn) || time === 0) {
          cf = frequency;
        } else {
          cf = frequency + (cf - frequency) * decay;
        }
        isOn = trigger;
        return cf;
      }
    },
  },

  /** effect modules */
  fx: {
    /**
     * Create a reverb that multiple echos are randomly generated.
     * @param start time that first echo may comes (in seconds)
     * @param length length of echos after start (in seconds)
     * @param density a number of echoes (integer)
     * @param feedback internal feedback amount.
     * @returns reverb effect function.
     */
    reverb_random: (start: number, length: number, density: number, feedback: number) => {
      let max_samples = Math.ceil((length + start) * sample_rate);
      let buffer = new Otojs.util.RingBuffer(max_samples);
      let echoes = new Array(density);
      for (let i = 0; i < echoes.length; i++) {
        let delay_time = Math.random() * length + start;
        let delay_samples = Math.ceil(delay_time * sample_rate);
        let decay = Math.pow(1 / density, delay_time / (length + start));
        echoes[i] = [delay_samples, i % 2 == 0 ? decay : -decay];
      }
      return (input: number): number => {
        let sum = 0;
        for (let echo of echoes) {
          sum += echo[1] * buffer.get(echo[0]);
        }
        buffer.push((1 - feedback) * input + feedback * sum);
        return sum;
      };
    },
  },

  /** utility modules */
  util: {
    /** comment in english.
     * A ring buffer that allows only adding values and referencing past values (within the allocated size).
     * For performance reasons, the allocated buffer size is a power-of-two Float64Array.
     * @param size The size of the buffer to be allocated. In practice, a larger size will be allocated.
     */
    RingBuffer: class {
      buffer: Float64Array;
      cur: number;
      max: number;
      constructor(size: number) {
        let bufferSize = Math.pow(2, Math.ceil(Math.log2(size)));
        this.max = bufferSize - 1;
        this.buffer = new Float64Array(bufferSize);
        this.cur = 0;
      }
      push(value: number) {
        this.buffer[this.cur] = value;
        this.cur = (this.cur + 1) & this.max;
      }
      get(offset: number): number {
        return this.buffer[(this.cur - offset) & this.max];
      }
    },
    /**
     * Parse "note value" into ticks.
     * @param valueString a note value string like "4", "8.", "16+32", "8-16", "4+8-16", "4^8" etc.
     * @returns ticks
     */
    parseNoteValue(valueString: string): number {
      let total_length = 0;
      let adding = true; // true: +, false: -
      let number = "";
      let dots = "";
      function parse_and_flush() {
        let n = parseInt(number);
        if (isNaN(n) || n == 0) { return; }
        let length = 4 * 960 / n;
        if (dots) {
          length *= 2 - 1 / Math.pow(2, dots.length);
        }
        if (adding) {
          total_length += length;
        } else {
          total_length -= length;
        }
        number = "";
        dots = "";
      }
      for (let c of valueString) {
        if ('0' <= c && c <= '9') {
          number += c;
        } else if (c === '.') {
          dots += c;
        } else if (c === '+' || c === '^' || c === '-') {
          parse_and_flush();
          adding = c !== '-';
        }
      }
      parse_and_flush();
      return total_length;
    },
  },

  /** sequencer modules */
  seq: {
    /**
     * Create a ticker function that is called once for every frame and returns the elapsed time in ticks.
     * @param bpm
     * @param offset in ticks
     * @returns
     */
    ticker: (bpm: number, offset: number = 0) => {
      // set dticks (delta-ticks per frame)
      let dticks = (960 * bpm) / 60 / sample_rate;
      let current = offset;
      return (): number => {
        current += dticks;
        return current;
      };
    },
    /**
     * Class for MML (Music Macro Language) sequencer.
     */
    Mml: class {
      // configuration
      tune_a4: number;
      // interface of status
      frequency: number = 0;
      trigger: boolean = false;
      accent: boolean = false;
      // playback configuration
      offset: number = 0;
      loop: boolean = true;
      loop_length: number = 0;
      // internal event list
      events: { tick: number; frequency: number; trigger: boolean; accent: boolean }[] = [];
      next_index: number = 0;
      next_tick: number | undefined = undefined;
      prev_tick: number = 0;
      /**
       * Create an MML sequencer instance.
       * @param tune_a4 fine tuning of A4 in Hz (default: 440)
       */
      constructor(tune_a4: number = 440) {
        this.tune_a4 = tune_a4;
      }
      /**
       * Play the sequencer at the given tick.
       * called once per frame with tick from ticker and `.frequency` `.trigger` `.accent` are updated.
       * @param tick
       */
      play(tick: number) {
        let t = tick - this.offset;
        if (this.loop) {
          t = t % this.loop_length;
          if (t < this.prev_tick) {
            // events looped
            this.next_index = 0;
            this.next_tick = this.events.length > 0 ? this.events[0].tick : undefined;
          }
        }
        while (this.next_tick !== undefined && this.next_tick <= t) {
          let next = this.events[this.next_index];
          this.frequency = next.frequency;
          this.trigger = next.trigger;
          this.accent = next.accent;
          this.next_index++;
          this.next_tick = this.next_index < this.events.length ? this.events[this.next_index].tick : undefined;
        }
        this.prev_tick = t;
      }
      /**
       * Give MML string and parse it for play.
       * @param mml the MML string
       * @param offset in ticks if you want play the score after some delay
       * @param loop true to enable looping
       * @param loop_length in ticks if not given, the total length of the score is used
       */
      score(mml: string, offset: number | undefined = undefined, loop: boolean | undefined = undefined, loop_length: number | undefined = undefined) {
        const label_characters = "CDEFGABNRO><LQ";
        const modifier_characters = "#+-";
        const length_characters = "0123456789.+-^";
        const post_modifier_characters = "!~";
        const delimiters = "| \n\r\t";
        const number_by_label: { [key: string]: number } = { 'C': 0, 'D': 2, 'E': 4, 'F': 5, 'G': 7, 'A': 9, 'B': 11 };
        const tune_a4 = this.tune_a4;
        // musical state
        let current_tick = 0;
        let octave = 4;
        let default_length = 960; // in ticks
        let gate = 7 / 8; // gate time ratio (or ticks if gate_absolute is true)
        let gate_absolute = false; // absolute gate time mode

        // the event list
        let events: { tick: number, frequency: number, trigger: boolean, accent: boolean }[] = [];


        // parser functions
        // parse note modifier into semitone offset
        function parse_modifier(modifier_str: string) {
          let modifier = 0;
          for (let c of modifier_str) {
            if (c === '+' || c === '#') {
              modifier += 1;
            } else if (c === '-') {
              modifier -= 1;
            }
          }
          return modifier;
        }
        // parse toknized note into events and update current_tick
        function parse_note(note: { label: string, modifier: string, length: string, post: string } | undefined) {
          if (note === undefined) { return; }
          if (note.label in number_by_label || note.label === 'N') {
            let note_number;
            let length;
            if (note.label === 'N') {
              note_number = parseInt(note.length);
              if (isNaN(note_number)) {
                current_tick += default_length;
                return;
              }
              length = default_length;
            } else {
              note_number = number_by_label[note.label] + (octave + 1) * 12 + parse_modifier(note.modifier);
              length = note.length ? Otojs.util.parseNoteValue(note.length) : default_length;
            }
            let frequency = tune_a4 * Math.pow(2, (note_number - 69) / 12);
            let gate_time = gate_absolute ? gate : Math.floor(length * gate);
            let accent = note.post.includes('!');
            let legato = note.post.includes('~');
            events.push({ tick: current_tick, frequency, trigger: true, accent });
            if (!legato) {
              events.push({ tick: current_tick + gate_time, frequency, trigger: false, accent });
            }
            current_tick += length;
          } else if (note.label === 'R') {
            let length = note.length ? Otojs.util.parseNoteValue(note.length) : default_length;
            current_tick += length;
          } else if (note.label === 'O') {
            let o = parseInt(note.length);
            if (isNaN(o)) { return; }
            octave = o;
          } else if (note.label === '>') {
            octave += 1;
          } else if (note.label === '<') {
            octave -= 1;
          } else if (note.label === 'L') {
            if (note.length) {
              default_length = Otojs.util.parseNoteValue(note.length);
            }
          } else if (note.label === 'Q') {
            let g = parseFloat(note.length);
            if (isNaN(g)) { return; }
            if (note.post.includes('!')) {
              gate_absolute = true;
              if (1 <= g) {
                gate = default_length * g / 8;
              } else {
                gate = default_length * g;
              }
            } else {
              gate_absolute = false;
              if (1 <= g) {
                gate = g / 8;
              } else {
                gate = g;
              }
            }
          }
        }
        // report error
        function report_error(message: string, mml: string, position: number) {
          throw new Error(`${message} at ${position} in MML\n${mml}\n${' '.repeat(position)}^`);
        }
        // parser state
        let state = 0; // 0: label, 1: modifier, 2: length, 3: post-modifier
        let note: { label: string, modifier: string, length: string, post: string } | undefined = undefined;

        // start parsing
        for (let index = 0; index < mml.length; index++) {
          let c = mml[index].toUpperCase();
          // same letter loop （同じ文字の再評価を行うためのループ）
          while (true) {
            switch (state) {
              case 0: // input may be label
                if (label_characters.includes(c)) {
                  note = { label: c, modifier: "", length: "", post: "" };
                  state = 1;
                } else if (delimiters.includes(c)) {
                  // ignore delimiters
                } else {
                  // unexpected character
                  report_error(`Unexpected character '${c}'`, mml, index);
                }
                break;
              case 1: // input may be modifier
                if (modifier_characters.includes(c)) {
                  note!.modifier += c;
                } else if (label_characters.includes(c)) {
                  parse_note(note);
                  note = undefined;
                  state = 0;
                  continue; // re-evaluate in note state
                } else if (length_characters.includes(c)) {
                  state = 2;
                  continue; // re-evaluate in length state
                } else if (post_modifier_characters.includes(c)) {
                  state = 3;
                  continue; // re-evaluate in post-modifier state
                } else if (delimiters.includes(c)) {
                  // note is finished if delimiter found
                  parse_note(note);
                  note = undefined;
                  state = 0;
                } else {
                  // unexpected character
                  report_error(`Unexpected character '${c}'`, mml, index);
                }
                break;
              case 2: // input may be length
                if (length_characters.includes(c)) {
                  note!.length += c;
                } else if (label_characters.includes(c)) {
                  parse_note(note);
                  note = undefined;
                  state = 0;
                  continue; // re-evaluate in note state
                } else if (post_modifier_characters.includes(c)) {
                  state = 3;
                  continue; // re-evaluate in post-modifier state
                } else if (delimiters.includes(c)) {
                  // note is finished if delimiter found
                  parse_note(note);
                  note = undefined;
                  state = 0;
                } else {
                  // unexpected character
                  report_error(`Unexpected character '${c}'`, mml, index);
                }
                break;
              case 3: // input may be post-modifier
                if (post_modifier_characters.includes(c)) {
                  note!.post += c;
                } else if (label_characters.includes(c)) {
                  parse_note(note);
                  note = undefined;
                  state = 0;
                  continue; // re-evaluate in note state
                } else if (delimiters.includes(c)) {
                  // note is finished if delimiter found
                  parse_note(note);
                  note = undefined;
                  state = 0;
                } else {
                  // unexpected character
                  report_error(`Unexpected character '${c}'`, mml, index);
                }
                break;
            }
            break; // exit same letter loop
          }
        }
        if (note) {
          parse_note(note);
        }

        this.events = events;
        if (offset !== undefined) {
          this.offset = offset;
        }
        if (loop !== undefined) {
          this.loop = loop;
        }
        this.loop_length = loop_length ? loop_length : current_tick;
        this.next_index = 0;
        this.next_tick = this.events.length > 0 ? this.events[0].tick : undefined;
      } // Mml.score
    }, // Mml
    /**
     * Class for Rhythm sequencer.
     */
    Rhythm: class {
      // configuration
      #noteValue: number = 4 * 960 / 16; // in ticks
      // interface of status
      trigger: boolean[] = [];
      accent: boolean[] = [];
      // playback configuration
      offset: number = 0;
      loop: boolean = true;
      loop_length: number = 0;
      // internal event list
      events: { tick: number; trigger: boolean[]; accent: boolean[] }[] = [];
      next_index: number = 0;
      next_tick: number | undefined = undefined;
      prev_tick: number = 0;
      /**
       * Create a Rhythm sequencer instance.
       */
      constructor() { }
      /**
       * Play the sequencer at the given tick.
       * called once per frame with tick from ticker and `.frequency` `.trigger` `.accent` are updated.
       * @param tick
       */
      play(tick: number) {
        let t = tick - this.offset;
        if (this.loop) {
          t = t % this.loop_length;
          if (t < this.prev_tick) {
            // events looped
            this.next_index = 0;
            this.next_tick = this.events.length > 0 ? this.events[0].tick : undefined;
          }
        }
        while (this.next_tick !== undefined && this.next_tick <= t) {
          let next = this.events[this.next_index];
          this.trigger = next.trigger;
          this.accent = next.accent;
          this.next_index++;
          this.next_tick = this.next_index < this.events.length ? this.events[this.next_index].tick : undefined;
        }
        this.prev_tick = t;
      }
      /**
       * set note value for one step.
       */
      noteValue(noteValue: string) {
        this.#noteValue = Otojs.util.parseNoteValue(noteValue);
      }
      /**
       * set pattern for each track.
       * [-.] = rest.
       * [ox] (and lowercases) = normal note.
       * [OX] (and uppercases) = accented note.
       * [|] and spaces = delimiters.
       */
      pattern(patterns: string[], offset: number | undefined = undefined, loop: boolean | undefined = undefined, loop_length: number | undefined = undefined) {
        // parse patterns
        const noteOff: boolean[] = Array(patterns.length).fill(false);
        let columns: number[] = Array(patterns.length).fill(0);
        let current_tick = 0;
        let has_notes = true;
        let events: { tick: number; trigger: boolean[]; accent: boolean[] }[] = [];
        while (has_notes) {
          let has_trigger = false;
          let trigger: boolean[] = Array(patterns.length).fill(false);
          let accent: boolean[] = Array(patterns.length).fill(false);
          has_notes = false;
          for (let trackIndex = 0; trackIndex < patterns.length; trackIndex++) {
            let note = patterns[trackIndex][columns[trackIndex]];
            while (note == "|" || note == " " || note == "\t" || note == "\r" || note == "\n") {
              columns[trackIndex]++;
              note = patterns[trackIndex][columns[trackIndex]];
            }
            if (note === undefined) { continue; }
            has_notes = true;
            if (note === "-" || note === ".") {
              // rest
            } else if ("a" <= note && note <= "z") {
              // lowercase: normal note
              has_trigger = true;
              trigger[trackIndex] = true;
            } else if ("A" <= note && note <= "Z") {
              // uppercase: accented note
              has_trigger = true;
              trigger[trackIndex] = true;
              accent[trackIndex] = true;
            } else {
              throw new Error(`Unexpected character '${note}' in pattern at track:${trackIndex} column:${columns[trackIndex]}`);
            }
            columns[trackIndex]++;
          }
          if (has_trigger) {
            events.push({ tick: current_tick, trigger, accent });
            events.push({ tick: current_tick + 1, trigger: noteOff, accent: noteOff });
          }
          if (has_notes) {
            current_tick += this.#noteValue;
          }
        }

        this.events = events;
        if (offset !== undefined) {
          this.offset = offset;
        }
        if (loop !== undefined) {
          this.loop = loop;
        }
        this.loop_length = loop_length ? loop_length : current_tick;
        this.next_index = 0;
        this.next_tick = this.events.length > 0 ? this.events[0].tick : undefined;
      } // Rhythm.pattern
    }, // Rhythm
  }, // seq
  midi: {
    /**
     * MIDI input parser for monophonic synthesizer.
     * Usage example:
     *   var parser = new Otojs.midi.MonoParser(0, 2);
     *   parser.parse(midi_input);
     *   var synth_output = parser.velocity * oscillator(parser.frequency);
     */
    MonoParser: class {
      // MIDI channel number (0-16). 0 means any channels.
      channel: number = 0;
      bend_range: number = 2; // in semitones
      // current status
      /** current note number 0-127, -1 means no note */
      note: number = -1;
      /** current frequency in Hz (by note) */
      note_frequency: number = 0;
      /** current frequency in Hz (note + pitch bended) */
      frequency: number = 0;
      /** velocity: 0.0 - 1.0 */
      velocity: number = 0;
      /** pitch bend: -1.0 - +1.0 */
      pitchbend: number = 0;
      /** modulation wheel: 0.0 - 1.0 */
      modulation: number = 0;
      /** control changes: 0.0 - 1.0 */
      controls: Array<number> = new Array(120).fill(0);
      // internal status
      notes_stack: Array<number> = [];
      /**
       * Create a Rhythm sequencer instance.
       * @param channel MIDI channel number (0-16). 0 means any channels.
       * @param bend_range Pitch bend range in semitones.
       */
      constructor(channel: number = 0, bend_range: number = 2) {
        this.channel = channel;
        this.bend_range = bend_range;
      }
      /**
       * Parse MIDI input messages.
       * @param midi_input
       */
      parse(midi_input: Array<Uint8Array>) {
        for (let packet of midi_input) {
          // packet: Uint8Array is a Universal MIDI Packet.
          // Check: packet is MIDI 1.0 Channel Voice Message.
          if ((packet[0] & 0xf0) !== 0x20) { continue; }
          // Check: channel number.
          if (this.channel !== 0 && (packet[0] & 0x0f) !== (this.channel - 1)) { continue; }
          const event_type = packet[1] & 0xf0;
          switch (event_type) {
            case 0x90: case 0x80: // Note On or Off
              const note_number = packet[2];
              // remove note_number in notes_stack if exists
              const index = this.notes_stack.indexOf(note_number);
              if (index !== -1) {
                this.notes_stack.splice(index, 1);
              }
              if (event_type === 0x90 && packet[3] > 0) {
                // Note On - some device sends Note On with velocity 0 as Note Off
                if (this.notes_stack.length === 0) { // first pressing
                  this.velocity = packet[3] / 127;
                }
                this.notes_stack.push(note_number);
              }
              if (this.notes_stack.length > 0) {
                this.note = this.notes_stack[this.notes_stack.length - 1];
                this.note_frequency = 440 * Math.pow(2, (this.note - 69) / 12);
                this.frequency = this.note_frequency * Math.pow(2, this.bend_range * this.pitchbend / 12);
              } else {
                this.note = -1;
                this.velocity = 0;
              }
              break;
            case 0xe0: // Pitch Bend
              const bend = ((packet[3] << 7) | packet[2]) - 8192;
              this.pitchbend = bend / 8192; // -1.0 to +1.0
              this.frequency = this.note_frequency * Math.pow(2, this.bend_range * this.pitchbend / 12);
              break;
            case 0xb0: // Control Change
              if (packet[2] === 0x01) { // Modulation Wheel
                this.modulation = packet[3] / 127;
              }
              this.controls[packet[2]] = packet[3] / 127;
              break;
          }
        }
      }
    }, // MonoParser
    /**
     * MIDI input parser for controlers.
     * Usage example:
     *   var parser = new Otojs.midi.ControlParser(0);
     *   parser.parse(midi_input);
     */
    ControlParser: class {
      // MIDI channel number (0-16). 0 means any channels.
      channel: number = 0;
      enable_log: boolean = true;
      // current status
      /** control changes: 0 - 127 */
      controls: Array<number> = new Array(120).fill(0);
      // internal status
      value_for_log: Map<number, Array<number>> = new Map();
      /**
       * Create a Rhythm sequencer instance.
       * @param channel MIDI channel number (0-16). 0 means any channels.
       */
      constructor(channel: number = 0, enable_log: boolean = true) {
        this.channel = channel;
        this.enable_log = enable_log;
      }
      /**
       * Parse MIDI input messages.
       * @param midi_input
       */
      parse(midi_input: Array<Uint8Array>) {
        for (let packet of midi_input) {
          // packet: Uint8Array is a Universal MIDI Packet.
          // Check: packet is MIDI 1.0 Channel Voice Message.
          if ((packet[0] & 0xf0) !== 0x20) { continue; }
          // Check: channel number.
          if (this.channel !== 0 && (packet[0] & 0x0f) !== (this.channel - 1)) { continue; }
          const event_type = packet[1] & 0xf0;
          switch (event_type) {
            case 0xb0: // Control Change
              this.controls[packet[2]] = packet[3];
              if (this.enable_log) {
                console.log(`Control Change ${packet[2]}: ${packet[3]}`);
              }
              if (packet[3] === 0 && this.value_for_log.has(packet[2])) {
                const values = this.value_for_log.get(packet[2])!;
                console.log(`Value: ${values[0]} from control ${values.slice(1).join(", ")}`);
              }
              break;
          }
        }
      }
      /**
       * Get control value (min-max) by control number.
       * @param control_number
       * @param min
       * @param max
       * @param log_trigger the last value will be logged when value 0 received under this control number (assumed to be a button).
       */
      value(control_number: number, min: number = 0.0, max: number = 1.0, log_trigger: number = -1): number {
        const value = (max - min) * this.controls[control_number] / 127 + min;
        if (log_trigger >= 0) {
          this.value_for_log.set(log_trigger, [value, control_number]);
        }
        return value;
      }
      /**
       * Get control value (min-max) by double precision control number.
       * @param control_number_u upper 7 bits
       * @param control_number_l lower 7 bits
       * @param min
       * @param max
       * @param log_trigger the last value will be logged when value 0 received under this control number (assumed to be a button).
       */
      dvalue(control_number_u: number, control_number_l: number, min: number = 0.0, max: number = 1.0, log_trigger: number = -1): number {
        const v = (this.controls[control_number_u] << 7) | this.controls[control_number_l];
        const value = (max - min) * v / 16383 + min;
        if (log_trigger >= 0) {
          this.value_for_log.set(log_trigger, [value, control_number_u, control_number_l]);
        }
        return value;
      }
    }, // ControlParser
  }, // midi
}; // Otojs
