// Browser Control - Documentation Interactive Helpers
(function() {
  // 1. Reliable clipboard copy with visual feedback
  document.querySelectorAll('.copy').forEach(function(btn) {
    btn.addEventListener('click', function() {
      var pre = btn.parentElement.querySelector('pre');
      if (!pre) return;
      var text = pre.textContent;
      var reset = function() {
        setTimeout(function() {
          btn.textContent = 'Copy';
          btn.classList.remove('done');
        }, 1600);
      };
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(function() {
          btn.textContent = 'Copied';
          btn.classList.add('done');
          reset();
        }).catch(function() {
          fallbackCopy(pre, btn, reset);
        });
      } else {
        fallbackCopy(pre, btn, reset);
      }
    });
  });

  function fallbackCopy(pre, btn, reset) {
    btn.textContent = 'Select & copy';
    var range = document.createRange();
    range.selectNodeContents(pre);
    var sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
    reset();
  }
})();
