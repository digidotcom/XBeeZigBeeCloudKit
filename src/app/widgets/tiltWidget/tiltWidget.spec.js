/*
 * This Source Code Form is subject to the terms of the Mozilla Public License,
 * v. 2.0. If a copy of the MPL was not distributed with this file, You can
 * obtain one at http://mozilla.org/MPL/2.0/.
 *
 * Copyright (c) 2015 Digi International Inc., All Rights Reserved.
 */

'use strict';

describe('Directive: tiltWidget', function() {
    var dataStreams, unlisten_map = {}, listener_map = {};

    var deviceId = "00000000-00000000-00001000-00002000";

    beforeEach(module('XBeeGatewayApp', function ($provide) {
        // http://stackoverflow.com/a/15865818
        $provide.decorator('dataStreams', function ($delegate) {
            var _dataStreams = $delegate;
            spyOn(_dataStreams, 'listen').andCallFake(function (device, stream, listener) {
                var fn = jasmine.createSpy("unlistener - " + stream);
                unlisten_map[stream] = fn;

                // Add a spy on the listener to dataStreams' listenerTree, so
                // sending updates will actually trigger the listener but also
                // be spied on.
                var fn2 = jasmine.createSpy("spy on listener - " + stream).andCallFake(listener);
                var tree = _dataStreams.get_listener_tree();
                tree.on(device, stream, fn2);
                listener_map[stream] = fn2;

                return fn;
            });
            spyOn(_dataStreams, 'get_initial_data');

            return _dataStreams;
        });
    }));

    var scope, element;

    beforeEach(inject(function ($httpBackend, _dataStreams_) {
        $httpBackend.whenGET("/api/devices" + deviceId + "data").respond({items: []});
        $httpBackend.expectGET("/api/devices" + deviceId + "data");

        dataStreams = _dataStreams_;
    }));

    beforeEach(inject(function($rootScope, $compile) {
        scope = $rootScope.$new();
        element = angular.element('<div tilt-widget="widget" />');
        scope.widget = {
            device: deviceId, id: 1, type: "tilt",
            radio: "00:12:34:56:78:9A", stream_x: "DIO0", stream_y: "DIO1"
        };
        $compile(element)(scope);
        // change 'scope' to point to widget's scope, and call $digest to
        // trigger compilation and linking
        scope = scope.$$childHead;
        scope.$digest();
    }));

    afterEach(function () {
        // We want the widget to automatically unregister its stream listeners
        // from dataStreams when it is being destroyed.
        scope.$broadcast('$destroy');

        var streamX = _.template('xbee.digitalIn/[${radio}]!/${stream_x}',
                                 scope.widget);
        var streamY = _.template('xbee.digitalIn/[${radio}]!/${stream_y}',
                                 scope.widget);

        expect(unlisten_map[streamX]).toHaveBeenCalled();
        expect(unlisten_map[streamY]).toHaveBeenCalled();
    });

    it('should have the correct widget in the scope', function() {
        expect(scope.widget).toBeDefined();
        expect(scope.widget.type).toBe("tilt");
    });

    it('should start with x and y set at 780', function () {
        expect(scope.x).toBe(780);
        expect(scope.y).toBe(780);
    });

    it('should have called dataStreams.listen with X and Y streams', function () {
        // Extract these variables to ease future changes to the test.
        var device = scope.widget.device;
        var streamX = _.template('xbee.digitalIn/[${radio}]!/${stream_x}',
                                 scope.widget);
        var streamY = _.template('xbee.digitalIn/[${radio}]!/${stream_y}',
                                 scope.widget);

        expect(dataStreams.listen)
                .toHaveBeenCalledWith(device, streamX, jasmine.any(Function));
        expect(dataStreams.listen)
                .toHaveBeenCalledWith(device, streamY, jasmine.any(Function));

        expect(dataStreams.get_initial_data)
                .toHaveBeenCalledWith(device, streamX);
        expect(dataStreams.get_initial_data)
                .toHaveBeenCalledWith(device, streamY);
    });

    it("should call the appropriate listener on dataStreams updates", function () {
        // This test is added for code coverage and as a sanity check.
        var streamX = _.template('xbee.digitalIn/[${radio}]!/${stream_x}',
                                 scope.widget);
        var streamY = _.template('xbee.digitalIn/[${radio}]!/${stream_y}',
                                 scope.widget);

        var innerObj = {
            data: 560,
            timestamp: 1,
            streamId: scope.widget.device + '/' + streamX
        };
        // Construct the new_data object this way to simplify changing the
        // values passed.
        var newData = {
            DataPoint: innerObj
        };

        dataStreams.new_data(newData);
        expect(listener_map[streamX])
                .toHaveBeenCalledWith({timestamp: 1, value: 560}, null,
                                      scope.widget.device, streamX);
        expect(scope.x).toBe(560);

        innerObj.streamId = scope.widget.device + '/' + streamY;
        innerObj.data = 5;
        dataStreams.new_data(newData);
        expect(listener_map[streamY])
                .toHaveBeenCalledWith({timestamp: 1, value: 5}, null,
                                      scope.widget.device, streamY);
        expect(scope.y).toBe(5);
    });
});
