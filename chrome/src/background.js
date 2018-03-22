const APP_ID_TWITCHED = "206723";
const APP_ID_TWITCHED_ZERO = "223126";

/**
 * Page action show listener
 * This checks for a HTML element with the .video-player class defined and shows the page action
 */
chrome.runtime.onInstalled.addListener(function() {
    chrome.declarativeContent.onPageChanged.removeRules(undefined, function() {
        chrome.declarativeContent.onPageChanged.addRules([{
            conditions: [
                new chrome.declarativeContent.PageStateMatcher({
                    pageUrl: {
                        hostContains: "twitch.tv"
                    },
                    css: [
                        ".video-player"
                    ]
                })
            ],
            actions: [
                new chrome.declarativeContent.ShowPageAction()
            ]
        }]);
    });
});

/**
 * Fallback for Firefox (Firefix?) since it does not support declarativeContent
 * This does not handle the .video-player class check on the page, so it should be checked in the content script
 */
chrome.tabs.onUpdated.addListener(function (tabId, changeInfo, tab) {
    if ((chrome.declarativeContent === null || typeof(chrome.declarativeContent) === "undefined") &&
        changeInfo.status === "complete" && tab.url.indexOf("twitch.tv") !== -1)
        chrome.pageAction.show(tabId);
});

/**
 * Send a stream deep link to the Roku
 * Provide only one of login or videoId
 * @param login streamer login to use for deep link
 * @param videoId video id to deep link
 * @param time video start time - only used for vods
 * @param callback param - error associative array containing title and message if there is an error or null on success
 */
function sendDeepLink(login, videoId, time, callback) {
    chrome.storage.local.get(["rokuIp", "rokuAppId"], function (values) {
        if (values.rokuIp === null || typeof(values.rokuIp) === "undefined" ||
            values.rokuAppId === null || typeof(values.rokuAppId) === "undefined") {
            chrome.runtime.openOptionsPage();
            return callback({
                title: chrome.i18n.getMessage("title_cast_fail"),
                message: chrome.i18n.getMessage("message_ip_not_set")
            });
        }
        else {
            var request = new XMLHttpRequest();
            request.timeout = 30000;
            request.onloadend = function(event) {
                if (event.target.status !== 200) {
                    callback({
                        title: chrome.i18n.getMessage("title_cast_fail"),
                        message: chrome.i18n.getMessage("message_roku_conntect_fail")
                    });
                }
                else
                    callback()
            };
            try {
                var url = "http://{0}:8060/launch/{1}?contentId={2}&mediaType={3}&time={4}";
                var contentId;
                var mediaType;
                if (login !== null && typeof(login) !== "undefined") {
                    contentId = "twitch_stream_{0}".replace("{0}", login);
                    mediaType = "live";
                }
                else if (videoId !== null && typeof(videoId) !== "undefined") {
                    contentId = "twitch_video_{0}".replace("{0}", videoId);
                    mediaType = "special";
                }
                else {
                    // noinspection ExceptionCaughtLocallyJS
                    throw "Missing login/videoId";
                }
                request.open(
                    "POST",
                    url
                        .replace("{0}", values.rokuIp)
                        .replace("{1}", values.rokuAppId === "0" ? APP_ID_TWITCHED : APP_ID_TWITCHED_ZERO)
                        .replace("{2}", contentId)
                        .replace("{3}", mediaType)
                        .replace("{4}", (time !== null && typeof(time) !== "undefined") ? String(time) : "0"),
                    true
                );
                request.send("");
            }
            catch (e) {
                console.log(e);
                callback({
                    title: chrome.i18n.getMessage("title_cast_fail"),
                    message: chrome.i18n.getMessage("message_roku_conntect_fail")
                });
            }
        }
    });
}

/**
 * Show a notification
 * @param title title
 * @param message message
 * @param isClickable is clickable
 * @param callback callback(notificationId)
 */
function showNotificationWithCallback(title, message, isClickable, callback) {
    chrome.notifications.create("org.twitched.notification.main", {
        type: "basic",
        iconUrl: "assets/image/icon_128.png",
        title: title,
        message: message,
        isClickable: isClickable
    }, callback)
}

/**
 * Show a chrome notification
 * @param title title
 * @param message message
 */
function showNotification(title, message) {
    showNotificationWithCallback(title, message, false, function () {
        if (chrome.runtime.lastError) {
            console.log(chrome.runtime.lastError);
            // Opera does not support non-clickable message
            showNotificationWithCallback(title, message, true, null);
        }
    });
}

/**
 * Handles the onclick of the extension icon when it is active
 */
chrome.pageAction.onClicked.addListener(function() {
    showNotification(chrome.i18n.getMessage("title_cast_in_progress"),
        chrome.i18n.getMessage("message_cast_in_progress"));
    // Inject extractor JavaScript
    chrome.tabs.executeScript(null, {
        file: "src/extract.js"
    }, function () {
        // Send a message to the extractor
        chrome.tabs.query({
            active: true,
            currentWindow: true
        }, function(tabs) {
            chrome.tabs.sendMessage(tabs[0].id, {
                command: "extract"
            }, function(response) {
                var success = (response !== null && typeof(response) !== "undefined") &&
                    (response.error === null || typeof(response.error) === "undefined");
                var title = chrome.i18n.getMessage(success ? "title_cast_success" : "title_cast_fail");
                var message;
                if (success)
                    message = chrome.i18n.getMessage("message_cast_success");
                else
                    message = chrome.i18n.getMessage(response.error);
                // Send deep link
                if (success) {
                    sendDeepLink(response.streamer.login, response.video.id, response.video.time, function (status) {
                        if (status !== null && typeof(status) !== "undefined") {
                            title = status.title;
                            message = status.message;
                        }
                        showNotification(title, message);
                    });
                }
                else
                    showNotification(title, message)
            })
        });
    });
});