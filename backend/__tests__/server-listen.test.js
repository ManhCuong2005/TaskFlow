'use strict';
const express = require('express');
const http = require('node:http');
const listen = require('../src/utils/listen');

function close(server) {
  return new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
}

test('rejects startup when the port is occupied instead of reporting a successful start', async () => {
  const existing = http.createServer();
  await new Promise(resolve => existing.listen(0, resolve));
  try {
    await expect(listen(express(), existing.address().port)).rejects.toMatchObject({ code: 'EADDRINUSE' });
    expect(existing.listening).toBe(true);
  } finally {
    await close(existing);
  }
});

test('resolves only after the server is listening and can accept requests', async () => {
  const app = express();
  app.get('/ready', (req, res) => res.json({ ready: true }));
  const server = await listen(app, 0);
  try {
    expect(server.listening).toBe(true);
    const response = await fetch(`http://localhost:${server.address().port}/ready`);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ready: true });
  } finally {
    server.closeIdleConnections();
    await close(server);
  }
});
