const { Counter, Gauge, Histogram, register } = require('prom-client');

function startTimer() {
  // TODO move to monotone time
  const start = Date.now();

  return () => {
    return (Date.now() - start) / 1000;
  };
}

const timeBuckets = [
  10,
  30,
  60,
  2 * 60,
  5 * 60,
  10 * 10,
  20 * 60,
  30 * 60,
  45 * 60,
  60 * 60,
  90 * 60,
  120 * 60,
  3 * 60 * 60,
  4 * 60 * 60,
  6 * 60 * 60,
  8 * 60 * 60,
  12 * 60 * 60,
];

const userCount = new Counter({
  name: 'user_count',
  help: 'Amount of users that join',
});

const userConcurrent = new Gauge({
  name: 'user_concurrent',
  help: 'Amount of concurrent users',
});

const userDuration = new Histogram({
  name: 'user_duration',
  help: 'Time user was connected',
  buckets: timeBuckets,
});

const roomCount = new Counter({
  name: 'room_count',
  help: 'Amount of rooms created',
});

const roomConcurrent = new Gauge({
  name: 'room_concurrent',
  help: 'Amount of concurrent rooms',
});

const roomDuration = new Histogram({
  name: 'room_duration',
  help: 'Time room was active',
  buckets: timeBuckets,
});

const namespaceCount = new Counter({
  name: 'namespace_count',
  help: 'Amount of namespaces created',
});

const namespaceConcurrent = new Gauge({
  name: 'namespace_concurrent',
  help: 'Amount of concurrent namespaces',
});

const namespaceDuration = new Histogram({
  name: 'namespace_duration',
  help: 'Time namespace was active',
  buckets: timeBuckets,
});

function trackSignaling(signaling) {
  signaling.on('new_user', (user) => {
    const timer = startTimer();

    userCount.inc();
    userConcurrent.inc();

    user.once('left', () => {
      userConcurrent.dec();
      userDuration.observe(timer());
    });
  });

  signaling.rooms.on('new_room', (room) => {
    const timer = startTimer();

    roomCount.inc();
    roomConcurrent.inc();

    room.once('closed', () => {
      roomConcurrent.dec();
      roomDuration.observe(timer());
    });
  });

  signaling.registry.on('new_namespace', (ns) => {
    const timer = startTimer();

    namespaceCount.inc();
    namespaceConcurrent.inc();

    ns.once('closed', () => {
      namespaceConcurrent.dec();
      namespaceDuration.observe(timer());
    });
  });
};

function addMetricsRoute(app, path='/metrics') {
  app.get(path, (req, res) => {
    res.set('Content-Type', register.contentType)
    res.end(register.metrics())
  });
}

module.exports = {
  trackSignaling,
  addMetricsRoute,
}
