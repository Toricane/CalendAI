let tokens;

// Discovery doc URL for APIs used by the quickstart
const DISCOVERY_DOC =
    "https://www.googleapis.com/discovery/v1/apis/calendar/v3/rest";

// Authorization scopes required by the API; multiple scopes can be
// included, separated by spaces.
const SCOPES = "https://www.googleapis.com/auth/calendar";

let tokenClient;
let gapiInited = false;
let gisInited = false;

document.getElementById("authorize_button").style.visibility = "hidden";
document.getElementById("signout_button").style.visibility = "hidden";

/**
 * Callback after api.js is loaded.
 */
function gapiLoaded() {
    gapi.load("client", initializeGapiClient);
}

/**
 * Callback after the API client is loaded. Loads the
 * discovery doc to initialize the API.
 */
async function initializeGapiClient() {
    tokens = await import("./tokens.js");
    await gapi.client.init({
        apiKey: tokens.API_KEY,
        discoveryDocs: [DISCOVERY_DOC],
    });
    gapiInited = true;
    maybeEnableButtons();
}

/**
 * Callback after Google Identity Services are loaded.
 */
function gisLoaded() {
    async function test() {
        tokens = await import("./tokens.js");
    }
    test().then(() => {
        tokenClient = google.accounts.oauth2.initTokenClient({
            client_id: tokens.CLIENT_ID,
            scope: SCOPES,
            callback: "", // defined later
        });
        gisInited = true;
        maybeEnableButtons();
    });
}

/**
 * Enables user interaction after all libraries are loaded.
 */
function maybeEnableButtons() {
    if (gapiInited && gisInited) {
        document.getElementById("authorize_button").style.visibility =
            "visible";
    }
}

/**
 *  Sign in the user upon button click.
 */
function handleAuthClick() {
    tokenClient.callback = async (resp) => {
        if (resp.error !== undefined) {
            throw resp;
        }
        document.getElementById("signout_button").style.visibility = "visible";
        document.getElementById("authorize_button").innerText = "Refresh";
        await main();
    };

    if (gapi.client.getToken() === null) {
        // Prompt the user to select a Google Account and ask for consent to share their data
        // when establishing a new session.
        tokenClient.requestAccessToken({ prompt: "consent" });
    } else {
        // Skip display of account chooser and consent dialog for an existing session.
        tokenClient.requestAccessToken({ prompt: "" });
    }
}

/**
 *  Sign out the user upon button click.
 */
function handleSignoutClick() {
    const token = gapi.client.getToken();
    if (token !== null) {
        google.accounts.oauth2.revoke(token.access_token);
        gapi.client.setToken("");
        document.getElementById("content").innerText = "";
        document.getElementById("authorize_button").innerText = "Authorize";
        document.getElementById("signout_button").style.visibility = "hidden";
    }
}

async function main() {
    const send_message = document.getElementById("send_message");
    const sendMessage = await import("./chat.js").then(
        (module) => module.sendMessage
    );
    send_message.onclick = sendMessage;

    const messageElem = document.getElementById("message");
    messageElem.onkeydown = (event) => {
        if (event.key === "Enter") {
            sendMessage();
        }
    };

    const mainElem = document.getElementById("main");
    mainElem.hidden = false;
}
