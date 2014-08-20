/*
 * This Source Code Form is subject to the terms of the Mozilla Public License,
 * v. 2.0. If a copy of the MPL was not distributed with this file, You can
 * obtain one at http://mozilla.org/MPL/2.0/.
 *
 * Copyright (c) 2014 Digi International Inc., All Rights Reserved.
 */

angular.module('XBeeGatewayApp.devices', [
    'XBeeGatewayApp.api',
    'ui.router',
    'ui.route',
    'templates-app',
    'ui.bootstrap'
])
.controller('devicesPageCtrl', function ($scope, $log, dashboardApi, $modal, utils, $timeout) {
    utils.setTitle("XBee Gateways in your account");

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
                $scope.devices.loading = true;
                $timeout(function(){
                    $scope.load_devices();
                }, 3000);
            }
        });
    };

    $scope.devices = {
        loaded: false,
        loading: false,
        load_error: null,
        selected: null,
        list: []
    };

    $scope.load_devices = function () {
        $scope.devices.loaded = false;
        $scope.devices.loading = true;
        $scope.devices.load_error = "";
        $scope.devices.selected = null;
        $scope.devices.list.splice(0, $scope.devices.list.length);

        dashboardApi.devices().then(function (devices) {
            $scope.devices.loaded = true;
            $scope.devices.loading = false;
            $scope.devices.list.splice.apply($scope.devices.list,
                                        [0, 0].concat(devices));
        }, function (response) {
            $scope.devices.loaded = true;
            $scope.devices.loading = false;
            $scope.devices.load_error = "An error was encountered while " +
                                        "loading the device list. Please " +
                                        "try again. (Status: " +
                                        response.status + ")";
        });
    }

    $scope.config = {
        error: false,
        error_text: null
    }

    $scope.load_devices();

    $scope.cloud_fqdn = "login.etherios.com";
    dashboardApi.user().then(function (user) {
        $scope.cloud_fqdn = user.cloud_fqdn;
    }, function (resp) {
        $log.error("Failed to load user info on devices page", resp);
    });
})
.controller('devicesAddModalCtrl', function($scope, $modalInstance, dashboardApi, $log, notificationService, utils, $q) {
    $scope.state = {
        working: false,
        error: false,
        error_text: null
    }

    /* Poll DeviceCore every 2 seconds, waiting for the device with the given
     * ID to show up as online. */
    var wait_for_device_to_connect = function (device_id) {
        var deferred = $q.defer();

        var retry_number = 0;

        var poll_okay = function (devices) {
            if (devices.length == 0) {
                // No device found. The device is supposed to be in the account
                // though... Fail out.
                $log.info("No device " + device_id + " found.");
                deferred.resolve({
                    title: "Gateway not found in your Device Cloud account.",
                    message: "Description might not be applied."
                });
                return;
            }

            // Ignore status and headers
            var device = devices[0];

            if (device.dpConnectionStatus == 1) {
                // Device is connected. Check if last disconnect time is not
                // null (e.g. that the device got disconnected after
                // provisioning, and has now reconnected).
                if ((device.dpLastDisconnectTime || null) != null) {
                    $log.info("Device is connected now.");
                    deferred.resolve();
                    return;
                } else {
                    $log.info("Device hasn't been reconnected yet.");
                }
            } else {
                $log.info("Device is not connected to Device Cloud yet.");
            }

            // If we've already polled 10 times (20 seconds or so) and we
            // either the device still hasn't connected, or Device Cloud hasn't
            // forced it to reconnect, just go ahead and pretend it's okay.
            if (retry_number >= 10) {
                $log.warn("Too many device poll retries.");
                deferred.resolve();
                return;
            }

            // Either the device is not connected, or the last disconnect time
            // is null. Wait two seconds, then try again.
            retry_number++;

            $log.info("Checking device status again in two seconds...");

            utils.timeout(function () {
                dashboardApi.devices(device_id).then(poll_okay, poll_fail);
            }, 2000);
        }

        var poll_fail = function (response) {
            // The API will reply with 200 OK even if the device is not in
            // DeviceCore, so this is an actual error.
            $log.error("Error polling DeviceCore for device:", response.status, response.data);

            // For simplicity's sake, go ahead with attempting configuration,
            // but display a warning.
            deferred.resolve({
                message: "Description might not be applied to device.",
                title: "Encountered an error while polling for device status."
            });
        }

        utils.timeout(function () {
            dashboardApi.devices(device_id).then(poll_okay, poll_fail);
        }, 2000);

        return deferred.promise;
    }

    $scope.add = function (device_mac, device_desc) {
        if ($scope.state.working) {
            // IE8 has a tendency to trigger the add() call twice on click.
            // We need to ensure we only send the request once.
            $log.debug("Skipping duplicate Add Device clicks.");
            return;
        }
        $scope.state.working = true;

        dashboardApi.provision_device_mac(device_mac).then(function(){
            $log.debug("Succesfully added " + device_mac);

            var provision_config = {timeOut: 3000};

            if (device_desc) {
                notificationService.success(
                    "Attempting to apply description...",
                    "Gateway was provisioned to your Device Cloud account.",
                    provision_config);

                // Try to send the description to the device
                // TODO ideally we should use id fetched from newly added device, but for now shortcut it
                var deviceId = "00000000-00000000-" + device_mac.substring(0,6) + "FF-FF" +  device_mac.substring(6);

                var config = {
                    system: {
                        description: device_desc
                    }
                };

                // Wait two seconds before applying configuration, so that we
                // don't just get a DeviceCore error or something
                wait_for_device_to_connect(deviceId).then(function (notification) {
                    if (notification) {
                        // We only resolve with notification data if we want to
                        // display a warning.
                        $log.warn(notification.title + "; " + notification.message);
                        notificationService.warning(notification.message, notification.title);
                    }

                    $log.info("Applying description to device...");

                    dashboardApi.gateway_config_apply(deviceId, config).then(function(){
                        $log.info("Description successfully applied to device.");
                    }, function(response){
                        $log.error("Error while applying description to new device: ", response);
                        var errors = utils.find_key(response, 'error');
                        var problem;
                        if (errors && errors.length) {
                            problem = errors[0].error.desc;
                        }
                        notificationService.error(problem, "Description could not be applied to device.");
                    });
                });
            } else {
                notificationService.success(
                        undefined, "Gateway was provisioned to your Device Cloud account.", provision_config);
            }

            // Whether or not there is a description to apply, close the modal
            // dialog.
            $scope.state.working = false;
            $modalInstance.close(true);
        }, function (response) {
            $scope.state.working = false;

            $log.error("Error provisioning device " + device_mac, response);
            // Backend does not currently attempt to parse error responses.
            // So, we need to search the response data for the error.
            var regex = /<error>([\s\S]*?)<\/error>/;
            if (regex.test(response.data)) {
                var error_message = response.data.match(regex)[1].trim();

                // Trim off 'DeviceCore error' preamble.
                var devicecore = /^POST DeviceCore error. Invalid request. /;
                if (devicecore.test(error_message)) {
                    error_message = error_message.replace(devicecore, "");
                }

                $scope.state.error_text = error_message;
            } else {
                // No error could be found for parsing. Just use response text.
                $scope.state.error_text = response.data;
            }

            $scope.state.error = true;
        });
    };

    $scope.cancel = function () {
        $modalInstance.dismiss('cancel');
    };
});
