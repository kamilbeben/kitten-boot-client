import Stomp from 'stomp-websocket-js';

/**
 * Private methods
 */

const defaultListener = function (path, response) {
  if (this.silent) return;
  console.log('[kitten-boot-client]', `[${path}]`, response);
}

/**
 * Validates if every required property is present and in correct format
 */
const validateConstruction = function () {
  ['registerEndpoint', 'messageBrokerPrefix', 'applicationDestinationPrefix']
    .forEach(name => {
      if (typeof (this[name]) !== 'string') {
        throw `KittenBootSocket. ${name} is not a string`;
      }
      if (!this[name].startsWith('/')) {
        this[name] = '/' + this[name];
        this.log(`${name} should start with "/". Trying to fix: ${this[name]}`);
      }
    });
  
  if (/^https?:\/\//.test(this.url)) {
    this.url = this.url.replace('http', 'ws');
  } else if (!/^wss?:\/\//.test(this.url)) {
    throw `KittenBootSocket. Url must start with "ws://" (or "wss://" for secure connection).`;
  }
}

/**
 * Connects to the server
 */
const connect = function () {
  this.client = Stomp.client(`${this.url}${this.registerEndpoint}`);
  this.client.debug = null;

  this.client.connect({}, (frame) => {
    this
      .subscribe('/queue_not_found', true, this.onQueueNotFound)
      .subscribe('/queue_created', true, this.onQueueCreated)
      .subscribe('/joined_queue', true, this.onJoinedQueue)
      .subscribe('/player_joined_queue', true, this.onPlayerJoinedQueue)
      .subscribe('/player_left_queue', true, this.onPlayerLeftQueue)
      .subscribe('/room_update', true, this.onUpdate)
      .subscribe('/player_joined_room', true, this.onPlayerLeftRoom)
      .subscribe('/player_left_room', true, this.onPlayerLeftRoom)

    if (this.onConnect) {
      this.onConnect();
    }
  });
}

class KittenBootClient {
  constructor ({
    // basic settings
    url, registerEndpoint, messageBrokerPrefix, applicationDestinationPrefix,
    // listeners
    onUpdate, onQueueNotFound, onQueueCreated, onJoinedQueue, onPlayerJoinedQueue, onPlayerLeftRoom, onPlayerLeftQueue,
    // method called after connection is established
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

    this.onUpdate =             onUpdate            || defaultListener.bind(this, '/onUpdate');
    this.onQueueNotFound =      onQueueNotFound     || defaultListener.bind(this, '/onQueueNotFound');
    this.onQueueCreated =       onQueueCreated      || defaultListener.bind(this, '/onQueueCreated');
    this.onJoinedQueue =        onJoinedQueue       || defaultListener.bind(this, '/onJoinedQueue');
    this.onPlayerJoinedQueue =  onPlayerJoinedQueue || defaultListener.bind(this, '/onPlayerJoinedQueue');
    this.onPlayerLeftRoom =     onPlayerLeftRoom    || defaultListener.bind(this, '/onPlayerLeftRoom');
    this.onPlayerLeftQueue =    onPlayerLeftQueue   || defaultListener.bind(this, '/onPlayerLeftQueue');

    validateConstruction.call(this);
    connect.call(this);
  }

  log (msg) {
    if (this.silent) return;
    console.log('[kitten-boot-client]', msg);
  }

  /**
   * @param {String} _path 
   * @param {Boolean} user - defines if message is private (sent only to one connection) or public (broadcasted to everyone) 
   * @param {Function} callback 
   */
  subscribe (_path, user, callback) {
    const path = `${user ? '/user' : ''}${this.messageBrokerPrefix}${_path}`;

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

  /**
   * @param {String} path
   * @param {Object} data - payload 
   */
  send (path, data) {
    if (!path.startsWith('/')) {
      path = '/' + path;
      this.log('Path should start with \'/\'. Trying to fix: ' + path);
    }
    this.client.send(`${this.applicationDestinationPrefix}${path}`, {}, JSON.stringify(data || {}));
    return this;
  }

  joinPublicQueue() {
    return this.send('/join_public_queue');
  }

  sendUpdate(data) {
    return this.send('/room_update', data);
  }

  joinPrivateRoom(queueUuid) {
    return this.send('/join_private_room', queueUuid);
  }

  startPrivateRoom() {
    return this.send('/start_private_room');
  }
}

var _instance;
export default {
  init: args => {
    _instance = new KittenBootClient(args)
    return _instance
  },
  instance: () => _instance
}
