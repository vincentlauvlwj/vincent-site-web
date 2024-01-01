<span>
    <span>
        &copy;
        {% set current = date(Date.now(), "YYYY") %}
        {% if theme.since and theme.since != current %}
            {{ theme.since }} -
        {% endif %}
        {{ current }}
        {{ config.author }}
    </span>
    <span><a rel="nofollow" href="https://beian.miit.gov.cn" target="_blank">粤ICP备17040353号-1</a></span>
    <span class="host-service">
        本站托管于 <a href="https://github.com/vincentlauvlwj/vincent-site-web" target="_blank">GitHub</a>
    </span>
</span>
