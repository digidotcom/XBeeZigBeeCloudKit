/*
 * This Source Code Form is subject to the terms of the Mozilla Public License,
 * v. 2.0. If a copy of the MPL was not distributed with this file, You can
 * obtain one at http://mozilla.org/MPL/2.0/.
 *
 * Copyright (c) 2014 Digi International Inc., All Rights Reserved.
 */

'use strict';

describe('Controller: xbeeNetworkPageCtrl', function () {
    var location, scope, ctrl, utils, api, devices_q, xbees_q, $q, $stateParams;

    beforeEach(module("XBeeGatewayApp"));

    beforeEach(inject(function ($rootScope, $controller, _utils_, $injector) {
        location = {search: jasmine.createSpy("location.search")};
        utils = _utils_;
        spyOn(utils, "setTitle");

        $q = $injector.get('$q');
        devices_q = $q.defer();
        xbees_q = $q.defer();

        api = $injector.get("dashboardApi");
        spyOn(api, 'devices').andReturn(devices_q.promise);
        spyOn(api, 'device_xbees').andReturn(xbees_q.promise);

        // Empty stateParams by default
        $stateParams = {};

        scope = $rootScope.$new();
        ctrl = $controller("xbeeNetworkPageCtrl", {
            $scope: scope, dashboardApi: api, utils: utils,
            $location: location, $stateParams: $stateParams
        });
    }));

    it("should set the page title correctly", function () {
        expect(utils.setTitle).toHaveBeenCalledWith("XBee Network View");
    });

    it("should start with the scope in an appropriate state", function () {
        expect(scope.state.loading_nodes).toBeFalsy();
        expect(scope.state.nodes_load_error).toBeFalsy();
        expect(scope.state.devices_load_error).toBeFalsy();
        expect(scope.selected_gateway).toBeUndefined();

        expect(scope.state.loading_gateways).toBeTruthy();
        expect(scope.gateways).toEqual([]);
        expect(scope.nodes).toEqual([]);
        expect(scope.fetch_from).toBe("dc");
    });

    it("should automatically look up gateways", function () {
        expect(api.devices).toHaveBeenCalled();
    });

    it("should not look up nodes initially", function () {
        expect(api.device_xbees).not.toHaveBeenCalled();
    });

    describe("(if the account has no gateways)", function () {
        beforeEach(function () {
            devices_q.resolve([]);
            scope.$digest();
        });

        it("should not have any gateways to list", function () {
            expect(scope.gateways).toEqual([]);

            expect(scope.selected_gateway).toBeUndefined();
        });

        it("should not look up nodes", function () {
            expect(api.device_xbees).not.toHaveBeenCalled();
        });

        it("should not be loading gateways anymore", function () {
            expect(scope.state.loading_gateways).toBeFalsy();
            expect(scope.state.devices_load_error).toBeFalsy();
        });
    });

    describe("(if the account has only one gateway)", function () {
        var the_one = {
            devConnectwareId: '00000000-00000000-00409DFF-FF123456'
        };

        beforeEach(function () {
            // Spy on scope.refresh_nodes
            spyOn(scope, 'refresh_nodes');

            devices_q.resolve([the_one]);
            scope.$digest();
        });

        it("should only have the one gateway to list", function () {
            expect(scope.gateways).toEqual([the_one]);
        });

        it("should automatically select that one", function () {
            expect(scope.selected_gateway).toBe(the_one.devConnectwareId);
        });

        it("should set fetch_from to 'dc' and call refresh_nodes", function () {
            expect(scope.fetch_from).toBe('dc');

            var devid = the_one.devConnectwareId;
            expect(scope.refresh_nodes).toHaveBeenCalledWith(devid, 'dc');
        });
    });

    describe("(if there's an error loading devices)", function () {
        // Spy on scope.refresh_nodes to keep things isolated.
        beforeEach(function () {
            spyOn(scope, 'refresh_nodes');
        });

        // Test where the response.data is empty
        describe("(and there's no response data)", function () {
            beforeEach(function () {
                devices_q.reject({status: 499});
                // Digest twice - once to hit error functions, twice to hit
                // finally block
                scope.$digest();
                scope.$digest();
            });

            it("should set the devices load error to indicate status code", function () {
                expect(scope.state.devices_load_error).toBe("Status code 499");
            });
        });

        describe("(and the response has an 'error' key, mapping to text)", function () {
            beforeEach(function () {
                devices_q.reject({status: 400, data: {error: "Lorem ipsum"}});
                // Digest twice - once to hit error functions, twice to hit
                // finally block
                scope.$digest();
                scope.$digest();
            });

            it("should set the devices load error to that error text", function () {
                expect(scope.state.devices_load_error).toBe("Lorem ipsum");
            });
        });

        describe("(and the response has an 'error' key, mapping to an array)", function () {
            var resp;

            beforeEach(function () {
                resp = {
                    status: 400,
                    data: {
                        error: ["dolor sit amet", "second error"]
                    }
                };
                devices_q.reject(resp);
                // Digest twice - once to hit error functions, twice to hit
                // finally block
                scope.$digest();
                scope.$digest();
            });

            it("should set the devices load error to the first element in that array", function () {
                expect(scope.state.devices_load_error).toBe(resp.data.error[0]);
            });
        });

        describe("(and the response has an 'detail' key, mapping to text)", function () {
            beforeEach(function () {
                devices_q.reject({status: 400, data: {detail: "Lorem ipsum"}});
                // Digest twice - once to hit error functions, twice to hit
                // finally block
                scope.$digest();
                scope.$digest();
            });

            it("should set the devices load error to that detail text", function () {
                expect(scope.state.devices_load_error).toBe("Lorem ipsum");
            });
        });

        describe("(and the response has an 'detail' key, mapping to an array)", function () {
            var resp;

            beforeEach(function () {
                resp = {
                    status: 400,
                    data: {
                        detail: ["dolor sit amet", "second error"]
                    }
                };
                devices_q.reject(resp);
                // Digest twice - once to hit error functions, twice to hit
                // finally block
                scope.$digest();
                scope.$digest();
            });

            it("should set the devices load error to the first element in that array", function () {
                expect(scope.state.devices_load_error).toBe(resp.data.detail[0]);
            });
        });

        describe("(and the response is just a plain string)", function () {
            beforeEach(function () {
                devices_q.reject({status: 400, data: "Hello world"});
                // Digest twice - once to hit error functions, twice to hit
                // finally block
                scope.$digest();
                scope.$digest();
            });

            it("should set the devices load error to that text", function () {
                expect(scope.state.devices_load_error).toBe("Hello world");
            });
        });

        describe("(and the response is a string with an XML error key in it)", function () {
            // Parse RCI error out.
            beforeEach(function () {
                devices_q.reject({status: 400, data: "<an><error>This is an error!</error></an>"});
                // Digest twice - once to hit error functions, twice to hit
                // finally block
                scope.$digest();
                scope.$digest();
            });

            it("should parse the error out and set it to the devices load error", function () {
                expect(scope.state.devices_load_error).toBe("This is an error!");
            });
        });

        afterEach(function () {
            // Expectations anytime there's an error.

            // Nodes have not been refreshed.
            expect(scope.refresh_nodes).not.toHaveBeenCalled();

            // We know we're not loading anymore.
            expect(scope.state.loading_gateways).toBeFalsy();
        });
    });
});

