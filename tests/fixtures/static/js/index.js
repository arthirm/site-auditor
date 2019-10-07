function emitRUMMarker() {
  window.performance.mark('mark_end');
  setTimeout(function() {
    var script = document.createElement('script');         
    script.src = 'js/afterrum.js';
    document.head.appendChild(script);
  }, 3000);
}

emitRUMMarker();