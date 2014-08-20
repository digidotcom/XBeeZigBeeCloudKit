/*
 * This Source Code Form is subject to the terms of the Mozilla Public License,
 * v. 2.0. If a copy of the MPL was not distributed with this file, You can
 * obtain one at http://mozilla.org/MPL/2.0/.
 *
 * Copyright (c) 2014 Digi International Inc., All Rights Reserved.
 */

'use strict';

angular.module('XBeeGatewayApp')
.controller('WidgetSettingsCtrl', function ($scope, $log, utils, $stateParams, dashboardService,
                                        notificationService, widgetRegistry, $state, $rootScope) {
    //This controller contains the logic for both the
    //widget_settings and /add_widget page

    $scope.widget_id = null;
    $scope.widget = {};

    $scope.settings_items = [];
    $scope.new_settings_item = function (opt) {
        var obj = {
            valid: true,
            error_message: "",
            key: opt.key
        };
        $scope.settings_items.push(obj);
        return obj;
    }

    // Begin: Code for differentiating between widget_settings and add_widget
    if ($state.is('widget_settings')) {
        utils.setTitle("Widget Settings");
        $scope.widget_id = $stateParams.widget_id;
    } else if ($state.is('add_widget')) {
        utils.setTitle("Add Widget");
        dashboardService.widgets().then(function(widgets) {
            var new_widget_id = 'widget_' + new Date().getTime();
            widgets.push({id: new_widget_id});
            $scope.widget_id = new_widget_id;
        }, function (response) {
            // response will consist of a list, where the first item is an
            // error message
            $log.error("Failed to fetch dashboard on add-widget page", response);
            var msg = response[0];
            notificationService.error(msg, 'Problem loading dashboard to add widget');
            $state.go("setup");
        });
    } else {
        $state.transitionTo("dashboard");
    }
    // End: Code for differentiating between widget_settings and add_widget

    $scope.viewCode = function () {
        $state.transitionTo("view_code", {widget_id: $stateParams.widget_id});
    }

    $scope.removing = false;
    $scope.removeWidget = function () {
        $scope.removing = true;
        dashboardService.remove_widget($stateParams.widget_id).then(function () {
            $state.transitionTo("dashboard");
        }, function () {
            $log.error("Error removing widget!", arguments);
            notificationService.error(
                undefined, "Error removing widget. Please try again.");
        })['finally'](function () {
            $scope.removing = false;
        });
    }

    $scope.selected_type = null;

    $scope.optionFields = [];
    $scope.base_options = utils.base_options;
    $scope.base_options_map = {};
    _.forEach(utils.base_options, function (opt) {
        $scope.base_options_map[opt.key] = opt;
    });
    $scope.io_options_map = {};
    _.forEach(utils.io_options, function (opt) {
        $scope.io_options_map[opt.key] = opt;
    });
    $scope.defn = {};

    $scope.$watch('form.$valid', function (validity, pastvalidity) {
        $log.debug("Form validity changed! Now:", validity, " was: ", pastvalidity);
        $rootScope.$broadcast('widget_settings.valid', validity);
    });

    // When this view is instantiated, fetch the widget based on the
    // widget_id variable set above, and set the widget field on the
    // scope to that widget object.
    $scope.$watch('widget_id', function(w_id) {
        if (w_id === null || w_id === undefined) {
            return;
        }

        utils.get_widget_by_id(w_id)
        .then(function (widget) {
            $log.debug("Looked up widget!", widget);
            if (_.isEmpty(widget)) {
                $log.info("There is no widget by that id");
                $state.transitionTo("dashboard");
                return;
            }
            $scope.widget = widget;
            $scope.selected_type = widgetRegistry.get(widget.type);
            $scope.selected_device = widget.device;
            $scope.selected_node = widget.radio;
        }, function (response) {
            // response will consist of a list, where the first item is an
            // error message
            $log.error("Failed to fetch dashboard on widget settings page", response);
            var msg = response[0];
            notificationService.error(msg, 'Problem loading widget settings');
            $state.go("setup");
        });
    });

    var lookupOptions = function (definition) {
        if (!definition) {
            $log.info("lookupOptions got bad definition!", definition);
        }
        else {
            $log.debug("Widget type selected:", definition);
            _.extend($scope.defn, {
                has_input: definition.has_input,
                sends_output: definition.sends_output,
                input_xform: definition.input_xform
            });

            // definition.options might be falsy (undefined, null,
            // false) -- use [] instead, in that case
            var options = definition.options || [];

            // If options is an empty array, $scope.optionFields will
            // end up being an empty array.
            // Otherwise, it ends up holding the values in options
            $scope.optionFields.splice.apply(
                $scope.optionFields,
                [0, $scope.optionFields.length].concat(options)
            );
        }
    }

    $scope.$watch('selected_type', function (definition) {
        if (definition === null || definition === undefined) {
            return;
        }
        lookupOptions(definition);
        $scope.widget.type = definition.type_key;
    });


    ////////////////
    // Button controlling code
    ////////////////
    $scope.save_disabled = false;
    $scope.saving = false;

    $scope.$on('widget_settings.valid', function (event, valid) {
        $log.debug("Buttons control got new validity", valid);
        $scope.save_disabled = !valid;
    });
    $scope.save = function () {
        $scope.saving = true;
        dashboardService.update_widgets().then(function() {
            $state.transitionTo("dashboard");
        }, function () {
            // Dashboard service does not pass any argument in.
            $log.error("Error saving widget!");
            notificationService.error(undefined, "Error saving widget. Try again.");
        })['finally'](function () {
            $scope.saving = false;
        });
    }

    $scope.cancel = function () {
        $state.transitionTo("dashboard");
    }
})
.controller('SettingsFormController', function ($log, $scope) {
    $scope.settings_items = [];
    var new_settings_item = function (opt) {
        var obj = {
            valid: true,
            message: "",
            opt: opt
        };
        $scope.settings_items.push(obj);
        return obj;
    };
    $scope.settings_items_invalid = function () {
        return _.any($scope.settings_items, {valid: false});
    };
    $scope.get_errors = function () {
        return _.where($scope.settings_items, {valid: false});
    }

    $scope.$watch('settings_items_invalid()', function (value) {
        // Enable/disable saving widget depending on input validity.
        $scope.save_disabled = value;
    });

    return {
        new_settings_item: new_settings_item,
        remove_settings_item: function (item) {
            //This code previously used _.pull().
            //It seems that func is not available in the current version
            //of lodash in grunt :(((
            var temp_items = $scope.settings_items.filter(function(i) {
                return (i !== item);
            });
            $scope.settings_items = temp_items;
        }
    };
})
.controller('SettingsItemController', function ($log, $scope) {
    $scope.has_error = false;
})
.controller('WidgetTypeController', function ($log, $scope, widgetRegistry,
                                              $filter) {
    $scope.has_error = false;
    //$scope.selected_type = null;
    var widget_types = $filter('nonHiddenWidgets')(widgetRegistry.getall());
    // Sort widget types by their type key
    $scope.select_values = _.sortBy(widget_types, 'type_key');
})
.controller('DevicePickerController', function ($log, $scope, dashboardApi, notificationService) {
    $scope.has_error = false;
    $scope.loading_devices = true;

    $scope.devices = [];
    dashboardApi.devices().then(function (devices) {
        $scope.devices = devices;
    }, function () {
        $log.error("Error loading device list");
        notificationService.error("Reload the page to try again.", "Error loading gateway list.");
    })['finally'](function () {
        $scope.loading_devices = false;
    });

    $scope.labelify = function (device) {
        var template = "${devConnectwareId}";
        if (device.dpDescription) {
            template += " (${dpDescription})";
        }

        return _.template(template, device);
    }
})
.controller('NodePickerController', function ($log, $scope, $q, $timeout,
                                              dashboardApi, $state) {
    $scope.has_error = false;

    $scope.error_message = "";

    $scope.available_nodes = [];
    $scope.loading_nodes = false;
    $scope.picking_enabled = false;

    $scope.make_label = function (node) {
        // Default to showing just the 64-bit address
        var template = "${addr}";
        var data = {
            addr: node.xpExtAddr
        }

        // If the node ID is available, present it.
        if ("xpNodeId" in node && !_.isEmpty(node.xpNodeId)) {
            template = "${node_id} (${addr})";
            data.node_id = node.xpNodeId;
        }

        return _.template(template, data);
    }

    var update_canceller = undefined;

    // Query
    var update_node_list = function (device_id, cache, clear) {
        var deferred = $q.defer();

        if (angular.isDefined(update_canceller)) {
            // Cancel previous update, if it hasn't finished yet.
            $log.info("Cancelling previous node fetch")
            update_canceller.resolve();
            update_canceller = undefined;
        }
        update_canceller = $q.defer();

        $log.debug("Fetching XBee nodes for", device_id);

        // If cache not given, default to true
        if (cache == null) cache = true;
        // If clear not given, default to false
        if (!clear) clear = false;

        dashboardApi.device_xbees(device_id, cache, clear, update_canceller.promise)
            .then(function (nodes) {
            $log.debug("Got XBee nodes:", nodes);
            if ("error" in nodes) {
                $log.error("Error fetching XBee modules:", nodes.error);
                deferred.reject(nodes.error);
                return;
            }
            deferred.resolve(nodes);
        }, function (data) {
            if (data.status === 0) {
                // Update was cancelled.
                $log.info("Cancelled fetch of nodes for " + device_id);
                deferred.reject(null);
                return;
            }
            $log.error("Failed to fetch XBee modules:", data, status);
            deferred.reject(data);
        })['finally'](function () {
            update_canceller = undefined;
        });

        return deferred.promise;
    }

    var device_changed = function (newvalue, oldvalue) {
        if ($state.is('widget_settings') && newvalue !== undefined &&
                oldvalue === undefined && $scope.widget.radio !== undefined) {
            // We're on the widget settings page, we just loaded the widget and
            // filled in the fields. Don't discover XBees.
            // Create a stub node object, put it in the list.
            $scope.available_nodes = [{xpExtAddr: $scope.widget.radio}];
            $scope.has_error = $scope.loading_nodes = false;
            $scope.picking_enabled = true;
            $log.info("Skipping XBee discovery for now.");
            return;
        }

        if (newvalue === undefined) {
            $scope.available_nodes = [];
            $scope.has_error = $scope.loading_nodes = $scope.picking_enabled = false;
        } else if (newvalue !== oldvalue) {
            // It's okay to refresh the list.
            $scope.discover_xbees(newvalue, false, false);
        }
    }

    $scope.discover_xbees = function (device, cache, clear) {
        $scope.loading_nodes = true;
        $scope.available_nodes = [];
        $scope.has_error = false;
        update_node_list(device, cache, clear).then(function (nodes) {
            var remote_nodes = _.reject(nodes, {"xpNetAddr": "0"});
            $scope.available_nodes = remote_nodes;

            if (angular.isUndefined($scope.widget.radio) &&
                    remote_nodes.length > 0) {
                // Pick first node by default, if no node has been
                // selected.
                $scope.widget.radio = remote_nodes[0].xpExtAddr;
            }

            $scope.loading_nodes = $scope.has_error = false;
            $scope.picking_enabled = true;

            $scope.error_message = "";
        }, function (err) {
            if (err === null) {
                // Update was cancelled.
                return;
            }
            $scope.loading_nodes = false;
            $log.error("Error loading modules...", err.data);
            $scope.has_error = true;
            try {
                if (angular.isArray(err.data.error)) {
                    $scope.error_message = err.data.error[0];
                } else {
                    $scope.error_message = (err.data.error || angular.toJson(err));
                }
            } catch (exc) {
                $scope.error_message = err;
            }
        });
    }

    // Watch the device selection, so we can populate the node list
    // appropriately.
    $scope.$watch('widget.device', device_changed);
})
.controller('PinConfigCtrl', function ($scope, $modal) {
    ////////////////
    // Pin Config Modal
    ////////////////
    $scope.checkPinConfig = function(option) {
        var modalInstance = $modal.open({
            templateUrl: 'widget_settings/pin-config-modal.tpl.html',
            controller: 'settingsPinConfigModalCtrl',
            backdrop: 'static',
            resolve: {
                widget: function(){
                    return $scope.widget;
                },
                option: function(){
                    return option;
                }
            }
        });
    };
})
.controller('settingsPinConfigModalCtrl', function($scope, $modalInstance, dashboardApi,
                                                    xbeeService, $log, widget, option) {
    $scope.state = {
        working: false,
        applying: false,
        error: false,
        error_text: null,
        needs_config: false,
    };

    $scope.values = {
        fetched: null,
        selected: null,
        device_ic: null,
        computed_ic: null
    };

    $scope.option = option;

    var stream = widget[option.key];

    $scope.command = {options: []};

    // FIXME: refactor this, horribly tight coupling between what should be general widget defined options
    switch(option.format)
    {
    case "stream":
    case "pin":
        var isOutput = !widget.read_only && (option.key === "sets");
        $scope.command = xbeeService.get_stream_options(stream, option.format , isOutput);
        break;
    case "pwm":
        $scope.command = xbeeService.get_stream_options(stream, option.format , true);
        break;
    default:
        //Unknown format, display an error
        $log.error("Unknown widget option format!", option.format);
        throw new Error("Unknown widget option format: " + option.format);
    }

    /* istanbul ignore else: should always be at least one option */
    if($scope.command.options.length){
        // Autoselect first option
        $scope.values.selected = $scope.command.options[0].value;
    }

    $scope.cancel = function () {
        $modalInstance.dismiss('cancel');
    };

    $scope.rci_to_at_cmd = function (setting_name) {
        var re = /^dio(\d+)_config$/;
        var parsed = setting_name.match(re);
        if (parsed) {
            var num = parseInt(parsed[1]);
            return (num < 10) ? "D" + num : "P" + (num - 10);
        } else {
            return setting_name;
        }
    }

    $scope.check_config = function() {
        $scope.state.error = false;
        $scope.state.needs_config = false;
        $scope.state.working = true;

        dashboardApi.radio_config(widget.device, widget.radio).then(function(resp) {
            $log.debug("Received device config", resp)
            $scope.state.working = false;
            try {
                var value = resp.radio[$scope.command.cmd];
                var ic = resp.radio.dio_detect;

                $scope.values.fetched = value;
                $scope.values.device_ic = ic;

                // Default the value selection to its current value, if that's
                // one of the valid options. Otherwise, pick the first in the
                // list.
                if (_.find($scope.command.options, {value: value})) {
                    $scope.values.selected = value;
                } else {
                    $scope.values.selected = $scope.command.options[0].value;
                }

                var isAnalogInput = parseInt($scope.values.selected) == 2;

                var cmd = $scope.command.cmd;
                var computed_ic = ic;
                // Compute the necessary IC value, if we're configuring a dio
                // pin for digital I/O
                if (angular.isDefined(ic) && /^dio\d/.test($scope.command.cmd)
                        && !isAnalogInput) {
                    var new_ic = xbeeService.generate_ic_str(cmd, ic);
                    if (new_ic) {
                        $log.info("Computed necessary IC value:", new_ic);
                        computed_ic = new_ic;
                    } else {
                        // Leave it as is.
                        $log.info("Got bad computed IC: ", new_ic);
                        computed_ic = ic;
                    }
                } else {
                    // No need to change the IC
                    $log.info("No need to change IC for this");
                    computed_ic = ic;
                }

                $scope.values.computed_ic = computed_ic;
            } catch (e) {
                $log.error(e);
                $scope.state.error = true;
            }
        }, function (resp) {
            $log.error("Error checking device config", resp);
            $scope.state.working = false;
            $scope.state.error = true;
            $scope.state.error_text = resp.data;
        });
    }

    $scope.all_is_well = function () {
        var same_setting = ($scope.values.selected == $scope.values.fetched);
        var same_ic = ($scope.values.computed_ic == $scope.values.device_ic);
        return same_setting && same_ic;
    }

    $scope.configure_device = function (cmd_name, cmd_value, ic_value) {
        $scope.state.applying = true;

        var param = {radio: {}};

        param.radio[cmd_name] = cmd_value;

        // If ic_value is provided, update and send it too
        if (ic_value !== undefined && xbeeService.cmd_ic_capable(cmd_value)) {
            var new_ic = xbeeService.generate_ic_str(cmd_name, ic_value);
            if (new_ic){
                param.radio.dio_detect = new_ic;
                $log.debug("Including updated IC value:", param);
            }
        }

        $log.debug("Configuring device with settings:", param);

        dashboardApi.radio_config_apply(widget.device, widget.radio, param).then(function(){
            $log.debug("Successfully applied new setting", cmd_name, cmd_value);
            $scope.state.applying = false
            // Re-run the check fn to confirm
            $scope.check_config();
        }, function(response){
            //TODO What to do in case of error? Currently fails silently
            $log.error("Error while applying setting to new device: ", response);
            $scope.state.error = true;
            $scope.state.error_text = response.data;
            $scope.state.applying = false;
        });
    }

    // Check config immediately when controller created
    $scope.check_config();
});