describe("Controller: xbeeNetworkPageCtrl (with gateway param)", function () {
    var location, scope, ctrl, utils, api, devices_q, xbees_q, $q, $stateParams;

    beforeEach(module("XBeeGatewayApp"));

    beforeEach(inject(function ($rootScope, $controller, _utils_, $injector) {
        location = {search: jasmine.createSpy("location.search")};
        utils = _utils_;
        spyOn(utils, "setTitle");

        $q = $injector.get('$q');
        devices_q = $q.defer();
        xbees_q = $q.defer();

        api = $injector.get("dashboardApi");
        spyOn(api, 'devices').andReturn(devices_q.promise);
        spyOn(api, 'device_xbees').andReturn(xbees_q.promise);

        // Set a gateway param by default.
        $stateParams = {gateway: 'foobarbaz'};

        scope = $rootScope.$new();
        ctrl = $controller("xbeeNetworkPageCtrl", {
            $scope: scope, dashboardApi: api, utils: utils,
            $location: location, $stateParams: $stateParams
        });
    }));

    it("should set the page title correctly", function () {
        expect(utils.setTitle).toHaveBeenCalledWith("XBee Network View");
    });

    it("should start with the scope in an appropriate state", function () {
        expect(scope.state.loading_nodes).toBeFalsy();
        expect(scope.state.nodes_load_error).toBeFalsy();
        expect(scope.state.devices_load_error).toBeFalsy();

        expect(scope.state.loading_gateways).toBeTruthy();
        expect(scope.gateways).toEqual([]);
        expect(scope.nodes).toEqual([]);
        expect(scope.fetch_from).toBe("dc");
        expect(scope.selected_gateway).toBe($stateParams.gateway);
    });

    it("should automatically look up gateways", function () {
        expect(api.devices).toHaveBeenCalled();
    });

    it("should not look up nodes initially", function () {
        expect(api.device_xbees).not.toHaveBeenCalled();
    });

    it("should keep the selection if devices list contains that device", function () {
        // Spy on refresh_nodes so we can test this in isolation
        spyOn(scope, 'refresh_nodes');
        devices_q.resolve([{devConnectwareId: 'foobarbaz'}]);
        scope.$digest();

        // scope selection should still be the same
        expect(scope.selected_gateway).toBe("foobarbaz");
        expect(scope.gateways).toEqual([{devConnectwareId: 'foobarbaz'}]);

        expect(scope.refresh_nodes).toHaveBeenCalledWith('foobarbaz', 'dc');
    });
});

