var hyperglue = require('hyperglue')
var EventEmitter = require('events').EventEmitter
var inherits = require('inherits')
var EventStream = require('./event_stream')
var copy = require('shallow-copy')
var xtend = require('xtend')
var fs = require('fs')
var insertCss = require('insert-css')
var Color = require('color')

var validEvent = EventStream.validEvent

var idSequence = 0

module.exports = Svg
inherits(Svg, EventEmitter)

function Svg (opt) {
  if (!(this instanceof Svg)) return new Svg(opt)

  this.idSequence = ++idSequence

  insertCss(fs.readFileSync(__dirname + '/style.css', 'utf-8'))
  this.html = fs.readFileSync(__dirname + '/index.html', 'utf-8')

  this.DEFAULT_STYLE = {
    fill: 'rgba(0, 0, 0, 0)',
    stroke: 'rgba(0, 0, 0, 1)'
  }

  this.opt = opt || {}

  this._resetStyle()

  this.fonts = {
    'default': {
      'font-family': 'Arial',
      'letter-spacing': 0,
      'font-weight': 'normal'
    }
  }

  this.fonts.Normal = xtend(this.fonts.default, {
    'font-size': 11,
    'letter-spacing': 0
  })

  this.fonts.Heading = xtend(this.fonts.default, {
    'font-size': 22,
    'font-weight': 'bold',
    'letter-spacing': 0
  })

  this.font = copy(this.fonts.default)

  this.deleted = []

  this.listeners = {
    'mousedown': this._down.bind(this),
    'touchstart': this._down.bind(this),
    'mouseup': this._up.bind(this),
    'touchend': this._up.bind(this),
    'mousemove': this._move.bind(this),
    'touchmove': this._move.bind(this),
    'anchorselect': this._anchorSelect.bind(this)
  }

  this.eventStream = new EventStream()
}

Svg.prototype.appendTo = function appendTo (el) {
  if (this.el) return this

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
  })).children[0]

  this.controls = {}

  this._eventListeners('addEventListener')

  return this
}

Svg.prototype.registerControl = function (name, instance) {
  var self = this

  if (!instance || typeof instance.emit === 'undefined') return

  self.controls[name] = instance

  var control = self.controls[name]

  if (!control.on) return

  control.on('createEvent', createEvent)
  control.on('updateEvent', updateEvent)
  control.on('deletePath', deletePath)
  control.on('closeToPath', self._pathSelected.bind(self))

  function createEvent (event) {
    self.eventStream.push(event)
    self._redraw([event])
  }

  function updateEvent (event) {
    self._redraw([event])
  }

  function deletePath (opt) {
    self.eventStream.push({
      type: 'delete',
      target: opt.target,
      args: {},
      path: opt.path
    })
    self._redraw(self.eventStream.events.slice(-1))
  }
}

Svg.prototype.remove = function remove () {
  if (!this.el) return
  var el = this.el.parentNode
  this._eventListeners('removeEventListener')
  el.parentNode.removeChild(el)
  this.el = null
}

Svg.prototype._triggerEventsChanged = function trigger () {
  if (trigger.timer) {
    clearTimeout(trigger.timer)
    trigger.timer = null
  }
  trigger.timer = setTimeout(function () {
    this.emit('eventStream', this.eventStream.toJSON())
  }.bind(this), 300)
}

Svg.prototype.setEvents = function setEvents (events) {
  this._resetStyle()
  while (this.eventStream.events.length) this._deleteEvent()
  this.eventStream.events = events
  this._redraw()
  this._init(events)
}

Svg.prototype._deleteEvent = function deleteEvent () {
  var event = this.eventStream.events.pop()
  if (event.el && event.el.parentNode) {
    event.el.parentNode.removeChild(event.el)
    event.el = null
  }
}

Svg.prototype._resetEvents = function resetEvents () {
  this._resetStyle()
  this._redraw()
  this._init(this.eventStream.events)
}

Svg.prototype.setControl = function setControl (control) {
  if (control === 'grid') return this._grid()
  if (control === 'undo') return this.undo()
  if (control === 'redo') return this.redo()
  this.el.setAttribute('data-control', control)
  this.control = this.controls[control]
  this.emit('changeControl', control)
  if (!this.control) throw new Error('control ' + control + ' not supported')
  if (this.opt.anchor) {
    if (!(this.opt.anchor.exclude || /undo|redo|grid/).test(control)) this._removeAnchorElements()
    if ((this.opt.anchor.include || /rubber|move|text/).test(control)) this._addAnchorElements(control)
  }
}

Svg.prototype._init = function init (events) {
  var self = this
  var color, style, controlName

  this.silent = true
  events.forEach(setDefaults)
  this.emit('changeStyle', style || self.style)
  this.emit('changeColor', color || self.DEFAULT_STYLE.stroke)
  if (controlName) self.setControl(controlName)

  this.silent = false

  function setDefaults (event) {
    if (event.type === 'style') {
      style = event.args
      if (event.args.stroke) {
        color = event.args.stroke
      }
      return
    }
    controls().forEach(setControl)
    function setControl (opt) {
      var control = opt.control
      if (control.matchEvent && control.matchEvent(event)) {
        controlName = opt.controlName
      }
    }
  }

  function controls () {
    return Object.keys(self.controls).map(function mapControl (name) {
      return {
        controlName: name,
        control: self.controls[name]
      }
    })
  }
}

