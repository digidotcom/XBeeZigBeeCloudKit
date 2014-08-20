/*
 * This Source Code Form is subject to the terms of the Mozilla Public License,
 * v. 2.0. If a copy of the MPL was not distributed with this file, You can
 * obtain one at http://mozilla.org/MPL/2.0/.
 *
 * Copyright (c) 2014 Digi International Inc., All Rights Reserved.
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
                removeListener: angular.noop
            };
        }

        var socket = io.connect('/device', {'transports': ['xhr-polling']});

        window.onbeforeunload = function () {
            $log.log("Disconnecting socket.io");
            socket.disconnect();
        }

        socket.on('connect', function () {
            $log.log("Connected via socket.io!");
        })

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
            }
        };

        return wrappedSocket;
    });
