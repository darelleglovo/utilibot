import express from 'express';
import * as bodyParser from 'body-parser';
import request from 'request';
import { APIs, MESSAGES } from './variables';
import dedent from 'dedent-js';
import cache from 'memory-cache';
import { capitalize } from 'lodash';

var Dictionary = require("oxford-dictionary");
var config = {
    app_id: "77714543",
    app_key: "d75c95e6592142ac7f6f31b0870ee765",
    source_lang: "en-us"
};
var dict = new Dictionary(config);

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
        })
    }

    // Handles messages events
    const handleMessage = (senderPSID: string, firstName: string, receivedMessage: any) => {

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
        })
        console.log('CACHE', cache.get(senderPSID));
        const text = receivedMessage.text
        const query = text.split(" ")
        const isCached = cache.get(senderPSID);
        if (isCached) {
            const currentCache = cache.get(senderPSID);
            switch (currentCache.split(':')[0]) {
                case 'search': {
                    const searchKeyword = currentCache.split(':')[1];
                    console.log(searchKeyword);
                    request(APIs.WIKIPEDIA + searchKeyword, { json: true }, (err, res, body) => {
                        if (err) { return console.log(err); }
                        try {
                            const { pages } = body.query;
                            const object = Object.keys(pages)[text - 1];
                            console.log(object);
                            console.log(pages[object]);
                            const contentBody = pages[object].extract.split('\n');
                            console.log(contentBody);
                            // const response = pages[object].title + '\n' + pages[object].extract
                            // console.log(response);
                            console.log(firstName)
                            sendMessage(senderPSID, `Here's what I've found :)`)
                            for (let i = 0; i < contentBody.length; i++) {
                                console.log(i, contentBody.length)
                                sendMessage(senderPSID, contentBody[i]);
                            }
                            cache.del(senderPSID);
                            // sendMessage(senderPSID, response); 
                        } catch (e) {
                            console.log(e);
                            cache.del(senderPSID);
                            sendMessage(senderPSID, "Invalid choice, please try again.")
                            return;
                        }

                    });
                    break;
                }
                default:
                    sendMessage(senderPSID, MESSAGES.ERROR)
                    break;

            }
            return;

        }
        switch (query[0].toLowerCase()) {
            case 'search':
                const searchKeyword = query.shift();
                // const choice = query.pop();
                const searchString = query.join(' ');

                if (searchKeyword == "") {
                    sendMessage(senderPSID, "Search what?..")
                    return;
                }
                request(APIs.WIKIPEDIA + searchString, { json: true }, (err, res, body) => {
                    if (err) { return console.log(err); }
                    let choices = dedent`Select a number from the search results:` + '\n';
                    let choiceNumber = 1;
                    for (const searchResult in body.query.pages) {
                        const { pages } = body.query;
                        choices += `${choiceNumber}. ${pages[searchResult].title} \n`
                        choiceNumber++;
                    }
                    cache.put(senderPSID, `search:${searchString}`);
                    sendMessage(senderPSID, choices);
                    return;
                });
                break;
            case 'currexrate':
                let value: number;
                let baseCurrency: string;
                let counterCurrency: string;
                let baseCurrencyValue: number;
                let counterCurrencyValue: number;
                if (query.length === 5) {
                    try {
                        value = query[1];
                        baseCurrency = query[2].toUpperCase();
                        counterCurrency = query[4].toUpperCase();
                        request(APIs.CURRENCY_EXCHANGE + `?symbols=${baseCurrency},${counterCurrency}&base=${baseCurrency}`, { json: true }, (err, res, body) => {
                            if (err) { return console.log(err); }
                            baseCurrencyValue = body.rates[baseCurrency];
                            counterCurrencyValue = body.rates[counterCurrency];
                            const date = body.date;
                            let result: number = value * counterCurrencyValue;
                            sendMessage(senderPSID, dedent`As of ${date}
                            ${value} ${baseCurrency} is equal to ${result} ${counterCurrency}`);
                        });
                    } catch (e) {
                        console.log(e);
                        sendMessage(senderPSID, MESSAGES.ERROR);
                    }
                } else {
                    sendMessage(senderPSID, MESSAGES.ERROR);
                }
                break;
            case 'weather':
                const city = query[1];
                const country = query[2];
                request(APIs.OPENWEATHER + `?q=${city},${country}&units=metric&appid=${process.env.OPENWEATHER_TOKEN}`, { json: true }, (err, res, body) => {
                    console.log(body.cod);
                    if (body.cod == 404) {
                        sendMessage(senderPSID, 'City not found');
                    } else if (body.cod == 200) {
                        const response = dedent`
                        ${body.name}, ${body.sys.country} weather as of now:
                        ${capitalize(body.weather[0].description)}
                        ${body.main.temp}C

                        By OpenWeather
                        `;
                        sendMessage(senderPSID, response);
                    }
                });
                break;
            case 'define':
                var lookup = dict.find("awesome");

                lookup.then(function (res: any) {
                    console.log(JSON.stringify(res, null, 4));
                },
                    function (err: any) {
                        console.log(err);
                    });
                break;
            case 'help':
                const a = dedent`
				Searching:
				> Type "search <keyword to search>"
				> Example: search gravity
				Currency exchange:
				> Type "currexrate <base value> <base currency> to <counter currency>"
				> Example: currexrate 5 usd to php
                `;
                sendMessage(senderPSID, a);
                break;
            default:
                sendMessage(senderPSID, MESSAGES.ERROR)
        }
        cache.del(senderPSID);
    }
    const handlePostback = (senderPSID: string, firstName: string, receivedPostback: any) => {

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
            const senderPSID: string = webhookEvent.sender.id;
            const firstName = webhookEvent.sender.first_name;
            console.log('Sender PSID: ' + senderPSID);

            // Check if the event is a message or postback and
            // pass the event to the appropriate handler function
            if (webhookEvent.message) {
                console.log("webhookEvent.message >> TRUE")
                handleMessage(senderPSID, firstName, webhookEvent.message);
            } else if (webhookEvent.postback) {
                console.log("webhookEvent.postback >> TRUE")
                handlePostback(senderPSID, firstName, webhookEvent.postback);
            }
        });

        // Returns a '200 OK' response to all requests
        res.status(200).send('EVENT_RECEIVED');
    } else {
        // Returns a '404 Not Found' if event is not from a page subscription
        res.sendStatus(404);
    }

});