Svg.prototype._eventListeners = function (method) {
  var self = this
  Object.keys(this.listeners).forEach(function event (name) {
    self.el[method](name, self.listeners[name])
  })
}

Svg.prototype._down = function down (e) {
  this.emit('drawing')
  if (this.control && this.control.ondown) this.control.ondown(e)
}

Svg.prototype._move = function move (e) {
  if (this.control && this.control.onmove) this.control.onmove(e)
}

Svg.prototype._up = function up (e) {
  if (this.control && this.control.onup) this.control.onup(e)
}

Svg.prototype._pathSelected = function pathSelected (e) {
  this.emit('drawing')
  if (!this.control || !this.control.onpathselected) return
  var target = e.target
  var id = +target.getAttribute('data-id')
  var path = this.eventStream.events.filter(findId)
  if (!path.length) return
  return this.control.onpathselected({path: path[0], e: e})
  function findId (event) {
    return event.id === id
  }
}

Svg.prototype._resetStyle = function resetStyle () {
  this.style = copy(this.DEFAULT_STYLE)
}

Svg.prototype._redraw = function redraw (events) {
  var self = this
  events = events || self.eventStream.events
  redraw.id = redraw.id || 0
  self._triggerEventsChanged()
  events.forEach(create)

  this._addAnchorElements()

  function create (event) {
    if (event.type === 'style') {
      self.style = xtend(self.DEFAULT_STYLE, event.args)
      return
    }
    var el = event.el || (function () {
      if (event.target) return event.target
      var el = self.el.appendChild(createElement(event.type))
      event.el = el
      el.setAttribute('data-id', ++redraw.id)
      event.id = redraw.id
      el.addEventListener('mousedown', self._pathSelected.bind(self))
      el.addEventListener('touchstart', self._pathSelected.bind(self))
      return el
    })()
    for (var key in event.args) {
      if (key !== 'value') {
        el.setAttribute(key, event.args[key])
      }
    }

    if (event.type !== 'move') {
      if (event.args.value) {
        el.innerHTML = ''
        if (event.layout && event.layout.style && event.layout.style.width) {
          var match = new RegExp('.{0,' + (event.layout.style.width / 5 | 0) + '}', 'g')
          event.args.value.match(match).forEach(function wrap (text, i) {
            if (i === 0) {
              el.textContent = text
            } else {
              var tspan = createElement('tspan')
              tspan.setAttribute('dy', '1.1em')
              tspan.setAttribute('x', event.args.x)
              tspan.textContent = text
              el.appendChild(tspan)
            }
          })
        } else {
          el.textContent = event.args.value
        }
      }
    }

    if (event.type === 'delete') {
      el.style.display = 'none'
    } else {
      if (!event.target) {
        var style = copy(self.style)
        if (event.type === 'text') style.fill = style.stroke
        applyStyle(el, style)
        applyLayout(event, el)
      }
    }
  }

  function applyLayout (event, el) {
    if (event.layout && event.layout.class) {
      el.setAttribute('class', event.layout.class)
    }
    if (event.layout && event.layout.font) {
      if (self.fonts[event.layout.font.name]) {
        self.font = copy(self.fonts[event.layout.font.name])
        if (event.layout.font.size) {
          self.font['font-size'] = event.layout.font.size
        }
      }
    }

    for (var key in self.font) el.setAttribute(key, self.font[key])
    if (event.layout && event.layout.rotate) {
      el.setAttribute('transform',
        'rotate(' + event.layout.rotate.deg + ' ' + event.args.x + ' ' + event.args.y + ')'
      )
    }
  }

  function applyStyle (el, style) {
    el.setAttribute('style', Object.keys(style).reduce(reduce, ''))
    function reduce (result, key) {
      return result + key + ':' + style[key] + ';'
    }
  }
}

function createElement (name) {
  return document.createElementNS('http://www.w3.org/2000/svg', name)
}

Svg.prototype.resize = function resize (width, height) {
  if (this.el) {
    this.el.setAttribute('viewBox', '0 0 ' + width + ' ' + height)
  }
}

Svg.prototype.setColor = function setColor (color) {
  if (Color(this.style.stroke).rgbaString() === Color(color).rgbaString()) return
  this.setStyle({stroke: Color(color).rgbaString()})
}

Svg.prototype.setStyle = function setStyle (opt) {
  var style = xtend(this.DEFAULT_STYLE, opt)
  var event = {
    type: 'style',
    args: style
  }
  if (!this.silent) this.eventStream.push(event)
  this._redraw([event])
}

