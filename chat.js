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
// let response;
// try {
//     const request = {
//         calendarId: "primary",
//         timeMin: new Date().toISOString(),
//         showDeleted: false,
//         singleEvents: true,
//         maxResults: 10,
//         orderBy: "startTime",
//     };
//     response = await gapi.client.calendar.events.list(request);
// } catch (err) {
//     document.getElementById("content").innerText = err.message;
//     return;
// }

// const events = response.result.items;
// console.log(events);
// if (!events || events.length == 0) {
//     document.getElementById("content").innerText = "No events found.";
//     return;
// }
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

async function createEvent(event) {
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

async function updateEvent(event) {
    await gapi.client.calendar.events.update({
        calendarId: "primary",
        eventId: event.eventId,
        resource: {
            start: {
                dateTime: event.start,
            },
            end: {
                dateTime: event.end,
            },
        },
    });
}

async function deleteEvent() {}

async function listEvents(
    timeMin = null,
    timeMax = null,
    maxResults = 10,
    orderBy = "startTime",
    showDeleted = false,
    singleEvents = true
) {
    if (!timeMin && !timeMax) {
        timeMin = new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString();
        timeMax = new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString();
    }
    let response;
    try {
        const request = {
            calendarId: "primary",
            timeMin: timeMin,
            timeMax: timeMax,
            showDeleted: showDeleted,
            singleEvents: singleEvents,
            maxResults: maxResults,
            orderBy: orderBy,
        };
        response = await gapi.client.calendar.events.list(request);
    } catch (err) {
        document.getElementById("content").innerText = err.message;
        return;
    }

    const events = response.result.items;
    console.log(events);
    let formattedEvents = events.map((event) => ({
        title: event.summary,
        eventId: event.id,
        start: event.start.dateTime,
        end: event.end.dateTime,
    }));
    return formattedEvents;
}

async function getEvent() {}

let actions = {
    "Create an event": {
        info: "Create an event with a title, start time, and end time.",
        format: [{ title: "string", start: "ISOString", end: "ISOString" }],
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
        format: [{ eventId: "string", start: "ISOString", end: "ISOString" }],
    },
    "Delete an event": {
        info: "Delete an event with a title, start time, and end time.",
        format: [{ title: "string", start: "ISOString", end: "ISOString" }],
    },
    "List events": {
        info: "List all events within the timeframe. Useful for seeing the scheduled events and getting the event ID.",
        format: [
            {
                start: "ISOString (optional, **only use if you are certain the event is after this start time**)",
                end: "ISOString (optional, **only use if you certain the event is before this end time**)",
            },
        ],
    },
    "Get an event": {
        info: "Get an event with a title, start time, and end time.",
        format: [{ title: "string", start: "ISOString", end: "ISOString" }],
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
        start: event.start ? new Date(event.start).toISOString() : null,
        end: event.end ? new Date(event.end).toISOString() : null,
    }));

    return {
        infoAcquired: true,
        action: action,
        data: data,
    };
}

const genai = new GoogleGenerativeAI(tokens.GEMINI);

const model = genai.getGenerativeModel({ model: "gemini-1.5-pro" });

let chat = model.startChat({
    history: [],
    generationConfig: { temperature: 0 },
});
let numMessages = 0;
let prompt = null;

export async function sendMessage() {
    const messageElem = document.getElementById("message");
    const messageText = messageElem.value;
    if (messageText === "" && !prompt) {
        return;
    }
    messageElem.value = "";
    const messagesElem = document.getElementById("messages");
    const messageP = document.createElement("p");
    messageP.innerText = prompt ? prompt : messageText;
    messageP.className = "user";
    messagesElem.appendChild(messageP);

    if (prompt) {
        prompt += `\n\nContext: ${JSON.stringify(
            { currentDate: new Date().toString() },
            null,
            2
        )}`;
    } else if (numMessages === 0) {
        prompt = `You are CalendAI, an AI scheduling assistant integrated into Google Calendar who can help the user with timeblocking. Here are the actions you can perform:\n\n${JSON.stringify(
            actions,
            null,
            2
        )}\n\nWhen a user provides input, you must ask clarifying questions if you do not have enough information. Once you have all the necessary details, respond with 'Information acquired: [Action]' followed by the appropriate JSON-formatted data.\n\nExample:\n\nUser: I want to move my lunch event by 2 hours\nYou: Information acquired: List events\n[\n{\n"start": null,\n"end": null\n}\n]\n\n Pay close attention to the relative time phrases. Always convert relative time phrases like "for the next hour" or "in 3 hours" into the same format, like the current time that I provided you, based on the current time provided in the context.\n\nContext: ${JSON.stringify(
            { currentDate: new Date().toString() },
            null,
            2
        )}\nDon't give me ISO string, give me the date and time like how I gave you.\n\nHere is what I want to do: ${messageText}\n\nNow, what would you like to do? If you have all the information, please tell me 'Information acquired' then the action you want to take. Otherwise, either preferably "List events" to get information about a pre-existing event, or ask me a question to gather the necessary details. Remember to assume the title of the event or when it is. If I say "I need to eat lunch at 3," don't ask me the title of the event or when it is, you should know that it is "Lunch" at 3 PM on the same day. Don't ask the user something like, "What is the title of the event you want to update?", you should use the action "List events" to get the context.`;
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

        if (processedResponse.action === "List events") {
            const data = processedResponse.data[0];
            const events = await listEvents(data.start, data.end);
            prompt = `Here are the list of events from ${data.start} to ${
                data.end
            }:\n\n${JSON.stringify(events, null, 2)}`;
            await sendMessage(prompt);
        } else if (processedResponse.action === "Create an event") {
            const event = processedResponse.data[0];
            await createEvent(event);
        } else if (processedResponse.action === "Create multiple events") {
            for (let event of processedResponse.data) {
                await createEvent(event);
            }
        } else if (processedResponse.action === "Update an event") {
            const event = processedResponse.data[0];
            await updateEvent(event);
        }
    }
    prompt = null;
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
