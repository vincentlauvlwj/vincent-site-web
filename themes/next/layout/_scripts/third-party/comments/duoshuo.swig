{% if (theme.duoshuo and theme.duoshuo.shortname) or theme.duoshuo_shortname %}

  {% if theme.duoshuo %}
    {% set duoshuo_shortname = theme.duoshuo.shortname %}
  {% else %}
    {% set duoshuo_shortname = theme.duoshuo_shortname %}
  {% endif %}

  {% if page.type === "messages" %}
  <script type="text/javascript">
    (function() {
      var ds = $(".comments .ds-thread");
      ds.attr("data-thread-key", "/messages");
      ds.attr("data-url", "http://vincentlauvlwj.github.io/messages/");
    })();
  </script>
  {% endif %}

  <script type="text/javascript">
    var duoshuoQuery = {short_name:"{{duoshuo_shortname}}"};
    (function() {
      var ds = document.createElement('script');
      ds.type = 'text/javascript';ds.async = true;
      ds.id = 'duoshuo-script';
      ds.src = (document.location.protocol == 'https:' ? 'https:' : 'http:') + '//static.duoshuo.com/embed.js';
      ds.charset = 'UTF-8';
      (document.getElementsByTagName('head')[0]
      || document.getElementsByTagName('body')[0]).appendChild(ds);
    })();
  </script>

  {% if theme.duoshuo_info.ua_enable %}
    {% if theme.duoshuo_info.admin_enable %}
      <script src="{{ url_for(theme.vendors) }}/ua-parser-js/dist/ua-parser.min.js"></script>
      <script src="{{ url_for(theme.js) }}/hook-duoshuo.js"></script>
    {% endif %}
  {% endif %}

{% endif %}
