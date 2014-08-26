var hyperglue    = require('hyperglue');
var EventEmitter = require('events').EventEmitter;
var inherits     = require('inherits');
var debugEvents  = require('./debug_events');
var EventStream  = require('./event_stream');
var copy         = require('shallow-copy');
var xtend        = require('xtend');
var fs           = require('fs');
var insertCss    = require('insert-css');

var idSequence = 0;

module.exports = Svg;
inherits(Svg, EventEmitter);

function Svg() {
  if (!(this instanceof Svg)) return new Svg();

  this.idSequence = ++idSequence;

  insertCss(fs.readFileSync(__dirname + '/style.css', 'utf-8'));
  this.html = fs.readFileSync(__dirname + '/index.html', 'utf-8');

  this.DEFAULT_STYLE = {
    fill: 'transparent',
    stroke: '#000000'
  };

  this._resetStyle();

  this.fonts = {
    'default': {
      'font-family': 'Arial',
      'letter-spacing': 0,
      'font-weight': 'normal',
    }
  };

  this.fonts.Normal = xtend(this.fonts.default, {
      'font-size': 11,
      'letter-spacing': 0,
  });

  this.fonts.Heading = xtend(this.fonts.default, {
      'font-size': 22,
      'font-weight': 'bold',
      'letter-spacing': 0,
  });

  this.font = copy(this.fonts['default']);

  this.deleted = [];

  this.listeners = {
    'mousedown': this._down.bind(this),
    'touchstart': this._down.bind(this),
    'mouseup': this._up.bind(this),
    'touchend': this._up.bind(this),
    'mousemove': this._move.bind(this),
    'touchmove': this._move.bind(this)
  };

  this.eventStream = new EventStream();
}

Svg.prototype.appendTo = function appendTo(el) {
  if (this.el) return this;

  this.el = el.appendChild(hyperglue(this.html, {
    '#grid': {
      'id': 'grid-' + this.idSequence
    },
    '.grid': {
      'fill': 'url(#grid-' + this.idSequence + ')'
    },
    '#smallGrid': {
      'id': 'smallGrid-' + this.idSequence
    },
    '.smallGrid': {
      'fill': 'url(#smallGrid-' + this.idSequence + ')'
    }
  })).children[0];

  this.controls = {};

  this._eventListeners('addEventListener');

  return this;
};

Svg.prototype.registerControl = function(name, instance) {
  var self = this;

  if (!instance || 'undefined' === instance.emit) return;

  self.controls[name] = instance;

  var control = self.controls[name];

  if (!control.on) return;

  control.on('createEvent', createEvent);
  control.on('updateEvent', updateEvent);
  control.on('deletePath', deletePath);
  control.on('closeToPath', self._pathSelected.bind(self));

  function createEvent(event) {
    self.eventStream.push(event);
    self._redraw([event]);
  }

  function updateEvent(event) {
    self._redraw([event]);
  }

  function deletePath(opt) {
    self.eventStream.push({
      type: 'delete',
      target: opt.target,
      args: {},
      path: opt.path
    });
    self._redraw(self.eventStream.events.slice(-1));
  }
};

Svg.prototype.remove = function remove() {
  if (!this.el) return;
  var el = this.el.parentNode;
  this._eventListeners('removeEventListener');
  el.parentNode.removeChild(el);
  this.el = null;
};

Svg.prototype._triggerEventsChanged = function trigger() {
  if (trigger.timer) {
    clearTimeout(trigger.timer);
    trigger.timer = null;
  }
  debugEvents(this.eventStream);
  trigger.timer = setTimeout(function() {
    this.emit('eventStream', this.eventStream.toJSON());
  }.bind(this), 300);
};

Svg.prototype.setEvents = function setEvents(events) {
  this._resetStyle();
  while (this.eventStream.events.length) this._deleteEvent();
  this.eventStream.events = events;
  this._redraw();
  this._init(events);
};

Svg.prototype._deleteEvent = function deleteEvent() {
  var event = this.eventStream.events.pop();
  if (event.el && event.el.parentNode) {
    event.el.parentNode.removeChild(event.el);
    event.el = null;
  }
};

Svg.prototype._resetEvents = function resetEvents() {
  this._resetStyle();
  this._redraw();
  this._init(this.eventStream.events);
};

Svg.prototype.setControl = function setControl(control) {
  this.el.setAttribute('data-control', control);
  if (control === 'grid') return this._grid();
  if (control === 'undo') return this._undo();
  if (control === 'redo') return this._redo();
  this.control = this.controls[control];
  this.emit('changeControl', control);
  if (!this.control) throw new Error('control ' + control + ' not supported');
};

Svg.prototype._init = function init(events) {
  var self = this;
  var color, controlName;

  events.forEach(setDefaults);

  this.emit('changeColor', color || self.DEFAULT_STYLE.stroke);
  if (controlName) self.setControl(controlName);

  function setDefaults(event) {
    if (event.type === 'style') {
      if (event.args.stroke) {
        color = event.args.stroke;
      }
      return;
    }
    controls().forEach(setControl);
    function setControl(opt) {
      var control = opt.control;
      if (control.matchEvent && control.matchEvent(event)) {
        controlName = opt.controlName;
      }
    }
  }

  function controls() {
    return Object.keys(self.controls).map(function mapControl(name) {
      return {
        controlName: name,
        control: self.controls[name]
      };
    });
  }
};

