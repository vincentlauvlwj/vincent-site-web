<div class="site-header-inner">
    <span class="site-logo">
        <a href="{{ url_for('/') }}">
            <img src="https://www.liuwj.me/gravatar/4fcd1218a0d478db1d5573249c376b95?d=retro">
        </a>
    </span>
    <span class="site-title">
        <h1>
            <a href="{{ url_for('/') }}">{{ config.title }}</a>
        </h1>
    </span>
    <nav class="site-menu">
        {% if theme.menu %}
            <ul>
                {% for menuItem in theme.menu %}
                    <li class="menu-item{% if menuItem.hideOnMobile %} menu-item-hide-on-mobile{% endif %}">
                        <a href="{{ url_for(menuItem.link) }}">
                            {{ menuItem.text }}
                        </a>
                    </li>
                {% endfor %}
            </ul>
        {% endif %}
    </nav>
</div>