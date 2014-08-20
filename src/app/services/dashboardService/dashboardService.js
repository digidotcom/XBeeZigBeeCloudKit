/*
 * This Source Code Form is subject to the terms of the Mozilla Public License,
 * v. 2.0. If a copy of the MPL was not distributed with this file, You can
 * obtain one at http://mozilla.org/MPL/2.0/.
 *
 * Copyright (c) 2014 Digi International Inc., All Rights Reserved.
 */

'use strict';

angular.module('XBeeGatewayApp')
    .service('dashboardService', function dashboardService(dashboardApi, $q, $log) {
        /*
         * This service's purpose is to provide the 'single source of truth'
         * about widgets in the dashboard across all pages of the application.
         * All access to widgets should be done by referencing widgets accecced
         * through this service (as opposed to calling dashboardApi.dashboards()
         * directly).
         */

        var fetched = false;
        var dashboard_dfd = $q.defer();

        var _make_unique = function (widget_list) {
            for (var i = 0; i < widget_list.length; i++) {
                var widget = widget_list[i];
                // Index guaranteed to be unique.
                widget._uniq = i;
            }
        }

        //update dashboard with a PUT to <url_dfd>

        //Fetches widgets from backend, stores url
        var get_dashboard = function () {
            fetched = true;
            dashboardApi.dashboard().then(function(data) {
                dashboard_dfd.resolve(data);
            }, function (response) {
                dashboard_dfd.reject(response);
            });
            return dashboard_dfd.promise;
        }

        //Gets widgets if not already retrieved, otherwise returns cached
        var widgets = function () {
            var dfd = $q.defer();
            $log.debug('getting widgets', fetched)
            if (!fetched) {
                get_dashboard().then(function (dashboard) {
                    $log.debug('Loaded dashboard from server:', dashboard);
                    if (_.isEmpty(dashboard) || dashboard.url === null) {
                        // Some strange error occurred within dashboardApi, or
                        // the user's account has no dashboards (hence, the
                        // loaded dashboard url is null)
                        $log.debug("Invalid dashboard, or user has no dashboards.");
                        dfd.reject(["No dashboards in your account.", dashboard]);
                        return;
                    }
                    _make_unique(dashboard.widgets);
                    // Otherwise, the dashboard should be okay, so resolve the
                    // promise with the list of widgets.
                    dfd.resolve(dashboard.widgets);
                }, function(response) {
                    dfd.reject(["Fetching dashboard failed", response])
                });
            } else {
                dashboard_dfd.promise.then(function(dashboard) {
                    $log.debug('Loaded cached dashboard:', dashboard)
                    if (_.isEmpty(dashboard) || dashboard.url === null) {
                        // Some strange error occurred within dashboardApi, or
                        // the user's account has no dashboards (hence, the
                        // loaded dashboard url is null)
                        $log.debug("Invalid cached dashboard, or user has no dashboards.");
                        dfd.reject(["No dashboards in your account.", dashboard]);
                        return;
                    }
                    dfd.resolve(dashboard.widgets);
                }, function() {
                    dfd.reject(["Fetching dashboard failed"])
                });
            }
            return dfd.promise
        }

        var update_widgets = function () {
            var dfd = $q.defer();
            dashboard_dfd.promise.then(function (dashboard) {
                var url = dashboard.url;
                var resource = _.last(url.split(/com|org|net/));
                var widgets = [];
                for (var i = 0; i < dashboard.widgets.length; i++) {
                    // Remove _uniq key from each widget.
                    var w = _.clone(dashboard.widgets[i]);
                    delete w._uniq;
                    widgets.push(w);
                }
                $log.debug(widgets);
                dashboardApi.update_widgets(resource, widgets)
                    .then(function() {
                        $log.debug("update_widgets succeeded", arguments);
                        dfd.resolve();
                    }, function () {
                        $log.debug("update_widgets failed", arguments);
                        dfd.reject();
                    });
            });
            return dfd.promise;
        }

        var remove_widget = function (widget_id) {
            var dfd = $q.defer();
            dashboard_dfd.promise.then(function (dashboard) {
                var url = dashboard.url;
                var resource = _.last(url.split(/com|org|net/));
                var survivors = _.reject(dashboard.widgets, function(widget) {
                    return (widget.id === widget_id);
                });
                dashboardApi.update_widgets(resource, survivors)
                    .then(function() {
                        dfd.resolve();
                    }, function() {
                        dfd.reject()
                    });
            });
            return dfd.promise;
        }

        var widgets_uncached = function () {
            $log.debug("Fetching widgets from server, uncached.");
            fetched = false;
            dashboard_dfd = $q.defer();
            return widgets();
        }

        // TODO: Could have these dynamically loaded/extended, etc
        var dashboard_layouts = [
            {
                description: "Cloud Kit (recommended)",
                definition: [
                    {
                        read_only: false,
                        type: "switch",
                        sets: "DIO10",
                        invert: false,
                        id: "led1",
                        _gridPos: {
                            row: 1,
                            col: 1
                        },
                        label: "Gauge LEDs"
                    },
                    {
                        read_only: false,
                        type: "switch",
                        sets: "DIO7",
                        invert: false,
                        id: "buzzer1",
                        _gridPos: {
                            row: 1,
                            col: 3
                        },
                        label: "Buzzer Toggle"
                    },
                    {
                        type: "tilt",
                        stream_x: "AD2",
                        stream_y: "AD3",
                        id: "accelerometer1",
                        _gridPos: {
                            row: 1,
                            col: 5
                        },
                        label: "Tilt"
                    },
                    {
                        read_only: true,
                        type: "switch",
                        sets: "DIO4",
                        invert: true,
                        id: "button1",
                        _gridPos: {
                            row: 3,
                            col: 1
                        },
                        label: "User Button",
                        gets: "DIO4"
                    },
                    {
                        read_only: false,
                        type: "switch",
                        sets: "DIO6",
                        invert: true,
                        id: "motor1",
                        _gridPos: {
                            row: 3,
                            col: 3
                        },
                        label: "Motor Toggle"
                    },
                    {
                        transform: "value/1023 * 100",
                        units: "percent",
                        low: 0,
                        type: "gauge",
                        id: "potentiometer1",
                        high: 100,
                        _gridPos: {
                            row: 4,
                            col: 5
                        },
                        label: "Potentiometer",
                        gets: "AD1"
                    },
                    {
                        autoscale: true,
                        ymin: 0,
                        ymax: 1000,
                        type: "line-graph",
                        timespan: 90,
                        ticksize: 30,
                        color: "#FF6319",
                        id: "lineGraph1",
                        _gridPos: {
                            row: 5,
                            col: 1
                        },
                        label: "Potentiometer - Graph",
                        gets: "AD1"
                    },
                    {
                        type: "serial",
                        id: "serial1",
                        _gridPos: {
                            row: 6,
                            col: 5
                        },
                        label: "Serial Terminal"
                    }
                ]
            },
            {
                description: "Empty",
                definition: []
            }
        ];

        var make_dashboard = function (device_id, radio, dashboard_def) {
            var widgets = [];
            // Only do anything with the device or radio fields if there are
            // any widgets to begin with.
            if (dashboard_def.length > 0) {
                // set the 'device' and 'radio' fields on each widget
                widgets = _.map(dashboard_def, function (w) {
                    // Clone each widget object so the originals are preserved.
                    var widget = _.clone(w);
                    widget.device = device_id;
                    widget.radio = radio;
                    return widget;
                });
            }
            return dashboardApi.post_dashboard(widgets);
        }

        return {
            widgets: widgets,
            widgets_uncached: widgets_uncached,
            update_widgets: update_widgets,
            remove_widget: remove_widget,
            make_dashboard: make_dashboard,
            _dashboard_layouts: function () {
                // Return a deep clone of available layouts,
                // so that the original stock dashboard model here is preserved
                return _.clone(dashboard_layouts, true);
            },
            current_url: function () {
                var ret = $q.defer();
                dashboardApi.dashboard().then(function (dashboard) {
                    ret.resolve(dashboard.url);
                }, function () {
                    ret.reject(arguments[0]);
                });
                return ret.promise;
            }
        };
    });
