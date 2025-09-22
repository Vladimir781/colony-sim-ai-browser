import { ACTION_COUNT, SYMBOL_COUNT } from '../../data/constants.js';
import { gemv, addBias } from '../math/gemv.js';
import { relu, softmax } from '../math/activations.js';

const INPUT_SIZE = 128;
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

function fillRandom(array, start = 0, end = array.length, scale = 0.08) {
  for (let i = start; i < end; i += 1) {
    array[i] = (Math.random() * 2 - 1) * scale;
  }
}

function computeParamCount(layerSizes) {
  let total = 0;
  for (let i = 0; i < layerSizes.length - 1; i += 1) {
    const rows = layerSizes[i + 1];
    const cols = layerSizes[i];
    total += rows * cols + rows;
  }
  return total;
}

export class TinyMLP {
  constructor({ weights, hiddenLayers = [64], initScale = 0.08 } = {}) {
    this.inputSize = INPUT_SIZE;
    this.outputSize = OUTPUT_SIZE;
    this.hiddenLayers = hiddenLayers.length ? [...hiddenLayers] : [64];
    this.layerSizes = [INPUT_SIZE, ...this.hiddenLayers, OUTPUT_SIZE];
    this.layerCount = this.layerSizes.length - 1;
    const paramCount = computeParamCount(this.layerSizes);

    const params = new Float32Array(paramCount);
    if (weights) {
      const source = weights instanceof Float32Array ? weights : decodeWeights(weights);
      const copyLength = Math.min(source.length, params.length);
      params.set(source.subarray(0, copyLength));
      if (copyLength < params.length) {
        fillRandom(params, copyLength, params.length, initScale);
      }
    } else {
      fillRandom(params, 0, params.length, initScale);
    }

    this.params = params;
    this.weights = [];
    this.biases = [];

    let offset = 0;
    for (let layerIndex = 0; layerIndex < this.layerCount; layerIndex += 1) {
      const rows = this.layerSizes[layerIndex + 1];
      const cols = this.layerSizes[layerIndex];
      const weightSize = rows * cols;
      this.weights.push(
        new Float32Array(this.params.buffer, this.params.byteOffset + offset * 4, weightSize),
      );
      offset += weightSize;
      const biasSize = rows;
      this.biases.push(
        new Float32Array(this.params.buffer, this.params.byteOffset + offset * 4, biasSize),
      );
      offset += biasSize;
    }

    this.outputBuffer = new Float32Array(OUTPUT_SIZE);
    this.cache = null;
  }

  forward(input) {
    const activations = new Array(this.layerCount + 1);
    activations[0] = Float32Array.from(input);
    const linear = new Array(this.layerCount);
    let current = Float32Array.from(input);

    for (let layerIndex = 0; layerIndex < this.layerCount; layerIndex += 1) {
      const rows = this.layerSizes[layerIndex + 1];
      const cols = this.layerSizes[layerIndex];
      const z = new Float32Array(rows);
      gemv(z, this.weights[layerIndex], rows, cols, current);
      addBias(z, this.biases[layerIndex]);
      linear[layerIndex] = Float32Array.from(z);
      if (layerIndex < this.layerCount - 1) {
        relu(z);
      }
      current = z;
      activations[layerIndex + 1] = Float32Array.from(z);
    }

    this.outputBuffer.set(current);
    const actionSlice = this.outputBuffer.subarray(0, ACTION_COUNT);
    const symbolSlice = this.outputBuffer.subarray(ACTION_COUNT, ACTION_COUNT + SYMBOL_COUNT);
    const baseline = this.outputBuffer[OUTPUT_SIZE - 1];

    const actionProbs = Float32Array.from(actionSlice);
    softmax(actionProbs);
    const symbolProbs = Float32Array.from(symbolSlice);
    softmax(symbolProbs);

    this.cache = {
      activations,
      linear,
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
    const { activations, linear, actionProbs, symbolProbs, baseline } = this.cache;
    const gradWeights = this.weights.map((w) => new Float32Array(w.length));
    const gradBiases = this.biases.map((b) => new Float32Array(b.length));
    const deltas = new Array(this.layerCount);

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
    gradOutput[OUTPUT_SIZE - 1] = baseline - targetValue;

    deltas[this.layerCount - 1] = gradOutput;

    for (let layerIndex = this.layerCount - 1; layerIndex >= 0; layerIndex -= 1) {
      const rows = this.layerSizes[layerIndex + 1];
      const cols = this.layerSizes[layerIndex];
      const delta = deltas[layerIndex];
      const gradW = gradWeights[layerIndex];
      const gradB = gradBiases[layerIndex];
      const prevActivation = activations[layerIndex];

      for (let r = 0; r < rows; r += 1) {
        const d = delta[r];
        gradB[r] += d;
        for (let c = 0; c < cols; c += 1) {
          gradW[r * cols + c] += d * prevActivation[c];
        }
      }

      if (layerIndex > 0) {
        const prevDelta = new Float32Array(cols);
        const weight = this.weights[layerIndex];
        for (let c = 0; c < cols; c += 1) {
          let sum = 0;
          for (let r = 0; r < rows; r += 1) {
            sum += weight[r * cols + c] * delta[r];
          }
          prevDelta[c] = sum;
        }
        const preActivation = linear[layerIndex - 1];
        for (let c = 0; c < cols; c += 1) {
          if (preActivation[c] <= 0) {
            prevDelta[c] = 0;
          }
        }
        deltas[layerIndex - 1] = prevDelta;
      }
    }

    const grad = new Float32Array(this.params.length);
    let offset = 0;
    for (let layerIndex = 0; layerIndex < this.layerCount; layerIndex += 1) {
      grad.set(gradWeights[layerIndex], offset);
      offset += gradWeights[layerIndex].length;
      grad.set(gradBiases[layerIndex], offset);
      offset += gradBiases[layerIndex].length;
    }
    return grad;
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
  return new TinyMLP({ weights: bytes, hiddenLayers: [64] });
}

export function createTinyMLPRandom({ hiddenLayers = [64], initScale } = {}) {
  return new TinyMLP({ hiddenLayers, initScale });
}

export function createTinyMLPWide() {
  return new TinyMLP({ hiddenLayers: [96], initScale: 0.06 });
}

export function createTinyMLPDeep() {
  return new TinyMLP({ hiddenLayers: [96, 64], initScale: 0.05 });
}

export function createTinyMLPUltra() {
  return new TinyMLP({ hiddenLayers: [256, 192, 128], initScale: 0.04 });
}

export const TINY_MLP_META = {
  inputSize: INPUT_SIZE,
  hiddenLayers: [64],
  outputSize: OUTPUT_SIZE,
};

