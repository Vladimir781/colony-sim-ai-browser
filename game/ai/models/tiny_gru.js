import { ACTION_COUNT, SYMBOL_COUNT } from '../../data/constants.js';
import { gemv, addBias } from '../math/gemv.js';
import { softmax, tanh } from '../math/activations.js';

const INPUT_SIZE = 128;
const HIDDEN_SIZE = 64;
const OUTPUT_SIZE = ACTION_COUNT + SYMBOL_COUNT + 1;

function sigmoid(vector) {
  for (let i = 0; i < vector.length; i += 1) {
    vector[i] = 1 / (1 + Math.exp(-vector[i]));
  }
  return vector;
}

function decodeWeights(uint8) {
  const scale = 1 / 128;
  const offset = -1;
  const float32 = new Float32Array(uint8.length);
  for (let i = 0; i < uint8.length; i += 1) {
    float32[i] = uint8[i] * scale + offset;
  }
  return float32;
}

export class TinyGRU {
  constructor({ weights }) {
    const params = weights instanceof Float32Array ? weights : decodeWeights(weights);
    let cursor = 0;
    const gateSize = HIDDEN_SIZE * INPUT_SIZE;
    const recurSize = HIDDEN_SIZE * HIDDEN_SIZE;
    const biasSize = HIDDEN_SIZE;

    this.wz = params.subarray(cursor, cursor + gateSize);
    cursor += gateSize;
    this.uz = params.subarray(cursor, cursor + recurSize);
    cursor += recurSize;
    this.bz = params.subarray(cursor, cursor + biasSize);
    cursor += biasSize;

    this.wr = params.subarray(cursor, cursor + gateSize);
    cursor += gateSize;
    this.ur = params.subarray(cursor, cursor + recurSize);
    cursor += recurSize;
    this.br = params.subarray(cursor, cursor + biasSize);
    cursor += biasSize;

    this.wh = params.subarray(cursor, cursor + gateSize);
    cursor += gateSize;
    this.uh = params.subarray(cursor, cursor + recurSize);
    cursor += recurSize;
    this.bh = params.subarray(cursor, cursor + biasSize);
    cursor += biasSize;

    const w2Size = OUTPUT_SIZE * HIDDEN_SIZE;
    this.w2 = params.subarray(cursor, cursor + w2Size);
    cursor += w2Size;
    const b2Size = OUTPUT_SIZE;
    this.b2 = params.subarray(cursor, cursor + b2Size);

    this.params = params;
    this.hiddenState = new Float32Array(HIDDEN_SIZE);
    this.tmp1 = new Float32Array(HIDDEN_SIZE);
    this.tmp2 = new Float32Array(HIDDEN_SIZE);
    this.output = new Float32Array(OUTPUT_SIZE);
    this.cache = null;
  }

  reset() {
    this.hiddenState.fill(0);
  }

  forward(input) {
    const z = this.tmp1;
    const r = this.tmp2;
    gemv(z, this.wz, HIDDEN_SIZE, INPUT_SIZE, input);
    addBias(z, this.bz);
    for (let i = 0; i < HIDDEN_SIZE; i += 1) {
      let sum = z[i];
      for (let h = 0; h < HIDDEN_SIZE; h += 1) {
        sum += this.uz[i * HIDDEN_SIZE + h] * this.hiddenState[h];
      }
      z[i] = sum;
    }
    sigmoid(z);

    gemv(r, this.wr, HIDDEN_SIZE, INPUT_SIZE, input);
    addBias(r, this.br);
    for (let i = 0; i < HIDDEN_SIZE; i += 1) {
      let sum = r[i];
      for (let h = 0; h < HIDDEN_SIZE; h += 1) {
        sum += this.ur[i * HIDDEN_SIZE + h] * this.hiddenState[h];
      }
      r[i] = sum;
    }
    sigmoid(r);

    const hHat = new Float32Array(HIDDEN_SIZE);
    gemv(hHat, this.wh, HIDDEN_SIZE, INPUT_SIZE, input);
    addBias(hHat, this.bh);
    for (let i = 0; i < HIDDEN_SIZE; i += 1) {
      let sum = hHat[i];
      for (let h = 0; h < HIDDEN_SIZE; h += 1) {
        sum += this.uh[i * HIDDEN_SIZE + h] * (r[h] * this.hiddenState[h]);
      }
      hHat[i] = sum;
    }
    tanh(hHat);

    for (let i = 0; i < HIDDEN_SIZE; i += 1) {
      this.hiddenState[i] = z[i] * this.hiddenState[i] + (1 - z[i]) * hHat[i];
    }

    gemv(this.output, this.w2, OUTPUT_SIZE, HIDDEN_SIZE, this.hiddenState);
    addBias(this.output, this.b2);

    const actionSlice = this.output.subarray(0, ACTION_COUNT);
    const symbolSlice = this.output.subarray(ACTION_COUNT, ACTION_COUNT + SYMBOL_COUNT);
    const baseline = this.output[OUTPUT_SIZE - 1];

    const actionProbs = Float32Array.from(actionSlice);
    softmax(actionProbs);
    const symbolProbs = Float32Array.from(symbolSlice);
    softmax(symbolProbs);

    this.cache = {
      input: Float32Array.from(input),
      hidden: Float32Array.from(this.hiddenState),
      actionProbs,
      symbolProbs,
      baseline,
    };

    return {
      actionProbs,
      symbolProbs,
      baseline,
    };
  }

  computeGradients() {
    return new Float32Array(this.params.length);
  }

  serialize() {
    return new Float32Array(this.params);
  }

  loadWeights(array) {
    if (!array || array.length !== this.params.length) return;
    this.params.set(array);
  }
}


