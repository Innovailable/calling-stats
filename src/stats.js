const { Counter, Gauge, Histogram, exponentialBuckets, Registry } = require('prom-client');

function startTimer() {
  // TODO move to monotone time
  const start = Date.now();

  return () => {
    return (Date.now() - start) / 1000;
  };
}

function peakCount(obj) {
  let max = 0;

  const update = (obj) => {
    max = Math.max(Object.keys(obj).length, max);
  };

  const get = () => {
    return max;
  };

  update(obj);

  return [get, update];
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

class SignalingStatistics {
  constructor(signaling) {
    this.registry = new Registry();
    this.signaling = signaling;

    this.setupServer();

    if(signaling.rooms != null) {
      this.setupRooms();
    }

    if(signaling.registry != null) {
      this.setupRegistry();
    }
  }

  setupServer() {
    this.userCount = new Counter({
      name: 'calling_user_count',
      help: 'Amount of users that join',
      registers: [this.registry],
    });

    this.userConcurrent = new Gauge({
      name: 'calling_user_concurrent',
      help: 'Amount of concurrent users',
      registers: [this.registry],
    });

    this.userDuration = new Histogram({
      name: 'calling_user_duration',
      help: 'Time user was connected',
      buckets: timeBuckets,
      registers: [this.registry],
    });

    this.signaling.on('new_user', (user) => {
      this.handleUser(user);
    });
  }

  setupRooms() {
    this.roomCount = new Counter({
      name: 'calling_room_count',
      help: 'Amount of rooms created',
      registers: [this.registry],
    });

    this.roomConcurrent = new Gauge({
      name: 'calling_room_concurrent',
      help: 'Amount of concurrent rooms',
      registers: [this.registry],
    });

    this.roomDuration = new Histogram({
      name: 'calling_room_duration',
      help: 'Time room was active',
      buckets: timeBuckets,
      registers: [this.registry],
    });

    this.roomPeak = new Histogram({
      name: 'calling_room_members_peak',
      help: 'Peak amount of room members',
      buckets: [1, 2, 3, 4, 5, 6, 7, 8, 10, 14, 22],
      registers: [this.registry],
    });

    this.signaling.rooms.on('new_room', (room) => {
      this.handleRoom(room);
    });
  }

  setupRegistry() {
    this.namespaceCount = new Counter({
      name: 'calling_namespace_count',
      help: 'Amount of namespaces created',
      registers: [this.registry],
    });

    this.namespaceConcurrent = new Gauge({
      name: 'calling_namespace_concurrent',
      help: 'Amount of concurrent namespaces',
      registers: [this.registry],
    });

    this.namespaceDuration = new Histogram({
      name: 'calling_namespace_duration',
      help: 'Time namespace was active',
      buckets: timeBuckets,
      registers: [this.registry],
    });

    this.namespaceSubscribePeak = new Histogram({
      name: 'calling_namespace_subscribe_peak',
      help: 'Peak amount of namespace subscribed users',
      buckets: exponentialBuckets(1, 2, 12),
      registers: [this.registry],
    });

    this.namespaceRegisterPeak = new Histogram({
      name: 'calling_namespace_register_peak',
      help: 'Peak amount of namespace registered users',
      buckets: exponentialBuckets(1, 2, 12),
      registers: [this.registry],
    });

    this.namespaceRoomPeak = new Histogram({
      name: 'calling_namespace_room_peak',
      help: 'Peak amount of namespace registered rooms',
      buckets: exponentialBuckets(1, 2, 12),
      registers: [this.registry],
    });

    this.signaling.registry.on('new_namespace', (ns) => {
      this.handleNamespace(ns);
    });
  }

  handleUser(user) {
    const timer = startTimer();

    this.userCount.inc();
    this.userConcurrent.inc();

    user.once('left', () => {
      this.userConcurrent.dec();
      this.userDuration.observe(timer());
    });
  }

  handleRoom(room) {
    const timer = startTimer();
    const [getPeak, updatePeak] = peakCount(room.peers);

    room.on('peers_changed', updatePeak);

    this.roomCount.inc();
    this.roomConcurrent.inc();

    room.once('closed', () => {
      this.roomConcurrent.dec();
      this.roomDuration.observe(timer());
      this.roomPeak.observe(getPeak());

      room.removeListener('peers_changed', updatePeak);
    });
  }

  handleNamespace(ns) {
    const timer = startTimer();
    const [getSubscribePeak, updateSubscribePeak] = peakCount(ns.subscribed);
    const [getRegisterPeak, updateRegisterPeak] = peakCount(ns.registered);
    const [getRoomPeak, updateRoomPeak] = peakCount(ns.rooms);

    room.on('subscribed_changed', updateSubscribePeak);
    room.on('registered_changed', updateRegisterPeak);
    room.on('rooms_changed', updateRoomsPeak);

    this.namespaceCount.inc();
    this.namespaceConcurrent.inc();

    ns.once('closed', () => {
      this.namespaceConcurrent.dec();
      this.namespaceDuration.observe(timer());
      this.namespaceSubscribePeak.observe(getSubscribePeak);
      this.namespaceRegisterPeak.observe(getRegisterPeak);
      this.namespaceRoomPeak.observe(getRoomPeak);

      room.removeListener('subscribed_changed', updateSubscribePeak);
      room.removeListener('registered_changed', updateRegisterPeak);
      room.removeListener('rooms_changed', updateRoomsPeak);
    });
  }

  addMetricsRoute(app, path='/metrics') {
    app.get(path, (req, res) => {
      res.set('Content-Type', this.registry.contentType)
      res.end(this.registry.metrics())
    });
  }
}

module.exports = {
  SignalingStatistics,
}
