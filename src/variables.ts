export enum APIs {
    WIKIPEDIA = 'https://en.wikipedia.org/w/api.php?origin=*&action=query&generator=prefixsearch&prop=extracts&exintro=1&explaintext=1&redirects=1&format=json&gpssearch=',
    CURRENCY_EXCHANGE = 'https://api.exchangeratesapi.io/latest',
    OPENWEATHER = 'https://api.openweathermap.org/data/2.5/weather',
    UTILIBOT_UTILS = 'http://utility-bot-utils.herokuapp.com/utilitybot/scrape/',
}

export enum MESSAGES {
    ERROR = `I don\'t understand what you're saying :/ Please type \"help\" for the list of commands.`
}