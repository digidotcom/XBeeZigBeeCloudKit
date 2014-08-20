/*
 * This Source Code Form is subject to the terms of the Mozilla Public License,
 * v. 2.0. If a copy of the MPL was not distributed with this file, You can
 * obtain one at http://mozilla.org/MPL/2.0/.
 *
 * Copyright (c) 2014 Digi International Inc., All Rights Reserved.
 */

describe("Controller: WidgetSettingsCtrl", function () {
    beforeEach(module("XBeeGatewayApp"));

    var utils, ctrl, scope, q, $state, $stateParams,
            widgetRegistry, notificationService, dashboardService;
    var $$controller;
    var widget_q;

    // Allow for creating controller inside tests, so that things like
    // $stateParams can be manipulated first
    function makeCtrl () {
        ctrl = $$controller("WidgetSettingsCtrl", {
            $scope: scope, utils: utils, $state: $state,
            $stateParams: $stateParams, widgetRegistry: widgetRegistry,
            notificationService: notificationService,
            dashboardService: dashboardService
        });
    }

    beforeEach(inject(function (_utils_, $controller, $rootScope, $injector) {
        $$controller = $controller;
        q = $injector.get('$q');
        widget_q = q.defer();

        $state = $injector.get('$state');
        spyOn($state, 'go');
        spyOn($state, 'is');
        $stateParams = {widget_id: null};

        utils = _utils_;
        spyOn(utils, 'setTitle');
        spyOn(utils, 'get_widget_by_id').andReturn(widget_q.promise);

        scope = $rootScope.$new();

        widgetRegistry = {get: jasmine.createSpy("widgetRegistry.get")};

        notificationService = $injector.get('notificationService');
        spyOn(notificationService, 'error');

        dashboardService = $injector.get('dashboardService');
    }));

    it("should set title to 'Widget Settings' if on that page", function () {
        $state.is.andCallFake(function (s) { return s === 'widget_settings'});

        makeCtrl();
        expect($state.is).toHaveBeenCalledWith('widget_settings');
        expect(utils.setTitle).toHaveBeenCalledWith("Widget Settings");
    });

    it("should set title to 'Add Widget' if on that page", function () {
        $state.is.andCallFake(function (s) { return s === 'add_widget'});

        makeCtrl();
        // Called to check if it's that page
        expect($state.is).toHaveBeenCalledWith('widget_settings');
        expect($state.is).toHaveBeenCalledWith('add_widget');
        expect(utils.setTitle).toHaveBeenCalledWith("Add Widget");
    });

    it("should set up the scope properly when in Widget Settings", function () {
        $state.is.andCallFake(function (s) { return s === 'widget_settings' });
        $stateParams.widget_id = 12345;
        makeCtrl();

        expect(scope.widget_id).toBe(12345);
        // Widget not loaded yet
        expect(scope.widget).toEqual({});
        expect(scope.settings_items).toEqual([]);
        expect(scope.removing).toBeFalsy();
        expect(scope.selected_type).toBe(null);
        expect(scope.defn).toEqual({});
        // Button controls
        expect(scope.save_disabled).toBeFalsy();
        expect(scope.saving).toBeFalsy();
    });

    it("should redirect to the dashboard if on any other page", function () {
        $state.is.andReturn(false);

        spyOn($state, 'transitionTo');

        makeCtrl();
        // Called to check if we're on either page
        expect($state.is).toHaveBeenCalledWith('widget_settings');
        expect($state.is).toHaveBeenCalledWith('add_widget');

        expect($state.transitionTo).toHaveBeenCalledWith('dashboard');
    });

    it("should set scope properly when dashboard fetching succeeds on Add Widget page", function () {
        var deferred = q.defer();
        spyOn(dashboardService, 'widgets').andReturn(deferred.promise);

        $state.is.andCallFake(function (s) { return s === 'add_widget' });
        $stateParams.widget_id = 12345;
        makeCtrl();

        expect(dashboardService.widgets).toHaveBeenCalled();

        // Control the generated widget ID
        spyOn(Date.prototype, 'getTime').andReturn(1234567);
        var widgets = [];
        deferred.resolve(widgets);
        scope.$apply();

        expect(widgets.length).toBe(1);
        expect(widgets[0]).toEqual({id: 'widget_1234567'});
        expect(scope.widget_id).toBe('widget_1234567');
    });

    it("should notify the user and redirect to setup page if dashboard fetching fails", function () {
        var deferred = q.defer();
        spyOn(dashboardService, 'widgets').andReturn(deferred.promise);

        $state.is.andCallFake(function (s) { return s === 'add_widget' });
        $stateParams.widget_id = 12345;
        makeCtrl();

        expect(dashboardService.widgets).toHaveBeenCalled();

        deferred.reject(["Error message", "Other content"]);
        scope.$apply();

        expect(scope.widget_id).toBeNull();
        expect(notificationService.error).toHaveBeenCalledWith(
            "Error message", "Problem loading dashboard to add widget");
        expect($state.go).toHaveBeenCalledWith("setup");
    });

    it("should return proper value from scope.new_settings_item, and add it to settings_items", function () {
        makeCtrl();

        expect(scope.settings_items).toEqual([]);
        var expected = {
            valid: true, error_message: "", key: "ABC"
        };
        var actual = scope.new_settings_item({key: "ABC"});
        expect(actual).toEqual(expected);
        expect(scope.settings_items).toContain(actual);
    });

    it("should redirect to the correct view code page on viewCode", function () {
        spyOn($state, 'transitionTo');

        makeCtrl();

        $stateParams.widget_id = 1234;
        scope.viewCode();
        expect($state.transitionTo).toHaveBeenCalledWith(
            'view_code', {widget_id: 1234})

        $stateParams.widget_id = "foo";
        scope.viewCode();
        expect($state.transitionTo).toHaveBeenCalledWith(
            'view_code', {widget_id: "foo"})
    });

    describe("should call dashboardService.remove_widget on removeWidget", function () {
        var rm_q;

        beforeEach(function () {
            makeCtrl();

            rm_q = q.defer();

            spyOn(dashboardService, 'remove_widget').andReturn(rm_q.promise);

            $stateParams.widget_id = 5678;
            spyOn($state, 'transitionTo');

            expect(scope.removing).toBeFalsy();

            scope.removeWidget();

            expect(scope.removing).toBeTruthy();
            expect(dashboardService.remove_widget).toHaveBeenCalledWith(5678);
        });

        afterEach(function () {
            scope.$apply();
            // Sets removing back to false
            expect(scope.removing).toBeFalsy();
        });

        it("and redirect to the dashboard when it succeeds", function () {
            rm_q.resolve();
            // Call $digest until things settle
            scope.$apply();

            expect($state.transitionTo).toHaveBeenCalledWith('dashboard');
            expect(notificationService.error).not.toHaveBeenCalled();
        });

        it("and NOT redirect to the dashboard when it fails", function () {
            rm_q.reject();
            // Call $digest until things settle
            scope.$apply();

            expect($state.transitionTo).not.toHaveBeenCalled();
            expect(notificationService.error).toHaveBeenCalledWith(
                undefined, "Error removing widget. Please try again.");
        });
    });

    it("should attempt to save the dashboard on save()", function () {
        var deferred = q.defer();
        spyOn(dashboardService, 'update_widgets').andReturn(deferred.promise);
        makeCtrl();

        scope.save();
        expect(scope.saving).toBeTruthy();
        expect(dashboardService.update_widgets).toHaveBeenCalled();
    });

    it("should redirect to the dashboard when saving succeeds", function () {
        var deferred = q.defer();
        spyOn(dashboardService, 'update_widgets').andReturn(deferred.promise);
        spyOn($state, 'transitionTo');
        makeCtrl();

        scope.save();
        expect(scope.saving).toBeTruthy();

        deferred.resolve();
        scope.$apply();

        expect($state.transitionTo).toHaveBeenCalledWith('dashboard');
        expect(scope.saving).toBeFalsy();
    });

    it("should not redirect to the dashboard if saving fails", function () {
        var deferred = q.defer();
        spyOn(dashboardService, 'update_widgets').andReturn(deferred.promise);
        spyOn(dashboardService, 'widgets').andReturn(q.defer().promise);
        spyOn($state, 'transitionTo');

        $state.is.andCallFake(function (s) { return s === 'widget_settings' });
        $stateParams.widget_id = 12345;
        makeCtrl();

        scope.save();
        expect(scope.saving).toBeTruthy();

        deferred.reject();
        scope.$digest();

        expect($state.transitionTo).not.toHaveBeenCalled();
        expect(notificationService.error).toHaveBeenCalledWith(
            undefined, "Error saving widget. Try again.");
        scope.$digest();
        expect(scope.saving).toBeFalsy();
    });

    it("should redirect to the dashboard on cancel", function () {
        spyOn($state, 'transitionTo');

        makeCtrl();

        scope.cancel();
        expect($state.transitionTo).toHaveBeenCalledWith('dashboard');
    });
});

