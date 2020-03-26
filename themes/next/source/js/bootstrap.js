/* global NexT: true */

// $(document).ready(function () {
(function() {

  $('#loading-progress').animate({width: '60%'}, 'slow', 'linear');

  $(document).trigger('bootstrap:before');
  
  // Define Motion Sequence.
  NexT.motion.integrator
    .add(NexT.motion.middleWares.logo)
    .add(NexT.motion.middleWares.menu)
    .add(NexT.motion.middleWares.postList)
    .add(NexT.motion.middleWares.sidebar);

  $(document).trigger('motion:before');

  // Bootstrap Motion.
  CONFIG.motion && NexT.motion.integrator.bootstrap();

  NexT.utils.isMobile() && window.FastClick.attach(document.body);

  NexT.utils.lazyLoadPostsImages();

  NexT.utils.registerBackToTop();

  $('.site-nav-toggle button').on('click', function () {
    var $siteNav = $('.site-nav');
    var ON_CLASS_NAME = 'site-nav-on';
    var isSiteNavOn = $siteNav.hasClass(ON_CLASS_NAME);
    var animateAction = isSiteNavOn ? 'slideUp' : 'slideDown';
    var animateCallback = isSiteNavOn ? 'removeClass' : 'addClass';

    $siteNav.stop()[animateAction]('fast', function () {
      $siteNav[animateCallback](ON_CLASS_NAME);
    });
  });


  CONFIG.fancybox && NexT.utils.wrapImageWithFancyBox();
  NexT.utils.embeddedVideoTransformer();
  NexT.utils.addActiveClassToMenuItem();

  $(document).trigger('bootstrap:after');

  $('#loading-progress').animate({width: '90%'}, 'slow', 'linear');

// });
})();


$(document).ready(function() {
  $('#loading-progress').animate({width: '100%'}, 'slow', 'linear', function() {
    if (CONFIG.scheme !== 'Muse') {
      $('#loading-progress').fadeOut();
    } else {
      $('#loading-progress').css({position: 'absolute'});
    }
  });
});

// fix code highlight
(function() {
  $(".kotlin .code .keyword").each(function() {
    var node = $(this);
    if (node.text() === "where") {
      node.removeClass("keyword");
    }
  });
})();
