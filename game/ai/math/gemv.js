export function gemv(output, matrix, rows, cols, vector) {
  for (let r = 0; r < rows; r += 1) {
    let sum = 0;
    for (let c = 0; c < cols; c += 1) {
      sum += matrix[r * cols + c] * vector[c];
    }
    output[r] = sum;
  }
  return output;
}

export function addBias(vector, bias) {
  for (let i = 0; i < vector.length; i += 1) {
    vector[i] += bias[i];
  }
  return vector;
}