describe("Controller: SettingsFormController", function () {
    beforeEach(module("XBeeGatewayApp"));

    var scope, ctrl;

    beforeEach(inject(function ($controller, $rootScope) {
        scope = $rootScope.$new();
        spyOn(scope, '$watch').andCallThrough();

        ctrl = $controller("SettingsFormController", {
            $scope: scope
        });
    }));

    it("should have empty settings_items", function () {
        expect(scope.settings_items).toEqual([]);
    });

    it("should define various scope functions", function () {
        expect(scope.settings_items_invalid).toMatch(jasmine.any(Function));
        expect(scope.get_errors).toMatch(jasmine.any(Function));
    });

    it("should return true from settings_items_invalid if any settings item has valid==false", function () {
        scope.settings_items = [];
        expect(scope.settings_items_invalid()).toBeFalsy();

        scope.settings_items = [{valid: false}];
        expect(scope.settings_items_invalid()).toBeTruthy();

        scope.settings_items = [{valid: false}, {valid: true}];
        expect(scope.settings_items_invalid()).toBeTruthy();
    });

    it("should return (from get_errors) items with valid==false", function () {
        scope.settings_items = [];
        expect(scope.get_errors()).toEqual([]);

        scope.settings_items = [{valid: false, id: 1}];
        expect(scope.get_errors()).toEqual([{valid: false, id: 1}]);

        scope.settings_items = [{valid: false}, {valid: false, id: 2}, {valid: true}];
        expect(scope.get_errors()).toContain({valid: false});
        expect(scope.get_errors()).toContain({valid: false, id: 2});
        expect(scope.get_errors()).not.toContain({valid: true});
    });

    it("should watch settings_items_invalid return value", function () {
        expect(scope.$watch).toHaveBeenCalledWith(
            'settings_items_invalid()', jasmine.any(Function));
    });

    it("should set save_disabled to settings_items_invalid return value", function () {
        var listener = scope.$watch.mostRecentCall.args[1];

        listener(false);
        expect(scope.save_disabled).toBeFalsy();
        listener(true);
        expect(scope.save_disabled).toBeTruthy();
    });

    it("should provide two methods on the actual controller", function () {
        expect(ctrl.new_settings_item).toBeDefined();
        expect(ctrl.remove_settings_item).toBeDefined();
        expect(ctrl.new_settings_item).toMatch(jasmine.any(Function));
        expect(ctrl.remove_settings_item).toMatch(jasmine.any(Function));
    });

    it("should return proper value from controller#new_settings_item, and add it to settings_items", function () {
        expect(scope.settings_items).toEqual([]);
        var expected = {
            valid: true, message: "", opt: "ABC"
        };
        var actual = ctrl.new_settings_item("ABC");
        expect(actual).toEqual(expected);
        expect(scope.settings_items).toContain(actual);
    });

    it("should remove the given item using controller#remove_settings_item", function () {
        scope.settings_items = [{foo: 123}, {foo: 456}];
        ctrl.remove_settings_item(scope.settings_items[0]);

        expect(scope.settings_items).toEqual([{foo: 456}]);

        scope.settings_items = [{foo: 123}, {foo: 456}];
        ctrl.remove_settings_item(scope.settings_items[1]);
        expect(scope.settings_items).toEqual([{foo: 123}]);

        scope.settings_items = [{foo: 123}, {foo: 456}];
        ctrl.remove_settings_item({foo: null});
        expect(scope.settings_items).toEqual([{foo: 123}, {foo: 456}]);
    });
});

