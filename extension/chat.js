// npm install @google/generative-ai
// const { GoogleGenerativeAI } = require("@google/generative-ai");

// <template>
function formatString(template, values) {
    return template.replace(/{(\w+)}/g, (match, key) => {
        return typeof values[key] !== "undefined" ? values[key] : match;
    });
}

function formatJSON(data) {
    let formatted = JSON.stringify(data, null, 2);
    console.log("formatted:", formatted);
    // find the ISO dates and replace them with new Date().toString(), account for timezones
    if (formatted.includes("T") && formatted.includes("-")) {
        return formatted.replace(
            /"(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}-\d{2}:\d{2})"/g,
            (_, date) => new Date(date).toString()
        );
    }
    return formatted.replace(
        /"(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2})"/g,
        (_, date) => new Date(date).toString()
    );
}

function getPrompt(actions, listOfEvents, messageText) {
    actions = formatJSON(actions);
    const context = formatJSON({ currentDateTime: new Date().toString() });
    listOfEvents = formatJSON(listOfEvents);
    return formatString(template, {
        actions,
        context,
        listOfEvents,
        messageText,
    });
}

const template = `[System]
You are CalendAI, an AI scheduling assistant integrated into Google Calendar who can help the user with timeblocking.
You can help the user with planning their days and events, such as creating, updating, and deleting events.
But, the main goal is to make it easier for the user to know when they should do what, and get things out of their heads and into a calendar.

Here are the actions you can perform:
"""
{actions}
"""

When a user provides input, first think about what the user is asking. You should ask clarifying questions if you do not have enough information.
Once you have all the necessary details, respond with 'Action: [Action]' followed by the appropriate JSON-formatted data.
When it is the last action in the conversation, respond with 'Final Action: [Action]' followed by the appropriate JSON-formatted data.

Example 1: (note that [System] is the program)
"""
User: [System]
... (these current instructions)
This is the user's request: I want to move my lunch event by 2 hours.

You: I think you want me to move the event called "Lunch" by 2 hours for both the start and end times.
I need to get the event ID to update it first. I will do that by listing the events.

Action: List events
[
    {
        "start": null,
        "end": null
    }
]

User: [System]
Here are the list of events from 8 hours ago to 56 hours into the future:

[
    {
        "summary": "Lunch",
        "eventId": "abc123",
        "start": "...",
        "end": "..."
    }
]

You: I have found the event ID for "Lunch" to be "abc123". I will now update the event with the new start and end times.

Final Action: Update events
[
    {
        "eventId": "abc123",
        "start": "...",
        "end": "..."
    }
]

User: [System]
ONLY FOR YOUR FOLLOWING RESPONSE: Tell the user the summary of your action (include details of event scheduling if applicable), and ask if they need help with anything else. For this message only, you don't need to mention "Action" or the action or the data. Just provide the message. FOR ALL FUTURE RESPONSES AFTER THIS, you must follow the previous instructions.

You: I have successfully moved the event "Lunch" by 2 hours. Is there anything else you need help with?
"""

Note: the current instructions, given at the start of each chat history, will provide the list of events from 8 hours ago to 56 hours into the future. You can always refresh this list using "List events".

Example 2:
"""
User: [System]
... (these current instructions)
This is the user's request: I need to do homework and walk my dog this evening.

You: I think you want me to create two events, one called "Homework" and one called "Walk Dog" for this evening.
From the listed events, I see that the user is busy until 6 PM.
I will schedule "Homework" from 6 PM to 8 PM and "Walk Dog" from 8 PM to 9 PM.
I will first confirm the user's availability for these times.

Would you like to proceed with these times?

User: Yes

You: Great! I will now create the events "Homework" and "Walk Dog" for this evening.

Final Action: Create events
[
    {
        "summary": "Homework",
        "start": "...",
        "end": "..."
    },
    {
        "summary": "Walk Dog",
        "start": "...",
        "end": "..."
    }
]

User: [System]
ONLY FOR YOUR FOLLOWING RESPONSE: Tell the user the summary of your action (include details of event scheduling if applicable), and ask if they need help with anything else. For this message only, you don't need to mention "Action" or the action or the data. Just provide the message. FOR ALL FUTURE RESPONSES AFTER THIS, you must follow the previous instructions.

You: I have successfully created the events "Homework" and "Walk Dog" for this evening. Is there anything else you need help with?
"""

Context:
"""
{context}
"""

Pay close attention to the relative time phrases.
Always convert relative time phrases like "for the next hour" or "in 3 hours" into the same format, like the current time that I provided you in the context.
Don't provide me the date times as ISO format. The program will convert the date and time into ISO format for you, as long as you follow the format provided in the context.

For formatting, never use \`\`\`, just provide it like the previously mentioned examples.
Be extra careful when deleting events.

Here are the list of events from 8 hours ago to 56 hours into the future:
(you can always refresh this using "List events")
"""
{listOfEvents}
"""

This is the user's request: {messageText}`;
// </template>

