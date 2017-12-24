var appId = "206723_e381"; // TODO update the unpublished id to the published one if the app passes verification

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
 * @param login
 * @param callback param - error associative array containing title and message if there is an error or null on success
 */
function sendDeepLink(login, callback) {
    chrome.storage.local.get("rokuIp", function (values) {
        if (values.rokuIp === null || typeof(values.rokuIp) === "undefined") {
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
                var url = "http://{0}:8060/launch/{1}?contentId=twitch_stream&mediaType=live&twitch_user_name={2}";
                request.open(
                    "POST",
                    url.replace("{0}", values.rokuIp).replace("{1}", appId).replace("{2}", login),
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
    // Inject extractor JavaScript
    chrome.tabs.executeScript(null, {
        file: "src/extract.js"
    });
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
                message = chrome.i18n.getMessage("message_cast_success",
                    response.streamer.displayName !== null && typeof(response.streamer.displayName) !== "undefined" ?
                        response.streamer.displayName :
                        response.streamer.login);
            else
                message = chrome.i18n.getMessage(response.error);
            // Send deep link
            if (success) {
                showNotification(chrome.i18n.getMessage("title_cast_in_progress"),
                    chrome.i18n.getMessage("message_cast_in_progress"));
                sendDeepLink(response.streamer.login, function (status) {
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