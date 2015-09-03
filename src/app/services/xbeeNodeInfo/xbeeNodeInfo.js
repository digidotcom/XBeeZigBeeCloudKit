/*
 * This Source Code Form is subject to the terms of the Mozilla Public License,
 * v. 2.0. If a copy of the MPL was not distributed with this file, You can
 * obtain one at http://mozilla.org/MPL/2.0/.
 *
 * Copyright (c) 2015 Digi International Inc., All Rights Reserved.
 */

'use strict';

angular.module('XBeeGatewayApp')
    .service('xbeeNodeInfo', function xbeeNodeInfo($log, dashboardApi) {
        var node_map = {};

        var refresh = function (ext_addrs) {
            var unique_addrs = _.uniq(ext_addrs);
            // Filter out any falsy values (undefined, false, null, 0)
            unique_addrs = _.remove(unique_addrs);

            $log.debug("Loading XBee node info for these nodes:", unique_addrs);

            function success(nodelist) {
                if (nodelist === undefined || nodelist.length == 0) {
                    $log.info("Failed to find any of the XBees in the dashboard");
                    return;
                }

                // Map extended addresses to node ID
                for (var i = 0; i < nodelist.length; i++) {
                    var node = nodelist[i];
                    if ("xpExtAddr" in node) {
                        node_map[node.xpExtAddr] = node.xpNodeId;
                    }
                }
            }

            function error(data) {
                $log.error("Failed to fetch XBee nodes", data);
            }

            dashboardApi.xbees(unique_addrs).then(success, error);
        }

        return {
            node_map: node_map,
            refresh: refresh
        };
    });