describe("Controller: SettingsItemController", function () {
    beforeEach(module("XBeeGatewayApp"));

    var scope, ctrl;

    beforeEach(inject(function ($controller, $rootScope) {
        scope = $rootScope.$new();
        ctrl = $controller("SettingsItemController", {
            $scope: scope
        });
    }));

    it("should set has_error to false initially", function () {
        expect(scope.has_error).toBeFalsy();
    });
});

describe("Controller: WidgetTypeController", function () {
    beforeEach(module("XBeeGatewayApp"));

    var scope, registry;

    beforeEach(inject(function ($controller, $rootScope, $injector) {
        registry = $injector.get('widgetRegistry');

        scope = $rootScope.$new();

        ctrl = $controller('WidgetTypeController', {
            $scope: scope
        });
    }));

    it("should set has_error to false initially", function () {
        expect(scope.has_error).toBeFalsy();
    });

    it("should set select_values to non-hidden widget options, sorted by key", function () {
        // Array.prototype.filter added in ES5. Won't work in IE8.
        var all_options = registry.getall();

        var options = [];
        for (var key in all_options) {
            var entry = all_options[key];
            if (!entry.hidden) {
                options.push(all_options[key]);
            }
        }
        // Sort by type key
        var sorted = _.sortBy(options, 'type_key');

        expect(scope.select_values.length).toEqual(sorted.length);
        for (var i = 0; i < sorted.length; i++) {
            expect(scope.select_values[i]).toEqual(sorted[i]);
        }
    });
});

