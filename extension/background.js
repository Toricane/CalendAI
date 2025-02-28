chrome.runtime.onInstalled.addListener(() => {
    console.log("Extension installed");
});

chrome.identity.onSignInChanged.addListener((account, signedIn) => {
    if (signedIn) {
        console.log("User signed in:", account);
    } else {
        console.log("User signed out:", account);
    }
});

// Function to get the OAuth2 token
async function getToken(interactive = true) {
    return new Promise((resolve, reject) => {
        chrome.identity.getAuthToken({ interactive }, (token) => {
            if (chrome.runtime.lastError) {
                resolve(null);
            } else {
                console.log("Token obtained:", token);
                resolve(token);
            }
        });
    });
}

// Function to remove the OAuth2 token
async function removeToken() {
    return new Promise((resolve, reject) => {
        chrome.identity.getAuthToken({}, (token) => {
            if (token) {
                chrome.identity.removeCachedAuthToken({ token }, () => {
                    if (chrome.runtime.lastError) {
                        console.error(
                            "Error removing cached token:",
                            chrome.runtime.lastError
                        );
                        reject(chrome.runtime.lastError);
                    } else {
                        console.log("Token removed");
                        // Optionally sign out the user
                        chrome.identity.clearAllCachedAuthTokens(() => {
                            console.log("All tokens cleared");
                            resolve();
                        });
                    }
                });
            } else {
                console.log("No token to remove");
                resolve();
            }
        });
    });
}

function refreshGoogleCalendar() {
    const currentUrl = window.location.href;
    const googleCalendarUrl = "https://calendar.google.com";

    if (currentUrl.startsWith(googleCalendarUrl)) {
        window.location.reload();
    }
}

// Listen for messages from the popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === "getToken") {
        getToken(message.interactive).then(sendResponse).catch(sendResponse);
        return true; // Indicates that we want to send a response asynchronously
    } else if (message.action === "removeToken") {
        removeToken().then(sendResponse).catch(sendResponse);
        return true; // Indicates that we want to send a response asynchronously
    }
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "refreshGoogleCalendar") {
        refreshGoogleCalendar();
        sendResponse({ status: "refreshed" });
    }
});
