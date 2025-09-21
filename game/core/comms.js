import { SYMBOL_COUNT } from '../data/constants.js';

export class CommunicationsChannel {
  constructor({ alphabet, cost = 0.1 }) {
    this.alphabet = alphabet.slice(0, SYMBOL_COUNT);
    this.cost = cost;
    this.log = [];
  }

  send(agentId, symbols) {
    const payload = symbols.join('');
    this.log.push({ time: Date.now(), agentId, message: payload });
    if (this.log.length > 200) {
      this.log.shift();
    }
    return this.cost * symbols.length;
  }

  recent(limit = 20) {
    return this.log.slice(-limit);
  }
}
