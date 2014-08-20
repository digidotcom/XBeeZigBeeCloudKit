/*
 * This Source Code Form is subject to the terms of the Mozilla Public License,
 * v. 2.0. If a copy of the MPL was not distributed with this file, You can
 * obtain one at http://mozilla.org/MPL/2.0/.
 *
 * Copyright (c) 2014 Digi International Inc., All Rights Reserved.
 */

angular.module('XBeeGatewayApp.setup', [
    'XBeeGatewayApp.api',
    'XBeeGatewayApp.devices',
    'ui.router',
    'ui.route',
    'templates-app',
    'ui.bootstrap'
])
.controller('setupPageCtrl', function ($scope, $log, dashboardApi, $modal,
                                        utils, dashboardService, $state,
                                        notificationService, $timeout, $q) {
    utils.setTitle("Dashboard Creation");

    // Values used in form
    $scope.selected_device = $scope.selected_radio = null;
    $scope.dashboard_layout = "default";

    $scope.config = {
        checking: false,
        loaded: false,
        stock: false,
        confirmed: false,
        applying: false,
        error: null
    };

    $scope.loading_devices = $scope.loading_radios = false;

    $scope.devices = $scope.radios = null;

    $scope.get_devices = function () {
        $scope.selected_device = $scope.selected_radio = null;

        // Cancel any ongoing XBee node list fetch.
        if (angular.isDefined($scope.radio_fetch_canceller)) {
            $scope.radio_fetch_canceller.resolve();
        }

        $scope.loading_devices = true;
        dashboardApi.devices().then(function (devices) {
            $scope.devices = devices;

            if(devices.length === 1){
                $scope.selected_device = $scope.devices[0];
            }

            $scope.load_error = "";
        }, function (error) {
            $scope.load_error = error;
        })['finally'](function () {
            $scope.loading_devices = false;
            $('select#inputDevice').select2();
        });
    }
    $scope.get_devices();

    $scope.radio_fetch_canceller = undefined;

    $scope.get_radios = function () {
        if (!$scope.selected_device) {
            return;
        }

        if (angular.isDefined($scope.radio_fetch_canceller)) {
            $scope.radio_fetch_canceller.resolve();
        }
        var canceller = $q.defer();
        $scope.radio_fetch_canceller = canceller;

        $scope.selected_radio = $scope.radios = $scope.gateway_radio = null;
        $scope.loading_radios = true;
        $scope.radio_load_error = "";

        var cwid = $scope.selected_device.devConnectwareId;

        dashboardApi.device_xbees(cwid, false, canceller.promise)
            .then(function (nodes) {
                if ("error" in nodes) {
                    $scope.radio_load_error = nodes.error;
                } else {
                    $scope.radio_load_error = "";

                    // Filter out the coordinator node.
                    var n = [];
                    for (var i = 0; i < nodes.length; i++) {
                        var node = nodes[i];
                        if (parseInt(node.xpNetAddr) > 0) {
                            n.push(node);
                        } else {
                            $scope.gateway_radio = node.xpExtAddr;
                        }
                    }
                    $scope.radios = n;

                    if (n.length == 1) {
                        // Auto-select the only XBee in the list.
                        $scope.selected_radio = n[0];
                        $('select#inputRadio').select2("val", $scope.radio_label(n[0]));
                    }
                }
            }, function (resp) {
                if (resp.status === 0) {
                    // Update was cancelled.
                    $log.info("Cancelled XBee module list fetch.");
                    return;
                }
                if (angular.isArray(resp.data.error)) {
                    $scope.radio_load_error = resp.data.error[0];
                } else {
                    $scope.radio_load_error = resp.data.error || angular.toJson(resp.data);
                }
            })['finally'](function () {
                $scope.loading_radios = false;
                $('select#inputRadio').select2();
            });
    }

    $scope.checkConfig = function (gateway, radio) {
        angular.extend($scope.config, {
            checking: true,
            loaded: false,
            applying: false,
            error: null,
            confirmed: false,
            stock: false
        });

        var gwid = gateway.devConnectwareId;
        var xbee = radio.xpExtAddr;

        dashboardApi.radio_config(gwid, xbee).then(function (config) {
            // Config call will return a delta between current and kit config.
            // If it's an empty object, we match the stock configuration.
            if (_.isEmpty(config['config-kit-stock-values'])) {
                $scope.config.stock = $scope.config.confirmed = true;
            } else {
                $scope.config.stock = false;
            }
            $scope.config.loaded = true;
        }, function (response) {
            $log.error("Error retrieving device config: ", response);

            var errors = utils.find_key(response.data, 'error');
            if (errors.length) {
                $scope.config.error = errors[0].error.desc;
            } else {
                $scope.config.error = angular.toJson(response.data);
            }
        })['finally'](function () {
            $scope.config.checking = false;
        });
    }

    $scope.configure_radio = function (gateway, radio) {
        angular.extend($scope.config, {
            checking: false,
            loaded: false,
            applying: true,
            error: null,
            confirmed: false,
            stock: false
        });

        var gwid = gateway.devConnectwareId;
        var xbee = radio.xpExtAddr;

        dashboardApi.radio_config_apply_stock(gwid, xbee).then(function () {
            // Applying stock configuration succeeded. Check config again.
            $scope.checkConfig(gateway, radio);
        }, function (response) {
            $log.error("Error applying stock config: ", response);

            var errors = utils.find_key(response.data, 'error');
            if (errors.length) {
                $scope.config.error = errors[0].error.desc;
            } else {
                $scope.config.error = angular.toJson(response.data);
            }
        })['finally'](function () {
            $scope.config.applying = false;
        });
    }

    $scope.$watch('selected_device', function (value) {
        if (value) {
            $scope.get_radios();
            $timeout(function () {
                $('select#inputDevice').trigger('change.select2');
            }, 0);
        }
    });
    $scope.$watch('selected_radio', function (value) {
        if (value) {
            $scope.checkConfig($scope.selected_device, value);

            $timeout(function () {
                $('select#inputRadio').trigger('change.select2');
            }, 0);
        }
    });

    $scope.radio_label = function (node) {
        var template = "${xpExtAddr}";
        if (node.xpNodeId) {
            template = "${xpExtAddr} (${xpNodeId})";
        }

        return _.template(template, node);
    }

    $scope.add_device = function () {
        var modalInstance = $modal.open({
            templateUrl: 'devices/devices-add-modal.tpl.html',
            controller: 'devicesAddModalCtrl',
            backdrop: 'static'
        });

        modalInstance.result.then(function (device_added) {
            if(device_added){
                //If device was added, refresh device list
                // Device cloud can take a bit between returning from provision call to when
                // device is ready, so build in a bit of delay
                $scope.loading_devices = true;
                $timeout(function(){
                    $scope.get_devices();
                }, 3000);
                //TODO autoselect added device
            }
        });
    };

    $scope.make_label = function (device) {
        var label = device.devConnectwareId;
        if (device.dpDescription) {
            label += ' (' + device.dpDescription + ')';
        }
        return label;
    }

    $scope.dashboard_layouts = dashboardService._dashboard_layouts();
    $scope.selected_layout = $scope.dashboard_layouts[0];
    $scope.dashboard_working = false;

    $scope.create_dashboard = function (device, radio, dashboard) {
        var cwid = device ? device.devConnectwareId : undefined;
        var extAddr = radio ? radio.xpExtAddr : undefined;
        $log.debug("Creating new dashboard for device:", cwid, extAddr);
        $log.debug("Dashboard definition:", dashboard.definition);
        $scope.dashboard_working = true;
        dashboardService.make_dashboard(cwid, extAddr, dashboard.definition).then(function () {
            $scope.dashboard_working = false;
            $state.go('dashboard');
        }, function (response) {
            $log.error("Error creating dashboard", response);
            notificationService.error("Error creating dashboard. Please try again.");
            $scope.dashboard_working = false;
        });
    }

    $scope.show_joining_instructions = function (gateway, local_ext_addr) {
        var modalInstance = $modal.open({
            templateUrl: 'setup/joining-instructions.tpl.html',
            backdrop: 'static',
            controller: 'JoiningInstructionsCtrl',
            resolve: {
                values: function () {
                    return {
                        gateway: gateway,
                        gateway_radio: local_ext_addr
                    }
                }
            }
        });
    }
})
.controller("JoiningInstructionsCtrl", function ($scope, dashboardApi, $modalInstance, CommonLinks, notificationService, $log, utils, values) {
    $scope.cfg = {
        loading: false,
        error: null,
        data: null
    };

    $scope.doc_link = CommonLinks.documentation;
    $scope.show_reconf = false;

    $scope.send_cfg = {};
    // What was sent last
    $scope.sent_cfg = {};

    $scope.key_regex = /^$|^(0x)?[a-fA-F0-9]{1,16}$/;

    $scope.error_key = "";

    $scope.reconfigure = {
        applying: false,
        error: ""
    };

    function loadConfig() {
        $scope.cfg.loading = true;
        $scope.cfg.error = "";

        dashboardApi.radio_config(values.gateway, values.gateway_radio).then(function (cfg) {
            $log.info("Successfully fetch gateway XBee module configuration.");
            $scope.cfg.data = cfg;
            angular.extend($scope.send_cfg, {
                ext_pan_id: cfg.radio.ext_pan_id,
                link_key: '', network_key: '',
                encrypt_options: cfg.radio.encrypt_options,
                encrypt_enable: cfg.radio.encrypt_enable
            });
        }, function (response) {
            $log.error("Failed to fetch gateway XBee module configuration.", response);
            var errors = utils.find_key(response.data, 'error');
            if (errors.length) {
                $scope.cfg.error = errors[0].error.desc;
            } else {
                $scope.cfg.error = angular.toJson(response.data);
            }
        })['finally'](function () {
            $scope.cfg.loading = false;
        });
    }

    // Load the gateway radio's configuration automatically
    loadConfig();

    $scope.send_configuration = function () {
        $scope.reconfigure.applying = true;
        $scope.reconfigure.error = $scope.error_key = "";

        var configuration = {
            ext_pan_id: $scope.send_cfg.ext_pan_id || undefined,
            encrypt_enable: $scope.send_cfg.encrypt_enable
        };
        if ($scope.send_cfg.encrypt_enable != 0) {
            // Add in EO and keys.
            // ui-mask restricts input of EO to just one byte. Add 0x to front.
            configuration.encrypt_options =
                ($scope.send_cfg.encrypt_options ? '0x' + $scope.send_cfg.encrypt_options
                                                 : undefined);

            // These keys will be further processed just below.
            configuration.link_key = $scope.send_cfg.link_key;
            configuration.network_key = $scope.send_cfg.network_key;
        }

        // Normalize PAN ID and network key values to full 128-bit hex values.
        var keys = ['ext_pan_id', 'link_key', 'network_key'];
        for (var idx in keys) {
            var key = keys[idx];
            var value = configuration[key];

            if (value === '' || value === undefined) {
                // Value is empty, so replace it with undefined, so that it
                // doesn't get sent down
                configuration[key] = undefined;
            } else {
                // Parse it as a hex value
                var parsed = parseInt(value, 16);
                if (isNaN(parsed)) {
                    // It shouldn't be, if it passed the pattern regex.
                    $log.info("Bad value for %s: %s", key, value);
                    // Send it down unchanged. Let the device handle it.
                } else {
                    var strval = parsed.toString(16);
                    if (strval.length < 16) {
                        var padding = '0000000000000000'.substr(strval.length);
                        strval = padding + strval;
                    }
                    // Assign the new, possibly padded value to 'configuration'
                    configuration[key] = '0x' + strval;
                }
            }
        }

        dashboardApi.radio_config_apply(
            values.gateway, values.gateway_radio, {radio: configuration})
        .then(function () {
            $log.info("Successfully saved gateway module XBee settings.");
            notificationService.success(undefined, "Successfully applied configuration to gateway XBee.");
            // Collapse the Reconfigure panel, reload configuration
            $scope.show_reconf = false;

            // Update sent_cfg value, so the instructions reflect the most
            // recently sent keys, if applicable.
            $scope.sent_cfg = configuration;

            loadConfig();
        }, function (response) {
            $log.error("Failed to apply settings.", response);

            var errors = utils.find_key(response.data, 'error');
            if (errors.length) {
                $scope.reconfigure.error = errors[0].error.desc;
                $scope.error_key = errors[0].error.hint;
            } else {
                $scope.reconfigure.error = angular.toJson(response.data);
            }
        })['finally'](function () {
            $scope.reconfigure.applying = false;
        });
    }

    $scope.toggleReconfig = function () {
        $scope.show_reconf = !$scope.show_reconf;
    }

    $scope.cancel = function () {
        $modalInstance.dismiss('cancel');
    }
})
// Directive to highlight a form group with the error class, if the scope's
// error_key value matches the ID of the input element contained within.
// Also sets the has-error class if the input element has the ng-invalid class.
.directive('showError', function () {
    return {
        restrict: 'A',
        link: function (scope, element, attrs) {
            // Take the ID off the first descendant input element.
            var input = element.find('input');
            var id = input.attr('id');
            if (id) {
                scope.$watch('error_key', function (newvalue) {
                    if (newvalue === id) {
                        element.addClass('has-error');
                    } else {
                        element.removeClass('has-error');
                    }
                });
            }

            // Watch for form invalidity. This will clear the has-error class
            // once the input becomes valid, so if this group is highlighted
            // red because the device rejected the value, then the input value
            // is changed, the red will be cleared out.
            scope.$watch('myForm.$invalid', function (nowInvalid) {
                if (nowInvalid && input.hasClass('ng-invalid')) {
                    element.addClass('has-error');
                } else {
                    element.removeClass('has-error');
                }
            });
        }
    }
});
