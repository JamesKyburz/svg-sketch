var copy  = require('shallow-copy');
var xtend = require('xtend');
var Color = require('color');

module.exports = EventStream;

EventStream.validEvent = validEvent;

function EventStream() {
  if (!(this instanceof EventStream)) return new EventStream();
  this.events = [];
}

EventStream.prototype.push = function push(event) {
  var value = this.events.push(event);
  return value;
};

EventStream.prototype.pop = function pop() {
  var value = this.events.pop();
  return value;
};

EventStream.prototype.toJSON = function toJSON() {
  var self = this;
  var lastType;
  this.normalized = this.events.map(createEvent);
  this.normalized.forEach(processPath);

  return this.normalized.reduce(
    reduce,
    []
  );

  function createEvent(event) {
    var args = copy(event.args);
    if (args) {
      ;['stroke', 'fill'].forEach(function setRgb(key) {
        if (args[key]) args[key] = Color(args[key]).rgbaString();
      });
    }
    return {
      type: event.type,
      id: event.id,
      args: args,
      layout: event.layout,
      pathId: event.path ? event.path.id : undefined
    };
  }

  function processPath(event) {
    if (event.pathId) {
      var path = self.normalized.filter(findById)[0];
      if (path) {
        event.deleted = true;
        path.args = xtend(path.args, event.args);
        path.deleted = event.type === 'delete';
      }
    }

    function findById(e) {
      return e.id === event.pathId;
    }
  }

  function reduce(result, event) {
    if (event.type === 'style' && lastType === 'style') result.pop();
    if (validEvent(event)) {
      lastType = event.type;
      result.push(
        ['type', 'args', 'layout'].reduce(copyEvent, {})
      );
      return result;
    }

    function copyEvent(result, key) {
      if (event[key]) {
        result[key] = event[key];
      }
      return result;
    }
    return result;
  }
};

function validEvent(event) {
  if (event.deleted) return false;

  if (event.type === 'text') {
    return !!event.args.value;
  }

  if (event.type === 'path') {
    return !!event.args.d.match(/a|l/i);
  }

  return Object.keys(event.args || {}).length +
         Object.keys(event.layout || {}).length > 0
  ;
}
