/*
 * This Source Code Form is subject to the terms of the Mozilla Public License,
 * v. 2.0. If a copy of the MPL was not distributed with this file, You can
 * obtain one at http://mozilla.org/MPL/2.0/.
 *
 * Copyright (c) 2014 Digi International Inc., All Rights Reserved.
 */

'use strict';

describe("Controller: devicesPageCtrl", function () {
    beforeEach(module("XBeeGatewayApp"));

    var scope, utils, api, devices_deferred, user_deferred, q;

    var mockModal, mockTimeout;

    beforeEach(inject(function ($rootScope, $controller, _utils_, $injector) {
        scope = $rootScope.$new();
        utils = _utils_;
        spyOn(utils, 'setTitle');
        api = $injector.get("dashboardApi");
        q = $injector.get("$q");
        devices_deferred = q.defer();
        user_deferred = q.defer();
        spyOn(api, 'devices').andReturn(devices_deferred.promise);
        spyOn(api, 'user').andReturn(user_deferred.promise);

        mockModal = jasmine.createSpyObj("$modal", ["open"]);
        mockModal._result = q.defer();
        mockModal.open.andReturn({
            result: mockModal._result.promise
        });
        mockTimeout = jasmine.createSpy("$timeout");
        $controller("devicesPageCtrl", {
            $scope: scope, $log: $injector.get("$log"),
            dashboardApi: api, utils: utils,
            $modal: mockModal, $timeout: mockTimeout
        });
    }));

    it("should call utils.setTitle", function () {
        expect(utils.setTitle).toHaveBeenCalledWith("XBee Gateways in your account");
    });

    it("should call dashboardApi.devices() on initialization somewhere", function () {
        expect(api.devices).toHaveBeenCalled();
    });

    it("should call dashboardApi.user() on initialization", function () {
        // This controller calls dashboardApi.user in order to fetch the user's
        // Device Cloud URL and use that as part of the "Manage Devices" link
        expect(api.user).toHaveBeenCalled();
    });

    it("should set the .devices state appropriately around load_devices()", function () {
        expect(scope.devices.loaded).toBe(false);
        expect(scope.devices.loading).toBe(true);
    });

    it("should set the .devices state appropriately on api.devices() success", function () {
        devices_deferred.resolve(["a", "b", "c"]);
        scope.$digest();

        expect(scope.devices.loaded).toBe(true);
        expect(scope.devices.loading).toBe(false);
        expect(scope.devices.list).toEqual(["a", "b", "c"]);
    });

    it("should set the .devices state appropriately on api.devices() success", function () {
        devices_deferred.reject({status: 400});
        scope.$digest();

        expect(scope.devices.loaded).toBe(true);
        expect(scope.devices.loading).toBe(false);
        expect(scope.devices.list).toEqual([]);
        expect(scope.devices.load_error.length).toBeGreaterThan(0);
    });

    it("should have correct things on scope", function () {
        expect(scope.add_device).toEqual(jasmine.any(Function));
        expect(scope.load_devices).toEqual(jasmine.any(Function));
        expect(scope.devices).toEqual(jasmine.any(Object));
        expect(scope.config).toEqual({error: false, error_text: null});
        // Default Device Cloud URL is the US cloud
        expect(scope.cloud_fqdn).toEqual("login.etherios.com");
    });

    it("should open a modal on add_device", function () {
        scope.add_device();
        expect(mockModal.open).toHaveBeenCalled();
    });

    it("should load devices after a delay when modal .result resolves", function () {
        // scope.load_devices() is called on controller instantiation, and it
        // sets loading=true. We need to reset that
        scope.devices.loading = false;
        scope.add_device();
        mockModal._result.resolve(true);
        scope.$digest();

        expect(scope.devices.loading).toBe(true);
        expect(mockTimeout).toHaveBeenCalledWith(jasmine.any(Function), 3000);

        spyOn(scope, 'load_devices');

        // Call the function passed into $timeout
        (mockTimeout.mostRecentCall.args[0])();

        expect(scope.load_devices).toHaveBeenCalled();
    });

    it("should not load devices, etc. if modal.result resolves but no device was added", function () {
        // scope.load_devices() is called on controller instantiation, and it
        // sets loading=true. We need to reset that
        scope.devices.loading = false;
        scope.add_device();
        mockModal._result.resolve(false);
        scope.$digest();

        expect(scope.devices.loading).toBe(false);
        expect(mockTimeout).not.toHaveBeenCalled();
    });

    it("should not load devices, etc. if modal.result rejects", function () {
        // scope.load_devices() is called on controller instantiation, and it
        // sets loading=true. We need to reset that
        scope.devices.loading = false;
        scope.add_device();
        mockModal._result.reject();
        scope.$digest();

        expect(scope.devices.loading).toBe(false);
        expect(mockTimeout).not.toHaveBeenCalled();
    });

    it("should update scope.cloud_fqdn when dashboardApi.user returns", function () {
        user_deferred.resolve({cloud_fqdn: "test_fqdn"});
        scope.$digest();

        expect(scope.cloud_fqdn).toEqual("test_fqdn");
    });

    // Code coverage: dashboardApi.user() call hits an error
    it("should not update cloud_fqdn if dashboardApi.user is rejected", function () {
        user_deferred.reject({});
        scope.$digest();

        expect(scope.cloud_fqdn).toBe("login.etherios.com");
    });
});

