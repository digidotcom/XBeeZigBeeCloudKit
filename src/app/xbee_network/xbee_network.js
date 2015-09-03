/*
 * This Source Code Form is subject to the terms of the Mozilla Public License,
 * v. 2.0. If a copy of the MPL was not distributed with this file, You can
 * obtain one at http://mozilla.org/MPL/2.0/.
 *
 * Copyright (c) 2015 Digi International Inc., All Rights Reserved.
 */

angular.module('XBeeGatewayApp.xbee_network', [
    'XBeeGatewayApp.api',
    'ui.router',
    'ui.route',
    'templates-app',
    'ui.bootstrap'
])
.controller('xbeeNetworkPageCtrl', function ($scope, $log, dashboardApi,
                                             $timeout, utils, $stateParams,
                                             $location) {
    utils.setTitle("XBee Network View");

    $scope.state = {};
    angular.extend($scope.state, {
        loading_gateways: false,
        loading_nodes: false,
        devices_load_error: false,
        nodes_load_error: false
    });

    $scope.gateways = $scope.nodes = [];
    $scope.fetch_from = "dc";

    $scope.selected_gateway = undefined;
    if ($stateParams.gateway) {
        $scope.selected_gateway = $stateParams.gateway;
    }

    var node_fetch_map = {
        dc: function (device) {
            return dashboardApi.device_xbees(device, true, false);
        },
        gw: function (device) { return dashboardApi.device_xbees(device, false, false); },
        gw_clear: function (device) { return dashboardApi.device_xbees(device, false, true); }
    };

    $scope.refresh_gateways = function () {
        angular.extend($scope.state, {
            loading_gateways: true,
            devices_load_error: ""
        });

        dashboardApi.devices().then(function (devices) {
            $scope.gateways = devices;

            var selection_found = false,
                force_load = false;

            for (var i = 0; i < devices.length; i++) {
                if (devices[i].devConnectwareId == $scope.selected_gateway) {
                    selection_found = true;
                    break;
                }
            }

            if (!selection_found && devices.length == 1) {
                // Device wasn't found. However, there is only one gateway in
                // the list, so we'll automatically select it, to make life
                // easier.
                $scope.selected_gateway = devices[0].devConnectwareId;
                force_load = true;
            }

            if (selection_found || force_load) {
                // Reset 'Fetch from' selection to Device Cloud.
                $scope.fetch_from = "dc";
                // Trigger a node list refresh.
                $scope.refresh_nodes($scope.selected_gateway, "dc");
            } else {
                // Previously-selected gateway (perhaps passed in on state
                // params) not in devices list. Clear selection.
                $scope.selected_gateway = undefined;
            }
        }, function (response) {
            var error = response.data;
            if (!response.data) {
                // No response content.
                error = "Status code " + response.status;
            } else if (_.has(error, "error") || _.has(error, "detail")) {
                error = response.data.error || response.data.detail;
                if (angular.isArray(error)) {
                    error = error[0];
                }
            } else if (angular.isString(error) && error.search(/<error>[\s\S]+?<\/error>/) > -1) {
                // Extract error message from RCI
                error = response.data.match(/<error>([\s\S]+?)<\/error>/)[1];
            }

            $scope.state.devices_load_error = error;
            $log.error("Error loading devices:", response.status, error);
        })['finally'](function () {
            $scope.state.loading_gateways = false;
        });
    }

    $scope.refresh_nodes = function (gateway, fetch_from) {
        $log.debug("refresh_nodes:", gateway, fetch_from);

        angular.extend($scope.state, {
            loading_nodes: true,
            nodes_load_error: ""
        });

        $location.search('gateway', gateway);

        var fn = node_fetch_map[fetch_from];
        if (fn) {
            var promise = fn(gateway);

            promise.then(function (xbees) {
                $scope.nodes = xbees;
            }, function (response) {
                var error = response.data;
                if (!response.data) {
                    // No response content.
                    error = "Status code " + response.status;
                } else if (_.has(error, "error") || _.has(error, "detail")) {
                    error = response.data.error || response.data.detail;
                    if (angular.isArray(error)) {
                        error = error[0];
                    }
                } else if (angular.isString(error) && error.search(/<error>[\s\S]+?<\/error>/) > -1) {
                    // Extract error message from RCI
                    error = error.match(/<error>([\s\S]+?)<\/error>/)[1];
                }

                $scope.state.nodes_load_error = error;
                $log.error("Error loading nodes:", response.status, error);
            })['finally'](function () {
                $scope.state.loading_nodes = false;
            });
        }
    }

    $scope.refresh_gateways();
})
.filter('node_type_repr', function () {
    return function (type) {
        type = parseInt(type);
        if (isNaN(type)) type = 3;

        switch (type) {
            case 0:
                return 'Coordinator';
            case 1:
                return 'Router';
            case 2:
                return 'End Device';
            default:
                return 'Unknown';
        }
    }
})
