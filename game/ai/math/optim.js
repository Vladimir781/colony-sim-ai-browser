export function clipGradients(grads, clipValue) {
  if (!clipValue) return grads;
  const clipSq = clipValue * clipValue;
  let totalSq = 0;
  for (let i = 0; i < grads.length; i += 1) {
    totalSq += grads[i] * grads[i];
  }
  if (totalSq > clipSq) {
    const scale = clipValue / Math.sqrt(totalSq);
    for (let i = 0; i < grads.length; i += 1) {
      grads[i] *= scale;
    }
  }
  return grads;
}

export function applyGradients(weights, grads, lr) {
  for (let i = 0; i < weights.length; i += 1) {
    weights[i] -= grads[i] * lr;
  }
}
