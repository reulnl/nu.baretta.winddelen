/* From Homey SDK 2.0 docs: The file device.js is a representation of an already paired device on Homey */
'use strict';

const Homey = require('homey');

var http = require("https");
var httpmin = require("http.min");
var et = require('elementtree');
var XML = et.XML;
var ElementTree = et.ElementTree;
var Element = et.Element;
var SubElement = et.SubElement;

var devices = {};
var baseurl1 = "https://backend.windcentrale.nl/windcentrale/productie"
var baseurl2 = "https://zep-api.windcentrale.nl/production/"

class winddelen extends Homey.Device {

    onInit() {
        this.log('device init');
        console.dir("getData: "); // for debugging
        console.dir(this.getData()); // for debugging
        console.dir("getSettings: "); // for debugging
        console.dir(this.getSettings()); // for debugging
        let device = this; // We're in a Device instance
        let settings = this.getSettings();
        this.log("Settings: ");
        this.log(settings['windmillID']);
        this.log(settings['numberofwinddelen']);
        this.log(settings);
        let name = this.getName() + '_' + this.getData().id;
        let cronName = name.toLowerCase();
        this.log("cronName: ");
        this.log(cronName);
        let tokens = {};
        let state = {};

        Homey.ManagerCron.getTask(cronName)
            .then(task => {
                this.log("The task exists: " + cronName);
                task.on('run', () => this.checkProduction(settings));
            })
            .catch(err => {
                if (err.code == 404) {
                    this.log("The task has not been registered yet, registering task: " + cronName);
                    Homey.ManagerCron.registerTask(cronName, "3-59/5 * * * *", settings)
                        .then(task => {
                            task.on('run', () => this.checkProduction(settings));
                        })
                        .catch(err => {
                            this.log(`problem with registering cronjob: ${err.message}`);
                        });
                } else {
                    this.log(`other cron error: ${err.message}`);
                }
            });

        //run once to get the first data
        this.checkProduction(settings);

    } // end onInit

    onAdded() {
        let id = this.getData().id;
        this.log('device added: ', id);

    } // end onAdded

    onDeleted() {

        let id = this.getData().id;
        let name = this.getName() + '_' + this.getData().id;
        let cronName = name.toLowerCase();
        this.log('Unregistering cron:', cronName);
        Homey.ManagerCron.unregisterTask(cronName, function (err, success) {});
        //Homey.ManagerCron.unregisterAllTasks(function (err, success) {});

        this.log('device deleted:', id);

    } // end onDeleted

    checkProduction(settings) {

        var numberofwinddelen = settings['numberofwinddelen'];

        // fetch current power and wind speed and direction
        this.log("settings['windmillID']: ");
        this.log(settings['windmillID']);
        //var url1 = baseurl1 + "?id=" + settings['windmillID'];
        var url1 = baseurl1 + "_" + settings['windmillID'] + ".txt";
        var url2 = baseurl2 + settings['windmillID'];

        var DATA = http.get(url1, (result) => {

            if (result.statusCode == 200) {

                result.on('data', (body) => {
                    var response = body.toString().split(",");
                    // the winddelen backend will continue outputting data for minutes, only need 1 line
                    result.destroy();

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
                        var wind = response[0];

                        if (this.getCapabilityValue('measure_power') != power) {
                            this.setCapabilityValue('measure_power', power);
                        }

                        if (this.getCapabilityValue('measure_wind') != wind) {
                            this.setCapabilityValue('measure_wind', wind);
                        }

                        //   this.log("Winddelen app - [" + this.getName() + "] Energy: " + energy + "kWh");
                        this.log("Winddelen app - [" + this.getName() + "] Power: " + power + "W");
                        this.log("Winddelen app - [" + this.getName() + "] Wind: " + wind + " Bft");

                });
            } else {
                this.log("Winddelen app - [" + this.getName()  + "] Unavailable: " + result.response.statusCode + " error");
            }
        });
        DATA.on('error', (err) => {
            this.log("Winddelen app - [" + this.getName() + "]" + ` problem with request: ${err.message}`);
        });

        httpmin.get(url2).then((result) => {
                if (result.response.statusCode == 200) {

                    var etree = et.parse(result.data);
                    var winddelenpermill = etree.findall('./productie')[0].get('winddelen');
                    var energy = Number(etree.findall('./productie/subset')[0].get('sum')) / winddelenpermill * numberofwinddelen;
                    var yieldYearly = Number(etree.findall('./productie/subset/[@interval="MONTH"]')[0].get('sum')) / winddelenpermill * numberofwinddelen;
                    // output in KWh, using MWh in interface
                    var yieldLifetime = Number(etree.findall('./productie/subset/[@interval="YEAR"]')[0].get('sum')) / winddelenpermill * numberofwinddelen / 1000;

                    if (this.getCapabilityValue('meter_power') != energy) {
                        this.setCapabilityValue('meter_power', energy );
                    }

                    if (this.getCapabilityValue('meter_year') != yieldYearly) {
                        this.setCapabilityValue('meter_year', yieldYearly);
                    }

                    if (this.getCapabilityValue('meter_lifetime') != yieldLifetime) {
                        this.setCapabilityValue('meter_lifetime', yieldLifetime);
                    }
                    this.log("Winddelen app - [" + this.getName() + "] Number of shares per mill: " + winddelenpermill);
                    this.log("Winddelen app - [" + this.getName() + "] Production today: " + energy + "kWh");
                    this.log("Winddelen app - [" + this.getName() + "] Year to date: " + yieldYearly + "kWh");
                    this.log("Winddelen app - [" + this.getName() + "] Lifetime: " + yieldLifetime + "MWh");
                } else {
                    this.log("Winddelen app - [" + this.getName() + "] URL2: " + url2 + " did not load");
                }
            })
            .catch((err) => {
                this.log("Winddelen app - [" + this.getName() + "]" + ` problem with request: ${err.message}`);
            });
    }

}

module.exports = winddelen;
