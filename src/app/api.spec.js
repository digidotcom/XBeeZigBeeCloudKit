/*
 * This Source Code Form is subject to the terms of the Mozilla Public License,
 * v. 2.0. If a copy of the MPL was not distributed with this file, You can
 * obtain one at http://mozilla.org/MPL/2.0/.
 *
 * Copyright (c) 2015 Digi International Inc., All Rights Reserved.
 */

'use strict';

describe("Service: dashboardApi", function() {
    // Load module
    beforeEach(module("XBeeGatewayApp.api"));

    var backend, api, rootScope;

    beforeEach(inject(function ($injector) {
        api = $injector.get('dashboardApi');

        backend = $injector.get('$httpBackend');

        rootScope = $injector.get('$rootScope');
    }));

    afterEach(function () {
        backend.verifyNoOutstandingExpectation();
        backend.verifyNoOutstandingRequest();
    });

    var loginFn = function (method, url, data) {
        var valid = {
            username: "test",
            password: "test!",
            cloud_fqdn: "my.devicecloud.com"
        };
        var parsedData = JSON.parse(data);
        if (_.where([parsedData], valid).length > 0) {
            // i.e. 'parsedData' and 'valid' are the same
            return [200, {}, ''];
        } else {
            return [401, {}, ''];
        }
    };

    var ready = function(backend) {
        backend.when("POST", '/api/login').respond(loginFn);

        var widgets = {
            url: "fake-url/api/dashboards/3",
            widgets: [
                {id: "widget1", type: "buzzer", label: "B1"},
                {id: "widget2", type: "switch", label: "S1"},
                // Add a widget which contains a key that will be removed by
                // the response extractor (code coverage)
                {id: "widget3", type: "gauge", label: "G1", $removeme: false}
            ]
        };
        backend.when("GET", '/api/dashboards').respond(200, [widgets], '');

        var devices = [];
        var devicesResponse = {
            // TODO: Populate response like API
            items: devices
        };
        backend.when("GET", '/api/devices').respond(200, devicesResponse, '');

        var devicesRE = /^\/api\/devices\/(.*)$/;
        backend.when("GET", devicesRE).respond(
            function (m, url) {
            var id = url.match(devicesRE)[0];
            return [200, JSON.stringify({items: [{devConnectwareId: id}]}), {}];
        });

        backend.when("POST", '/api/devices').respond(function (m, u, data) {
            data = JSON.parse(data);
            if (!data || !data.mac) {
                return [400, '', {}];
            } else {
                return [200, {result: {location: "DeviceCore/blah"}}, {}];
            }
        });

        backend.when("GET", '/api/user').respond([{url: "", username: "HarryMudd", cloud_fqdn: ""}]);

        //backend.when("GET", '/api/*').respond(200);
    };

    it("should do a POST to /api/login on login()", function() {
        ready(backend);
        var login = {
            username: "A",
            password: "B",
            cloud_fqdn: "C",
            persistent_session: true
        };

        backend.expect("POST", '/api/login', JSON.stringify(login));
        api.login(login.username, login.password, login.cloud_fqdn, true);
        backend.flush();
    });

    it("should respond with 401 on bad creds", function() {
        ready(backend);
        backend.expect("POST", '/api/login');
        api.login("foo", "bar", "baz", true);
        backend.flush();
    });

    it("should reject the login promise on bad creds", function () {
        ready(backend);
        var successCB = jasmine.createSpy("success callback");
        var failureCB = jasmine.createSpy("failure callback");
        backend.expect("POST", '/api/login');
        var promise = api.login("foo", "bar", "baz", false);
        promise.then(successCB, failureCB);
        backend.flush();
        expect(successCB).not.toHaveBeenCalled();
        expect(failureCB).toHaveBeenCalledWith({
            status: 401, message: "Username or password was incorrect."
        });
    });

    it("should reject the login promise on error code", function () {
        backend.when("POST", '/api/login').respond(400, {}, '');
        var successCB = jasmine.createSpy("success callback");
        var failureCB = jasmine.createSpy("failure callback");
        backend.expect("POST", '/api/login');
        var promise = api.login("foo", "bar", "baz", false);
        promise.then(successCB, failureCB);
        backend.flush();
        expect(successCB).not.toHaveBeenCalled();
        expect(failureCB).toHaveBeenCalledWith({
            status: 400, message: "Unexpected status code: 400"
        });
    });

    it("should respond with 200 on good creds", function() {
        ready(backend);
        backend.expect("POST", '/api/login');
        api.login("test", "test!", "my.devicecloud.com", true);
        backend.flush();
    });

    it("should resolve the login promise on good creds", function () {
        ready(backend);
        var successCB = jasmine.createSpy("success callback (g)");
        var failureCB = jasmine.createSpy("failure callback (g)");
        backend.expect("POST", '/api/login');
        var promise = api.login("test", "test!", "my.devicecloud.com", false);
        promise.then(successCB, failureCB);
        backend.flush();
        expect(successCB).toHaveBeenCalled();
        expect(failureCB).not.toHaveBeenCalled();
    });

    it("should do a GET to /api/dashboards on dashboard()", function () {
        ready(backend);
        var testcase = this;
        backend.expect("GET", "/api/dashboards");
        api.dashboard().then(undefined, function (resp) {
            testcase.fail(new Error(JSON.stringify(resp)));
        });
        backend.flush();
    });

    it("should do a POST to /api/dashboards on post_dashboard", function () {
        backend.when("POST", "/api/dashboards").respond(200);
        var post_data = [
            // Widgets being POSTed don't technically need to be completely
            // valid widget objects.
            // The $removedKey is for code coverage in _sanitize_widgets function
            {id: "w1", $removedKey: 1}
        ];
        var successCB = jasmine.createSpy("success callback");
        var failureCB = jasmine.createSpy("error callback");
        api.post_dashboard(post_data).then(successCB, failureCB);
        backend.expect("POST", "/api/dashboards", JSON.stringify({widgets: [{id: "w1"}]}));
        backend.flush();

        expect(successCB).toHaveBeenCalled();
        expect(failureCB).not.toHaveBeenCalled();
    });

    it("should reject the post_dashboard promise on error", function () {
        backend.when("POST", "/api/dashboards").respond(400);
        var successCB = jasmine.createSpy("success callback");
        var failureCB = jasmine.createSpy("error callback");

        api.post_dashboard([]).then(successCB, failureCB);
        backend.expect("POST", "/api/dashboards", JSON.stringify({widgets: []}));
        backend.flush();

        expect(successCB).not.toHaveBeenCalled();
        expect(failureCB).toHaveBeenCalled();
    });

    it("should do a PUT to <url> on update_widgets(url, widgets)", function () {
        backend.when("PUT", "/api/dashboards/1").respond(200);
        var successCB = jasmine.createSpy("success callback");
        var failureCB = jasmine.createSpy("error callback");

        api.update_widgets("/api/dashboards/1", []).then(successCB, failureCB);
        backend.expect("PUT", "/api/dashboards/1");
        backend.flush();

        expect(successCB).toHaveBeenCalled();
        expect(failureCB).not.toHaveBeenCalled();
    });

    it("should reject the update_widgets promise on error", function () {
        backend.when("PUT", "/api/dashboards/1").respond(400);
        var successCB = jasmine.createSpy("success callback");
        var failureCB = jasmine.createSpy("error callback");

        api.update_widgets("/api/dashboards/1", []).then(successCB, failureCB);
        backend.expect("PUT", "/api/dashboards/1", JSON.stringify({widgets: []}));
        backend.flush();

        expect(successCB).not.toHaveBeenCalled();
        expect(failureCB).toHaveBeenCalled();
    });

    it("should do a GET to /api/xbees on xbees()", function () {
        backend.when("GET", "/api/xbees").respond(200);
        var successCB = jasmine.createSpy("success callback");
        var failureCB = jasmine.createSpy("error callback");

        api.xbees().then(successCB, failureCB);
        backend.expect("GET", "/api/xbees");
        backend.flush();

        expect(successCB).toHaveBeenCalled();
        expect(failureCB).not.toHaveBeenCalled();
    });

    // Test one extended address being queried
    it("should do a GET to /api/xbees?ext_addr=foo on xbees('foo')", function () {
        backend.when("GET", "/api/xbees?ext_addr=foo").respond(200);
        var successCB = jasmine.createSpy("success callback");
        var failureCB = jasmine.createSpy("error callback");

        api.xbees("foo").then(successCB, failureCB);
        backend.expect("GET", "/api/xbees?ext_addr=foo");
        backend.flush();

        expect(successCB).toHaveBeenCalled();
        expect(failureCB).not.toHaveBeenCalled();
    });

    // Test array of extended addresses being queried
    it("should do a GET to /api/xbees?ext_addr=foo&ext_addr=bar on xbees(['foo', 'bar'])", function () {
        backend.when("GET", "/api/xbees?ext_addr=foo&ext_addr=bar")
               .respond(200);

        var successCB = jasmine.createSpy("success callback");
        var failureCB = jasmine.createSpy("error callback");

        api.xbees(["foo", "bar"]).then(successCB, failureCB);
        backend.expect("GET", "/api/xbees?ext_addr=foo&ext_addr=bar");
        backend.flush();

        expect(successCB).toHaveBeenCalled();
        expect(failureCB).not.toHaveBeenCalled();
    });

    it("should throw an error if xbees() argument is not array, string, or null/undefined", function () {
        expect(function () {
            api.xbees(123);
        }).toThrow(new Error("Bad argument type for .xbees(): number"));
    });

    it("should reject the xbees promise on error", function () {
        // All valid code paths lead to a single Restangular API call, so no
        // need to provide copies of this for each argument type.
        backend.when("GET", "/api/xbees").respond(400);
        var successCB = jasmine.createSpy("success callback");
        var failureCB = jasmine.createSpy("error callback");

        api.xbees().then(successCB, failureCB);
        backend.expect("GET", "/api/xbees");
        backend.flush();

        expect(successCB).not.toHaveBeenCalled();
        expect(failureCB).toHaveBeenCalled();
    });

    it("should do a GET to /api/devices on devices()", function () {
        ready(backend);
        var testcase = this;
        api.devices().then(undefined, function (resp) {
            testcase.fail(new Error(JSON.stringify(resp)));
        });
        backend.expect("GET", "/api/devices");
        backend.flush();
    });

    it("should do a GET to /api/devices/<id> on devices(<id>)", function () {
        ready(backend);
        var testcase = this;
        api.devices("TEST").then(undefined, function (resp) {
            testcase.fail(new Error(JSON.stringify(resp)));
        });
        backend.expect("GET", "/api/devices/TEST");
        backend.flush();
    });

    it("should do a GET to /api/devices/<id>/config on gateway_config(<id>)", function () {
        ready(backend);
        var testcase = this;
        api.gateway_config("TEST").then(undefined, function (resp) {
            testcase.fail(new Error(JSON.stringify(resp)));
        });
        backend.expect("GET", "/api/devices/TEST/config");
        backend.flush();
    });

    it("should pass query parameters to GET call on gateway_config(_, params)", function () {
        ready(backend);
        var testcase = this;
        api.gateway_config("TEST", {abc: "foo"}).then(undefined, function (resp) {
            testcase.fail(new Error(JSON.stringify(resp)));
        });
        backend.expect("GET", "/api/devices/TEST/config?abc=foo");
        backend.flush();
    });

    it("should do a GET to /api/devices/<device>/xbees/<radio>/config on radio_config(device, radio)", function () {
        ready(backend);
        var testcase = this;
        api.radio_config("TEST", "RADIO").then(undefined, function (resp) {
            testcase.fail(new Error(JSON.stringify(resp)));
        });
        backend.expect("GET", "/api/devices/TEST/xbees/RADIO/config");
        backend.flush();
    });

    it("should pass query parameters to GET call on radio_config(_, _, params)", function () {
        ready(backend);
        var testcase = this;
        api.radio_config("TEST", "RADIO", {abc: "foo"}).then(undefined, function (resp) {
            testcase.fail(new Error(JSON.stringify(resp)));
        });
        backend.expect("GET", "/api/devices/TEST/xbees/RADIO/config?abc=foo");
        backend.flush();
    });

    it("should throw an Error on gateway_config()", function () {
        expect(function () {
            api.gateway_config();
        }).toThrow(new Error("Cannot call without providing a device ID"));
    });

    it("should throw an Error on radio_config()", function () {
        expect(function () {
            api.radio_config();
        }).toThrow(new Error("Cannot call without providing a device ID"));
    });

    it("should throw an Error on radio_config(_)", function () {
        expect(function () {
            api.radio_config("DEVICE");
        }).toThrow(new Error("Cannot call without providing a radio address"));
    });

    it("should do a PUT to /api/devices/<id>/config on gateway_config_apply", function () {
        var testcase = this;
        api.gateway_config_apply("aaa", {test: 123}).then(undefined, function (resp) {
            testcase.fail(new Error(JSON.stringify(resp)));
        });
        backend.expect("PUT", "/api/devices/aaa/config", JSON.stringify({test: 123})).respond(200);
        backend.flush();
    });

    it("should throw an Error on gateway_config_apply()", function () {
        expect(function () {
            api.gateway_config_apply();
        }).toThrow(new Error("Cannot call without providing a device ID"));
    });

    it("should do a PUT to /api/devices/<id>/xbees/<radio>/config on radio_config_apply", function () {
        var testcase = this;
        api.radio_config_apply("aaa", "bbb", {test: 123}).then(undefined, function (resp) {
            testcase.fail(new Error(JSON.stringify(resp)));
        });
        backend.expect("PUT", "/api/devices/aaa/xbees/bbb/config", JSON.stringify({test: 123})).respond(200);
        backend.flush();
    });

    it("should throw an Error on radio_config_apply()", function () {
        expect(function () {
            api.radio_config_apply();
        }).toThrow(new Error("Cannot call without providing a device ID"));
    });

    it("should throw an Error on radio_config_apply(_)", function () {
        expect(function () {
            api.radio_config_apply("device");
        }).toThrow(new Error("Cannot call without providing a radio address"));
    });

    it("should do a PUT to /api/devices/<id>/xbees/<radio>/config-stock on radio_config_apply_stock", function () {
        var testcase = this;
        api.radio_config_apply_stock("aaa", "bbb").then(undefined, function (resp) {
            testcase.fail(new Error(JSON.stringify(resp)));
        });
        backend.expect("PUT", "/api/devices/aaa/xbees/bbb/config-stock").respond(200);
        backend.flush();
    });

    it("should throw an Error on radio_config_apply_stock()", function () {
        expect(function () {
            api.radio_config_apply_stock();
        }).toThrow(new Error("Cannot call without providing a device ID"));
    });

    it("should throw an Error on radio_config_apply_stock(_)", function () {
        expect(function () {
            api.radio_config_apply_stock("foo");
        }).toThrow(new Error("Cannot call without providing a radio address"));
    });

    it("should do a POST to /api/devices on provision_device_mac", function() {
        ready(backend);
        var mac = "aa:bb:cc:dd:ee:ff"
        var testcase = this;
        api.provision_device_mac("aa:bb:cc:dd:ee:ff").then(undefined, function (resp) {
            testcase.fail(new Error(JSON.stringify(resp)));
        });
        backend.expect("POST", "/api/devices", JSON.stringify({mac: mac}));
        backend.flush();
    });

    it("should throw an error when provision_device_mac is not given a MAC", function () {
        expect(function () {
            api.provision_device_mac();
        }).toThrow(new Error("Must provide a MAC address to provision!"));

        expect(function () {
            api.provision_device_mac(null);
        }).toThrow(new Error("Must provide a MAC address to provision!"));
    });

    it("should do a GET to /api/user on user()", function () {
        ready(backend);
        api.user();
        backend.expect("GET", "/api/user");
        backend.flush();
    });

    it("should cache user info from user() calls", function () {
        ready(backend);
        var obj;
        var good_response = false;
        api.user().then(function (resp) {
            good_response = true;
            obj = resp;
        });
        backend.expect("GET", "/api/user");
        backend.flush();

        expect(obj).toBeDefined();
        expect(good_response).toBe(true);

        var second_obj;
        api.user().then(function (o) { second_obj = o; });
        // Trigger the callbacks
        rootScope.$apply();
        expect(second_obj).toBe(obj);
    });

    it("should reject the user promise on error", function () {
        backend.whenGET("/api/user").respond(400);
        var successCB = jasmine.createSpy("success callback");
        var failureCB = jasmine.createSpy("error callback");

        api.user().then(successCB, failureCB);
        backend.expect("GET", "/api/user");
        backend.flush();

        expect(successCB).not.toHaveBeenCalled();
        expect(failureCB).toHaveBeenCalled();
    });

    it("should do a GET to /api/devices/<device>/xbees on device_xbees()", function () {
        backend.whenGET(/^\/api\/devices\/my-device-id\/.*$/).respond(200);

        api.device_xbees("my-device-id");
        // Trailing question mark is due to the 'cache' argument not being
        // passed in.
        backend.expect("GET", "/api/devices/my-device-id/xbees?");
        backend.flush();
    });

    it("should do a GET to /api/devices/<device>/xbees?cache=<cache>", function() {
        backend.whenGET(/^\/api\/devices\/my-device-id\/.*$/).respond(200);

        api.device_xbees("my-device-id", true);
        backend.expect("GET", "/api/devices/my-device-id/xbees?cache=true");
        backend.flush();

        backend.resetExpectations();

        api.device_xbees("my-device-id", false);
        backend.expect("GET", "/api/devices/my-device-id/xbees?cache=false");
        backend.flush();
    });

    it("should throw on output() with no device argument", function () {
        expect(function () { api.output(); }).toThrow();
    });

    it("should throw on output() with no second argument", function () {
        expect(function () { api.output("Hello"); }).toThrow();
    });

    it("should properly PUT to /api/devices/<device>/io on output()", function () {
        ready(backend);
        var devicesRE = /^\/api\/devices\/(.*)$/;
        backend.whenPUT(devicesRE).respond(200);

        // .output called with object -> pass that object down.
        api.output("hello", {D0: 1});
        backend.expect("PUT", "/api/devices/hello/io", JSON.stringify({D0: 1}));
        backend.flush();

        backend.resetExpectations();
        var node = "0011001100110011";
        var name = "DIO0";
        var value = false;

        var api_obj = {};
        api_obj[node] = {};
        api_obj[node][name] = value;

        api.output("hello", node, name, value);
        backend.expect("PUT", "/api/devices/hello/io", JSON.stringify(api_obj));
        backend.flush();
    });

    it("should throw an error from output() if no name is passed when ext_addr is used", function () {
        // If obj_or_ext_addr argument is a string, it is assumed to be a
        // radio's extended addresses. A digital output name must be specified,
        // along with a value. The value will be tested next.
        ready(backend);
        expect(function () {
            api.output("device", "radio");
        }).toThrow(new Error("No name passed to .output API!"));
    });

    it("should throw an error from output() if no value is passed when ext_addr is used", function () {
        // If obj_or_ext_addr argument is a string, it is assumed to be a
        // radio's extended addresses. A digital output name must be specified,
        // along with a value. The name argument is tested above.
        ready(backend);
        expect(function () {
            api.output("device", "radio", "DIO1");
        }).toThrow(new Error("No value passed to .output API!"));
    });

    it("should reject the output promise on error", function () {
        var devicesRE = /^\/api\/devices\/(.*)$/;
        backend.whenPUT(devicesRE).respond(400);
        var successCB = jasmine.createSpy("success callback");
        var failureCB = jasmine.createSpy("failure callback");

        api.output("device", {D0: 1}).then(successCB, failureCB);
        backend.expect("PUT", "/api/devices/device/io", JSON.stringify({D0: 1}));
        backend.flush();

        expect(successCB).not.toHaveBeenCalled();
        expect(failureCB).toHaveBeenCalled();
    });

    it("should throw on send_serial() with no gateway argument", function () {
        expect(function () { api.send_serial(); }).toThrow();
    });

    it("should throw on send_serial() with no node argument", function () {
        expect(function () { api.send_serial("Hello"); }).toThrow();
    });

    it("should throw on send_serial() with no data argument", function () {
        expect(function () { api.send_serial("Device", "Node"); }).toThrow();
    });

    it("should properly POST to /api/devices/<device>/serial on send_serial()", function () {
        ready(backend);
        var devicesRE = /^\/api\/devices\/(.*)$/;
        backend.whenPOST(devicesRE).respond(200);

        api.send_serial("hello", "node", "data");
        var expected_obj = {
            data: "data",
            node: "node"
        };
        backend.expect("POST", "/api/devices/hello/serial",
                       JSON.stringify(expected_obj));
        backend.flush();
    });

    it("should reject the send_serial promise on error", function () {
        var devicesRE = /^\/api\/devices\/(.*)$/;
        backend.whenPOST(devicesRE).respond(400);
        var successCB = jasmine.createSpy("success callback");
        var failureCB = jasmine.createSpy("failure callback");

        var expected_obj = {
            data: "data",
            node: "node"
        };

        api.send_serial("device", "node", "data").then(successCB, failureCB);
        backend.expect("POST", "/api/devices/device/serial", JSON.stringify(expected_obj));
        backend.flush();

        expect(successCB).not.toHaveBeenCalled();
        expect(failureCB).toHaveBeenCalled();
    });

    it("should do a request to /api/devices/<device>/data on device_data()", function () {
        backend.whenGET("/api/devices/aaa/data").respond({
            // These items are formatted to get code coverage in "data" case of
            // response extractor
            items: [
                { timestamp: "111" },
                { timestamp: 112 },
                { timestamp: "aa" } // meeting the _.isNaN condition
            ]
        });

        // The response extractor needs to use console.error instead of
        // $log.error, because you cannot get a reference to $log in the config
        // block. We don't want the error logged in the response extractor (when
        // the _.isNaN condition is met) to show up in the Karma log, because
        // it just interferes with the otherwise nice console output.
        var _consoleerror = console.error;
        console.error = function () {};
        var response;
        api.device_data("aaa").then(function (datapoints) {
            response = datapoints;
        });
        backend.expect("GET", '/api/devices/aaa/data');
        backend.flush();

        expect(response.length).toBe(2);
        expect(response[0].timestamp).toBe(111);
        expect(response[1].timestamp).toBe(112);

        // Restore console.error before continuing on to other tests.
        console.error = _consoleerror;
    });

    it("should do a request to /api/devices/<device>/data/<device>%2F<stream> on device_data_stream", function () {
        // Restangular converts the / in the stream name (device/stream) to
        // %2F, so we must account for that in the expected GET URL.
        backend.whenGET("/api/devices/aaa/data/aaa%2FDIO0").respond({
            // Code coverage for the response extractor, handling this case
            // (using device_data_stream) where the datapoint is nested
            // underneath currentValue
            items: [{currentValue: {timestamp: 100}}]
        });

        var response;
        api.device_data_stream("aaa", "DIO0").then(function (datapoints) {
            response = datapoints;
        });
        backend.expectGET("/api/devices/aaa/data/aaa%2FDIO0");
        backend.flush();

        expect(response.length).toBe(1);
        expect(response[0].currentValue.timestamp).toBe(100);

        backend.whenGET("/api/devices/bbb/data/bbb%2FDIO%2F1").respond({items: []});
        api.device_data_stream("bbb", "DIO/1");
        backend.expectGET("/api/devices/bbb/data/bbb%2FDIO%2F1");
        backend.flush();
    });

    // Generic error-case-testing function.
    var test_error = function (backend, method, url, testcase, caller, expected, accessor) {
        backend.when(method, url).respond(200);
        var response;
        caller().then(function (res) {
            response = res;
        }, function (fail) {
            testcase.fail(new Error(fail));
        });
        backend.expect(method, url);
        backend.flush();

        if (accessor) {
            expect(response[accessor]).toEqual(expected);
        }
        else {
            expect(response).toEqual(expected);
        }
    }

    // Error cases

    it("should return empty dashboard when backend gives nothing", function () {
        test_error(backend, "GET", "/api/dashboards", this, function () {
            return api.dashboard();
        }, [], 'widgets');
    });

    it("should return null user when backend gives nothing", function () {
        test_error(backend, "GET", "/api/user", this, function () {
            return api.user();
        }, null);
    });

    // For no apparent reason, these two test cases fail when I try to compare
    // the response to an empty array ( [] ). Jasmine reports the failure as:
    //      Expected [  ] to equal [  ].
    // So to get around this issue, we will check that the response's .length
    // is 0
    it("should return empty list of devices when backend gives nothing", function () {
        test_error(backend, "GET", "/api/devices", this, function () {
            return api.devices();
        }, 0, 'length');
    });
    it("should return an empty list of data when backend gives nothing", function () {
        test_error(backend, "GET", "/api/devices/aaa/data", this, function () {
            return api.device_data("aaa");
        }, 0, 'length');
    });
});

