$(document).ready(function () {
  if (themeConfig.fancybox.enable) {
    Theme.fancybox.register();
  }
  Theme.backToTop.register();

  // fix code highlight
  $(".kotlin .code .keyword").each(function() {
    var node = $(this);
    if (node.text() === "where" || node.text() === "set") {
      node.removeClass("keyword");
    }
  });
});
