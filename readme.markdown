# svg-sketch

svg widget with built in json eventstream

svg -> json -> what ever FTW

[![build status](https://api.travis-ci.org/JamesKyburz/svg-sketch.svg)](http://travis-ci.org/JamesKyburz/svg-sketch)

[![Sauce Test Status](https://saucelabs.com/browser-matrix/svg-sketch.svg)](https://saucelabs.com/u/svg-sketch)

Try it out! [![view on requirebin](http://requirebin.com/badge.png)](http://requirebin.com/?gist=0dc5356985194d0b8466)

use with [browserify](http://browserify.org)

# methods

``` js
var sketch = require('svg-sketch');
```

## `sketch([opts={}])`

Returns a new sketch instance.

`opts` is optional

`opts.anchor` is used for move, delete operations and to easily click on
text elements

If you want anchors to appear then there are the options (they help with deleting and moving elements) :-

* `opts.anchor.size` size of anchor (default is 14px)

* `opts.anchor.exclude` regex checked for a falsy value, used to determine 	when to remove anchor elements. (default is `/undo|redo|grid/`)

* `opts.anchor.include` regex checked for a truthy value, used to determine when to show anchor elements. (default is `/rubber|move|text/`)

* `opts.anchor.position` optional function to determine the xy position of a svg shape.

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

## sketch.setStyle(style)

## sketch.setGridStyle(style)

override grid style used

## svg.setClipboard(json)

clipboard context for widget used by paste.

## svg.copy()

save eventStream and emit `copy` event

## svg.cut

save eventStream, remove drawing and emit `copy` event

## svg.paste(e)

paste copied eventStream to drawing.
if `e` contains clipboard data used that instead of local copied eventStream.

# events

## svg.changeControl(name)

## svg.changeColor(color)

## svg.changeStyle(style)

## svg.eventStream(events)

## svg.copy

complete json structure for drawing

# install

With [npm](https://npmjs.org) do:

```
npm install svg-sketch
```

# test

```
npm test
```

# license

MIT