describe("Controller: DevicePickerController", function () {
    beforeEach(module("XBeeGatewayApp"));
    // has_error == false
    // devices = []
    // calls dashboardApi.devices
    // devices is updated when api call finishes

    var scope, api, devices_q;

    beforeEach(inject(function ($controller, $rootScope, $injector) {
        scope = $rootScope.$new();
        api = $injector.get('dashboardApi');
        devices_q = $injector.get('$q').defer();
        spyOn(api, 'devices').andReturn(devices_q.promise);

        $controller("DevicePickerController", {
            $scope: scope, dashboardApi: api
        });
    }));

    it("should set up scope correctly", function () {
        expect(scope.has_error).toBeFalsy();
        expect(scope.devices).toEqual([]);
    });

    it("should call dashboardApi.devices immediately", function () {
        expect(api.devices).toHaveBeenCalled();
    });

    it("should update scope.devices to API return value", function () {
        var devices = [{a: 123}, {a: 456}, {a: 789}];
        devices_q.resolve(devices);
        scope.$digest();

        expect(scope.devices).toEqual(devices);
    });

    it("should create device labels correctly in `labelify`", function () {
        var device = {
            devConnectwareId: "00001111", dpDescription: "My Gateway"
        };

        expect(scope.labelify(device)).toBe("00001111 (My Gateway)");

        delete device.dpDescription;
        expect(scope.labelify(device)).toBe("00001111");
    });
});