Svg.prototype.undo = function undo () {
  var event = this.eventStream.pop()
  if (event) {
    this.deleted.push(event)
    if (event.el) {
      event.el.style.display = 'none'
    }
  }
  this._resetEvents()
}

Svg.prototype.redo = function redo () {
  var event = this.deleted.pop()
  if (event) {
    this.eventStream.push(event)
    if (event.el) {
      event.el.style.display = 'block'
    }
  }
  this._resetEvents()
}

Svg.prototype.setGridStyle = function setGridStyle (style) {
  style = style || this.gridStyle
  if (style) {
    this.gridStyle = style
    var grid = this.el.querySelector('.grid')
    Object.keys(style).forEach(function setStyle (key) {
      grid.setAttribute(key, style[key])
    })
  }
}

Svg.prototype._grid = function toggleGrid () {
  var grid = this.el.querySelector('.grid')
  var gridUrl = 'url(#grid-' + this.idSequence + ')'

  var gridDisplay = grid.getAttribute('fill')
  gridDisplay = gridDisplay === 'transparent' ? gridUrl : 'transparent'
  grid.setAttribute('fill', gridDisplay)
  this.el.setAttribute('data-grid', gridDisplay === gridUrl)
  this.setGridStyle()
}

Svg.prototype._anchorSelect = function anchorSelect (e) {
  var id = e.target.getAttribute('data-anchor-id')
  var target = this.el.querySelector('[data-id="' + id + '"]')
  e.stopPropagation()
  this._pathSelected({target: target, stopPropagation: e.stopPropagation.bind(e)})
}

Svg.prototype._removeAnchorElements = function removeAnchorElements () {
  var self = this
  ;[].forEach.call(this.el.querySelectorAll('.anchor'), removeAnchor)
  this.eventStream.events.forEach(resetAnchorEl)
  function removeAnchor (el) {
    el.removeEventListener('mousedown', self.listeners.anchorselect)
    el.removeEventListener('touchstart', self.listeners.anchorselect)
    el.parentNode.removeChild(el)
  }
  function resetAnchorEl (event) {
    delete event.anchorEl
  }
}

Svg.prototype._addAnchorElements = function addAnchorElements (control) {
  if (control) addAnchorElements.control = control
  control = addAnchorElements.control
  if (!control) return
  if (!this.opt.anchor) return
  this.eventStream.events.forEach(add.bind(this))
  function add (event) {
    if (!event.el) return
    var position = (this.opt.anchor.position || xy)(event)
    if (!position.filter(Boolean).length) return
    if (control === 'text' && !(event.target || event.el).nodeName.match(/text/i)) return
    var el = event.anchorEl
    if (!el) {
      el = createElement('ellipse')
      el.addEventListener('mousedown', this.listeners.anchorselect)
      el.addEventListener('touchstart', this.listeners.anchorselect)
      event.anchorEl = el
      this.el.appendChild(el)
    }
    var id = (event.target || event.el).getAttribute('data-id')
    el.style.display = (event.target || event.el).style.display
    el.setAttribute('cx', position[0])
    el.setAttribute('cy', position[1])
    el.setAttribute('rx', this.opt.anchor.size || 14)
    el.setAttribute('ry', this.opt.anchor.size || 14)
    el.setAttribute('data-anchor-id', id)
    el.setAttribute('class', 'anchor')
  }

  function xy (event) {
    var el = (event.target || event.el)
    var attributes = el.attributes
    var args = [].reduce.call(attributes, function (sum, item) { sum[item.name] = item.value; return sum }, {})
    if (event.type === 'text') args.value = el.textContent
    if (!validEvent({args: args, type: event.type})) return []
    if (event.type === 'ellipse') return [args.cx - args.rx, args.cy]
    if (event.type === 'path') return path()
    return [args.x, args.y]
    function path () {
      var POINT = /\d+\.?\d*\s*,\s*\d+\.?\d*/g
      var d = args.d.match(POINT)[0].split(',').map(Number)
      return [d[0], d[1]]
    }
  }
}

Svg.prototype.setClipboard = function setClipboard (copied) {
  this.copied = copied
}

Svg.prototype.copy = function copy () {
  this.copied = this.eventStream.toJSON()
  this.emit('copy', this.copied)
}

Svg.prototype.cut = function cut () {
  this.copy()
  this._removeAllEvents()
  this._resetEvents()
}

Svg.prototype._removeAllEvents = function removeAllEvents () {
  var self = this
  this.eventStream.events.forEach(remove)
  function remove (event) {
    if (!event.el || event.type === 'delete') return
    self.eventStream.push({
      type: 'delete',
      target: event.el,
      args: {},
      path: event
    })
  }
  this._removeAnchorElements()
}

Svg.prototype.paste = function paste (e) {
  var pasteData
  try {
    var data = e.clipboardData.getData('text')
    pasteData = JSON.parse(data)
  } catch (x) {}
  if (!pasteData && !this.copied) return
  this._removeAllEvents()
  Array.prototype.push.apply(this.eventStream.events, (pasteData || this.copied))
  this._resetEvents()
}
