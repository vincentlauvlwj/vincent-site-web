// var apiHost = "http://192.168.1.102";
var apiHost = "https://api.liuwj.me";
var smileyPanelHtml;

function initSmileyPanelHtml() {
    var supportedSmilies = [
        "smile", "laughing", "blush", "smiley", "relaxed", "smirk", "heart-eyes", "kissing-heart", "kissing-closed-eyes", "flushed", "relieved", "satisfied", "grin", "wink", "stuck-out-tongue-winking-eye", "stuck-out-tongue-closed-eyes", "grinning", "kissing", "kissing-smiling-eyes", "stuck-out-tongue", "sleeping", "worried", "frowning", "anguished", "open-mouth", "grimacing", "confused", "hushed", "expressionless", "unamused", "sweat-smile", "sweat", "disappointed-relieved", "weary", "pensive", "disappointed", "confounded", "fearful", "cold-sweat", "persevere", "cry", "sob", "joy", "astonished", "scream", "neckbeard", "tired-face", "angry", "rage", "triumph", "sleepy", "yum", "mask", "sunglasses", "dizzy-face", "imp", "smiling-imp", "neutral-face", "no-mouth", "bowtie", "innocent", "alien", "yellow-heart", "blue-heart", "purple-heart", "heart", "green-heart", "broken-heart", "heartbeat", "heartpulse", "two-hearts", "revolving-hearts", "cupid", "sparkling-heart", "sparkles", "star", "star2", "dizzy", "boom", "collision", "anger", "exclamation", "question", "grey-exclamation", "grey-question", "zzz", "dash", "sweat-drops", "notes", "musical-note", "fire", "hankey", "poop", "shit", "thumbsup", "thumbsdown", "ok-hand", "punch", "facepunch", "fist", "v", "wave", "hand", "raised-hand", "open-hands", "point-up", "point-down", "point-left", "point-right", "raised-hands", "pray", "point-up-2", "clap", "muscle", "metal", "fu", "runner", "running", "couple", "family", "two-men-holding-hands", "two-women-holding-hands", "dancer", "dancers", "ok-woman", "no-good", "information-desk-person", "raising-hand", "bride-with-veil", "person-with-pouting-face", "person-frowning", "bow", "couplekiss", "couple-with-heart", "massage", "haircut", "nail-care", "boy", "girl", "woman", "man", "baby", "older-woman", "older-man", "person-with-blond-hair", "man-with-gua-pi-mao", "man-with-turban", "construction-worker", "cop", "angel", "princess", "smiley-cat", "smile-cat", "heart-eyes-cat", "kissing-cat", "smirk-cat", "scream-cat", "crying-cat-face", "joy-cat", "pouting-cat", "japanese-ogre", "japanese-goblin", "see-no-evil", "hear-no-evil", "speak-no-evil", "guardsman", "skull", "feet", "lips", "kiss", "droplet", "ear", "eyes", "nose", "tongue", "love-letter", "bust-in-silhouette", "busts-in-silhouette", "speech-balloon", "thought-balloon", "feelsgood", "finnadie", "goberserk", "godmode", "hurtrealbad", "rage1", "rage2", "rage3", "rage4", "suspect", "trollface", "sunny", "umbrella", "cloud", "snowflake", "snowman", "zap", "cyclone", "foggy", "ocean", "cat", "dog", "mouse", "hamster", "rabbit", "wolf", "frog", "tiger", "koala", "bear", "pig", "pig-nose", "cow", "boar", "monkey-face", "monkey", "horse", "racehorse", "camel", "sheep", "elephant", "panda-face", "snake", "bird", "baby-chick", "hatched-chick", "hatching-chick", "chicken", "penguin", "turtle", "bug", "honeybee", "ant", "beetle", "snail", "octopus", "tropical-fish", "fish", "whale", "whale2", "dolphin", "cow2", "ram", "rat", "water-buffalo", "tiger2", "rabbit2", "dragon", "goat", "rooster", "dog2", "pig2", "mouse2", "ox", "dragon-face", "blowfish", "crocodile", "dromedary-camel", "leopard", "cat2", "poodle", "paw-prints", "bouquet", "cherry-blossom", "tulip", "four-leaf-clover", "rose", "sunflower", "hibiscus", "maple-leaf", "leaves", "fallen-leaf", "herb", "mushroom", "cactus", "palm-tree", "evergreen-tree", "deciduous-tree", "chestnut", "seedling", "blossom", "ear-of-rice", "shell", "globe-with-meridians", "sun-with-face", "full-moon-with-face", "new-moon-with-face", "new-moon", "waxing-crescent-moon", "first-quarter-moon", "waxing-gibbous-moon", "full-moon", "waning-gibbous-moon", "last-quarter-moon", "waning-crescent-moon", "last-quarter-moon-with-face", "first-quarter-moon-with-face", "crescent-moon", "earth-africa", "earth-americas", "earth-asia", "volcano", "milky-way", "partly-sunny", "octocat", "squirrel", "bamboo", "gift-heart", "dolls", "school-satchel", "mortar-board", "flags", "fireworks", "sparkler", "wind-chime", "rice-scene", "jack-o-lantern", "ghost", "santa", "christmas-tree", "gift", "bell", "no-bell", "tanabata-tree", "tada", "confetti-ball", "balloon", "crystal-ball", "cd", "dvd", "floppy-disk", "camera", "video-camera", "movie-camera", "computer", "tv", "iphone", "phone", "telephone", "telephone-receiver", "pager", "fax", "minidisc", "vhs", "sound", "speaker", "mute", "loudspeaker", "mega", "hourglass", "hourglass-flowing-sand", "alarm-clock", "watch", "radio", "satellite", "loop", "mag", "mag-right", "unlock", "lock", "lock-with-ink-pen", "closed-lock-with-key", "key", "bulb", "flashlight", "high-brightness", "low-brightness", "electric-plug", "battery", "calling", "email", "mailbox", "postbox", "bath", "bathtub", "shower", "toilet", "wrench", "nut-and-bolt", "hammer", "seat", "moneybag", "yen", "dollar", "pound", "euro", "credit-card", "money-with-wings", "e-mail", "inbox-tray", "outbox-tray", "envelope", "incoming-envelope", "postal-horn", "mailbox-closed", "mailbox-with-mail", "mailbox-with-no-mail", "package", "door", "smoking", "bomb", "gun", "hocho", "pill", "syringe", "page-facing-up", "page-with-curl", "bookmark-tabs", "bar-chart", "chart-with-upwards-trend", "chart-with-downwards-trend", "scroll", "clipboard", "calendar", "date", "card-index", "file-folder", "open-file-folder", "scissors", "pushpin", "paperclip", "black-nib", "pencil2", "straight-ruler", "triangular-ruler", "closed-book", "green-book", "blue-book", "orange-book", "notebook", "notebook-with-decorative-cover", "ledger", "books", "bookmark", "name-badge", "microscope", "telescope", "newspaper", "football", "basketball", "soccer", "baseball", "tennis", "8ball", "rugby-football", "bowling", "golf", "mountain-bicyclist", "bicyclist", "horse-racing", "snowboarder", "swimmer", "surfer", "ski", "spades", "hearts", "clubs", "diamonds", "gem", "ring", "trophy", "musical-score", "musical-keyboard", "violin", "space-invader", "video-game", "black-joker", "flower-playing-cards", "game-die", "dart", "mahjong", "clapper", "memo", "pencil", "book", "art", "microphone", "headphones", "trumpet", "saxophone", "guitar", "shoe", "sandal", "high-heel", "lipstick", "boot", "shirt", "tshirt", "necktie", "womans-clothes", "dress", "running-shirt-with-sash", "jeans", "kimono", "bikini", "ribbon", "tophat", "crown", "womans-hat", "mans-shoe", "closed-umbrella", "briefcase", "handbag", "pouch", "purse", "eyeglasses", "fishing-pole-and-fish", "coffee", "tea", "sake", "baby-bottle", "beer", "beers", "cocktail", "tropical-drink", "wine-glass", "fork-and-knife", "pizza", "hamburger", "fries", "poultry-leg", "meat-on-bone", "spaghetti", "curry", "fried-shrimp", "bento", "sushi", "fish-cake", "rice-ball", "rice-cracker", "rice", "ramen", "stew", "oden", "dango", "egg", "bread", "doughnut", "custard", "icecream", "ice-cream", "shaved-ice", "birthday", "cake", "cookie", "chocolate-bar", "candy", "lollipop", "honey-pot", "apple", "green-apple", "tangerine", "lemon", "cherries", "grapes", "watermelon", "strawberry", "peach", "melon", "banana", "pear", "pineapple", "sweet-potato", "eggplant", "tomato", "corn", "house", "house-with-garden", "school", "office", "post-office", "hospital", "bank", "convenience-store", "love-hotel", "hotel", "wedding", "church", "department-store", "european-post-office", "city-sunrise", "city-sunset", "japanese-castle", "european-castle", "tent", "factory", "tokyo-tower", "japan", "mount-fuji", "sunrise-over-mountains", "sunrise", "stars", "statue-of-liberty", "bridge-at-night", "carousel-horse", "rainbow", "ferris-wheel", "fountain", "roller-coaster", "ship", "speedboat", "boat", "sailboat", "rowboat", "anchor", "rocket", "airplane", "helicopter", "steam-locomotive", "tram", "mountain-railway", "bike", "aerial-tramway", "suspension-railway", "mountain-cableway", "tractor", "blue-car", "oncoming-automobile", "car", "red-car", "taxi", "oncoming-taxi", "articulated-lorry", "bus", "oncoming-bus", "rotating-light", "police-car", "oncoming-police-car", "fire-engine", "ambulance", "minibus", "truck", "train", "station", "train2", "bullettrain-front", "bullettrain-side", "light-rail", "monorail", "railway-car", "trolleybus", "ticket", "fuelpump", "vertical-traffic-light", "traffic-light", "warning", "construction", "beginner", "atm", "slot-machine", "busstop", "barber", "hotsprings", "checkered-flag", "crossed-flags", "izakaya-lantern", "moyai", "circus-tent", "performing-arts", "round-pushpin", "triangular-flag-on-post", "jp", "kr", "cn", "us", "fr", "es", "it", "ru", "gb", "uk", "de", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "keycap-ten", "1234", "zero", "hash", "symbols", "arrow-backward", "arrow-down", "arrow-forward", "arrow-left", "capital-abcd", "abcd", "abc", "arrow-lower-left", "arrow-lower-right", "arrow-right", "arrow-up", "arrow-upper-left", "arrow-upper-right", "arrow-double-down", "arrow-double-up", "arrow-down-small", "arrow-heading-down", "arrow-heading-up", "leftwards-arrow-with-hook", "arrow-right-hook", "left-right-arrow", "arrow-up-down", "arrow-up-small", "arrows-clockwise", "arrows-counterclockwise", "rewind", "fast-forward", "information-source", "ok", "twisted-rightwards-arrows", "repeat", "repeat-one", "new", "top", "up", "cool", "free", "ng", "cinema", "koko", "signal-strength", "u5272", "u5408", "u55b6", "u6307", "u6708", "u6709", "u6e80", "u7121", "u7533", "u7a7a", "u7981", "sa", "restroom", "mens", "womens", "baby-symbol", "no-smoking", "parking", "wheelchair", "metro", "baggage-claim", "accept", "wc", "potable-water", "put-litter-in-its-place", "secret", "congratulations", "m", "passport-control", "left-luggage", "customs", "ideograph-advantage", "cl", "sos", "id", "no-entry-sign", "underage", "no-mobile-phones", "do-not-litter", "non-potable-water", "no-bicycles", "no-pedestrians", "children-crossing", "no-entry", "eight-spoked-asterisk", "sparkle", "eight-pointed-black-star", "heart-decoration", "vs", "vibration-mode", "mobile-phone-off", "chart", "currency-exchange", "aries", "taurus", "gemini", "cancer", "leo", "virgo", "libra", "scorpius", "sagittarius", "capricorn", "aquarius", "pisces", "ophiuchus", "six-pointed-star", "negative-squared-cross-mark", "a", "b", "ab", "o2", "diamond-shape-with-a-dot-inside", "recycle", "end", "back", "on", "soon", "clock1", "clock130", "clock10", "clock1030", "clock11", "clock1130", "clock12", "clock1230", "clock2", "clock230", "clock3", "clock330", "clock4", "clock430", "clock5", "clock530", "clock6", "clock630", "clock7", "clock730", "clock8", "clock830", "clock9", "clock930", "heavy-dollar-sign", "copyright", "registered", "tm", "x", "heavy-exclamation-mark", "bangbang", "interrobang", "o", "heavy-multiplication-x", "heavy-plus-sign", "heavy-minus-sign", "heavy-division-sign", "white-flower", "100", "heavy-check-mark", "ballot-box-with-check", "radio-button", "link", "curly-loop", "wavy-dash", "part-alternation-mark", "trident", "black-small-square", "white-small-square", "black-medium-small-square", "white-medium-small-square", "black-medium-square", "white-medium-square", "white-large-square", "white-check-mark", "black-square-button", "white-square-button", "black-circle", "white-circle", "red-circle", "large-blue-circle", "large-blue-diamond", "large-orange-diamond", "small-blue-diamond", "small-orange-diamond", "small-red-triangle", "small-red-triangle-down", "shipit"
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

function toggleQuestComment() {
	if ($(".ds-guest-comment input").is(":checked")) {
		$(".ds-login-input input").prop("disabled", true);
		$(".ds-login-input input").val("");
		$(".ds-replybox textarea").focus();
	} else {
		$(".ds-login-input input").prop("disabled", false);
	}
}

function refreshLoginStatus() {
    var user = Cookies.getJSON("user");
    if (user == null) {
        $(".ds-toolbar").hide();
        $(".ds-login-input").show();
        $(".ds-replybox .ds-avatar a").attr("href", "javascript:void(0);");
        $(".ds-replybox .ds-avatar img").attr("src", "https://cdn.v2ex.com/gravatar/?f=y&d=mm");
        $(".ds-replybox textarea").attr("placeholder", "邮箱仅用于接收回复通知，绝不外泄，若仍有顾虑，请使用游客评论");
        $(".ds-input-wrapper-name input").val("");
        $(".ds-input-wrapper-email input").val("");
        $(".ds-input-wrapper-homepage input").val("");
        $(".ds-guest-comment").show();
    } else {
        $(".ds-toolbar").show();
        $(".ds-toolbar .ds-visitor-name").attr("href", user.homepage);
        $(".ds-toolbar .ds-visitor-name").html(user.name);
        $(".ds-login-input").hide();
        $(".ds-replybox .ds-avatar a").attr("href", user.homepage);
        $(".ds-replybox .ds-avatar img").attr("src", user.avatar);
        $(".ds-replybox textarea").attr("placeholder", "说点什么吧...");
        $(".ds-input-wrapper-name input").val(user.name);
        $(".ds-input-wrapper-email input").val(user.email);
        $(".ds-input-wrapper-homepage input").val(user.homepage);
        $(".ds-guest-comment").hide();
    }
}

function login(user) {
	if (!user.guest) {
	    Cookies.set("user", user, { expires: 1024, path: "/" });
	    refreshLoginStatus();
	}
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
        	guest: $(".ds-guest-comment input").is(":checked"),
            name: $.trim($(".ds-input-wrapper-name input").val()),
            email: $.trim($(".ds-input-wrapper-email input").val()),
            homepage: $.trim($(".ds-input-wrapper-homepage input").val())
        }, 
        toUser: {
            id: parseInt($("#ds-reply-user-id").val())
        }
    }

    if (request.content === "") {
        $(".ds-textarea-wrapper").css("border-color", "red");
        $(".ds-replybox textarea").focus();
        return;
    }

    if (!request.fromUser.guest) {
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

    $(".ds-account-control").click(function() {
    	if ($(this).hasClass("ds-active")) {
    		$(this).removeClass("ds-active");
    	} else {
    		$(this).addClass("ds-active");
    	}
    });

    $(".ds-guest-comment input").click(toggleQuestComment);

    $(".ds-guest-comment span").click(function() {
    	var $checkbox = $(".ds-guest-comment input");
    	if ($checkbox.is(":checked")) {
    		$checkbox.prop("checked", false);
    	} else {
    		$checkbox.prop("checked", true);
    	}
    	toggleQuestComment();
    });

    loadComments(false);
});
