$(function() {
    /* 在textarea处插入文本--Start */
    (function($) {
        $.fn.extend({
            insertContent: function(myValue, t) {
                var $t = $(this)[0];
                if (document.selection) { // ie
                    this.focus();
                    var sel = document.selection.createRange();
                    sel.text = myValue;
                    this.focus();
                    sel.moveStart('character', -l);
                    var wee = sel.text.length;
                    if (arguments.length == 2) {
                        var l = $t.value.length;
                        sel.moveEnd("character", wee + t);
                        t <= 0 ? sel.moveStart("character", wee - 2 * t - myValue.length) : sel.moveStart("character", wee - t - myValue.length);
                        sel.select();
                    }
                } else if ($t.selectionStart || $t.selectionStart == '0') {
                    var startPos = $t.selectionStart;
                    var endPos = $t.selectionEnd;
                    var scrollTop = $t.scrollTop;
                    $t.value = $t.value.substring(0, startPos) + myValue + $t.value.substring(endPos, $t.value.length);
                    this.focus();
                    $t.selectionStart = startPos + myValue.length;
                    $t.selectionEnd = startPos + myValue.length;
                    $t.scrollTop = scrollTop;
                    if (arguments.length == 2) {
                        $t.setSelectionRange(startPos - t,
                            $t.selectionEnd + t);
                        this.focus();
                    }
                } else {
                    this.value += myValue;
                    this.focus();
                }
            }
        })
    })(jQuery);
    /* 在textarea处插入文本--Ending */
});



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
});