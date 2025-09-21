import { clipGradients, applyGradients } from '../math/optim.js';

export class ReinforceLearner {
  constructor({ learningRate = 0.0005, gamma = 0.95, gradientClip = 5 } = {}) {
    this.learningRate = learningRate;
    this.gamma = gamma;
    this.gradientClip = gradientClip;
  }

  /**
   * @param {Float32Array} weights
   * @param {Float32Array[]} gradients
   */
  update(weights, gradients) {
    const avgGrad = new Float32Array(weights.length);
    for (const grad of gradients) {
      for (let i = 0; i < grad.length; i += 1) {
        avgGrad[i] += grad[i];
      }
    }
    if (gradients.length) {
      const scale = 1 / gradients.length;
      for (let i = 0; i < avgGrad.length; i += 1) {
        avgGrad[i] *= scale;
      }
    }
    clipGradients(avgGrad, this.gradientClip);
    applyGradients(weights, avgGrad, this.learningRate);
  }

  computeReturns(rewards) {
    const returns = new Array(rewards.length);
    let next = 0;
    for (let i = rewards.length - 1; i >= 0; i -= 1) {
      next = rewards[i] + this.gamma * next;
      returns[i] = next;
    }
    return returns;
  }
}
