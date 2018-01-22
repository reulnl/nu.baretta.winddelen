"use strict";

var http = require("http");
var httpmin = require("http.min");
var et = require('elementtree');
var XML = et.XML;
var ElementTree = et.ElementTree;
var Element = et.Element;
var SubElement = et.SubElement;

var devices = {};
var baseurl1 = "http://backend.windcentrale.nl/windcentrale/productie"
var baseurl2 = "https://zep-api.windcentrale.nl/production/"

module.exports.init = function (devices_data, callback) {
    devices_data.forEach(function (device_data) {
        initDevice(device_data, false);
    });
    callback(null, true);
};

module.exports.pair = function (socket) {
    socket.on("validate", function (data, callback) {
        Homey.log("Winddelen app - ID: " + data.id + " number winddelen: " + data.numberofwinddelen);
        var url = baseurl1 + "?id=" + device_data.id;

        http.get(url).then(function (result) {
            if (result.response.statusCode == 200 || result.response.statusCode == 304) {
                callback(null, true);
            } else {
                callback(__("login_error"), null);
            }
        });
    });
};

module.exports.added = function (device_data, callback) {
    Homey.log("Winddelen app - [" + device_data.name + "] Added");

    initDevice(device_data, true);
    callback(null, true);
};

module.exports.deleted = function (device_data, callback) {
    Homey.log("Winddelen app - [" + device_data.name + "] Deleted");

    Homey.manager("cron").unregisterTask(devices[device_data.id].cron_name, function (err, success) {});

    delete devices[device_data.id];
    callback(null, true);
};

module.exports.renamed = function (device_data, new_name) {
    Homey.log("Winddelen app - [" + device_data.name + "] Renamed to: " + new_name);

    devices[device_data.id].name = new_name;
};

module.exports.capabilities = {
    measure_power: {
        get: function (device_data, callback) {
            var device = devices[device_data.id];

            if (device === undefined) {
                callback(null, 0);
            } else {
                callback(null, device.power);
            }
        }
    },
    measure_wind: {
        get: function (device_data, callback) {
            var device = devices[device_data.id];

            if (device === undefined) {
                callback(null, 0);
            } else {
                callback(null, device.wind);
            }
        }
    },
    meter_power: {
        get: function (device_data, callback) {
            var device = devices[device_data.id];

            if (device === undefined) {
                callback(null, 0);
            } else {
                callback(null, device.energy);
            }
        }
    },
    meter_year: {
        get: function (device_data, callback) {
            var device = devices[device_data.id];

            if (device === undefined) {
                callback(null, 0);
            } else {
                callback(null, device.year);
            }
        }
    },
    meter_lifetime: {
        get: function (device_data, callback) {
            var device = devices[device_data.id];

            if (device === undefined) {
                callback(null, 0);
            } else {
                callback(null, device.lifetime);
            }
        }
    }

};

function initDevice(device_data, cron) {
    Homey.log("Winddelen app - [" + device_data.name + "] Initializing device");

    var device = devices[device_data.id] = {
        name: device_data.name,
        cron_name: "winddelen_" + device_data.id,
        last_output: "0:00",
        power: 0,
        energy: 0
    };

    if (cron) {
        Homey.manager("cron").registerTask(device.cron_name, "*/5 * * * *", device_data, function (err, task) {
            if (err !== null) {
                Homey.log("Winddelen app - [" + device.name + "] Error while creating cron job: " + err);
            }
        });
    }

    Homey.manager("cron").on(device.cron_name, function (device_data) {
        checkProduction(device_data);
    });
}

function checkProduction(device_data) {
    var device = devices[device_data.id];
    var numberofwinddelen = device_data.numberofwinddelen;

    // fetch current power and wind speed and direction
    var url1 = baseurl1 + "?id=" + device_data.id;
    var url2 = baseurl2 + device_data.id;

    http.get(url1, (result) => {

        if (result.statusCode == 200) {
            module.exports.setAvailable(device_data);
            result.on('data', (body) => {
                var response = body.toString().split(",");
                var last_output = response[2];

                if (last_output != device.last_output) {
                    device.last_output = last_output;
                    // sample output:
                    // ZO 5,1455,147,62,66,19.4,0,1031797,1609.0833333333,N 4,1489318632,71764
                    // response[0] -> wind direction and force (Beaufort)
                    // response[1] -> current total power for windmill 
                    // response[2] -> current power per share 
                    // response[3] -> % of max. power 
                    // response[4] -> 66, ?
                    // response[5] -> 19.4, temp?
                    // response[6] -> 0, ?
                    // response[7] -> total lifetime energy (kWh),
                    // response[8] -> 1609.0833, ?
                    // response[9] -> N 4, ?
                    // response[10] -> 1489318632,?
                    // response[11] -> 71764 ?

                    var power = Number(response[2]) * numberofwinddelen;
                    device.power = power;
                    module.exports.realtime(device_data, "measure_power", power);

                    var wind = response[0];
                    device.wind = wind;
                    module.exports.realtime(device_data, "measure_wind", wind);

                    //   Homey.log("Winddelen app - [" + device_data.name + "] Energy: " + energy + "kWh");
                    Homey.log("Winddelen app - [" + device_data.name + "] Power: " + power + "W");
                    Homey.log("Winddelen app - [" + device_data.name + "] Wind: " + wind + " Bft");
                } else {
                    Homey.log("Winddelen app - [" + device_data.name + "] No new data");
                }
            });
            // the winddelen backend will continue outputting data for minutes, only need 1 line 
            result.destroy();
        } else {
            Homey.log("Winddelen app - [" + device_data.name + "] Unavailable: " + result.response.statusCode + " error");

            module.exports.setUnavailable(device_data, result.response.statusCode + " error");
        }
    });

    httpmin.get(url2).then(function (result) {
        if (result.response.statusCode == 200) {
            module.exports.setAvailable(device_data);

            var etree = et.parse(result.data);
            var winddelenpermill = etree.findall('./productie')[0].get('winddelen');
            var energy = Number(etree.findall('./productie/subset')[0].get('sum')) / winddelenpermill * numberofwinddelen;
            var yieldYearly = Number(etree.findall('./productie/subset/[@interval="MONTH"]')[0].get('sum')) / winddelenpermill * numberofwinddelen;
            var yieldLifetime = Number(etree.findall('./productie/subset/[@interval="YEAR"]')[0].get('sum')) / winddelenpermill * numberofwinddelen;

            device.energy = energy;
            module.exports.realtime(device_data, "meter_power", device.energy);

            device.year = yieldYearly;
            module.exports.realtime(device_data, "meter_year", device.year);

            device.lifetime = yieldLifetime / 1000;
            module.exports.realtime(device_data, "meter_lifetime", device.lifetime);

            Homey.log("Winddelen app - [" + device_data.name + "] Number of shares per mill: " + winddelenpermill);
            Homey.log("Winddelen app - [" + device_data.name + "] Production today: " + device.energy + "kWh");
            Homey.log("Winddelen app - [" + device_data.name + "] Year to date: " + device.year + "kWh");
            Homey.log("Winddelen app - [" + device_data.name + "] Lifetime: " + device.lifetime + "MWh");
        } else {
            Homey.log("Winddelen app - [" + device_data.name + "] URL2: " + url2 + " did not load");
        }
    });
}