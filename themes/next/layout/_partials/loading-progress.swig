<div id="loading-progress"></div>
<style type="text/css">
  #loading-progress {
    background: #222;
    height: 2px;
    width: 0%;
    position: fixed;
    top: 0;
    z-index: 9999;
  }
</style>
<script type="text/javascript">
  (function() {
    var progressBar = document.getElementById('loading-progress');
    var timer = null;

    timer = setInterval(function() {
      // console.log('Current progress: ' + progressBar.style.width);

      var length = progressBar.style.width.length;
      var curr;

      if (length == 0) {
        curr = 0;
      } else {
        curr = parseInt(progressBar.style.width.substr(0, length - 1));
      }

      if (curr >= 20) {
        clearInterval(timer);
      } else {
        progressBar.style.width = (curr + 1) + '%';
        // console.log('Set progress: ' + curr + '%');
      }
    }, 20);
  })();
</script>