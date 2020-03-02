import express from "express";
import * as bodyParser from "body-parser";
import request from 'request';

const app = express();
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());
// const port = 8080; // default port to listen
const GRAPH_TOKEN = process.env.GRAPH_TOKEN;

// start the Express server /
app.listen(process.env.PORT, () => console.log('Example app listening on port env!'));

// define a route handler for the default home page
app.get("/", (req, res) => {
    res.send("Hello world!");
});

app.get('/webhook', (req, res) => {
    // Your verify token. Should be a random string.
    const VERIFY_TOKEN = process.env.WEBHOOK_VERIFY_TOKEN;

    // Parse the query params
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    // Checks if a token and mode is in the query string of the request
    if (mode && token) {

        // Checks the mode and token sent is correct
        if (mode === 'subscribe' && token === VERIFY_TOKEN) {

            // Responds with the challenge token from the request
            console.log('WEBHOOK_VERIFIED');
            res.status(200).send(challenge);

        } else {
            // Responds with '403 Forbidden' if verify tokens do not match
            res.sendStatus(403);
        }
    }
    else {
        res.sendStatus(403);
    }
});

app.post('/webhook', (req, res) => {

    const sendMessage = (senderPSID: string, message: string) => {
        request.post(`https://graph.facebook.com/v6.0/me/messages?access_token=${GRAPH_TOKEN}`, {
            json: {
                "recipient": {
                    "id": senderPSID
                },
                "message": {
                    "text": message
                }
            }
        }, (error) => {
            if (error) {
                console.error(error)
                return
            }
            // console.log(`statusCode: ${res.statusCode}`)
            // console.log(body)
        })
    }

    // Handles messages events
    const handleMessage = (senderPSID: string, receivedMessage: any) => {

        request.post(`https://graph.facebook.com/v6.0/me/messages?access_token=${GRAPH_TOKEN}`, {
            json: {
                "recipient": {
                    "id": senderPSID
                },
                "sender_action": "typing_on"
            }
        }, (error) => {
            if (error) {
                console.error(error)
                return
            }
            // console.log(`statusCode: ${res.statusCode}`)
            // console.log(body)
        })

        const text = receivedMessage.text
        const query = text.split(" ")
        switch (query[0].toLowerCase()) {
            case "help":
                sendMessage(senderPSID,
                    `
                    Searching:
                    > Type "search <space> <keyword to search>"
                    > Example: search gravity
                    `)
                break;
            default:
                sendMessage(senderPSID, "I do not understand what you're saying. Please type \"help\" for the list of commands.")
        }
    }
    const handlePostback = (senderPSID: string, receivedPostback: any) => {

        // Get the payload for the postback
        const payload = receivedPostback.payload;

        if (payload === 'GET_STARTED') {
            // placeholder
        }
    }

    const body = req.body;

    if (body.object === 'page') {

        // Iterates over each entry - there may be multiple if batched
        body.entry.forEach((entry: any) => {

            // Gets the message. entry.messaging is an array, but
            // will only ever contain one message, so we get index 0
            const webhookEvent = entry.messaging[0];
            console.log(webhookEvent);

            // Get the sender PSID
            const senderPSID = webhookEvent.sender.id;
            console.log('Sender PSID: ' + senderPSID);

            // Check if the event is a message or postback and
            // pass the event to the appropriate handler function
            if (webhookEvent.message) {
                console.log("webhookEvent.message >> TRUE")
                handleMessage(senderPSID, webhookEvent.message);
            } else if (webhookEvent.postback) {
                console.log("webhookEvent.postback >> TRUE")
                handlePostback(senderPSID, webhookEvent.postback);
            }
        });

        // Returns a '200 OK' response to all requests
        res.status(200).send('EVENT_RECEIVED');
    } else {
        // Returns a '404 Not Found' if event is not from a page subscription
        res.sendStatus(404);
    }

});

// start the Express server
// app.listen( port, () => {
//     // tslint:disable-next-line:no-console
//     console.log( `server started at http://localhost:${ port }` );
// } );