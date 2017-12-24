/**
 * Handle messages from the extension
 */
chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) {
    // Check if the request is to extract
    if (request.command !== "extract")
        return;
    // Check if declarative content API is not enabled and check for the video player class element
    if ((chrome.declarativeContent === null || typeof(chrome.declarativeContent) === "undefined")) {
        var videoPlayersElements = document.getElementsByClassName("video-player");
        // Failed to find item in page
        if (videoPlayersElements.length === 0) {
            return sendResponse({
                error: "message_find_stream_fail"
            });
        }
    }
    // Get login name
    var login;
    var videoPlayers = document.getElementsByClassName("video-player__container");
    if (videoPlayers.length > 0) {
        var videoPlayer = videoPlayers[0];
        login = videoPlayer.getAttribute("data-channel");
    }
    // Verify
    if (login === null || typeof(login) === "undefined") {
        console.log("Failed to get login from video player attributes.");
        console.log(videoPlayers);
        var path = document.location.pathname;
        if (path.indexOf("?") > -1)
            path = path.substring(0, path.indexOf("?"));
        if (path.indexOf("#") > -1)
            path = path.substring(0, path.indexOf("#"));
        var pathSplit = path.split("/");
        console.log(pathSplit);
        if (pathSplit.length !== 2) {
            console.log("Failed to get login from path.");
            console.log(document.location.pathname);
            console.log(pathSplit);
            return sendResponse({
                error: "message_find_stream_fail"
            });
        }
        login = pathSplit[1];
    }
    // Get the display name
    var displayName;
    // Respond
    sendResponse({
        streamer: {
            login: login,
            displayName: displayName
        }
    });
});