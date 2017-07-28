/*
 * This Source Code Form is subject to the terms of the Mozilla Public License,
 * v. 2.0. If a copy of the MPL was not distributed with this file, You can
 * obtain one at http://mozilla.org/MPL/2.0/.
 *
 * Copyright (c) 2015 Digi International Inc., All Rights Reserved.
 */

/*
 * Angular service to wrap SocketIO functionality
 * for the XBee ZigBee Cloud Kit.
 * Based on:
 *
 * angular-socket-io v0.2.0
 * (c) 2013 Brian Ford http://briantford.com
 * License: MIT
 *
 * Changes:
 * - turned "socket" into a service within the XBeeGatewayApp rather than a
 *   stand-alone provider in a separate module
 * - removed "forward" method
 */

'use strict';

angular.module('XBeeGatewayApp')
    .service('socket', function ($rootScope, $timeout, $log, $location) {
        /* istanbul ignore next */
        if ($location.port() == 5859) {
            // E2E-testing port. Disable socket.io functionality.
            return {
                on: angular.noop,
                emit: angular.noop,
                addListener: angular.noop,
                removeListener: angular.noop,
                reconnect: angular.noop,

                state: {
                    connected: true,
                    connecting: false,
                    known: true
                }
            };
        }

        var socketOptions = {
            transports: ['xhr-polling'],
            // reconnect: true
        };
        var socket = io.connect('/device', socketOptions);

        var _state = {
            connected: false,
            connecting: true,
            // By default we don't "know" the connection state. (Well, we do,
            // but let's ignore that fact.) Once we get certain events
            // (connect, disconnect, etc.) we then _do_ know.
            known: false
        };

        window.onbeforeunload = function () {
            $log.log("Disconnecting socket.io");
            socket.disconnect();
        };

        var asyncAngularify = function (callback) {
            return function () {
                var args = arguments;
                $timeout(function () {
                    callback.apply(socket, args);
                }, 0);
            };
        };

        var addListener = function (eventName, callback) {
            socket.on(eventName, asyncAngularify(callback));
        };

        addListener('connect', function () {
            $log.log("Connected via socket.io!");
            _state.connected = true;
            _state.connecting = false;
            _state.known = true;
        });
        addListener('disconnect', function () {
            $log.log("Disconnected from socket.io");
            _state.connected = false;
            _state.connecting = false;
            _state.known = true;
        });
        addListener('reconnecting', function (nextDelay, attempts) {
            $log.log("Reconnecting socket.io: %s attempts, next delay %s ms",
                     attempts, nextDelay);
            _state.connected = false;
            _state.connecting = true;
            _state.known = true;
        });

        var wrappedSocket = {
            on: addListener,
            addListener: addListener,

            emit: function (eventName, data, callback) {
                if (callback) {
                    socket.emit(eventName, data, asyncAngularify(callback));
                } else {
                    socket.emit(eventName, data);
                }
            },

            removeListener: function () {
                var args = arguments;
                return socket.removeListener.apply(socket, args);
            },

            reconnect: function () {
                socket.socket.reconnect();
            },

            state: _state
        };

        return wrappedSocket;
    });
