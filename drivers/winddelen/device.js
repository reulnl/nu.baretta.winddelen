'use strict';

const Homey = require('homey');

const POLL_INTERVAL = 60 * 1000; 

var http = require("https");
var httpmin = require("http.min");
var et = require('elementtree');
var XML = et.XML;
var ElementTree = et.ElementTree;
var Element = et.Element;
var SubElement = et.SubElement;

var devices = {};
var baseurl1 = "https://zep-api.windcentrale.nl/production/"
var baseurl2 = "https://zep-api.windcentrale.nl/production/"

class winddelen extends Homey.Device {

    async onInit() {
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
        let tokens = {};
        let state = {};

        //run once to get the first data
        this.checkProduction(settings);

        this.update = this.homey.setInterval(async () => {
            await this.checkProduction(settings);
        }, POLL_INTERVAL);

    } // end onInit




   onAdded() {
        let id = this.getData().id;
        this.log('device added: ', id);

    } // end onAdded
 
    onDeleted() {

        let id = this.getData().id;
        
        //reset update cycle
        this.homey.clearInterval(this.update);
        this.update = undefined;
        this.log('device deleted:', id);
    
        this.checkProduction(settings);
        this.update = this.homey.setInterval(async () => {
            await this.checkProduction(settings);
        }, POLL_INTERVAL);

        this.log("reset update cycle");

    } // end onDeleted

    checkProduction(settings) {

        var numberofwinddelen = settings['numberofwinddelen'];

        // fetch current power and wind speed and direction
        this.log("settings['windmillID']: ");
        this.log(settings['windmillID']);
        //var url1 = baseurl1 + "?id=" + settings['windmillID'];
        var url1 = baseurl1 + settings['windmillID'] + "/live";
		this.log("Live API URL: - " + url1);
        var url2 = baseurl2 + settings['windmillID'];

        httpmin.get(url1).then((result) => {

            if (result.response.statusCode == 200) {

				var obj = JSON.parse(result.data);
                

                        var power = (obj["powerAbsWd"]) * numberofwinddelen;
                        var wind = (obj["windSpeed"]);

                        if (this.getCapabilityValue('measure_power') != power) {
                            this.setCapabilityValue('measure_power', power);
                        }

                        if (this.getCapabilityValue('measure_wind_strength') != wind) {
                            this.setCapabilityValue('measure_wind_strength', wind);
                        }

                        //   this.log("Winddelen app - [" + this.getName() + "] Energy: " + energy + "kWh");
                        this.log("Winddelen app - [" + this.getName() + "] Power: " + power + "W");
                        this.log("Winddelen app - [" + this.getName() + "] Wind: " + wind + "km/h");

                
            } else {
                this.log("Winddelen app - [" + this.getName()  + "] Unavailable: " + result.response.statusCode + " error");
            }
        })
        .catch((err) => {
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