describe("Controller: devicesAddModalCtrl", function () {
    beforeEach(module("XBeeGatewayApp"));

    var scope, modalInstance, api, provision_deferred, gateway_config_apply_deferred;
    var poll_deferred;
    var notificationService, $timeout;

    beforeEach(inject(function ($rootScope, $controller, dashboardApi, $injector) {
        scope = $rootScope.$new();
        api = dashboardApi;
        modalInstance = jasmine.createSpyObj("$modalInstance", ['close', 'dismiss']);
        var q = $injector.get("$q");
        provision_deferred = q.defer();
        gateway_config_apply_deferred = q.defer();
        poll_deferred = q.defer();
        spyOn(api, 'provision_device_mac').andReturn(provision_deferred.promise);
        spyOn(api, 'gateway_config_apply').andReturn(gateway_config_apply_deferred.promise);
        spyOn(api, 'devices').andReturn(poll_deferred.promise);

        notificationService = $injector.get("notificationService");
        spyOn(notificationService, 'success');
        spyOn(notificationService, 'error');

        $timeout = $injector.get('$timeout');

        $controller("devicesAddModalCtrl", {
            $scope: scope, $log: $injector.get("$log"),
            dashboardApi: api, $modalInstance: modalInstance,
            notificationService: notificationService
        });
    }));

    it("should have a state object inside", function () {
        expect(scope.state).toBeDefined();
        expect(scope.state.working).toBe(false);
        expect(scope.state.error).toBe(false);
        expect(scope.state.error_text).toBe(null);
    });

    it("should call $modalInstance.dismiss on cancel()", function () {
        scope.cancel();
        expect(modalInstance.dismiss).toHaveBeenCalledWith('cancel');
    });

    it("should set state.working to true on first add() call", function () {
        scope.add("fake mac", "fake desc");
        expect(scope.state.working).toBe(true);
    });

    it("should behave correctly when provisioning resolves (success, no description)", function () {
        expect(scope.state.working).toBe(false);
        scope.add("fake mac");
        expect(api.provision_device_mac).toHaveBeenCalledWith("fake mac");
        expect(scope.state.working).toBe(true);
        provision_deferred.resolve();
        // Trigger callbacks
        scope.$digest();

        expect(notificationService.success).toHaveBeenCalled();
        expect(notificationService.error).not.toHaveBeenCalled();
        expect(api.devices).not.toHaveBeenCalled();
        expect(scope.state.working).toBe(false);
        // No description passed in, so expect the modal to be closed
        // immediately
        expect(modalInstance.close).toHaveBeenCalledWith(true);
    });

    it("should behave correctly when provisioning resolves (success, description success)", function () {
        expect(scope.state.working).toBe(false);
        scope.add("001122334455", "description");
        expect(api.provision_device_mac).toHaveBeenCalledWith("001122334455");
        expect(scope.state.working).toBe(true);
        provision_deferred.resolve();
        // Trigger callbacks
        scope.$digest();

        expect(notificationService.success).toHaveBeenCalled();
        expect(notificationService.error).not.toHaveBeenCalled();
        notificationService.success.reset();

        // The modal dialog is closed down. Description is handled in the
        // background.
        expect(modalInstance.close).toHaveBeenCalledWith(true);
        expect(scope.state.working).toBe(false);
        expect(scope.state.error).toBe(false);
        expect(scope.state.error_text).toBe(null);

        expect(api.gateway_config_apply).not.toHaveBeenCalled();

        $timeout.flush();

        // We should be asking for information about the new device.
        var device_id = "00000000-00000000-001122FF-FF334455";
        expect(api.devices).toHaveBeenCalledWith(device_id);
        // Resolve the API call with just the one device.
        poll_deferred.resolve([{
            dpConnectionStatus: "1",
            dpLastDisconnectTime: "some timestamp"
        }]);
        // That should resolve a promise internal to the code, so apply the
        // scope.
        scope.$apply();

        // A description was passed in, so expect to go out to apply device
        // configuration
        expect(api.gateway_config_apply).toHaveBeenCalledWith(
            device_id, {system: {description: "description"}}
        );

        gateway_config_apply_deferred.resolve();

        // Trigger callbacks
        scope.$apply();

        expect(notificationService.success).not.toHaveBeenCalled();
        expect(notificationService.error).not.toHaveBeenCalled();
    });

    it("should behave correctly when provisioning resolves (success, description failure)", function () {
        expect(scope.state.working).toBe(false);
        scope.add("001122334455", "description");
        expect(api.provision_device_mac).toHaveBeenCalledWith("001122334455");
        expect(scope.state.working).toBe(true);
        provision_deferred.resolve();
        // Trigger callbacks
        scope.$digest();

        expect(notificationService.success).toHaveBeenCalled();
        notificationService.success.reset();
        expect(notificationService.error).not.toHaveBeenCalled();

        // The modal dialog is closed down. Description is handled in the
        // background.
        expect(modalInstance.close).toHaveBeenCalledWith(true);
        expect(scope.state.working).toBe(false);
        expect(scope.state.error).toBe(false);
        expect(scope.state.error_text).toBe(null);

        expect(api.gateway_config_apply).not.toHaveBeenCalled();

        $timeout.flush();

        // We should be asking for information about the new device.
        var device_id = "00000000-00000000-001122FF-FF334455";
        expect(api.devices).toHaveBeenCalledWith(device_id);
        // Resolve the API call with just the one device.
        poll_deferred.resolve([{
            dpConnectionStatus: "1",
            dpLastDisconnectTime: "some timestamp"
        }]);
        // That should resolve a promise internal to the code, so apply the
        // scope.
        scope.$apply();

        // A description was passed in, so expect to go out to apply device
        // configuration
        expect(api.gateway_config_apply).toHaveBeenCalledWith(
            "00000000-00000000-001122FF-FF334455",
            {system: {description: "description"}}
        );

        gateway_config_apply_deferred.reject();
        // Trigger callbacks
        scope.$apply();

        expect(notificationService.success).not.toHaveBeenCalled();
        expect(notificationService.error).toHaveBeenCalled();
    });

    // TODO: Unit test the poll loop behavior that goes on before the
    // description is applied.

    it("should behave correctly when provisioning resolves (failure)", function () {
        expect(scope.state.working).toBe(false);
        scope.add("fake mac");
        expect(api.provision_device_mac).toHaveBeenCalledWith("fake mac");
        expect(scope.state.working).toBe(true);
        provision_deferred.reject({data: "Failure."});
        // Trigger callbacks
        scope.$digest();

        expect(notificationService.success).not.toHaveBeenCalled();
        expect(notificationService.error).not.toHaveBeenCalled();
        expect(scope.state.working).toBe(false);
        expect(scope.state.error_text).toEqual("Failure.");
        expect(scope.state.error).toBe(true);
        expect(modalInstance.close).not.toHaveBeenCalled();
        expect(modalInstance.dismiss).not.toHaveBeenCalled();
    });

    it("should ignore add() calls while add() is working", function () {
        expect(scope.state.working).toBe(false);
        scope.add("test");
        expect(scope.state.working).toBe(true);
        expect(api.provision_device_mac).toHaveBeenCalledWith("test");

        // Reset the provision_device_mac spy
        expect(scope.state.working).toBe(true);
        api.provision_device_mac.reset();
        scope.add("test2");
        expect(scope.state.working).toBe(true);
        expect(api.provision_device_mac).not.toHaveBeenCalled();
    });
});
