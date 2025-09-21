export function seededRandom(seed = 1) {
  let value = seed % 2147483647;
  if (value <= 0) value += 2147483646;
  return function random() {
    value = (value * 16807) % 2147483647;
    return (value - 1) / 2147483646;
  };
}

export function shuffle(array, rand = Math.random) {
  for (let i = array.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rand() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

export function randomChoice(array, rand = Math.random) {
  return array[Math.floor(rand() * array.length)];
}
