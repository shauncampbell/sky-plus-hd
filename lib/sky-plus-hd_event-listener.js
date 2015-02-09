"use strict";

var eventEmitter = require('events').EventEmitter;
var freeport = require('freeport');
var http = require('http');
var ip = require('ip');
var q = require('q');
var util = require('util');

var SkyPlusHDXmlParser = require('./sky-plus-hd_xml-parser');
var SkyPlusHDHttpRequest = require('./sky-plus-hd_http-request');

q.longStackSupport = true;

/**
 * SkyPlusHDEventListener - subscribes to notifications from a sky box and emits events when changes are detected
 * @private
 * @param {String} eventSubscriptionUrl - a service's eventSubURL to subscribe to
 * @constructor
 */
var SkyPlusHDEventListener = function(eventSubscriptionUrl) {

	var self = this;
	var listeningSocket;
	var listeningPort;
	var sid;

	/**
	 * Open a TCP socket to receive notifications from a SkyPlusHD box.
	 * @returns {Promise} - resolved when the socket is listening
	 */
	function listenForNotifications() {
		var deferred = q.defer();
		listeningSocket = http.createServer(function(req, res) {
			if (sid && req.headers.sid !== sid) {
				res.writeHead(404,{'Content-Type':'text/plain'});
				res.end();
				return;
			}
			var chunks = "";
			req.on('data',function(chunk) { chunks+=chunk; });
			req.on('end',function() {
				new SkyPlusHDXmlParser(chunks).then(function(result) {
					new SkyPlusHDXmlParser(result['e:propertyset']['e:property'].LastChange).then(function(results) {
						var ev = {
							TransportState: results.Event.InstanceID.TransportState.$.val,
							CurrentTrackURI: results.Event.InstanceID.CurrentTrackURI.$.val,
							TransportPlaySpeed: results.Event.InstanceID.TransportPlaySpeed.$.val,
							AVTransportURI: results.Event.InstanceID.AVTransportURI.$.val,
							TransportStatus: results.Event.InstanceID.TransportStatus.$.val,
						};
						self.emit('notification',ev);
					});
				});
			});
			res.writeHead(200,{'Content-Type':'text/plain'});
			res.end('OK');
		}).listen(listeningPort,function() {
			deferred.resolve();
		});
		return deferred.promise;
	}

	/**
	 * Submits a subscription request to a SkyPlusHD box - if a previous subscription is still valid, renews that subscription
	 * @returns {Promise} resolved when subscription request is acknowleged
	 */
	function subscribe() {
		var deferred = q.defer();
		SkyPlusHDHttpRequest.device({
			url: eventSubscriptionUrl,
			method: 'SUBSCRIBE',
			headers: (sid) ? {
				sid: sid
			} : {
				callback: util.format("<http://%s:%d>",ip.address(),listeningPort),
				nt: 'upnp:event'
			}
		}).then(function(response) {
			sid = response.headers.sid;
			deferred.resolve(sid);
		}).fail(function(err) {
			deferred.reject(err);
		});
		return deferred.promise;
	}

	this.start = function() {
		var deferred = q.defer();
		freeport(function(err, port) {
			if (err) {
				console.log("FREE PORT FAILED");
				deferred.reject(err);
			} else {
				listeningPort = port;
				listenForNotifications().then(function() {
					subscribe().then(function() {
						deferred.resolve();
					});
				});
			}
		});
		return deferred.promise;
	};
};
util.inherits(SkyPlusHDEventListener, eventEmitter);

module.exports = SkyPlusHDEventListener;