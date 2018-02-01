/**
 * Create time element and add the current time
 */
function init() {
    var newDiv = false;
    var timeDiv = document.getElementById("org.twitched.buffer_time");
    if (timeDiv === null || typeof(timeDiv) === "undefined") {
        timeDiv = document.createElement("div");
        newDiv = true;
    }
    var time = window.lastBufEnd;
    if (time === null && typeof(time) === "undefined")
        time = 0;
    else if (time <= 30)
        time -= 30;
    timeDiv.setAttribute("data-time", time);
    timeDiv.id = "org.twitched.buffer_time";
    if (newDiv)
        (document.head || document.documentElement).appendChild(timeDiv);
}

init();