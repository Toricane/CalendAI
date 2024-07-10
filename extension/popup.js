document.addEventListener("DOMContentLoaded", function () {
    document.getElementById("sign-in").addEventListener("click", signIn);
    document.getElementById("sign-out").addEventListener("click", signOut);

    checkAuth();
});

document.addEventListener("DOMContentLoaded", () => {
    const main = document.getElementById("main");
    const signinButton = document.getElementById("sign-in");
    const signoutButton = document.getElementById("sign-out");

    // Function to update UI based on sign-in status
    function updateUI(signedIn) {
        if (signedIn) {
            main.style.display = "block";
            signinButton.style.display = "none";
            signoutButton.style.display = "block";
        } else {
            main.style.display = "none";
            signinButton.style.display = "block";
            signoutButton.style.display = "none";
        }
    }

    // Listen for messages from the background script
    chrome.runtime.onMessage.addListener((message) => {
        if (message.action === "updateSignInStatus") {
            updateUI(message.signedIn);
        }
    });

    // Sign-in button click handler
    signinButton.addEventListener("click", () => {
        chrome.runtime.sendMessage(
            { action: "getToken", interactive: true },
            (response) => {
                if (response && !response.error) {
                    console.log("Sign-in successful:", response);
                    updateUI(true);
                } else {
                    console.error("Error during sign-in:", response.error);
                }
            }
        );
    });

    // Sign-out button click handler
    signoutButton.addEventListener("click", () => {
        signOut();
    });

    // Check initial sign-in status
    chrome.runtime.sendMessage(
        { action: "getToken", interactive: false },
        (response) => {
            if (response && !response.error) {
                updateUI(true);
            } else {
                updateUI(false);
            }
        }
    );
});

async function checkAuth() {
    try {
        const token = await getAuthToken(false);
        if (token) {
            console.log("Token obtained:", token);
            console.log("User is signed in");
        } else {
            console.log("User is not signed in");
            document.getElementById("sign-in").style.display = "block";
        }
    } catch (error) {
        console.error("Error checking auth:", error);
    }
}

function signIn() {
    getAuthToken(true)
        .then((token) => {
            if (token) {
                console.log("User signed in:", token);
                document.getElementById("sign-in").style.display = "none";
                document.getElementById("sign-out").style.display = "block";
                document.getElementById("main").style.display = "block";
            }
        })
        .catch((error) => {
            console.error("Error signing in:", error);
        });
}

function signOut() {
    removeAuthToken()
        .then(() => {
            console.log("User signed out");
            document.getElementById("sign-in").style.display = "block";
            document.getElementById("sign-out").style.display = "none";
            document.getElementById("main").style.display = "none";
        })
        .catch((error) => {
            console.error("Error signing out:", error);
        });
}

function getAuthToken(interactive) {
    return new Promise((resolve, reject) => {
        chrome.runtime.sendMessage(
            { action: "getToken", interactive },
            (response) => {
                if (chrome.runtime.lastError || !response) {
                    reject(chrome.runtime.lastError || "No response");
                } else {
                    resolve(response);
                }
            }
        );
    });
}

function removeAuthToken() {
    return new Promise((resolve, reject) => {
        chrome.runtime.sendMessage({ action: "removeToken" }, (response) => {
            if (chrome.runtime.lastError) {
                reject(chrome.runtime.lastError);
            } else {
                resolve(response);
            }
        });
    });
}

const messageInput = document.getElementById("message");
messageInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && !event.shiftKey) {
        event.preventDefault(); // Prevent the default behavior of adding a new line
        sendMessage();
    }
});

// Auto-resize textarea
const textarea = document.getElementById("message");

textarea.addEventListener("input", function () {
    this.style.height = "auto";
    this.style.height = this.scrollHeight - 20 + "px";
});

// // Initialize the height of the textarea
// window.addEventListener("load", function () {
//     textarea.style.height = "auto";
//     textarea.style.height = textarea.scrollHeight + "px";
// });
