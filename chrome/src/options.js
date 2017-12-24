var requests = {};

/**
 * Get local IPs
 * https://stackoverflow.com/a/29514292
 * @param callback function to be called with ips as an array parameter
 */
function getLocalIPs(callback) {
    var ips = [];

    var RTCPeerConnection = window.RTCPeerConnection ||
        window.webkitRTCPeerConnection || window.mozRTCPeerConnection;

    var pc = new RTCPeerConnection({
        // Don't specify any stun/turn servers, otherwise you will
        // also find your public IP addresses.
        iceServers: []
    });
    // Add a media line, this is needed to activate candidate gathering.
    pc.createDataChannel('');

    // onicecandidate is triggered whenever a candidate has been found.
    pc.onicecandidate = function(e) {
        if (!e.candidate) { // Candidate gathering completed.
            pc.close();
            callback(ips);
            return;
        }
        var ip = /^candidate:.+ (\S+) \d+ typ/.exec(e.candidate.candidate)[1];
        if (ips.indexOf(ip) === -1) // avoid duplicate entries (tcp/udp)
            ips.push(ip);
    };
    pc.createOffer(function(sdp) {
        pc.setLocalDescription(sdp);
    }, function onerror() {});
}

/**
 * Set the message field
 * @param msg string to show
 */
function setMessage(msg) {
    var message = document.getElementById("message");
    message.innerText = chrome.i18n.getMessage(msg);
}

/**
 * Load the saved IP (if any) and set the input field value
 */
function loadSavedIp() {
    chrome.storage.local.get("rokuIp", function (values) {
        if (values.rokuIp !== null && typeof(values.rokuIp) !== "undefined") {
            var ipField = document.getElementById("ip-field");
            ipField.value = values.rokuIp;
        }
    });
}

/**
 * Handle a list item click event
 */
function onRokuListItemClicked(event) {
    var roku = event.target;
    var ip = roku.getAttribute("data-ip");
    if (ip === null || typeof(ip) === "undefined")
        return setMessage(chrome.i18n.getMessage("message_failed_set_ip"));
    // Set ip
    setMessage(chrome.i18n.getMessage("message_setting_ip"));
    chrome.storage.local.set({
        rokuIp: ip
    }, function () {
        setMessage("message_set_ip");
        loadSavedIp()
    });
}

/**
 * Parse Roku 8060:query/device-info response
 * @param ip roku ip string
 * @param responseText string
 */
function addRokuToSearchList(ip, responseText) {
    var parser = new DOMParser();
    try {
        var xml = parser.parseFromString(responseText, "text/html");
        var info = xml.getElementsByTagName("device-info")[0];
        var vendor = info.getElementsByTagName("vendor-name")[0].innerText;
        if (vendor.toUpperCase() === "ROKU") {
            var deviceName = info.getElementsByTagName("user-device-name")[0].innerText;
            var roku = document.createElement("div");
            roku.innerText = deviceName + " - " + ip;
            roku.setAttribute("class", "roku");
            roku.setAttribute("data-ip", ip);
            roku.setAttribute("data-name", deviceName);
            roku.onclick = onRokuListItemClicked;
            var rokuList = document.getElementById("roku-list");
            rokuList.appendChild(roku);
        }
    }
    catch (e) {
        console.log(e)
    }
}

/**
 * Handle an IP being submitted via a form
 */
function onIpSubmit(event) {
    event.preventDefault();
    setMessage(chrome.i18n.getMessage("message_setting_ip"));
    var ipField = document.getElementById("ip-field");
    // Check for empty ip
    if (ipField === null || typeof(ipField) === "undefined") {
        setMessage(chrome.i18n.getMessage("message_failed_set_ip"));
        return;
    }
    // Make a device info request to make sure this is a roku
    var request = new XMLHttpRequest();
    request.timeout = 2000;
    request.onloadend = function(event) {
        if (event.target.status === 200) {
            try {
                var parser = new DOMParser();
                var xml = parser.parseFromString(event.target.responseText, "text/html");
                var info = xml.getElementsByTagName("device-info")[0];
                var vendor = info.getElementsByTagName("vendor-name")[0].innerText;
                if (vendor.toUpperCase() === "ROKU") {
                    chrome.storage.local.set({
                        rokuIp: ipField.value
                    }, function (){
                        setMessage("message_set_ip");
                    });
                }
                else 
                    setMessage("message_failed_set_ip")
            }
            catch (e) {
                console.log(e);
                setMessage("message_failed_set_ip");
            }
        }
        else
            setMessage("message_failed_set_ip");
    };
    try {
        request.open("GET", "http://" + ipField.value + ":8060/query/device-info", true);
        request.send();
    }
    catch (e) {
        console.log(e);
        setMessage("message_failed_set_ip");
    }
}

/**
 * Begin searching for this devices IP(s) and search from 1-255 on the last octet for a Roku.
 */
window.onload = function() {
    // Set form action
    document.getElementById("ip-form").onsubmit = onIpSubmit;
    loadSavedIp();
    // Get ips
    var ipv4 = new RegExp("((?:\\d+\\.){3})\\d+");
    getLocalIPs(function(ips) {
        ips.forEach(function(ip) {
            var match = ipv4.exec(ip);
            if (match !== null && typeof(match) !== "undefined" && match.length === 2) {
                requests[match[1]] = 0;
                for (var hostOctet = 1; hostOctet <= 255; hostOctet++) {
                    const ip = match[1] + hostOctet;
                    var request = new XMLHttpRequest();
                    request.timeout = 2000;
                    request.onloadend = function(event) {
                        // Add roku to list
                        if (event.target.status === 200)
                            addRokuToSearchList(ip, event.target.responseText);
                        // Check if request are done and hide the spinner
                        requests[match[1]]++;
                        var done = true;
                        for (var requestAmount in requests) {
                            if (requests[requestAmount] !== 255)
                                done = false;
                        }
                        if (done) {
                            var spinner = document.getElementById("search-spinner");
                            spinner.setAttribute("class", "hidden");
                        }
                    };
                    try {
                        request.open("GET", "http://" + ip + ":8060/query/device-info", true);
                        request.send();
                    }
                    catch (e) {
                        console.log(e);
                    }
                }

            }
        });
    });
};