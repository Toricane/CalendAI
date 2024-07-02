import { GoogleGenerativeAI } from "@google/generative-ai";

let tokens = await import("./tokens.js");

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
            summary: event.title,
            colorId: event.color,
        },
    });
}

async function deleteEvent(event) {
    await gapi.client.calendar.events.delete({
        calendarId: "primary",
        eventId: event.eventId,
    });
}

async function listEvents(
    timeMin = null,
    timeMax = null,
    maxResults = 20,
    orderBy = "startTime",
    showDeleted = false,
    singleEvents = true
) {
    if (!timeMin && !timeMax) {
        timeMin = new Date(Date.now() - 8 * 60 * 60 * 1000).toISOString();
        timeMax = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();
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
        return "Error listing events";
    }

    const events = response.result.items;

    let formattedEvents = events.map((event) => ({
        title: event.summary,
        eventId: event.id,
        start: event.start.dateTime,
        end: event.end.dateTime,
        color: event.colorId,
    }));
    return formattedEvents;
}

async function getEvent(event) {
    let response;
    try {
        response = await gapi.client.calendar.events.get({
            calendarId: "primary",
            eventId: event.eventId,
        });
    } catch (err) {
        return "Incorrect event ID";
    }

    event = response.result;
    let formattedEvent = {
        title: event.summary,
        eventId: event.id,
        start: event.start.dateTime,
        end: event.end.dateTime,
        color: event.colorId,
    };
    return formattedEvent;
}

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
        info: "Update an event with a title, event ID, start time, and end time.",
        format: [
            {
                title: "string",
                eventId: "string",
                start: "ISOString (required)",
                end: "ISOString (required)",
                color: "string (optional, only if the event color needs to be changed) choose the key (number) from: {'1': 'lavendar', '2': 'sage', '3': 'grape', '4': 'flamingo', '5': 'banana', '6': 'tangerine', '7': 'peacock', '8': 'graphite', '9': 'blueberry', '10': 'basil', '11': 'tomato'}",
            },
        ],
    },
    "Update multiple events": {
        info: "Update multiple events with a title, event ID, start time, and end time.",
        format: [
            {
                title: "string",
                eventId: "string",
                start: "ISOString (required)",
                end: "ISOString (required)",
                color: "string (optional, only if the event color needs to be changed) choose the key (number) from: {'1': 'lavendar', '2': 'sage', '3': 'grape', '4': 'flamingo', '5': 'banana', '6': 'tangerine', '7': 'peacock', '8': 'graphite', '9': 'blueberry', '10': 'basil', '11': 'tomato'}",
            },
            "...",
        ],
    },
    "Delete an event": {
        info: "Delete an event with the event ID. Ensure you are deleting the correct event.",
        format: [{ eventId: "string" }],
    },
    "Delete multiple events": {
        info: "Delete multiple events with event IDs. Ensure you are deleting the correct events.",
        format: [{ eventId: "string" }, "..."],
    },
    "List events": {
        info: "List all events within the timeframe. Useful for seeing the scheduled events and getting the event ID. Use this instead of asking the user whenever possible. By default, it lists events from 8 hours ago to 48 hours into the future.",
        format: [
            {
                start: "ISOString (optional, **only use if you are certain the event is after this start time**)",
                end: "ISOString (optional, **only use if you certain the event is before this end time**)",
            },
        ],
    },
    "Get an event": {
        info: "Get an event with an event ID. Useful for seeing the details of a specific event, including color.",
        format: [{ eventId: "string" }],
    },
    "Get multiple events": {
        info: "Get multiple events with event IDs. Useful for seeing the details of specific events, including color.",
        format: [{ eventId: "string" }, "..."],
    },
};

