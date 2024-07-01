import { GoogleGenerativeAI } from "@google/generative-ai";

let tokens = await import("./tokens.js");

async function loadCalendar() {
    try {
        const response = await gapi.client.calendar.calendarList.list();
        const calendars = response.result.items;
        const primaryCalendar = calendars.find((cal) => cal.primary);

        if (primaryCalendar) {
            const calendarId = encodeURIComponent(primaryCalendar.id);
            const src = `https://calendar.google.com/calendar/embed?src=${calendarId}&ctz=${primaryCalendar.timeZone}`;

            // Get the iframe element
            const iframe = document.getElementById("calendar-iframe");

            // Update the src attribute
            iframe.src = src;
            console.log("Loaded calendar:", src);

            // Force a reload of the iframe content
            iframe.contentWindow.location.reload(true);
        } else {
            console.error("Primary calendar not found.");
        }
    } catch (error) {
        console.error("Error loading calendar:", error);
    }
}

/**
 * Print the summary and start datetime/date of the next ten events in
 * the authorized user's calendar. If no events are found an
 * appropriate message is printed.
 */
// async function main() {
//     let response;
//     try {
//         const request = {
//             calendarId: "primary",
//             timeMin: new Date().toISOString(),
//             showDeleted: false,
//             singleEvents: true,
//             maxResults: 10,
//             orderBy: "startTime",
//         };
//         response = await gapi.client.calendar.events.list(request);
//     } catch (err) {
//         document.getElementById("content").innerText = err.message;
//         return;
//     }

//     const events = response.result.items;
//     console.log(events);
//     if (!events || events.length == 0) {
//         document.getElementById("content").innerText = "No events found.";
//         return;
//     }
//     // Flatten to string to display
//     const output = events.reduce(
//         (str, event) =>
//             `${str}${event.summary} (${
//                 event.start.dateTime || event.start.date
//             })\n`,
//         "Events:\n"
//     );
//     await gapi.client.calendar.events.insert({
//         calendarId: "primary",
//         resource: {
//             summary: "Test Event",
//             start: {
//                 dateTime: new Date().toISOString(),
//             },
//             end: {
//                 dateTime: new Date().toISOString(),
//             },
//         },
//     });
//     document.getElementById("content").innerText = output;
//     await loadCalendar();
// }

async function createEvent() {}

async function updateEvent() {}

async function deleteEvent() {}

async function listEvents() {}

async function getEvent() {}

let actions = {
    "Create an event": {
        info: "Create an event with a title, start time, and end time.",
        format: { title: "string", start: "ISOString", end: "ISOString" },
    },
    "Create multiple events": {
        info: "Create multiple events with a title, start time, and end time.",
        format: [
            { title: "string", start: "ISOString", end: "ISOString" },
            "...",
        ],
    },
    "Update an event": {
        info: "Update an event with a title, start time, and end time.",
        format: { title: "string", start: "ISOString", end: "ISOString" },
    },
    "Delete an event": {
        info: "Delete an event with a title, start time, and end time.",
        format: { title: "string", start: "ISOString", end: "ISOString" },
    },
    "List events": {
        info: "List all events.",
        format: {},
    },
    "Get an event": {
        info: "Get an event with a title, start time, and end time.",
        format: { title: "string", start: "ISOString", end: "ISOString" },
    },
};

function processAIResponse(response) {
    // Strip whitespace at the beginning and end of the string
    response = response.trim();

    // Check if the information is acquired
    if (!response.startsWith("Information acquired:")) {
        return {
            infoAcquired: false,
            action: null,
            data: null,
        };
    }

    // Extract the action
    const actionMatch = response.match(/Information acquired: ([^\n]+)/);
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

    // Convert "start" and "end" times to ISO format
    data = data.map((event) => ({
        ...event,
        start: new Date(event.start).toISOString(),
        end: new Date(event.end).toISOString(),
    }));

    return {
        infoAcquired: true,
        action: action,
        data: data,
    };
}

const genai = new GoogleGenerativeAI(tokens.GEMINI);

const model = genai.getGenerativeModel({ model: "gemini-1.5-flash" });

let chat = model.startChat({
    history: [],
    generationConfig: { temperature: 0 },
});
let numMessages = 0;

export async function sendMessage() {
    const messageElem = document.getElementById("message");
    const messageText = messageElem.value;
    if (messageText === "") {
        return;
    }
    messageElem.value = "";
    const messagesElem = document.getElementById("messages");
    const messageP = document.createElement("p");
    messageP.innerText = messageText;
    messageP.className = "user";
    messagesElem.appendChild(messageP);
    let prompt;

    if (numMessages === 0) {
        prompt = `You are CalendAI, an AI scheduling assistant integrated into Google Calendar who can help the user with timeblocking. Here are the actions you can perform:\n\n${JSON.stringify(
            actions,
            null,
            2
        )}\n\nWhen a user provides input, you must ask clarifying questions if you do not have enough information. Once you have all the necessary details, respond with 'Information acquired: [Action]' followed by the appropriate JSON-formatted data. Pay close attention to the relative time phrases. Always convert relative time phrases like "for the next hour" or "in 3 hours" into the same format, like the current time that I provided you, based on the current time provided in the context.\n\nContext: ${JSON.stringify(
            { currentDate: new Date().toString() },
            null,
            2
        )}\nDon't give me ISO string, give me the date and time like how I gave you.\n\nHere is what I want to do: ${messageText}\n\nNow, what would you like to do? If you have all the information, please tell me 'Information acquired' then the action you want to take. Otherwise, ask me a question to gather the necessary details. Remember to assume the title of the event or when it is. If I say "I need to eat lunch at 3," don't ask me the title of the event or when it is, you should know that it is "Lunch" at 3 PM on the same day.`;
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
    const result = await chat.sendMessage(prompt);
    const response = await result.response;
    const text = await response.text();
    const messageResponse = document.createElement("p");
    messageResponse.innerText = text;
    messageResponse.className = "chatbot";
    messagesElem.appendChild(messageResponse);
    let processedResponse = processAIResponse(text);
    if (processedResponse.infoAcquired) {
        console.log(processedResponse);
        if (processedResponse.action === "Create an event") {
            const event = processedResponse.data[0];
            await gapi.client.calendar.events.insert({
                calendarId: "primary",
                resource: {
                    summary: event.title,
                    start: {
                        dateTime: event.start,
                    },
                    end: {
                        dateTime: event.end,
                    },
                },
            });
        } else if (processedResponse.action === "Create multiple events") {
            for (let event of processedResponse.data) {
                await gapi.client.calendar.events.insert({
                    calendarId: "primary",
                    resource: {
                        summary: event.title,
                        start: {
                            dateTime: event.start,
                        },
                        end: {
                            dateTime: event.end,
                        },
                    },
                });
            }
        }
    }
}

async function main() {
    const authorize_button = document.getElementById("authorize_button");
    authorize_button.onclick = handleAuthClick;
    const signout_button = document.getElementById("signout_button");
    signout_button.onclick = handleSignoutClick;
    const send_message = document.getElementById("send_message");
    send_message.onclick = sendMessage;
    const gapi_element = document.getElementById("gapi");
    gapi_element.onload = gapiLoaded;
    const gis_element = document.getElementById("gis");
    gis_element.onload = gisLoaded;
    //
}

// export {
//     gapiLoaded,
//     gisLoaded,
//     handleAuthClick,
//     handleSignoutClick,
//     sendMessage,
// };