function NodePickerController_Common(env, context, current_state) {
    var scope, api, xbees_q, $state;

    beforeEach(function () {
        scope = context.scope,
        api = context.api,
        xbees_q = context.xbees_q,
        $state = context.$state;

        $state.is.andCallFake(function (s) { return s == current_state });
    });

    env.it("should not trigger an API call if device is undefined", function () {
        scope.widget = {};

        scope.$apply();

        expect(api.device_xbees).not.toHaveBeenCalled();
    });

    env.it("should trigger an API call when widget.device changes", function () {
        scope.widget.device = 'foobarbaz';
        scope.$apply();

        expect(api.device_xbees).toHaveBeenCalledWith('foobarbaz', false, false, jasmine.any(Object));
        expect(scope.loading_nodes).toBeTruthy();
        expect(scope.has_error).toBeFalsy();

        // Last argument should be a promise
        var promise = api.device_xbees.mostRecentCall.args[3];
        expect(promise.then).toMatch(jasmine.any(Function));
    });

    env.it("should use timeout promise on API call when a second discovery is started", function () {
        scope.widget = {device: 'foobarbaz'};
        scope.$apply();

        expect(api.device_xbees).toHaveBeenCalledWith('foobarbaz', false, false, jasmine.any(Object));
        var promise = api.device_xbees.mostRecentCall.args[3];
        expect(promise.then).toMatch(jasmine.any(Function));

        // Add a callback for that promise being resolved
        var cancelled = jasmine.createSpy('API call timeout spy');
        promise.then(cancelled);

        // API call has not resolved yet, so update_canceller will still be
        // defined. Change widget.device, trigger $apply
        api.device_xbees.reset();

        scope.widget.device = 'foobar';
        scope.$apply();

        expect(cancelled).toHaveBeenCalled();
        expect(api.device_xbees).toHaveBeenCalledWith('foobar', false, false, jasmine.any(Object));
    });

    env.it("should set available_nodes to those that were found, except coordinator", function () {
        var xbees = [{xpNetAddr: "0", xpExtAddr: "foo"}, {xpNetAddr: 1, xpExtAddr: "bar"}];

        scope.widget = {device: 'test'};
        scope.$digest();

        xbees_q.resolve(xbees);
        // Continue running $digest until things settle
        scope.$apply();

        expect(scope.available_nodes).toContain(xbees[1]);
        expect(scope.available_nodes).not.toContain(xbees[0]);
        expect(scope.loading_nodes).toBeFalsy();
        expect(scope.has_error).toBeFalsy();
        expect(scope.picking_enabled).toBeTruthy();
    });

    env.it("should automatically select the first node, if none has already been selected", function () {
        var xbees = [{xpNetAddr: "0", xpExtAddr: "foo"}, {xpNetAddr: 1, xpExtAddr: "bar"}];
        scope.widget = {device: 'test', radio: undefined};
        scope.$digest();

        xbees_q.resolve(xbees);
        scope.$apply();

        expect(scope.widget.radio).toBe(scope.available_nodes[0].xpExtAddr);
    });

    env.it("should not automatically select the first node if one has already been selected", function () {
        var xbees = [{xpNetAddr: "0", xpExtAddr: "foo"}, {xpNetAddr: 1, xpExtAddr: "bar"}];
        scope.widget = {device: 'test', radio: 'baz'};
        scope.$digest();

        xbees_q.resolve(xbees);
        scope.$apply();

        expect(scope.widget.radio).not.toBe(scope.available_nodes[0].xpExtAddr);
        // Check it hasn't changed
        expect(scope.widget.radio).toBe("baz");
   });

    env.describe("should set error message if API response has 'error' key", function () {
        var err = {error: null};
        var expected_message = null;

        it("(plain text error value)", function () {
            err.error = "Device Not Connected";
            expected_message = err.error;
        });

        it("(with data.error array)", function () {
            err.error = {data: {error: ["Device Not Connected"]}};
            expected_message = err.error.data.error[0];
        });

        it("(with data.error string)", function () {
            err.error = {data: {error: "Some error"}};
            expected_message = err.error.data.error;
        });

        it("(with data.error being empty)", function () {
            err.error = {data: {error: undefined}};
            expected_message = angular.toJson(err.error);
        });

        afterEach(function () {
            scope.widget = {device: 'foo'};
            scope.$apply();

            xbees_q.resolve(err);
            scope.$apply();

            expect(scope.available_nodes).toEqual([]);
            expect(scope.has_error).toBe(true);
            expect(scope.error_message).toEqual(expected_message);
            expect(scope.loading_nodes).toBeFalsy();
            expect(scope.picking_enabled).toBeFalsy();
        });
    });

    env.describe("should set error message if API call errors out", function () {
        var response = {data: {}, status: 400};
        var expected_message = null;

        it("(plain text error value)", function () {
            response.data.error = "Device Not Connected";
            expected_message = response.data.error;
        });

        it("(with data.error array)", function () {
            response.data = {error: ["Device Not Connected"]};
            expected_message = response.data.error[0];
        });

        it("(with data.error being empty)", function () {
            response.data = {error: undefined};
            expected_message = angular.toJson(response);
        });

        afterEach(function () {
            scope.widget = {device: 'foo'};
            scope.$apply();

            xbees_q.reject(response);
            scope.$apply();

            expect(scope.available_nodes).toEqual([]);
            expect(scope.has_error).toBe(true);
            expect(scope.error_message).toEqual(expected_message);
            expect(scope.loading_nodes).toBeFalsy();
            expect(scope.picking_enabled).toBeFalsy();
        });
    });

    env.it("should not change scope values if API call is cancelled", function () {
        scope.widget = {device: 'foo'};

        xbees_q.reject({status: 0});
        scope.$apply();

        expect(scope.loading_nodes).toBe(true);
        expect(scope.available_nodes).toEqual([]);
        expect(scope.has_error).toBe(false);
        expect(scope.picking_enabled).toBe(false);
        expect(scope.error_message).toBe("");
    });

    env.it("should create XBee dropdown item labels correctly", function () {
        var node = {
            xpNodeId: "LOREM IPSUM", xpExtAddr: "00:11:22:33:44:55:66:77"
        };
        expect(scope.make_label(node)).toBe("LOREM IPSUM (00:11:22:33:44:55:66:77)");

        delete node.xpNodeId;
        expect(scope.make_label(node)).toBe("00:11:22:33:44:55:66:77");
    });
}

