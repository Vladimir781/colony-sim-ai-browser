const size = 11181;
const data = new Uint8Array(size);
for (let i = 0; i < size; i += 1) {
  data[i] = (i * 73 + 97) % 255;
}
export const BRAIN_DEFAULT = data;
