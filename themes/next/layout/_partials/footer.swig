
{% set cc = {'by': 1, 'by-nc': 1, 'by-nc-nd': 1, 'by-nc-sa': 1, 'by-nd': 1, 'by-sa': 1, 'zero': 1} %}
{% if theme.creative_commons in cc %}
<div class="cc-license">
  <a href="http://creativecommons.org/licenses/{{ theme.creative_commons }}/4.0" class="cc-opacity" target="_blank">
    <img src="{{ url_for(theme.images) }}/cc-{{ theme.creative_commons }}.svg" alt="Creative Commons" />
  </a>
</div>
{% endif %}

<div>
  推荐链接：<a href="http://blog.zhaojie.me/" target="_blank">老赵点滴 - 追求编程之美</a>
           | <a href="http://liberize.github.io/" target="_blank">liberize's blog</a>
</div>


<div class="copyright" >
  {% set current = date(Date.now(), "YYYY") %}
  &copy; {% if theme.since and theme.since != current %} {{ theme.since }} - {% endif %}
  <span itemprop="copyrightYear">{{ current }}</span>
  <span class="author" itemprop="copyrightHolder">{{ config.author }}</span>
  <span><a href="http://www.miitbeian.gov.cn/" target="_blank">粤ICP备17040353号</a></span>
</div>

{% block footer %}{% endblock %}
