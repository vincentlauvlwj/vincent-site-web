<div id="loading-progress"></div>
<style type="text/css">
  #loading-progress {
    background: #222;
    height: 2px;
    position: fixed;
    top: 0;
    z-index: 99999;
  }
</style>
<script type="text/javascript">
  (function() {
    var progressBar = document.getElementById('loading-progress');
    var timer = null;

    timer = setInterval(function() {
      var length = progressBar.style.width.length;
      var curr = parseInt(progressBar.style.width.substr(0, length - 1));

      if (curr >= 20) {
        clearInterval(timer);
      } else {
        progressBar.style.width = curr + '%';
      }
    }, 20);
  })();
</script>