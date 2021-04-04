{% if is_home() %}
    <div class="colored-header">
        <div class="wrap clearfix">
            <div id="clogo">
                <img src="https://cdn.v2ex.com/gravatar/4fcd1218a0d478db1d5573249c376b95?d=retro&s=100" onclick="window.location.href='/'" style="cursor: pointer;">
            </div>
            <div id="blog-name">
                <h1 class="site-title">
                    <a href="{{ url_for('/') }}" class="logo">{{ config.title }}</a>
                </h1>
            </div>
            <nav id="menu">
                {% if theme.menu %}
                    <ul id="menu-top" class="nav-top-items">
                        {% for name, path in theme.menu %}
                            <li class="menu-item">
                                <a href="{{ url_for(path) }}">
                                    {% set itemName = 'menu.' + name.toLowerCase() %}
                                    {% if itemName.startsWith('menu') %}
                                        {{ name }}
                                    {% else %}
                                        {{ __(itemName) }}
                                    {% endif %}
                                </a>
                            </li>
                        {% endfor %}
                    </ul>
                {% endif %}
            </nav>
        </div>
    </div>
{% else %}
    <div class="site-header-inner">
        <h1 class="site-title">
            <a href="{{ url_for('.') }}" class="logo">{{ config.title }}</a>
        </h1>

        <nav id="nav-top">
            {% if theme.menu %}
                <ul id="menu-top" class="nav-top-items">
                    {% for name, path in theme.menu %}
                        <li class="menu-item">
                            <a href="{{ url_for(path) }}">
                                {% set itemName = 'menu.' + name.toLowerCase() %}
                                {% if itemName.startsWith('menu') %}
                                    {{ name }}
                                {% else %}
                                    {{ __(itemName) }}
                                {% endif %}
                            </a>
                        </li>
                    {% endfor %}
                </ul>
            {% endif %}
      </nav>
    </div>
{% endif %}