const baseURL = "https://calend-ai.vercel.app";

async function createEvents(events) {
    const response = await fetch(`${baseURL}/create-events`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify({ token: token, events: events }),
    });
    return response.json();
}

async function updateEvents(events) {
    let eventIds = events.map((event) => ({ eventId: event.eventId }));
    const currentEvents = await getEvents(eventIds);
    events = events.map((event, index) => {
        if (!event.start) {
            event.start = currentEvents[index].start.dateTime;
            delete currentEvents[index].start;
        }
        if (!event.end) {
            event.end = currentEvents[index].end.dateTime;
            delete currentEvents[index].end;
        }
        return {
            ...currentEvents[index],
            ...event,
        };
    });
    const response = await fetch(`${baseURL}/update-events`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify({ token: token, events: events }),
    });
    return response.json();
}

async function deleteEvents(events) {
    const response = await fetch(`${baseURL}/delete-events`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify({ token: token, events: events }),
    });
    return response.json();
}

async function listEvents(request) {
    const response = await fetch(`${baseURL}/list-events`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify({ token: token, request: request }),
    });
    return response.json();
}

async function getEvents(events) {
    const response = await fetch(`${baseURL}/get-events`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify({ token: token, events: events }),
    });
    return response.json();
}

async function sendAIMessage(prompt, history) {
    const response = await fetch(`${baseURL}/send-ai-message`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify({ prompt, history }),
    });
    return response.json();
}

let actions = {
    "Create events": {
        info: "Create events with a title, start time, and end time. All parameters are required.",
        format: [
            {
                summary: "string, the title of the event",
                start: "string, like [System] example",
                end: "string, like [System] example",
            },
            "...",
        ],
    },
    "Update events": {
        info: "Update events with a title, event ID, start time, and end time.",
        format: [
            {
                summary:
                    "string, the title of the event (optional, only if the event title needs to be changed)",
                eventId:
                    "string (required. if you don't know, use 'List events' to find out. DON'T ask the user for the event ID.)",
                start: "string, like [System] example (optional, will default to previous value)",
                end: "string, like [System] example (optional, will default to previous value)",
                colorId:
                    "string (optional, only if the event color needs to be changed) choose the key (number) from: {'1': 'lavendar', '2': 'sage', '3': 'grape', '4': 'flamingo', '5': 'banana', '6': 'tangerine', '7': 'peacock (default)', '8': 'graphite', '9': 'blueberry', '10': 'basil', '11': 'tomato'}",
            },
            "...",
        ],
    },
    "Delete events": {
        info: "Delete events with event IDs. Ensure you are deleting the correct events.",
        format: [
            {
                eventId:
                    "string (required. if you don't know, use 'List events' to find out. DON'T ask the user for the event ID.)",
            },
            "...",
        ],
    },
    "List events": {
        info: "List all events within the timeframe. Useful for seeing the scheduled events and getting the event ID. Use this instead of asking the user whenever possible. By default, it lists events from 8 hours ago to 56 hours into the future.",
        format: [
            {
                start: "string, like [System] example (optional, **only use if you are certain the event is after this start time**)",
                end: "string, like [System] example (optional, **only use if you certain the event is before this end time**)",
            },
        ],
    },
    "Get events": {
        info: "Get events with event IDs. Useful for seeing the details of specific events.",
        format: [
            {
                eventId:
                    "string (required. if you don't know, use 'List events' to find out. DON'T ask the user for the event ID.)",
            },
            "...",
        ],
    },
};