describe("Controller: NodePickerController", function () {
    beforeEach(module("XBeeGatewayApp"));

    var scope, api, q, $state;
    var xbees_q;

    var test_ctx = {};

    beforeEach(inject(function ($controller, $rootScope, $injector) {
        scope = $rootScope.$new();
        scope.widget = {};

        api = $injector.get('dashboardApi');
        q = $injector.get('$q');

        xbees_q = q.defer();

        spyOn(api, 'device_xbees').andReturn(xbees_q.promise);

        $state = $injector.get('$state');
        spyOn($state, 'is').andReturn(false);

        // Capture $watch calls
        spyOn(scope, '$watch').andCallThrough();

        // Set up reusable test context.
        test_ctx.scope = scope;
        test_ctx.api = api;
        test_ctx.q = q;
        test_ctx.xbees_q = xbees_q;
        test_ctx.$state = $state;

        $controller("NodePickerController", {
            $scope: scope, $q: q, dashboardApi: api, $state: $state
        });
    }));

    beforeEach(function () {
        // Propagate the empty widget value first.
        scope.$apply();
    });

    it("should set up the scope correctly", function () {
        expect(scope.has_error).toBeFalsy();
        expect(scope.error_message).toBeFalsy();
        expect(scope.available_nodes).toEqual([]);
        expect(scope.loading_nodes).toBeFalsy();
        expect(scope.picking_enabled).toBeFalsy();

        // Set up watcher
        expect(scope.$watch).toHaveBeenCalledWith('widget.device', jasmine.any(Function));
    });

    it("should not trigger an API call at first", function () {
        expect(api.device_xbees).not.toHaveBeenCalled();
    });

    it("should not trigger an API call if device is undefined", function () {
        scope.widget = {};

        scope.$apply();

        expect(api.device_xbees).not.toHaveBeenCalled();
    });

    describe("(on widget settings page, just loaded)", function () {
        beforeEach(function () {
            $state.is.andCallFake(function (s) { return s == 'widget_settings' });
            // Make sure widget.radio is also defined.
            scope.widget.radio = 'bar';
        });

        it("should not trigger an API call when widget.device change is detected", function () {
            scope.widget.device = 'foo';

            scope.$apply();

            expect(api.device_xbees).not.toHaveBeenCalled();

            expect(scope.available_nodes).toEqual([{xpExtAddr: scope.widget.radio}]);
            expect(scope.has_error).toBeFalsy();
            expect(scope.loading_nodes).toBeFalsy();
            expect(scope.picking_enabled).toBeTruthy();
        });
    });

    describe("(on widget settings page, after first load)", function () {
        beforeEach(function () {
            scope.widget.radio = 'bar';
            scope.widget.device = 'foo';
            scope.$apply();

            expect(api.device_xbees).toHaveBeenCalled();

            api.device_xbees.reset();
        });

        // Use tests that are common to both cases.
        NodePickerController_Common(this.env, test_ctx, 'widget_settings');
    });

    describe("(on add widget page)", function () {
        // Use tests that are common to both cases.
        NodePickerController_Common(this.env, test_ctx, 'add_widget');
    });
});

describe("Controller: PinConfigCtrl", function () {
    beforeEach(module("XBeeGatewayApp"));

    var scope, modal;

    beforeEach(inject(function ($controller, $rootScope) {
        scope = $rootScope.$new();
        modal = {open: jasmine.createSpy('modal.open')};
        $controller('PinConfigCtrl', {
            $scope: scope, $modal: modal
        });
    }));

    it("should provide a checkPinConfig function", function () {
        expect(scope.checkPinConfig).toMatch(jasmine.any(Function));
    });

    it("should open a modal dialog in checkPinConfig", function () {
        scope.checkPinConfig("ABC");

        expect(modal.open).toHaveBeenCalledWith({
            templateUrl: 'widget_settings/pin-config-modal.tpl.html',
            controller: 'settingsPinConfigModalCtrl',
            backdrop: 'static',
            resolve: {
                widget: jasmine.any(Function),
                option: jasmine.any(Function)
            }
        });
    });

    it("should resolve widget and option in the modal opened", function () {
        scope.checkPinConfig("ABC");

        var resolve = modal.open.mostRecentCall.args[0].resolve;

        scope.widget = {abc: 123};
        expect(resolve.widget()).toBe(scope.widget);
        expect(resolve.option()).toBe("ABC");
    });
});

