/*
 * This Source Code Form is subject to the terms of the Mozilla Public License,
 * v. 2.0. If a copy of the MPL was not distributed with this file, You can
 * obtain one at http://mozilla.org/MPL/2.0/.
 *
 * Copyright (c) 2014 Digi International Inc., All Rights Reserved.
 */

describe("Controller: setupPageCtrl", function () {
    beforeEach(module("XBeeGatewayApp"));

    var utils, ctrl, scope, api, dashboardService, q, devices_q, $modal, $state,
            notificationService, $timeout;
    var modal_q, dash_q, xbees_q;

    beforeEach(inject(function (_utils_, $controller, $rootScope, $injector) {
        q = $injector.get('$q');
        devices_q = q.defer();
        xbees_q = q.defer();
        api = $injector.get('dashboardApi');
        spyOn(api, 'devices').andReturn(devices_q.promise);
        spyOn(api, 'device_xbees').andReturn(xbees_q.promise);

        dashboardService = $injector.get('dashboardService');
        dash_q = q.defer();
        spyOn(dashboardService, 'make_dashboard').andReturn(dash_q.promise);

        $modal = {open: jasmine.createSpy('$modal.open')};
        modal_q = q.defer();
        $modal.open.andReturn({result: modal_q.promise});

        $state = $injector.get('$state');
        spyOn($state, 'go');

        notificationService = $injector.get('notificationService');
        spyOn(notificationService, 'error');

        $timeout = jasmine.createSpy('$timeout');

        utils = _utils_;
        spyOn(utils, 'setTitle');

        scope = $rootScope.$new();

        ctrl = $controller("setupPageCtrl", {
            $scope: scope, dashboardApi: api, utils: utils,
            dashboardService: dashboardService, $modal: $modal,
            notificationService: notificationService, $state: $state,
            $timeout: $timeout
        });
    }));

    it("should set the page title properly", function () {
        expect(utils.setTitle).toHaveBeenCalledWith("Dashboard Creation");
    });

    it("should set up scope values correctly", function () {
        expect(scope.selected_device).toBe(null);
        expect(scope.dashboard_layout).toBe("default");
        expect(scope.devices).toBe(null);
        expect(scope.load_error).toBeUndefined();

        expect(scope.dashboard_layouts).toBeDefined();
        var layouts = dashboardService._dashboard_layouts();
        expect(scope.dashboard_layouts).toEqual(layouts);
        expect(scope.selected_layout).toBe(scope.dashboard_layouts[0]);
        expect(scope.dashboard_working).toBeFalsy();

        // get_devices is called immediately. This is set there.
        expect(scope.loading_devices).toBeTruthy();
    });

    it("should set scope.devices and scope.loading when devices are loaded", function () {
        devices_q.resolve([]);
        scope.$digest();

        expect(scope.devices).toEqual([]);
        expect(scope.loading_devices).toBeFalsy();
        expect(scope.load_error).toBeFalsy();
        // Shouldn't select a device
        expect(scope.selected_device).toBe(null);
    });

    it("should select first device if there's only one", function () {
        var devices = [{devConnectwareId: 0}]
        devices_q.resolve(devices);
        scope.$digest();

        expect(scope.devices).toEqual(devices);
        expect(scope.loading_devices).toBeFalsy();
        expect(scope.load_error).toBeFalsy();
        expect(scope.selected_device).toEqual(devices[0]);

        expect(api.device_xbees).toHaveBeenCalledWith(0, false, jasmine.any(Object));
    });

    it("should set load_error when device loading errors out", function () {
        devices_q.reject("My error");
        scope.$digest();

        expect(scope.devices).toBe(null);
        expect(scope.loading_devices).toBeFalsy();
        expect(scope.load_error).toEqual("My error");
        expect(scope.selected_device).toBe(null);
    });

    it("should launch the add device modal on add_device", function () {
        scope.add_device();

        expect($modal.open).toHaveBeenCalledWith({
            templateUrl: 'devices/devices-add-modal.tpl.html',
            controller: 'devicesAddModalCtrl',
            backdrop: 'static'
        });
    });

    it("should do nothing when add-device modal closes without adding a device", function () {
        // End initial device loading
        devices_q.resolve([]);
        scope.$digest();

        expect(scope.loading_devices).toBeFalsy();
        expect($timeout).not.toHaveBeenCalled();

        scope.add_device();
        modal_q.resolve(false);
        scope.$digest();

        expect(scope.loading_devices).toBeFalsy();
        expect($timeout).not.toHaveBeenCalled();
    });

    it("should wait a few seconds and call get_devices when add-device modal closes and a device was added", function () {
        // End initial device loading
        devices_q.resolve([]);
        scope.$digest();

        expect(scope.loading_devices).toBeFalsy();
        expect($timeout).not.toHaveBeenCalled();

        scope.add_device();
        modal_q.resolve(true);
        scope.$digest();

        expect(scope.loading_devices).toBeTruthy();
        expect($timeout).toHaveBeenCalledWith(jasmine.any(Function), 3000);

        // Call delayed function. Should call get_devices
        var fn = $timeout.mostRecentCall.args[0];
        spyOn(scope, 'get_devices');
        fn();

        expect(scope.get_devices).toHaveBeenCalled();
    });

    describe("should call dashboardService.make_dashboard on create_dashboard", function () {
        beforeEach(function () {
            scope.create_dashboard({devConnectwareId: 12}, {xpExtAddr: '123'},
                                   {definition: [{id: 2, type: 'switch'}]});
            expect(dashboardService.make_dashboard).toHaveBeenCalledWith(
                12, '123', [{id: 2, type: 'switch'}]);
            expect(scope.dashboard_working).toBeTruthy();
        });

        it("and jump to the dashboard page when it succeeds", function () {
            dash_q.resolve();
            scope.$digest();

            expect(scope.dashboard_working).toBeFalsy();
            expect($state.go).toHaveBeenCalledWith('dashboard');
            expect(notificationService.error).not.toHaveBeenCalled();
        });

        it("and notify the user if it fails", function () {
            dash_q.reject("Some error occurred.");
            scope.$digest();

            expect(scope.dashboard_working).toBeFalsy();
            expect($state.go).not.toHaveBeenCalled();
            expect(notificationService.error).toHaveBeenCalledWith(
                "Error creating dashboard. Please try again.");
        });
    });

    it("should launch the 'joining instructions' dialog on show_joining_instructions", function () {
        scope.show_joining_instructions("foo", "bar");

        expect($modal.open).toHaveBeenCalledWith({
            templateUrl: 'setup/joining-instructions.tpl.html',
            controller: 'JoiningInstructionsCtrl',
            backdrop: 'static',
            resolve: {values: jasmine.any(Function)}
        });

        // Check the resolve.values is correct
        var values = $modal.open.mostRecentCall.args[0].resolve.values();
        expect(values).toEqual({gateway: "foo", gateway_radio: "bar"});
    });
});

