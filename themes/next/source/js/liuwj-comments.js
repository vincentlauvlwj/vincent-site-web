var apiHost = "http://192.168.1.102"
var smileyPanelHtml;

function initSmileyPanelHtml() {
    var supportedSmilies = [
        "bowtie", "smile", "smile", "laughing", "blush", "smiley"
    ];

    smileyPanelHtml = '<div id="ds-smilies-tooltip"><div class="ds-smilies-container"><ul>';
    for (var i = 0; i < supportedSmilies.length; i++) {
        var smiley = supportedSmilies[i];
        smileyPanelHtml += '<li class="emoji emoji-' + smiley + '" placeholder="[' + smiley + ']"></li>';
    }
    smileyPanelHtml += '</ul></div></div>';
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
            left: offset.left + "px",
            width: Math.min(400, $toolbar.width()) + "px"
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
        $(".ds-toolbar .ds-visitor-name").attr("href", user.homepage);
        $(".ds-toolbar .ds-visitor-name").html(user.name);
        $(".ds-login-input").hide();
        $(".ds-replybox .ds-avatar a").attr("href", user.homepage);
        $(".ds-replybox .ds-avatar img").attr("src", user.avatar);
        $(".ds-input-wrapper-name input").val(user.name);
        $(".ds-input-wrapper-email input").val(user.email);
        $(".ds-input-wrapper-homepage input").val(user.homepage);
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

function replyUser(userId, userName) {
    $(".ds-reply-user").show();
    $("#ds-reply-user-id").val(userId);
    $("#ds-reply-user-name").html(userName);
    $(".ds-replybox textarea").focus();
}

function cancelReply() {
    $(".ds-reply-user").hide();
    $("#ds-reply-user-id").val("");
    $("#ds-reply-user-name").html("");
}

function loadComments(async) {
    $.ajax({
        url: apiHost + "/comments/?pageId=" + encodeURI(window.location.pathname),
        type: "get",
        dataType: "json",
        async: async,
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
            homepage: $.trim($(".ds-input-wrapper-homepage input").val())
        }, 
        toUser: {
            id: parseInt($("#ds-reply-user-id").val()),
            name: $("#ds-reply-user-name").html()
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

    var emailRegex = new RegExp("^[\\w-]+(\\.[\\w-]+)*@[\\w-]+(\\.[\\w-]+)+$");
    if (request.fromUser.email === "" || !emailRegex.test(request.fromUser.email)) {
        $(".ds-input-wrapper-email input").css("border-color", "red");
        $(".ds-input-wrapper-email input").focus();
        return;
    }

    $.ajax({
        url: apiHost + "/comments/",
        type: "post",
        contentType: "application/json",
        data: JSON.stringify(request),
        dataType: "json",
        success: function(comment) {
            var $commentCount = $("#ds-comment-count");
            $commentCount.html(parseInt($commentCount.html()) + 1);
            $("#ds-post-placeholder").hide();
            $("#comment-template").tmpl(comment).appendTo("#ds-comments");
            $(".ds-replybox textarea").val("");
            login(comment.fromUser);
            cancelReply();
        }
    });
}


$(document).ready(function() {
    initSmileyPanelHtml();
    refreshLoginStatus();

    $(".ds-add-emote").click(toggleSmileyPanel);
    $(".ds-replybox form").submit(createComment);
    $(".ds-logout").click(logout);
    $(".ds-cancel-reply").click(cancelReply);

    $(".ds-account-control").hover(function() {
        $(this).addClass("ds-active");
    }, function() {
        $(this).removeClass("ds-active");
    });

    loadComments(false);
});
