/*
 * This Source Code Form is subject to the terms of the Mozilla Public License,
 * v. 2.0. If a copy of the MPL was not distributed with this file, You can
 * obtain one at http://mozilla.org/MPL/2.0/.
 *
 * Copyright (c) 2014 Digi International Inc., All Rights Reserved.
 */

'use strict';

angular.module('XBeeGatewayApp')
    .directive('tiltWidget', function (widgetRegistry, utils, dataStreams) {
        var linker = function postLink(scope, element) {
            scope.$element = element;
            scope.x = 780;
            scope.y = 780;
            var type = 'tilt';
            var spec = widgetRegistry.get(type);

            utils.postlinkWidget(type, scope, element, spec);

            // Hook into dataStreams to listen for the necessary streams

            // Determine which streams to listen to.
            var xStream, yStream, xStreamTemplate, yStreamTemplate;

            if (/^DIO/.test(scope.widget.stream_x)) {
                // Listen to xbee.digitalIn
                xStreamTemplate = 'xbee.digitalIn/[${radio}]!/${stream_x}';
            } else if (/^AD/.test(scope.widget.stream_x)) {
                // Listen to xbee.analog
                xStreamTemplate = 'xbee.analog/[${radio}]!/${stream_x}';
            } else {
                // Assume they selected a serial stream.
                xStreamTemplate = 'xbee.serialIn/[${radio}]!';
            }

            if (/^DIO/.test(scope.widget.stream_y)) {
                // Listen to xbee.digitalIn
                yStreamTemplate = 'xbee.digitalIn/[${radio}]!/${stream_y}';
            } else if (/^AD/.test(scope.widget.stream_y)) {
                // Listen to xbee.analog
                yStreamTemplate = 'xbee.analog/[${radio}]!/${stream_y}';
            } else {
                // Assume they selected a serial stream.
                yStreamTemplate = 'xbee.serialIn/[${radio}]!';
            }

            // Template out the stream names
            xStream = _.template(xStreamTemplate, scope.widget);
            yStream = _.template(yStreamTemplate, scope.widget);

            var device = scope.widget.device;
            var xlistener = function (value) {
                scope.x = value.value;
            };
            var ylistener = function (value) {
                scope.y = value.value;
            };
            var unlisten_x = dataStreams.listen(device, xStream, xlistener);
            dataStreams.get_initial_data(device, xStream);
            var unlisten_y = dataStreams.listen(device, yStream, ylistener)
            dataStreams.get_initial_data(device, yStream);
            scope.$on('$destroy', function () {
                unlisten_x();
                unlisten_y();
            });
        };

        // AngularJS directive setup
        return {
            templateUrl: "widgets/tiltWidget/tiltWidget.tpl.html",
            restrict: 'A',
            link: linker,
            controller: 'simpleDataHolder',
            scope: { widget: "=tiltWidget" }
        };
    })
    // This function, referred to in AngularJS as a "run block", is called by
    // AngularJS after the injector is created and is used to bootstrap the
    // application. The XBee ZigBee Cloud Kit makes use of the run block
    // to add widget definitions to the widget registry at start-up.
    .run(function(widgetRegistry) {
        // Adding the widget to the widget registry
        var widget_type_key = 'tilt';
        var widget_description = 'Tilt Indicator Widget';
        var widget_spec = {
            // Whether or not the widget is built-in or user-created
            // (i.e., whether the code is in /src/app or /src/common)
            builtin: true,
            // widget size: X,Y (columns, rows)
            size: [3, 3],
            // description appearing in 'Widget Type' list when adding new
            // widgets
            description: widget_description,
            directive: "tilt-widget",
            // camel-case version of directive
            directive_c: "tiltWidget",

            // properties pertaining to widget settings
            /*
            has_input: does the widget's data get updated from Device Cloud?
            sends_output: does the widget send data to the device?
            input_xform: can the user specify a custom transformation to apply
                            to incoming data? (optional)
            options: list of objects defining the settings associated with this
                        widget type
                - options generally follow the Revalidator API
                    (http://github.com/flatiron/revalidator)
            */
            has_input: false,
            sends_output: false,
            options: [
                {key: "stream_x", label: "X-Axis Stream", type: "string",
                 format: "stream", required: true},
                {key: "stream_y", label: "Y-Axis Stream", type: "string",
                 format: "stream", required: true}
            ]
        };

        // DO NOT CHANGE ANY CODE BELOW HERE.
        widgetRegistry.put(widget_type_key, widget_spec);
    });
