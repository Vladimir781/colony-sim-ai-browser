import { ACTION_COUNT, SYMBOL_COUNT } from '../../data/constants.js';
import { gemv, addBias } from '../math/gemv.js';
import { relu, softmax } from '../math/activations.js';

const INPUT_SIZE = 128;
const HIDDEN_SIZE = 64;
const OUTPUT_SIZE = ACTION_COUNT + SYMBOL_COUNT + 1;

function decodeWeights(uint8) {
  const scale = 1 / 128;
  const offset = -1;
  const float32 = new Float32Array(uint8.length);
  for (let i = 0; i < uint8.length; i += 1) {
    float32[i] = uint8[i] * scale + offset;
  }
  return float32;
}

export class TinyMLP {
  constructor({ weights }) {
    const params = weights instanceof Float32Array ? weights : decodeWeights(weights);
    const w1Size = INPUT_SIZE * HIDDEN_SIZE;
    const b1Size = HIDDEN_SIZE;
    const w2Size = OUTPUT_SIZE * HIDDEN_SIZE;
    const b2Size = OUTPUT_SIZE;

    this.w1 = new Float32Array(params.buffer, params.byteOffset, w1Size);
    this.b1 = new Float32Array(params.buffer, params.byteOffset + w1Size * 4, b1Size);
    this.w2 = new Float32Array(
      params.buffer,
      params.byteOffset + (w1Size + b1Size) * 4,
      w2Size,
    );
    this.b2 = new Float32Array(
      params.buffer,
      params.byteOffset + (w1Size + b1Size + w2Size) * 4,
      b2Size,
    );

    this.params = params;
    this.hidden = new Float32Array(HIDDEN_SIZE);
    this.output = new Float32Array(OUTPUT_SIZE);
    this.cache = null;
  }

  forward(input) {
    const hidden = this.hidden;
    gemv(hidden, this.w1, HIDDEN_SIZE, INPUT_SIZE, input);
    addBias(hidden, this.b1);
    relu(hidden);

    gemv(this.output, this.w2, OUTPUT_SIZE, HIDDEN_SIZE, hidden);
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
      hidden: Float32Array.from(hidden),
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

  computeGradients({ actionIndex, symbolIndex, advantage, targetValue }) {
    if (!this.cache) return new Float32Array(this.params.length);
    const { input, hidden, actionProbs, symbolProbs, baseline } = this.cache;
    const gradW1 = new Float32Array(this.w1.length);
    const gradB1 = new Float32Array(this.b1.length);
    const gradW2 = new Float32Array(this.w2.length);
    const gradB2 = new Float32Array(this.b2.length);

    const gradOutput = new Float32Array(OUTPUT_SIZE);
    for (let i = 0; i < ACTION_COUNT; i += 1) {
      let g = -actionProbs[i];
      if (i === actionIndex) g += 1;
      gradOutput[i] = g * advantage;
    }
    for (let i = 0; i < SYMBOL_COUNT; i += 1) {
      let g = -symbolProbs[i];
      if (i === symbolIndex) g += 1;
      gradOutput[ACTION_COUNT + i] = g * advantage;
    }
    const valueError = baseline - targetValue;
    gradOutput[OUTPUT_SIZE - 1] = valueError;

    for (let o = 0; o < OUTPUT_SIZE; o += 1) {
      const go = gradOutput[o];
      gradB2[o] += go;
      for (let h = 0; h < HIDDEN_SIZE; h += 1) {
        gradW2[o * HIDDEN_SIZE + h] += go * hidden[h];
      }
    }

    const gradHidden = new Float32Array(HIDDEN_SIZE);
    for (let o = 0; o < OUTPUT_SIZE; o += 1) {
      const go = gradOutput[o];
      for (let h = 0; h < HIDDEN_SIZE; h += 1) {
        gradHidden[h] += this.w2[o * HIDDEN_SIZE + h] * go;
      }
    }

    for (let h = 0; h < HIDDEN_SIZE; h += 1) {
      if (hidden[h] <= 0) {
        gradHidden[h] = 0;
      }
    }

    for (let h = 0; h < HIDDEN_SIZE; h += 1) {
      const gh = gradHidden[h];
      gradB1[h] += gh;
      for (let i = 0; i < INPUT_SIZE; i += 1) {
        gradW1[h * INPUT_SIZE + i] += gh * input[i];
      }
    }

    const grad = new Float32Array(this.params.length);
    grad.set(gradW1, 0);
    grad.set(gradB1, gradW1.length);
    grad.set(gradW2, gradW1.length + gradB1.length);
    grad.set(gradB2, gradW1.length + gradB1.length + gradW2.length);
    return grad;
  }

  applyGradients(grad, lr) {
    for (let i = 0; i < this.params.length; i += 1) {
      this.params[i] -= grad[i] * lr;
    }
  }

  serialize() {
    return new Float32Array(this.params);
  }

  loadWeights(array) {
    if (!array || array.length !== this.params.length) return;
    this.params.set(array);
  }
}

export function createTinyMLPFromBytes(bytes) {
  return new TinyMLP({ weights: bytes });
}

export const TINY_MLP_META = {
  inputSize: INPUT_SIZE,
  hiddenSize: HIDDEN_SIZE,
  outputSize: OUTPUT_SIZE,
};

