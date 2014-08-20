/*
 * This Source Code Form is subject to the terms of the Mozilla Public License,
 * v. 2.0. If a copy of the MPL was not distributed with this file, You can
 * obtain one at http://mozilla.org/MPL/2.0/.
 *
 * Copyright (c) 2014 Digi International Inc., All Rights Reserved.
 */

'use strict';

describe("Service: deviceStatus", function () {
    var service, api, socket, devices_q, rootScope;

    beforeEach(module("XBeeGatewayApp"));

    beforeEach(inject(function ($injector) {
        socket = $injector.get('socket');
        spyOn(socket, 'addListener');

        api = $injector.get('dashboardApi');
        devices_q = $injector.get('$q').defer();
        spyOn(api, 'devices').andReturn(devices_q.promise);

        service = $injector.get('deviceStatus');

        rootScope = $injector.get('$rootScope');
    }));

    it("should provide device_status_map", function () {
        expect(service.device_status_map).toEqual({});
    });

    it("should call socket.addListener('device_status', ...)", function () {
        expect(socket.addListener).toHaveBeenCalledWith('device_status', jasmine.any(Function));
    });

    it("should call dashboardApi.devices immediately", function () {
        expect(api.devices).toHaveBeenCalled();
    });

    it("should update device_status_map appropriately", function () {
        expect(service.device_status_map).toEqual({});
        var resp = [
            {dpConnectionStatus: '0', devConnectwareId: '001'},
            {dpConnectionStatus: '1', devConnectwareId: '002'},
            {dpConnectionStatus: 0, devConnectwareId: '003'},
            // Non-numeric string status
            {dpConnectionStatus: 'abc', devConnectwareId: '004'}
        ];
        devices_q.resolve(resp);

        // Trigger promise callbacks
        rootScope.$digest();

        expect(service.device_status_map).toEqual({
            '001': 0,
            '002': 1,
            '003': 0
        });
    });

    it("should not change device_status_map if devices API errors out", function () {
        expect(service.device_status_map).toEqual({});
        devices_q.reject("Some error");
        // Trigger promise callbacks
        rootScope.$digest();

        expect(service.device_status_map).toEqual({});
    });

    // TODO Test socket listener handling
    it("should update device_status_map when new status comes in through socket", function () {
        var socket_handler = socket.addListener.mostRecentCall.args[1];
        expect(socket_handler).toBeDefined();

        var data = {
            DeviceCore: {
                dpConnectionStatus: 1,
                devConnectwareId: "foobar"
            }
        };

        expect(service.device_status_map).toEqual({});

        socket_handler(data);

        expect(service.device_status_map).toEqual({
            foobar: 1
        });
    });

    it("should not change device_status_map if socket data has no DeviceCore key", function () {
        expect(service.device_status_map).toEqual({});

        var socket_handler = socket.addListener.mostRecentCall.args[1];
        expect(socket_handler).toBeDefined();

        var data = {
            notDeviceCore: {}
        };

        expect(service.device_status_map).toEqual({});

        socket_handler(data);

        expect(service.device_status_map).toEqual({});
    });
});
