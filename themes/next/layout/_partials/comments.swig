{% if page.comments %}
<div class="comments" id="comments">
    <div class="ds-thread" data-thread-key="/2016/09/03/java-reflection-black-tech" data-title="逆天改命，Java反射的黑科技" data-url="http://vincentlauvlwj.github.io/2016/09/03/java-reflection-black-tech/" id="ds-thread">
        <div id="ds-reset">
            <div class="ds-comments-info">
            	<span class="ds-highlight ds-comment-count">5</span>&nbsp;条评论
            </div>

            <script id="comment-template" type="text/x-jquery-tmpl">
            	<li id="comment-${id}" class="ds-post">
                    <div class="ds-post-self">
                        <div class="ds-avatar">
                            <a rel="nofollow author" target="_blank" href="${fromUser.homepage}"><img src="${fromUser.avatar}"></a>
                        </div>
                        <div class="ds-comment-body">
                            <div class="ds-comment-header">
                            	<a class="ds-user-name" href="${fromUser.homepage}" rel="nofollow" target="_blank">${fromUser.name}</a>
                            </div>
                            <p>
                            	<a class="ds-comment-context">回复 Hawaii: </a>${content}
                            </p>
                            <div class="ds-comment-footer ds-comment-actions">
                            	<span class="ds-time">${createDateStr}</span>
                            	<a class="ds-post-reply" data-user-id="${fromUser.id}" href="javascript:void(0);">
                            		<span class="ds-icon ds-icon-reply"></span>回复
                            	</a>
                            </div>
                        </div>
                    </div>
                </li>
            </script>

            <ul class="ds-comments">
            	<li class="ds-post ds-post-placeholder">还没有评论</li>
            </ul>


            <div class="ds-alert" style="display: none;"></div>
            <div class="ds-toolbar" style="display: none;">
                <div class="ds-account-control"><span class="ds-icon ds-icon-settings"></span> <span>帐号管理</span>
                    <ul>
                        <li><a href="javascript:void(0);" style="border-top: none">修改头像</a></li>
                        <li><a href="javascript:void(0);" style="border-bottom: none">忘记我</a></li>
                    </ul>
                </div>
                <div class="ds-visitor"><a class="ds-visitor-name" href="http://www.liuwenjun.info/" target="_blank">炒米粉。</a><a class="ds-unread-comments-count" href="javascript:void(0);" title="你没有新回复" style="display: none;">0</a></div>
            </div>
            <div class="ds-replybox">
                <a class="ds-avatar" href="http://duoshuo.com/settings/avatar/" target="_blank"><img src="http://q.qlogo.cn/qqapp/100229475/903697B988A65F0EFC0B400EEB09FCC0/100" alt="炒米粉。"></a>

                <form method="post">

                	<div class="ds-login-input">
		                <span class="ds-input-wrapper ds-input-wrapper-name">
		                	<input type="text" name="name" placeholder="请输入您的名字">
		                </span>
		                <span class="ds-input-wrapper ds-input-wrapper-email">
		                	<input type="text" name="email" placeholder="您的邮箱，用于接收回复">
		                </span>
		                <span class="ds-input-wrapper ds-input-wrapper-homepage">
		                	<input type="text" name="homepage" placeholder="您的主页">
		                </span>
	                </div>
                    
                    <div class="ds-textarea-wrapper ds-rounded-top">
                        <textarea name="content" placeholder="说点什么吧…"></textarea>
                    </div>

                    <div class="ds-post-toolbar">
                        <div class="ds-post-options ds-gradient-bg"></div>
                        <button class="ds-post-button" type="submit">发布</button>
                        <div class="ds-toolbar-buttons">
                            <a class="ds-toolbar-button ds-add-emote" title="插入表情"></a>
                            <!-- <a class="ds-toolbar-button ds-add-image" title="插入图片"></a> -->
                        </div>
                    </div>
                </form>
            </div>
        </div>
    </div>
</div>


{% endif %}
