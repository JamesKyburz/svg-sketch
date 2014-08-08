# svg-sketch

svg-sketch

Try it out! [![view on requirebin](http://requirebin.com/badge.png)](http://requirebin.com/?gist=0dc5356985194d0b8466)

use with [browserify](http://browserify.org)

# methods

``` js
var sketch = require('svg-sketch')();
```

## sketch.appendTo(el)

append svg element to element

## sketch.registerControl()

register drawing control

## sketch.remove()

remove svg element and event listeners

## sketch.setEvents(events)

set drawing events data

## sketch.setControl(control)

set which control is currently being used

## sketch.resize(width, height)

set viewport to width and height

## sketch.setColor(color)

set current drawing color in hex or rgb

## sketch.setGridStyle(style)

override grid style used

# events

## svg.changeControl(name)

## svg.changeColor(color)

## svg.eventStream(events)

complete json structure for drawing

# install

With [npm](https://npmjs.org) do:

```
npm install svg-sketch
```

# license

MIT