function processAIResponse(response) {
    // Strip whitespace at the beginning and end of the string
    response = response.trim();
    const fullResponse = response;

    // Check if the information is acquired
    if (!response.includes("Action:")) {
        return {
            finalAction: false,
            action: null,
            data: null,
        };
    }
    response = response.substring(response.indexOf("Action: "));

    // Extract the action
    const actionMatch = response.match(/Action: ([^\n]+)/);
    if (!actionMatch) {
        throw new Error("Action not found in the response");
    }
    const action = actionMatch[1].trim();

    // Extract and parse the JSON data
    const jsonStringMatch = response.match(/\[(.*)\]/s);
    if (!jsonStringMatch) {
        throw new Error("JSON data not found in the response");
    }

    const jsonString = jsonStringMatch[0];
    let data;

    try {
        data = JSON.parse(jsonString);
    } catch (e) {
        throw new Error("Invalid JSON data");
    }
    console.log("DATA:", data);

    // Convert "start" and "end" times to ISO format
    data = data.map((event) => ({
        ...event,
        start: event.start ? new Date(event.start).toISOString() : null,
        end: event.end ? new Date(event.end).toISOString() : null,
    }));

    return {
        finalAction: fullResponse.includes("Final Action:"),
        action: action,
        data: data,
    };
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

// Function to send a message to the content script
function refreshGoogleCalendar() {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        chrome.tabs.sendMessage(tabs[0].id, {
            action: "refreshGoogleCalendar",
        });
    });
}

let history = [];

function addToHistory(text) {
    let lastRole;
    if (history.length === 0) {
        lastRole = "model";
    } else {
        lastRole = history[history.length - 1].role;
    }
    let message = {
        role: lastRole === "user" ? "model" : "user",
        parts: [{ text: text }],
    };
    history.push(message);
}

let numMessages = 0;
let loop = 0;
let prompt = null;
let token = null;

async function sendMessage() {
    loop += 1;

    token = await getAuthToken(true);

    const messageElem = document.getElementById("message");
    const messageText = messageElem.value;

    if (messageText === "" && !prompt) {
        return;
    }

    messageElem.value = "";
    const messagesElem = document.getElementById("messages");
    const messageP = document.createElement("p");
    messageP.innerText = prompt ? prompt : messageText;
    messageP.className = prompt ? "chatbot" : "user";

    // add user message to chat ui
    if (!prompt) {
        messagesElem.appendChild(messageP);
    }

    if (prompt) {
        prompt += `\n\nContext: ${JSON.stringify(
            { currentDate: new Date().toString() },
            null,
            2
        )}`;
    } else if (numMessages === 0) {
        const listOfEvents = await listEvents({});
        prompt = getPrompt(actions, listOfEvents, messageText);
    } else {
        prompt = messageText;
        prompt += `\n\nContext: ${JSON.stringify(
            { currentDate: new Date().toString() },
            null,
            2
        )}`;
    }

    numMessages += 1;
    console.log(prompt);

    let result = await sendAIMessage(prompt, history);
    let text = result.text;

    addToHistory(prompt);
    addToHistory(text);

    let processedResponse = processAIResponse(text);
    let messageResponse;

    if (!processedResponse.action) {
        messageResponse = document.createElement("p");
        messageResponse.innerText = text;
        messageResponse.className = "chatbot";
        messagesElem.appendChild(messageResponse);
    } else {
        console.log(text);
    }

    if (processedResponse.action) {
        console.log(processedResponse);

        if (processedResponse.action === "List events") {
            const data = processedResponse.data[0];
            const events = await listEvents(data);
            prompt = `[System]\nHere are the list of events from ${
                data.start
            } to ${data.end}:\n\n${JSON.stringify(events, null, 2)}`;
            await sendMessage();
        } else if (processedResponse.action === "Create events") {
            await createEvents(processedResponse.data);
        } else if (processedResponse.action === "Update events") {
            await updateEvents(processedResponse.data);
        } else if (processedResponse.action === "Delete events") {
            await deleteEvents(processedResponse.data);
        } else if (processedResponse.action === "Get events") {
            const eventDetails = await getEvents(processedResponse.data);
            prompt = `[System]\nHere are the details for the events:\n\n${JSON.stringify(
                eventDetails,
                null,
                2
            )}`;
            await sendMessage();
        }

        if (processedResponse.finalAction) {
            prompt = `[System]\nONLY FOR YOUR FOLLOWING RESPONSE: Tell the user the summary of your action (include details of event scheduling if applicable), and ask if they need help with anything else. For this message only, you don't need to mention "Action" or the action or the data. Just provide the message. FOR ALL FUTURE RESPONSES AFTER THIS, you must follow the previous instructions.`;
            await sendMessage();
            // TODO: fix this
            // refreshGoogleCalendar();
        }
    }
    prompt = null;
    loop -= 1;
}

const chatButton = document.getElementById("send_message");
chatButton.onclick = sendMessage;

console.log("chat.js loaded");
