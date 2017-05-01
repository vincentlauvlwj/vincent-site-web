var smileyPanelHtml;

function initSmileyPanelHtml() {
    var supportedSmilies = new Array();
    supportedSmilies.push("bowtie");
    supportedSmilies.push("smile");
    supportedSmilies.push("laughing");
    supportedSmilies.push("blush");
    supportedSmilies.push("smiley");

    smileyPanelHtml = '<div id="ds-smilies-tooltip"><div class="ds-smilies-container"><ul>';
    for (var i = 0; i < supportedSmilies.length; i++) {
        var smiley = supportedSmilies[i];
        smileyPanelHtml += '<li class="emoji emoji-' + smiley + '" placeholder="[' + smiley + ']"></li>';
    }
    smileyPanelHtml += "</ul></div></div>";
}

function toggleSmileyPanel() {
    var $panel = $("#ds-smilies-tooltip");
    if ($panel.length > 0) {
        $panel.remove();
    } else {
        var $panel = $(smileyPanelHtml);
        var $toolbar = $(".ds-post-toolbar");
        var offset = $toolbar.offset();
        $panel.css({
            top: offset.top + $toolbar.outerHeight() + 4 + "px",
            left: offset.left + "px"
        });
        $panel.find("li").click(function() {
            $(".ds-replybox textarea").insertContent($(this).attr("placeholder"));
            toggleSmileyPanel();
        });
        $("body").append($panel);
    }
}

function refreshLoginStatus() {
    var user = Cookies.getJSON("user");
    if (user == null) {
        $(".ds-toolbar").hide();
        $(".ds-login-input").show();
        $(".ds-replybox .ds-avatar a").attr("href", "javascript:void(0);");
        $(".ds-replybox .ds-avatar img").attr("src", "https://cdn.v2ex.com/gravatar/?f=y&d=mm");
        $(".ds-input-wrapper-name input").val("");
        $(".ds-input-wrapper-email input").val("");
        $(".ds-input-wrapper-homepage input").val("");
    } else {
        $(".ds-toolbar").show();
        $(".ds-toolbar .ds-visitor-name").attr("href", user.generatedHomepage);
        $(".ds-toolbar .ds-visitor-name").html(user.name);
        $(".ds-login-input").hide();
        $(".ds-replybox .ds-avatar a").attr("href", user.generatedHomepage);
        $(".ds-replybox .ds-avatar img").attr("src", user.generatedAvatar);
        $(".ds-input-wrapper-name input").val(user.name);
        $(".ds-input-wrapper-email input").val(user.email);
        $(".ds-input-wrapper-homepage input").val(user.generatedHomepage);
    }
}

function login(user) {
    Cookies.set("user", user, { expires: 1024, path: "/" });
    refreshLoginStatus();
}

function logout() {
    Cookies.remove("user", { path: "/" });
    refreshLoginStatus();
}

function loadComments() {
    $.ajax({
        url: "http://localhost/comments/?pageId=" + encodeURI(window.location.pathname),
        type: "get",
        dataType: "json",
        success: function(comments) {
            if (comments.length > 0) {
                $("#ds-comment-count").html(comments.length);
                $("#ds-post-placeholder").hide();
                $("#comment-template").tmpl(comments).appendTo("#ds-comments");
            } else {
                $("#ds-comment-count").html(0);
                $("#ds-post-placeholder").show();
            }
        }
    });
}

function createComment() {
    $(".ds-textarea-wrapper").css("border-color", "#c7d4e1");
    $(".ds-input-wrapper-name input").css("border-color", "#c7d4e1");
    $(".ds-input-wrapper-email input").css("border-color", "#c7d4e1");

    var request = {
        pageId: window.location.pathname,
        content: $.trim($(".ds-replybox textarea").val()),
        fromUser: {
            name: $.trim($(".ds-input-wrapper-name input").val()),
            email: $.trim($(".ds-input-wrapper-email input").val()),
            homepage: $.trim($(".ds-input-wrapper-homepage input").val()),
        }
    }

    if (request.content === "") {
        $(".ds-textarea-wrapper").css("border-color", "red");
        $(".ds-replybox textarea").focus();
        return;
    }
    if (request.fromUser.name === "") {
        $(".ds-input-wrapper-name input").css("border-color", "red");
        $(".ds-input-wrapper-name input").focus();
        return;
    }
    if (request.fromUser.email === "") {
        $(".ds-input-wrapper-email input").css("border-color", "red");
        $(".ds-input-wrapper-email input").focus();
        return;
    }

    $.ajax({
        url: "http://localhost/comments/",
        type: "post",
        contentType: "application/json",
        data: JSON.stringify(request),
        dataType: "json",
        success: function(comment) {
            login(comment.fromUser);

            var $commentCount = $("#ds-comment-count");
            $commentCount.html(parseInt($commentCount.html()) + 1);
            $("#ds-post-placeholder").hide();
            $("#comment-template").tmpl(comment).appendTo("#ds-comments");

            $(".ds-replybox textarea").val("");
        }
    });
}


$(document).ready(function() {
    initSmileyPanelHtml();
    refreshLoginStatus();

	$(".ds-add-emote").click(toggleSmileyPanel);
    $(".ds-replybox form").submit(createComment);
    $("#ds-logout").click(logout);

    $(".ds-account-control").hover(function() {
        $(this).addClass("ds-active");
    }, function() {
        $(this).removeClass("ds-active");
    });

    loadComments();
});