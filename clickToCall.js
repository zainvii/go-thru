const { Builder,By } = require('selenium-webdriver');
const selenium  = require('selenium-webdriver');
const chrome = require('selenium-webdriver/chrome');


(async function example() {

let chromeOptions = new chrome.Options();

// Set preferences
chromeOptions.setUserPreferences({
    'profile.managed_default_content_settings.media_stream': 1,
    'profile.managed_default_content_settings.media_stream_mic': 1,
    'profile.managed_default_content_settings.media_stream_camera': 1
});

const driver = new Builder()
    .forBrowser('chrome')
    .setChromeOptions(chromeOptions)
    .build();
    try {
        let url = "https://click2connect.tech/button/default/4607708259713024?customer_data=1717243730442&nscode=dGMtYnBvLmNhbGxjZW50ZXJzdHVkaW8uY29t&cwid=ahRzfm11c3RlcmktaGl6bWV0bGVyaXIaCxINQ2xpY2syQ29ubmVjdBiAgLLw-tWXCAyiARt0Yy1icG8uY2FsbGNlbnRlcnN0dWRpby5jb20";
        await driver.get(url);
        let title = await driver.getTitle();
        console.log('Title:', title);

    } finally {
        // Close the browser
        // await driver.quit();
    }
})();