// Test this function in isolation from the rest of the controller
describe("Controller: xbeeNetworkPageCtrl, scope.refresh_nodes", function () {
    var location, scope, ctrl, api, xbees_q, $q;

    beforeEach(module("XBeeGatewayApp"));

    beforeEach(inject(function ($rootScope, $controller, $injector) {
        location = {search: jasmine.createSpy("location.search")};

        $q = $injector.get('$q');
        xbees_q = $q.defer();

        api = $injector.get("dashboardApi");
        spyOn(api, 'device_xbees').andReturn(xbees_q.promise);
        // Stub out initial gateway loading
        spyOn(api, 'devices').andReturn($q.defer().promise);

        scope = $rootScope.$new();

        ctrl = $controller("xbeeNetworkPageCtrl", {
            $scope: scope, dashboardApi: api, $location: location
        });
    }));

    it("should immediately set the state appropriately", function () {
        scope.refresh_nodes("abcd");

        expect(scope.state.loading_nodes).toBeTruthy();
        expect(scope.state.nodes_load_error).toBeFalsy();
    });

    it("should set the URL query param to the gateway argument", function () {
        scope.refresh_nodes("GATEWAY12345");

        expect(location.search).toHaveBeenCalledWith('gateway', "GATEWAY12345");
    });

    it("should call the API to fetch from DC if fetch_from == 'dc'", function () {
        scope.refresh_nodes("foo", "dc");

        expect(api.device_xbees).toHaveBeenCalledWith("foo", true, false);
    });

    it("should call the API to fetch cache from gateway if fetch_from == 'gw'", function () {
        scope.refresh_nodes("bar", "gw");

        expect(api.device_xbees).toHaveBeenCalledWith("bar", false, false);
    });

    it("should call the API to do a clean discovery if fetch_from == 'gw_clear'", function () {
        scope.refresh_nodes("baz", "gw_clear");

        expect(api.device_xbees).toHaveBeenCalledWith("baz", false, true);
    });

    it("should not call the API if fetch_from is not recognized", function () {
        scope.refresh_nodes("abcdef", "Lorem ipsum dolor sit amet");

        expect(api.device_xbees).not.toHaveBeenCalled();
    });

    describe("(when nodes are loaded successfully)", function () {
        var devices;
        beforeEach(function () {
            devices = [{xpExtAddr: 'abc'}];
            xbees_q.resolve(devices);

            scope.refresh_nodes("foo", "dc");
            // Once to trigger success function
            scope.$digest();
            // Twice to trigger finally function
            scope.$digest();
        });

        it("should set scope.nodes to the response", function () {
            expect(scope.nodes).toEqual(devices);
        });

        it("should set loading_nodes to false", function () {
            expect(scope.state.loading_nodes).toBeFalsy();
            expect(scope.state.nodes_load_error).toBeFalsy();
        });
    });

    describe("(if there's an error loading nodes)", function () {
        beforeEach(function () {
            // Call scope.refresh_nodes to kick us off
            scope.refresh_nodes("foo", "dc");
        });

        // Test where the response.data is empty
        describe("(and there's no response data)", function () {
            beforeEach(function () {
                xbees_q.reject({status: 499});
                // Digest twice - once to hit error functions, twice to hit
                // finally block
                scope.$digest();
                scope.$digest();
            });

            it("should set the nodes load error to indicate status code", function () {
                expect(scope.state.nodes_load_error).toBe("Status code 499");
            });
        });

        describe("(and the response has an 'error' key, mapping to text)", function () {
            beforeEach(function () {
                xbees_q.reject({status: 400, data: {error: "Lorem ipsum"}});
                // Digest twice - once to hit error functions, twice to hit
                // finally block
                scope.$digest();
                scope.$digest();
            });

            it("should set the nodes load error to that error text", function () {
                expect(scope.state.nodes_load_error).toBe("Lorem ipsum");
            });
        });

        describe("(and the response has an 'error' key, mapping to an array)", function () {
            var resp;

            beforeEach(function () {
                resp = {
                    status: 400,
                    data: {
                        error: ["dolor sit amet", "second error"]
                    }
                };
                xbees_q.reject(resp);
                // Digest twice - once to hit error functions, twice to hit
                // finally block
                scope.$digest();
                scope.$digest();
            });

            it("should set the nodes load error to the first element in that array", function () {
                expect(scope.state.nodes_load_error).toBe(resp.data.error[0]);
            });
        });

        describe("(and the response has an 'detail' key, mapping to text)", function () {
            beforeEach(function () {
                xbees_q.reject({status: 400, data: {detail: "Lorem ipsum"}});
                // Digest twice - once to hit error functions, twice to hit
                // finally block
                scope.$digest();
                scope.$digest();
            });

            it("should set the nodes load error to that detail text", function () {
                expect(scope.state.nodes_load_error).toBe("Lorem ipsum");
            });
        });

        describe("(and the response has an 'detail' key, mapping to an array)", function () {
            var resp;

            beforeEach(function () {
                resp = {
                    status: 400,
                    data: {
                        detail: ["dolor sit amet", "second error"]
                    }
                };
                xbees_q.reject(resp);
                // Digest twice - once to hit error functions, twice to hit
                // finally block
                scope.$digest();
                scope.$digest();
            });

            it("should set the nodes load error to the first element in that array", function () {
                expect(scope.state.nodes_load_error).toBe(resp.data.detail[0]);
            });
        });

        describe("(and the response is just a plain string)", function () {
            beforeEach(function () {
                xbees_q.reject({status: 400, data: "Hello world"});
                // Digest twice - once to hit error functions, twice to hit
                // finally block
                scope.$digest();
                scope.$digest();
            });

            it("should set the nodes load error to that text", function () {
                expect(scope.state.nodes_load_error).toBe("Hello world");
            });
        });

        describe("(and the response is a string with an XML error key in it)", function () {
            // Parse RCI error out.
            beforeEach(function () {
                xbees_q.reject({status: 400, data: "<an><error>This is an error!</error></an>"});
                // Digest twice - once to hit error functions, twice to hit
                // finally block
                scope.$digest();
                scope.$digest();
            });

            it("should parse the error out and set it to the nodes load error", function () {
                expect(scope.state.nodes_load_error).toBe("This is an error!");
            });
        });

        afterEach(function () {
            // Expectations anytime there's an error.

            // We know we're not loading anymore.
            expect(scope.state.loading_nodes).toBeFalsy();
        });
    });
});

describe("Filter: node_type_repr", function () {
    beforeEach(module("XBeeGatewayApp"));

    var filter;
    beforeEach(inject(function (_node_type_reprFilter_) {
        filter = _node_type_reprFilter_;
    }));

    it("should return 'Coordinator' on 0 value", function () {
        expect(filter(0)).toBe("Coordinator");
        expect(filter('0')).toBe("Coordinator");
    });

    it("should return 'Router' on 1 value", function () {
        expect(filter(1)).toBe("Router");
        expect(filter('1')).toBe("Router");
    });

    it("should return 'End Device' on 2 value", function () {
        expect(filter(2)).toBe("End Device");
        expect(filter("2")).toBe("End Device");
    });

    it("should return 'Unknown' on anything else", function () {
        var test = function (val) { expect(filter(val)).toBe("Unknown"); };

        test(3);
        test({});
        test([]);
        test("");
        test(-50);
        test(null);
    });
});
