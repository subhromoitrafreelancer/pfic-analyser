'use strict';

function createSemaphore(max) {
  let running = 0;
  const queue = [];

  return async function limit(fn) {
    if (running >= max) {
      await new Promise(resolve => queue.push(resolve));
    }
    running++;
    try {
      return await fn();
    } finally {
      running--;
      if (queue.length > 0) queue.shift()();
    }
  };
}

module.exports = { createSemaphore };
