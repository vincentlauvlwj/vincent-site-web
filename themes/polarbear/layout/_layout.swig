<!DOCTYPE html>
<html lang="{{ config.language }}">
  <head>
    {% include '_partial/head.swig' %}
    <title>{% block title %}{% endblock %}</title>
  </head>

  <body>
    <div id="page">
      <header id="masthead" {% if is_home() %}class="home"{% endif %}>
        {%- include '_partial/header.swig' %}
      </header>
      <div id="content">
        {% block content %}{% endblock %}
      </div>

      <footer id="colophon">
        {%- include '_partial/footer.swig' %}
      </footer>

      <div class="back-to-top" id="back-to-top">
        <i class="iconfont icon-top"></i>
      </div>
    </div>
    {% include '_script/libs.swig' %}
    {% include '_script/theme.swig' %}
    {% include '_script/comments.swig' %}
  </body>
</html>
