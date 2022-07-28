"use strict";
// need Homey module, see SDK Guidelines
const Homey = require('homey');

class winddelenDriver extends Homey.Driver {

    onPair(session) {

        let devices = [
            {
                "name": "My Device",
                "data": { "id": "abcd" },
                "settings": {
                    "windmilID": 'windmillID',
                    "numberofwinddelen": 'numberofwinddelen',
                }
            }
        ]

        // this is called when the user presses save settings button in pair.html
        session.setHandler("get_devices", async (data) => {
            devices = device_data;
            return devices;
        });

        // this happens when user clicks away the pairing windows
        session.setHandler('disconnect', () => {
            this.log("Winddelen - Pairing is finished (done or aborted) ");
        })

    } // end onPair

}
module.exports = winddelenDriver;
