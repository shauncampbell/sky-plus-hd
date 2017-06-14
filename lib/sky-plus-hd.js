"use strict";

var SkyPlusHDFinder = require('./sky-plus-hd_finder');

/**
 * Find a SkyPlusHDBox on the local network
 * @see SkyPlusHDFinder.find
 */
module.exports.findBox = function(ipAddress, config) {
	var finder = new SkyPlusHDFinder(config);
	return finder.findBox(ipAddress);
};