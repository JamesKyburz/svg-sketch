// phantomjs it's 2014 and still no bind :(
Function.prototype.bind = require('function-bind');

// setup svg dom
var svg = require('../')();
var controls = require('svg-sketch-controls');
var test = require('tape');

svg.appendTo(document.body);
svg.el.setAttribute('height', '600px');
svg.el.setAttribute('width', '600px');

Object.keys(controls).forEach(registerControl);

function registerControl(key) {
  svg.registerControl(key, controls[key](svg.el));
}

// allow running test in all screen sizes with predefined xy
controls.control.prototype.xy = function fixedXy(e) {
  return [e.pageX, e.pageY];
};

test('draw a house', function(t) {
  var moves = require('./fixtures/house');
  var expected = require('./fixtures/house_expected_eventstream');
  window.prompt = function() { return 'maison'; };

  moves.forEach(draw);

  function draw(item) {
    svg.setControl(item[1]);
    svg[item[0]]({preventDefault: Function, pageX: item[2], pageY: item[3]});
  }

  process.nextTick(function() {
    t.deepEqual(svg.eventStream.toJSON(), expected);
    t.end();
  });

});