describe("Controller: settingsPinConfigModalCtrl", function () {
    beforeEach(module("XBeeGatewayApp"));

    var scope, modalInstance, api, xbeeService, widget, option;
    var $controller;
    var config_q, apply_q;

    // Allow for creating controller inside tests, so that things like
    // widget and option can be manipulated
    function makeCtrl () {
        ctrl = $controller("settingsPinConfigModalCtrl", {
            $scope: scope, $modalInstance: modalInstance,
            dashboardApi: api, xbeeService: xbeeService,
            widget: widget, option: option
        });
    }

    beforeEach(inject(function (_$controller_, $rootScope, $injector) {
        scope = $rootScope.$new();
        modalInstance = {dismiss: jasmine.createSpy('dismiss')};
        api = $injector.get('dashboardApi');
        xbeeService = $injector.get('xbeeService');

        q = $injector.get('$q');
        config_q = q.defer();
        apply_q = q.defer();

        $controller = _$controller_;

        // Provide default values
        option = {key: "gets", format: "pin"};
        widget = {gets: "DIO0"}; // provide gets key to prevent errors

        spyOn(api, 'radio_config').andReturn(config_q.promise);
        spyOn(api, 'radio_config_apply').andReturn(apply_q.promise);
    }));

    it("should set up the basic scope correctly", function () {
        makeCtrl();

        expect(scope.state).toEqual({
            working: true, // check_config is called immediately
            applying: false,
            error: false,
            error_text: null,
            needs_config: false
        });

        // Auto-selects first option
        var isOutput = false;
        var command = xbeeService.get_stream_options("DIO0", "pin", isOutput);
        var selected = command.options[0].value;

        expect(scope.values).toEqual({
            fetched: null, selected: selected,
            device_ic: null, computed_ic: null
        });

        expect(scope.option).toBe(option);
        expect(scope.command).toEqual(command);

        // Check that scope functions are provided
        var functions = ["check_config", "all_is_well", "configure_device"];
        for (var i = 0; i < functions.length; i++) {
            var fname = functions[i];
            expect(scope[fname]).toBeDefined();
            expect(scope[fname]).toMatch(jasmine.any(Function));
        }
    });

    it("should throw an error on unrecognized option format", function () {
        option.format = "lorem ipsum";

        expect(makeCtrl).toThrow(new Error("Unknown widget option format: lorem ipsum"));
    });

    it("should call the API to check radio configuration immediately", function () {
        option.format = "stream";
        widget.device = "foo";
        widget.radio = "bar";

        makeCtrl();

        expect(api.radio_config).toHaveBeenCalledWith("foo", "bar");
    });

    // TODO test check_config more

    it("should close the modal dialog in `cancel`", function () {
        makeCtrl();

        scope.cancel();

        expect(modalInstance.dismiss).toHaveBeenCalledWith('cancel');
    });

    it("should parse XBee RCI config names to AT commands correctly", function () {
        makeCtrl();

        var map = { };
        for (var i = 0; i < 13; i++) {
            map['dio' + i + '_config'] = (i < 10) ? 'D' + i : 'P' + (i - 10);
        }

        for (var key in map) {
            expect(scope.rci_to_at_cmd(key)).toEqual(map[key]);
        }

        // Unparseable names just get themselves back
        expect(scope.rci_to_at_cmd("foobar")).toBe("foobar");
        expect(scope.rci_to_at_cmd("di_config")).toBe("di_config");
    });

    it("all_is_well should work as expected", function () {
        // return (are selected and fetched the same) and (computed and
        // on-device IC values the same)?
        makeCtrl();

        // Both pairs the same
        scope.values.selected = scope.values.fetched = '3';
        scope.values.computed_ic = scope.values.device_ic = '0xff';
        expect(scope.all_is_well()).toBeTruthy();

        // false/true
        scope.values.fetched = '2';
        expect(scope.all_is_well()).toBeFalsy();

        // true/false
        scope.values.selected = scope.values.fetched;
        scope.values.computed_ic = '0x0';
        expect(scope.all_is_well()).toBeFalsy();

        // false/false
        scope.values.selected = '0';
        expect(scope.all_is_well()).toBeFalsy();
    });
});