describe("Controller: JoiningInstructionsCtrl", function () {
    beforeEach(module("XBeeGatewayApp"));

    var scope, modalInstance, api, config_deferred, config_apply_deferred,
        notificationService, CommonLinks;
    var values;

    beforeEach(inject(function ($rootScope, $controller, dashboardApi, $injector) {
        scope = $rootScope.$new();
        api = dashboardApi;
        modalInstance = jasmine.createSpyObj("$modalInstance", ['close', 'dismiss']);
        var q = $injector.get("$q");
        config_deferred = q.defer();
        config_apply_deferred = q.defer();
        spyOn(api, 'radio_config').andReturn(config_deferred.promise);
        spyOn(api, 'radio_config_apply').andReturn(config_apply_deferred.promise);

        notificationService = $injector.get("notificationService");
        spyOn(notificationService, 'success');

        CommonLinks = $injector.get('CommonLinks');

        values = {gateway: "foo", gateway_radio: "bar"};

        $controller("JoiningInstructionsCtrl", {
            $scope: scope, dashboardApi: api, $modalInstance: modalInstance,
            notificationService: notificationService, values: values
        });
    }));

    it("should set up the basic scope correctly", function () {
        expect(scope.doc_link).toBe(CommonLinks.documentation);
        expect(scope.show_reconf).toBeFalsy();
        expect(scope.send_cfg).toEqual({});
        expect(scope.sent_cfg).toEqual({});
        expect(scope.reconfigure).toEqual({
            applying: false, error: ""
        });

        // Configuration is loaded immediately, hence
        // cfg.loading == true and cfg.error == ""
        expect(scope.cfg).toEqual({
            loading: true,
            error: "",
            data: null
        });

        // key_regex is a regular expression
        expect(_.isRegExp(scope.key_regex)).toBe(true);
    });

    // key regex tests
    describe("key_regex", function () {
        var tests;

        beforeEach(function () {
            tests = {pass: [], fail: []};

            this.addMatchers({
                toPassKeyRegex: function () {
                    return scope.key_regex.test(this.actual);
                },
                toFailKeyRegex: function () {
                    return !scope.key_regex.test(this.actual);
                }
            });
        });

        it("should accept empty strings", function () {
            tests.pass.push('');
        });

        it("should accept normal hex numbers", function () {
            for (var i = 0; i < 50; i++) {
                tests.pass.push(i.toString(16));
                tests.pass.push('0x' + i.toString(16));
                tests.pass.push(i.toString(16).toUpperCase());
                tests.pass.push('0x' + i.toString(16).toUpperCase());
            }

            // Test a fairly large value;
            var val = 0xabcd0123ff79;
            tests.pass.push(val.toString(16));
            tests.pass.push('0x' + val.toString(16));
            tests.pass.push(val.toString(16).toUpperCase());
            tests.pass.push('0x' + val.toString(16).toUpperCase());

            // Check that 16 hex digits is accepted
            tests.pass.push(0x100010001000ffff.toString(16));
            // Even with leading 0x
            tests.pass.push('0x' + (0x100010001000ffff.toString(16)));
        });

        it("should reject '0x'", function () {
            tests.fail.push('0x');
        });

        it("should reject strings with non-hex characters", function () {
            tests.fail.push('foo');
            tests.fail.push('x');
            tests.fail.push('i');
        });

        it("should reject too-long hex strings", function () {
            tests.fail = [
                "0x0000000000000000000000000000000000000000000000",
                "0x1111111111111111111111111111111111",
                "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
                "0xffffffffffffffffffffffffffffff",
                "0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF"
            ];
        });

        afterEach(function () {
            for (var i = 0; i < tests.pass.length; i++) {
                expect(tests.pass[i]).toPassKeyRegex();
            }
            for (var i = 0; i < tests.fail.length; i++) {
                expect(tests.fail[i]).toFailKeyRegex();
            }
        });
    });

    // cancel() tests

    it("should not call $modalInstance.dismiss initially", function () {
        expect(modalInstance.dismiss).not.toHaveBeenCalled();
    });

    it("should call $modalInstance.dismiss on cancel()", function () {
        scope.cancel();

        expect(modalInstance.dismiss).toHaveBeenCalledWith('cancel');
    });

    // toggleReconfig() test
    it("should toggle show_reconf value on toggleReconfig()", function () {
        expect(scope.show_reconf).toBe(false);

        scope.toggleReconfig();
        expect(scope.show_reconf).toBe(true);

        scope.toggleReconfig();
        expect(scope.show_reconf).toBe(false);
    });

    // loadConfig() and config fetching tests

    it("should call dashboardApi.radio_config immediately, with values from 'values'", function () {
        expect(api.radio_config).toHaveBeenCalledWith(values.gateway, values.gateway_radio);
    });

    it("should set scope values appropriately when config fetch resolves", function () {
        var conf = {
            radio: {
                ext_pan_id: "0x0000000000000abc",
                encrypt_enable: "0",
                encrypt_options: "0x0",
                link_key: null,
                network_key: null
            }
        };

        config_deferred.resolve(conf);

        scope.$apply();

        expect(scope.cfg.data).toEqual(conf);
        expect(scope.send_cfg).toEqual({
            ext_pan_id: conf.radio.ext_pan_id,
            link_key: '', network_key: '',
            encrypt_options: conf.radio.encrypt_options,
            encrypt_enable: conf.radio.encrypt_enable
        });

        expect(scope.cfg.loading).toBeFalsy();
    });

    describe("should set scope values appropriately when config fetch fails", function () {
        var expected_error;

        it("with an RCI error", function () {
            config_deferred.reject({data: {error: {desc: "foobar"}}});

            expected_error = "foobar";
        });

        it("without an error key", function () {
            config_deferred.reject({data: {something: "happened"}});

            expected_error = angular.toJson({something: "happened"});
        });

        afterEach(function () {
            scope.$apply();

            // data is still null, from its initial value
            expect(scope.cfg.data).toEqual(null);
            expect(scope.cfg.error).toEqual(expected_error);

            expect(scope.cfg.loading).toBeFalsy();
        });
    });

    // send_configuration tests
    describe("should call dashboardApi.radio_config_apply on send_configuration", function () {
        it("and clear out empty keys in its data", function () {
            scope.send_cfg = {
                ext_pan_id: '', encrypt_enable: "1",
                // 2 is the value coming from the ui-mask applied to the EO
                // input field when it reads "0x2"
                encrypt_options: '2', link_key: '', network_key: ''
            };

            scope.send_configuration();

            expect(api.radio_config_apply).toHaveBeenCalledWith(
                values.gateway, values.gateway_radio, {
                    radio: {
                        ext_pan_id: undefined, encrypt_enable: '1',
                        encrypt_options: '0x2', link_key: undefined,
                        network_key: undefined
                    }
                });
        });

        it("and format PAN ID, link key and network key appropriately", function () {
            scope.send_cfg = {
                ext_pan_id: 'beefcafe', encrypt_enable: "1",
                // Blank EO field -> should overwrite with undefined
                encrypt_options: '', link_key: '0', network_key: '123'
            };

            scope.send_configuration();

            expect(api.radio_config_apply).toHaveBeenCalledWith(
                values.gateway, values.gateway_radio, {
                    radio: {
                        ext_pan_id: '0x00000000beefcafe',
                        encrypt_enable: '1', encrypt_options: undefined,
                        link_key: '0x0000000000000000',
                        network_key: '0x0000000000000123'
                    }
                });
        });

        it("and behaves appropriately when that succeeds", function () {
            // Reset dashboardApi.radio_config call from immediate
            // configuration check.
            api.radio_config.reset();
            scope.cfg.loading = false;

            // Call send_configuration
            scope.send_configuration();

            // Get sent configuration
            var sent = api.radio_config_apply.mostRecentCall.args[2].radio;

            // Error text was reset
            expect(scope.reconfigure.error).toBe("");
            expect(scope.error_key).toBe("");

            // Applying the configuration succeeded
            config_apply_deferred.resolve();
            scope.$apply();

            // Should make a notification to that effect
            expect(notificationService.success).toHaveBeenCalledWith(
                undefined, "Successfully applied configuration to gateway XBee.");

            // It's done applying configuration
            expect(scope.reconfigure.applying).toBeFalsy();
            // No errors
            expect(scope.reconfigure.error).toBe("");
            expect(scope.error_key).toBe("");

            // It hides the Reconfigure panel
            expect(scope.show_reconf).toBeFalsy();

            // And also fetches the configuration again...
            expect(scope.cfg.loading).toBeTruthy();
            expect(scope.cfg.error).toBeFalsy();

            expect(api.radio_config).toHaveBeenCalledWith(values.gateway, values.gateway_radio);
        });

        describe("and set scope values appropriately when that API call fails", function () {
            var expected_error, expected_error_key;

            beforeEach(function () {
                // Reset API from immediate config check
                api.radio_config.reset();
                scope.cfg.loading = false;

                // Call send_configuration
                scope.send_configuration();
            });

            it("with an RCI error", function () {
                config_apply_deferred.reject({
                    data: {
                        error: {
                            desc: "foobar",
                            hint: "baz"
                        }
                    }
                });

                expected_error = "foobar";
                expected_error_key = "baz";
            });

            it("without an error key", function () {
                config_apply_deferred.reject({data: {something: "happened"}});

                expected_error = angular.toJson({something: "happened"});
                // Expect error key to not change
                expected_error_key = scope.error_key;
            });

            afterEach(function () {
                scope.$apply();

                expect(scope.error_key).toEqual(expected_error_key);
                expect(scope.reconfigure.error).toEqual(expected_error);

                expect(scope.reconfigure.applying).toBeFalsy();

                // Shouldn't check configuration again
                expect(api.radio_config).not.toHaveBeenCalled();
                // Certainly shouldn't make a success notification
                expect(notificationService.success).not.toHaveBeenCalled();
            });
        });
    });
});
