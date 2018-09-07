import Stomp from 'stomp-websocket-js';

export default class {
  constructor ({
    // basic settings
    url, registerEndpoint, messageBrokerPrefix, applicationDestinationPrefix,
    // listeners
    onUpdate, onQueueNotFound, onQueueCreated, onJoinedQueue, onPlayerJoinedQueue, onPlayerLeftRoom, onPlayerLeftQueue,
    // method called after connection is estabilished
    onConnect,
    // prevents any debug info
    silent
  }) {

    this.url = url;
    this.registerEndpoint = registerEndpoint;
    this.messageBrokerPrefix =  messageBrokerPrefix;
    this.applicationDestinationPrefix = applicationDestinationPrefix;

    this.onConnect = onConnect;
    this.silent = silent;

    const defaultListener = function (path, response) {
      if (!this.silent) {
        console.info(`[${path}]`, response);
      }
    };

    this.onUpdate =             onUpdate            || defaultListener.bind(this, 'onUpdate');
    this.onQueueNotFound =      onQueueNotFound     || defaultListener.bind(this, 'onQueueNotFound');
    this.onQueueCreated =       onQueueCreated      || defaultListener.bind(this, 'onQueueCreated');
    this.onJoinedQueue =        onJoinedQueue       || defaultListener.bind(this, 'onJoinedQueue');
    this.onPlayerJoinedQueue =  onPlayerJoinedQueue || defaultListener.bind(this, 'onPlayerJoinedQueue');
    this.onPlayerLeftRoom =     onPlayerLeftRoom    || defaultListener.bind(this, 'onPlayerLeftRoom');
    this.onPlayerLeftQueue =    onPlayerLeftQueue   || defaultListener.bind(this, 'onPlayerLeftQueue');

    this.validateConstruction();
    this.connect();
  }

  validateConstruction() {
    ['registerEndpoint', 'messageBrokerPrefix', 'applicationDestinationPrefix']
      .forEach(name => {
        if (typeof (this[name]) !== 'string') {
          throw `KittenBootSocket. ${name} is not a string`;
        }
        if (this[name].startsWith('/')) {
          throw `KittenBootSocket. ${name} can't start with "/"`, this[name];
        }
      });
    
    if (/^https?:\/\//.test(this.url)) {
      this.url = this.url.replace('http', 'ws');
    } else if (!/^wss?:\/\//.test(this.url)) {
      throw `KittenBootSocket. Url must start with "ws://" (or "wss://" for secure connection).`;
    }
  }

  connect () {
    this.client = Stomp.client(`${this.url}/${this.registerEndpoint}`);
    this.client.debug = null;

    this.client.connect({}, (frame) => {
      this
        .subscribe('queue_not_found', true, this.onQueueNotFound)
        .subscribe('queue_created', true, this.onQueueCreated)
        .subscribe('joined_queue', true, this.onJoinedQueue)
        .subscribe('player_joined_queue', true, this.onPlayerJoinedQueue)
        .subscribe('player_left_queue', true, this.onPlayerLeftQueue)
        .subscribe('room_update', true, this.onUpdate)
        .subscribe('player_joined_room', true, this.onPlayerLeftRoom)
        .subscribe('player_left_room', true, this.onPlayerLeftRoom)

      if (this.onConnect) {
        this.onConnect();
      }
    });
  }

  subscribe (_path, user, callback) {
    const path = `${user ? '/user' : ''}/${this.messageBrokerPrefix}/${_path}`;

    this.client.subscribe(
      path,
      (response) => {
        var body;

        try {
          // response.body is an object
          body = JSON.parse(response.body);
        } catch (error) {
          // response.body is a simple string
          body = response.body;
        }

        if (typeof (callback) === 'function') {
          callback(body);
        } else {
          throw `Callback for subscription ${path} is not a function.`;
        }
      }
    );

    return this;
  }

  send (path, data) {
    this.client.send(`/${this.applicationDestinationPrefix}/${path}`, {}, JSON.stringify(data || {}));
    return this;
  }

  joinPublicQueue() {
    return this.send('join_public_queue');
  }

  sendUpdate(data) {
    return this.send('room_update', data);
  }

  joinPrivateRoom(queueUuid) {
    return this.send('join_private_room', queueUuid);
  }

  startPrivateRoom() {
    return this.send('start_private_room');
  }
}
