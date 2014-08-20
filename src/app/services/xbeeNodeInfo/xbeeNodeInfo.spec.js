/*
 * This Source Code Form is subject to the terms of the Mozilla Public License,
 * v. 2.0. If a copy of the MPL was not distributed with this file, You can
 * obtain one at http://mozilla.org/MPL/2.0/.
 *
 * Copyright (c) 2014 Digi International Inc., All Rights Reserved.
 */

'use strict';

describe("Service: xbeeNodeInfo", function() {
    // Load module
    beforeEach(module("XBeeGatewayApp"));

    var service, api, xbees_q, rootScope;
    beforeEach(inject(function (xbeeNodeInfo, $injector) {
        service = xbeeNodeInfo;
        api = $injector.get('dashboardApi');
        xbees_q = $injector.get('$q').defer();
        rootScope = $injector.get('$rootScope');
        spyOn(api, 'xbees').andReturn(xbees_q.promise);
    }));

    it("should start with an empty node_map object", function () {
        expect(service.node_map).toEqual({});
    });

    it("should call dashboardApi.xbees inside refresh", function () {
        service.refresh(['abc']);
        expect(api.xbees).toHaveBeenCalledWith(['abc']);
    });

    it("should leave node_map alone if API response is undefined", function () {
        expect(service.node_map).toEqual({});
        service.refresh(['foo']);
        expect(api.xbees).toHaveBeenCalledWith(['foo']);
        // Test undefined response
        xbees_q.resolve(undefined);
        // Trigger promise callbacks
        rootScope.$digest();
        // Check node map has not changed.
        expect(service.node_map).toEqual({});
    });

    it("should leave node_map alone if API response is empty", function () {
        expect(service.node_map).toEqual({});
        service.refresh(['bar']);
        expect(api.xbees).toHaveBeenCalledWith(['bar']);
        // Test empty array response
        xbees_q.resolve([]);
        // Trigger promise callbacks
        rootScope.$digest();
        // Check node map has not changed.
        expect(service.node_map).toEqual({});
    });

    it("should update node_map with data from API response", function () {
        expect(service.node_map).toEqual({});
        // refresh argument doesn't matter, since we control the API response.
        service.refresh(['baz']);
        var response = [
            {xpExtAddr: "1234", xpNodeId: "JIM BOB"},
            {xpExtAddr: "5678", xpNodeId: undefined},
            // Node value with no extended address. Not likely to happen in
            // reality, but it is a case handled by the code.
            {xpNodeId: "FOO"}
        ];

        xbees_q.resolve(response);
        rootScope.$digest();

        expect(service.node_map).toEqual({
            1234: "JIM BOB", 5678: undefined
        });
    });

    // Test error case
    it("should leave node_map alone if API promise is rejected", function () {
        expect(service.node_map).toEqual({});
        service.refresh(['foo']);
        expect(api.xbees).toHaveBeenCalledWith(['foo']);
        // Test error response
        xbees_q.reject("Some error");
        // Trigger promise callbacks
        rootScope.$digest();
        // Check node map has not changed.
        expect(service.node_map).toEqual({});
    });
});
