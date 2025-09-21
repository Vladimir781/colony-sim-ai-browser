export function relu(vector) {
  for (let i = 0; i < vector.length; i += 1) {
    vector[i] = Math.max(0, vector[i]);
  }
  return vector;
}

export function tanh(vector) {
  for (let i = 0; i < vector.length; i += 1) {
    vector[i] = Math.tanh(vector[i]);
  }
  return vector;
}

export function softmax(vector) {
  let max = -Infinity;
  for (let i = 0; i < vector.length; i += 1) {
    if (vector[i] > max) max = vector[i];
  }
  let sum = 0;
  for (let i = 0; i < vector.length; i += 1) {
    const v = Math.exp(vector[i] - max);
    vector[i] = v;
    sum += v;
  }
  for (let i = 0; i < vector.length; i += 1) {
    vector[i] /= sum || 1;
  }
  return vector;
}
