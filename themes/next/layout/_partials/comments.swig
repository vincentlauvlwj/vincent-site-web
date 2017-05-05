{% if page.comments %}
<div id="comments" class="comments">
    <div id="ds-thread" class="ds-thread">
        <div id="ds-reset">
            <div class="ds-comments-info">
            	<span id="ds-comment-count" class="ds-highlight">0</span>条评论
            </div>

            <script id="comment-template" type="text/x-jquery-tmpl">
            	<li id="comment-${id}" class="ds-post">
                    <div class="ds-post-self">
                        <div class="ds-avatar">
                            <a href="${fromUser.generatedHomepage}" rel="nofollow" target="_blank"><img src="${fromUser.generatedAvatar}"></a>
                        </div>
                        <div class="ds-comment-body">
                            <div class="ds-comment-header">
                            	<a class="ds-user-name" href="${fromUser.generatedHomepage}" rel="nofollow" target="_blank">${fromUser.name}</a>
                            </div>
                            <p>
                            	<a class="ds-comment-context">回复 Hawaii: </a>${content}
                            </p>
                            <div class="ds-comment-footer ds-comment-actions">
                            	<span class="ds-time">2017-05-05 12:34</span>
                            	<a class="ds-post-reply" data-user-id="${fromUser.id}" href="javascript:void(0);">
                            		<span class="ds-icon ds-icon-reply"></span>回复
                            	</a>
                            </div>
                        </div>
                    </div>
                </li>
            </script>

            <ul id="ds-comments" class="ds-comments">
            	<li id="ds-post-placeholder" class="ds-post ds-post-placeholder" style="display: none;">还没有评论</li>
            </ul>

            <div class="ds-alert" style="display: none;"></div>

            <div class="ds-toolbar" style="display: none;">
                <div class="ds-account-control">
                	<span class="ds-icon ds-icon-settings"></span> <span>帐号管理</span>
                    <ul>
                        <li><a href="http://cn.gravatar.com/" target="_blank" style="border-top: none">修改头像</a></li>
                        <li><a id="ds-logout" href="javascript:void(0);" style="border-bottom: none">忘记我</a></li>
                    </ul>
                </div>
                <div class="ds-visitor">
                	<a class="ds-visitor-name" href="javascript:void(0);" rel="nofollow" target="_blank"></a>
                </div>
            </div>

            <div class="ds-replybox">
                <span class="ds-avatar">
                	<a href="javascript:void(0);" rel="nofollow" target="_blank"><img src="https://cdn.v2ex.com/gravatar/?f=y&d=mm"></a>
                </span>

                <form action="javascript:void(0);" method="post">

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
                        <div class="ds-post-options">
                            <span class="ds-reply-user">
                                <span>正在回复</span>
                                <span id="ds-reply-user-name">炒米粉</span>
                                <a id="ds-cancel-reply" href="javascript:void(0);">取消</a>
                            </span>
                        </div>
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