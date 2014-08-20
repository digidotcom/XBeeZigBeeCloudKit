/*
 * This Source Code Form is subject to the terms of the Mozilla Public License,
 * v. 2.0. If a copy of the MPL was not distributed with this file, You can
 * obtain one at http://mozilla.org/MPL/2.0/.
 *
 * Copyright (c) 2014 Digi International Inc., All Rights Reserved.
 */

describe("Controller: ViewCodeCtrl", function () {
    beforeEach(module("XBeeGatewayApp"));

    var utils, ctrl, scope, q, $state, $stateParams,
            widgetRegistry, notificationService;
    var $$controller;
    var widget_q;

    // Allow for creating controller inside tests, so that things like
    // $stateParams can be manipulated first
    function makeCtrl () {
        ctrl = $$controller("ViewCodeCtrl", {
            $scope: scope, utils: utils, $state: $state,
            $stateParams: $stateParams, widgetRegistry: widgetRegistry,
            notificationService: notificationService
        });
    }

    beforeEach(inject(function (_utils_, $controller, $rootScope, $injector) {
        $$controller = $controller;
        q = $injector.get('$q');
        widget_q = q.defer();

        $state = $injector.get('$state');
        spyOn($state, 'transitionTo');
        $stateParams = {widget_id: null};

        utils = _utils_;
        spyOn(utils, 'setTitle');
        spyOn(utils, 'get_widget_by_id').andReturn(widget_q.promise);

        scope = $rootScope.$new();

        widgetRegistry = {get: jasmine.createSpy("widgetRegistry.get")};

        notificationService = $injector.get('notificationService');
        spyOn(notificationService, 'error');
    }));

    it("should set the page title properly", function () {
        makeCtrl();
        expect(utils.setTitle).toHaveBeenCalledWith("View Widget Code");
    });

    it("should set up scope values correctly", function () {
        makeCtrl();
        expect(scope.widget).toEqual({});
        expect(scope.fileName).toBe("");

        expect(scope.close).toMatch(jasmine.any(Function));
    });

    it("should call utils.get_widget_by_id automatically", function () {
        $stateParams.widget_id = "1234abc";
        makeCtrl();

        expect(utils.get_widget_by_id).toHaveBeenCalledWith($stateParams.widget_id);
    });

    it("should set scope values correctly when get_widget_by_id succeeds", function () {
        // widget_id value doesn't really matter, since we control
        // get_widget_by_id
        makeCtrl();

        var widget = {type: 'switch'};
        widget_q.resolve(widget);

        // Fake out widgetRegistry behavior
        widgetRegistry.get.andCallFake(function (type) {
            return {directive_c: type + "_foo", builtin: false};
        });

        scope.$digest();

        expect(scope.widget).toBe(widget);
        expect(scope.fileName).toBe('switch_foo');
        expect(scope.builtin).toBe(false);

        expect($state.transitionTo).not.toHaveBeenCalled();
        expect(notificationService.error).not.toHaveBeenCalled();
    });

    it("should transition to dashboard if get_widget_by_id resolves with empty value", function () {
        makeCtrl();

        widget_q.resolve(undefined);
        scope.$digest();

        expect(widgetRegistry.get).not.toHaveBeenCalled();
        expect($state.transitionTo).toHaveBeenCalledWith('dashboard');
    });

    it("should transition to setup if get_widget_by_id fails", function () {
        makeCtrl();

        spyOn($state, 'go');

        // Code extracts first entry in array as the error message.
        widget_q.reject(["My error message!"]);
        scope.$digest();

        expect(notificationService.error).toHaveBeenCalledWith(
            "My error message!", "Problem loading widget");
        expect($state.go).toHaveBeenCalledWith('setup');
    });

    it("should transition to dashboard on Close", function () {
        makeCtrl();

        scope.close();
        expect($state.transitionTo).toHaveBeenCalledWith('dashboard');
    });
});

describe("Directive: codeView (code-view)", function () {
    // TODO: Test this
});