function processAIResponse(response) {
    // Strip whitespace at the beginning and end of the string
    response = response.trim();

    // Check if the information is acquired
    if (!response.includes("Information acquired:")) {
        return {
            infoAcquired: false,
            action: null,
            data: null,
        };
    }
    response = response.substring(response.indexOf("Information acquired: "));

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

const model = genai.getGenerativeModel({ model: "gemini-1.5-flash" });

let chat = model.startChat({
    history: [],
    generationConfig: { temperature: 0 },
});
let numMessages = 0;
let loop = 0;
let prompt = null;

export async function sendMessage() {
    loop += 1;
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
    if (prompt) {
        // messageP.style.hidden = true;
    }
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
        const events = await listEvents();
        const events_prompt = `Here are the list of events from 12 hours ago to 12 hours into the future:\n\n${JSON.stringify(
            events,
            null,
            2
        )}`;
        prompt = `You are CalendAI, an AI scheduling assistant integrated into Google Calendar who can help the user with timeblocking. Here are the actions you can perform:\n\n${JSON.stringify(
            actions,
            null,
            2
        )}\n\nWhen a user provides input, you must ask clarifying questions if you do not have enough information. Once you have all the necessary details, respond with 'Information acquired: [Action]' followed by the appropriate JSON-formatted data.\n\nExample:\n\nUser: I want to move my lunch event by 2 hours\nYou: Information acquired: List events\n[\n{\n"start": null,\n"end": null\n}\n]\n\n Pay close attention to the relative time phrases. Always convert relative time phrases like "for the next hour" or "in 3 hours" into the same format, like the current time that I provided you, based on the current time provided in the context.\n\nContext: ${JSON.stringify(
            { currentDate: new Date().toString() },
            null,
            2
        )}\nDon't give me ISO string, give me the date and time like how I gave you.\nFor formatting, never use \`\`\`, just provide it like the previously mentioned example. When updating an event, always preserve the old color.\n\nHere is what I want to do: ${messageText}\n(you can always refresh this using "List events")\n${events_prompt}\n\nNow, what would you like to do? If you have all the information, please tell me 'Information acquired' then the action you want to take. Otherwise, either preferably "List events" to get information about a pre-existing event, or ask me a question to gather the necessary details. Remember to assume the title of the event or when it is. If I say "I need to eat lunch at 3," don't ask me the title of the event or when it is, you should know that it is "Lunch" at 3 PM on the same day. Don't ask the user something like, "What is the title of the event you want to update?", you should use the action "List events" to get the context.\n\nWhat you should do: Think out loud in your response about what the user wants to do before "Information acquired", using an action, or asking questions. Be extra careful when deleting events.`;
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
    let result = await chat.sendMessage(prompt);
    let response = await result.response;
    let text = await response.text();
    let processedResponse = processAIResponse(text);
    let messageResponse;
    if (!processedResponse.infoAcquired) {
        messageResponse = document.createElement("p");
        messageResponse.innerText = text;
        messageResponse.className = "chatbot";
        messagesElem.appendChild(messageResponse);
    } else {
        console.log(text);
    }
    if (processedResponse.infoAcquired) {
        // messageResponse.style.hidden = true;
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
        } else if (processedResponse.action === "Update multiple events") {
            for (let event of processedResponse.data) {
                await updateEvent(event);
            }
        } else if (processedResponse.action === "Delete an event") {
            const event = processedResponse.data[0];
            await deleteEvent(event);
        } else if (processedResponse.action === "Delete multiple events") {
            for (let event of processedResponse.data) {
                await deleteEvent(event);
            }
        } else if (processedResponse.action === "Get an event") {
            const event = processedResponse.data[0];
            await getEvent(event);
        } else if (processedResponse.action === "Get multiple events") {
            for (let event of processedResponse.data) {
                await getEvent(event);
            }
        }

        if (loop === 1) {
            prompt = `Tell the user that you have completed the action and ask if they need help with anything else. For this message only, you don't need to mention "Information acquired" or the action or the data. Just provide the message.`;
            result = await chat.sendMessage(prompt);
            response = await result.response;
            text = await response.text();
            messageResponse = document.createElement("p");
            messageResponse.innerText = text;
            messageResponse.className = "chatbot";
            messagesElem.appendChild(messageResponse);
        }
    }
    prompt = null;
    loop -= 1;
}
