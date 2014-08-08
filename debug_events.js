module.exports = function debugEvents(eventStream) {
  if (window.location.search !== '?debug') return;
  log(eventStream);
};

function log(eventStream) {
  var eventStreamJSON = JSON.stringify(eventStream.toJSON(), null, 4);
  localStorage.setItem('eventstream', eventStreamJSON);
  var json = [];
  eventStream.events.forEach(function(event) {
    var e = {};
    ['type', 'args', 'origin', 'stroke', 'layout'].forEach(function(x) {
      e[x] = event[x];
    });
    json.push(e);
  });
  console.log(JSON.stringify(json, null, 4) + '\neventStream#toJSON\n' + eventStreamJSON);
}
