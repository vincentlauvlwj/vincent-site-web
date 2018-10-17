{% macro render(post) %}

  <article class="post post-type-{{ post.type | default('normal') }}" itemscope itemtype="http://schema.org/Article">
    <header class="post-header">

      <h1 class="post-title">
        {% if post.link %}{# Link posts #}
          <a class="post-title-link post-title-link-external" target="_blank" href="{{ url_for(post.link) }}" itemprop="url">
            {{ post.title or post.link }}{% if post.subtitle %} - {{ post.subtitle }}{% endif %}
            <i class="fa fa-external-link"></i>
          </a>
        {% else %}
            <a class="post-title-link" href="{{ url_for(post.path) }}" itemprop="url">
              {% if post.type === 'picture' %}
                {{ post.content }}
              {% else %}
                <span itemprop="name">{{ post.title | default(__('post.untitled')) }}{% if post.subtitle %} - {{ post.subtitle }}{% endif %}</span>
              {% endif %}
            </a>
        {% endif %}
      </h1>

      <div class="post-meta">
        <a href="{{ theme.menu.archives }}/{{ date(post.date, 'YYYY/MM') }}/" style="border: 0px;">
          <time class="post-meta-time" itemprop="dateCreated"
                datetime="{{ moment(post.date).format() }}"
                content="{{ date(post.date, config.date_format) }}" >
            {{ date(post.date, 'MM-DD') }}
          </time>
        </a>
      </div>

    </header>
  </article>

{% endmacro %}
