{% macro render(post) %}
  <article class="post">
    <header class="post-header">
      <h1 class="post-title">
        {% if is_home() %}
          <a class="post-link" href="{{ url_for(post.path) }}">{{ post.title }}</a>
        {% else %}
          {{ post.title }}
        {% endif %}
      </h1>

      <div class="post-meta">
        <time>{{ full_date(post.date, 'YYYY-MM-DD') }}</time>
        <span> | </span>
        <span>{% if post.author %}{{ post.author }}{% else %}{{ config.author }}{% endif %}</span>
      </div>
    </header>



    {% if is_home() %}
        <div class="post-excerpt post-content">
            {% set excerpt = "" %}
            {% if post.description %}
              {% set excerpt = post.description %}
            {% elif post.excerpt %}
              {% set excerpt = post.excerpt %}
            {% endif %}

            {% if excerpt %}
              {{ excerpt }}
              <div class="post-more-link">
                <a class="btn" href="{{ url_for(post.path) }}" rel="contents">
                  阅读全文 &raquo;
                </a>
              </div>
            {% endif %}
        </div>
          {% else %}
            <div class="post-content">
            {{ post.content }}
            </div>
          {% endif %}

    {% if not is_home() %}
      <footer class="post-footer">
		{% if post.tags and post.tags.length %}
		<div class="post-tags">
		  {% for tag in post.tags %}
			<a href="{{ url_for(tag.path) }}">{{ tag.name }}</a>
		  {% endfor %}
		</div>
		{% endif %}

        {# Post Pagination #}
        {% include "../_partial/pagination.swig" %}
      </footer>
    {% endif %}
  </article>
{% endmacro %}
