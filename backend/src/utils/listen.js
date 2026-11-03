'use strict';

// Express 5 forwards listen errors to its callback. Resolve only after the
// socket is bound so startup failures cannot be logged as successful starts.
function listen(app, port) {
  return new Promise((resolve, reject) => {
    const server = app.listen(port, (error) => {
      if (error) return reject(error);
      resolve(server);
    });
  });
}

module.exports = listen;
