const express = require("express");
const bodyParser = require("body-parser");
const { google } = require("googleapis");
const { GoogleGenerativeAI } = require("@google/generative-ai");
require("dotenv").config(); // Load environment variables from .env file

const app = express();
const port = process.env.PORT;

app.use(bodyParser.json());

// List of allowed origins
const allowedOrigins = [
    "chrome-extension://cnkiadfggjfkhlkbjmnohkonhpdbdjpc",
    "chrome-extension://ibgenhokhbnjedblbdadcippmamblnip",
    "chrome-extension://bhkceimljabijhhfkcgjemnfglpphaka",
];

// CORS middleware
app.use((req, res, next) => {
    const origin = req.headers.origin;
    if (allowedOrigins.includes(origin)) {
        res.header("Access-Control-Allow-Origin", origin);
    }

    res.header(
        "Access-Control-Allow-Headers",
        "Origin, X-Requested-With, Content-Type, Accept"
    );

    next();
});

function getCalendar(token) {
    const oauth2Client = new google.auth.OAuth2(
        process.env.CLIENT_ID,
        process.env.CLIENT_SECRET,
        process.env.REDIRECT_URI
    );
    oauth2Client.setCredentials({ access_token: token });
    const calendar = google.calendar({ version: "v3", auth: oauth2Client });
    return calendar;
}

const genai = new GoogleGenerativeAI(process.env.GEMINI);
const model = genai.getGenerativeModel({ model: "gemini-1.5-flash" });

app.post("/create-events", async (req, res) => {
    try {
        const { token, events } = req.body;
        const calendar = getCalendar(token);
        let responses = [];
        for (let event of events) {
            if (!(event.start && event.end)) {
                delete event.start;
                delete event.end;
            } else {
                event.start = { dateTime: event.start };
                event.end = { dateTime: event.end };
            }
            responses.push(
                await calendar.events.insert({
                    calendarId: "primary",
                    resource: event,
                })
            );
        }
        res.status(200).send(responses.map((response) => response.data));
    } catch (error) {
        console.log(error);
        res.status(500).send(error);
    }
});

app.post("/update-events", async (req, res) => {
    try {
        const { token, events } = req.body;
        const calendar = getCalendar(token);
        let responses = [];
        let eventId;
        for (let event of events) {
            if (!(event.start && event.end)) {
                delete event.start;
                delete event.end;
            } else {
                event.start = { dateTime: event.start };
                event.end = { dateTime: event.end };
            }
            eventId = event.eventId;
            delete event.eventId;
            responses.push(
                await calendar.events.update({
                    calendarId: "primary",
                    eventId: eventId,
                    resource: event,
                })
            );
        }
        res.status(200).send(responses.map((response) => response.data));
    } catch (error) {
        console.log(error);
        res.status(500).send(error);
    }
});

app.post("/delete-events", async (req, res) => {
    try {
        const { token, events } = req.body;
        const calendar = getCalendar(token);
        let responses = [];
        let eventId;
        for (let event of events) {
            eventId = event.eventId;
            delete event.eventId;
            responses.push(
                await calendar.events.delete({
                    calendarId: "primary",
                    eventId: eventId,
                })
            );
        }
        res.status(200).send({ message: "Events deleted successfully" });
    } catch (error) {
        res.status(500).send(error);
    }
});

app.post("/list-events", async (req, res) => {
    try {
        const { token, request } = req.body;
        const calendar = getCalendar(token);

        if (!request.start && !request.end) {
            request.start = new Date(
                Date.now() - 8 * 60 * 60 * 1000
            ).toISOString();
            request.end = new Date(
                Date.now() + 56 * 60 * 60 * 1000
            ).toISOString();
        }

        const response = await calendar.events.list({
            calendarId: "primary",
            timeMin: request.start,
            timeMax: request.end,
            singleEvents: true,
            orderBy: "startTime",
        });

        let formattedEvents = response.data.items.map((event) => ({
            title: event.summary,
            eventId: event.id,
            start: event.start.dateTime,
            end: event.end.dateTime,
            colorId: event.colorId,
        }));

        res.status(200).send(formattedEvents);
    } catch (error) {
        res.status(500).send(error);
    }
});

app.post("/get-events", async (req, res) => {
    try {
        const { token, events } = req.body;
        const calendar = getCalendar(token);
        let responses = [];
        let eventId;
        for (let event of events) {
            eventId = event.eventId;
            delete event.eventId;
            responses.push(
                await calendar.events.get({
                    calendarId: "primary",
                    eventId: eventId,
                })
            );
        }
        res.status(200).send(responses.map((response) => response.data));
    } catch (error) {
        res.status(500).send(error);
    }
});

app.post("/send-ai-message", async (req, res) => {
    try {
        let { prompt, history } = req.body;

        let chat = model.startChat({
            history: history,
            generationConfig: { temperature: 0 },
        });

        let result = await chat.sendMessage(prompt);
        let response = await result.response;
        let text = await response.text();

        res.status(200).send({ text });
    } catch (error) {
        res.status(500).send(error);
    }
});

app.get("/", (req, res) => {
    res.sendFile(__dirname + "/get.html");
});

app.use("/get.js", (req, res, next) => {
    res.type(".js");
    next();
});

app.use("/chat.js", (req, res, next) => {
    res.type(".js");
    next();
});

app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});
