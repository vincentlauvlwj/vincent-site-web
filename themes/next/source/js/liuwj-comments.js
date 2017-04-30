
$(document).ready(function() {
	var supportedSmilies = new Array();
	supportedSmilies.push("bowtie");
	supportedSmilies.push("smile");
	supportedSmilies.push("laughing");
	supportedSmilies.push("blush");
	supportedSmilies.push("smiley");

	var smileyPanelHtml = '<div id="ds-smilies-tooltip"><div class="ds-smilies-container"><ul>';
	for (var i = 0; i < supportedSmilies.length; i++) {
		var smiley = supportedSmilies[i];
		smileyPanelHtml += '<li class="emoji emoji-' + smiley + '" placeholder="[' + smiley + ']"></li>';
	}


	function toggleSmileyPanel() {
		var smileyPanel = $("#ds-smilies-tooltip");
		if (smileyPanel.length > 0) {
			smileyPanel.remove();
		} else {
			var smileyPanel = $(smileyPanelHtml);
			var toolbar = $(".ds-post-toolbar");
			var offset = toolbar.offset();
			smileyPanel.css({
				top: offset.top + toolbar.outerHeight() + 4 + "px",
				left: offset.left + "px"
			});
			smileyPanel.find("li").click(function() {
				$(".ds-replybox textarea").insertContent($(this).attr("placeholder"));
				toggleSmileyPanel();
			});
			$("body").append(smileyPanel);
		}
	}

	$(".ds-add-emote").click(toggleSmileyPanel);

    $(".ds-account-control").hover(function() {
        $(this).addClass("ds-active");
    }, function() {
        $(this).removeClass("ds-active");
    });

    
    function refreshComments() {
        $.ajax({
            url: "http://localhost/comments/?pageId=" + encodeURI(window.location.pathname),
            type: "get",
            dataType: "json",
            success: function(comments) {
                $("#ds-reset .ds-comments").empty();
                $("#comment-template").tmpl(comments).appendTo("#ds-reset .ds-comments");
            }
        });
    }
    
    refreshComments();

    $(".ds-replybox form").submit(function() {
        var request = {
            pageId: window.location.pathname,
            content: $(".ds-replybox textarea").val(),
            fromUser: {
                name: $(".ds-input-wrapper-name input").val(),
                email: $(".ds-input-wrapper-email input").val(),
                homepage: $(".ds-input-wrapper-homepage input").val(),
            }
        }

        $.ajax({
            url: "http://localhost/comments/",
            type: "post",
            contentType: "application/json",
            data: JSON.stringify(request),
            dataType: "json",
            success: function(comment) {
                $("#comment-template").tmpl(comment).appendTo("#ds-reset .ds-comments");
            }
        });

        return false;
    });
});