Svg.prototype._eventListeners = function(method) {
  var self = this;
  Object.keys(this.listeners).forEach(function event(name) {
    self.el[method](name, self.listeners[name]);
  });
};

Svg.prototype._down = function down(e) {
  if (this.control && this.control.ondown) this.control.ondown(e);
};

Svg.prototype._move = function move(e) {
  if (this.control && this.control.onmove) this.control.onmove(e);
};

Svg.prototype._up = function up(e) {
  if (this.control && this.control.onup) this.control.onup(e);
};

Svg.prototype._pathSelected = function pathSelected(e) {
  if (!this.control || !this.control.onpathselected) return;
  var target = e.target;
  var id = +target.getAttribute('data-id');
  var path = this.eventStream.events.filter(findId);
  if (!path.length) return;
  return this.control.onpathselected({path: path[0], e: e});
  function findId(event) {
    return event.id === id;
  }
};

Svg.prototype._resetStyle = function resetStyle() {
  this.style = copy(this.DEFAULT_STYLE);
};

Svg.prototype._redraw = function redraw(events) {
  var self = this;
  events = events || self.eventStream.events;
  redraw.id = redraw.id || 0;
  self._triggerEventsChanged();
  events.forEach(create);

  function create(event) {
    if (event.type === 'style') {
      self.style = xtend(self.DEFAULT_STYLE, event.args);
      return;
    }
    var el = event.el || (function() {
      if (event.target) return event.target;
      var el = self.el.appendChild(createElement(event.type));
      event.el = el;
      el.setAttribute('data-id', ++redraw.id);
      event.id = redraw.id;
      el.addEventListener('mousedown', self._pathSelected.bind(self));
      el.addEventListener('touchstart', self._pathSelected.bind(self));
      return el;
    })();
    for(var key in event.args) {
      if (key !== 'value') {
        el.setAttribute(key, event.args[key]);
      }
    }

    if (event.type !== 'move') {
      if (event.args.value) {
        el.innerHTML = '';
        if (event.layout && event.layout.style && event.layout.style.width) {
          var match = new RegExp('.{0,' + event.layout.style.width / 5 + '}', 'g');
          event.args.value.match(match).forEach(function wrap(text, i) {
            if (i === 0) {
              el.textContent = text;
            } else {
              var tspan = createElement('tspan');
              tspan.setAttribute('dy', '1.1em');
              tspan.setAttribute('x', event.args.x);
              tspan.textContent = text;
              el.appendChild(tspan);
            }
          });

        } else {
          el.textContent = event.args.value;
        }
      }
    }

    if (event.type === 'delete') {
      el.style.display = 'none';
    } else {
      if (!!!event.target) {
        var style = copy(self.style);
        if (event.type === 'text') style.fill = style.stroke;
        applyStyle(el, style);
        applyLayout(event, el);
      }
    }
  }

  function applyLayout(event, el) {
    if (event.layout && event.layout.class) {
      el.setAttribute('class', event.layout.class);
    }
    if (event.layout && event.layout.font) {
      self.font = copy(self.fonts[event.layout.font.name]);
      if (event.layout.font.size) {
        self.font['font-size'] = event.layout.font.size;
      }
    }

    for(var key in self.font) el.setAttribute(key, self.font[key]);
    if (event.layout && event.layout.rotate) {
      el.setAttribute('transform',
        'rotate(' + event.layout.rotate.deg + ' ' + event.args.x + ' ' + event.args.y + ')'
      );
    }
  }

  function applyStyle(el, style) {
    el.setAttribute('style', Object.keys(style).reduce(reduce, ''));
    function reduce(result, key) {
      return result + key + ':' + style[key] + ';';
    }
  }
};

function createElement(name) {
  return document.createElementNS('http://www.w3.org/2000/svg', name);
}

Svg.prototype.resize = function resize(width, height) {
  if (this.el) {
    this.el.setAttribute('viewBox', '0 0 ' + width + ' ' + height);
  }
};

Svg.prototype.setColor = function(color) {
  if (this.style.stroke === color) return;
  var event;
  this.eventStream.push(event = {
    type: 'style',
    args: {
      stroke: color
    }
  });
  this._redraw([event]);
};

Svg.prototype._undo = function undo() {
  var event = this.eventStream.pop();
  if (event) {
    this.deleted.push(event);
    if (event.el) {
      event.el.style.display = 'none';
    }
  }
  this._resetEvents();
};

Svg.prototype._redo = function redo() {
  var event = this.deleted.pop();
  if (event) {
    this.eventStream.push(event);
    if (event.el) {
      event.el.style.display = 'block';
    }
  }
  this._resetEvents();
};

Svg.prototype.setGridStyle = function setGridStyle(style) {
  style = style || this.gridStyle;
  if (style) {
    this.gridStyle = style;
    var grid = this.el.querySelector('.grid');
    Object.keys(style).forEach(function setStyle(key) {
      grid.setAttribute(key, style[key]);
    });
  }
};

Svg.prototype._grid = function toggleGrid() {
  var grid = this.el.querySelector('.grid');
  var gridUrl = 'url(#grid-' + this.idSequence + ')';

  var gridDisplay = grid.getAttribute('fill');
  gridDisplay = gridDisplay === 'transparent' ? gridUrl : 'transparent';
  grid.setAttribute('fill', gridDisplay);
  this.el.setAttribute('data-grid', gridDisplay === gridUrl);
  this.setGridStyle();
};
