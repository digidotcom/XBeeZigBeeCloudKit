#
# This Source Code Form is subject to the terms of the Mozilla Public License,
# v. 2.0. If a copy of the MPL was not distributed with this file, You can
# obtain one at http://mozilla.org/MPL/2.0/.
#
# Copyright (c) 2014 Digi International Inc., All Rights Reserved.
#

from hamcrest import *
from functools import partial
from nose import with_setup
import logging

import splinter_tests
from utils import log_in_clean, do_sleep, e2e_users

browser = None


def setup():
    splinter_tests.start_browser()
    global browser
    browser = splinter_tests.browser


def teardown():
    splinter_tests.kill_browser()


def expand_username_menu():
    # Expand the menu by clicking on the username in the top right.
    link_css = ".navbar a.dropdown-toggle"
    username_link = browser.find_by_css(link_css)

    assert not username_link.is_empty()
    username_link.click()


def do_check_device_list(test_user):
    # Do a fresh login
    log_in_clean(*test_user.auth)

    # Navigate to the Devices page
    splinter_tests.visit("/#/devices")
    do_sleep(multiplier=0.5)

    assert_that(browser.title, starts_with("XBee Gateways in your account"))

    # Make sure we didn't get redirected away or anything
    assert_that(browser.url, ends_with("#/devices"))

    # Check the contents of the page
    assert browser.is_text_present("XBee Gateways in your account")
    assert not browser.find_link_by_text("Manage Devices").is_empty()

    # Allow the device list fetch to complete. (Should be wicked fast on
    # integration test backend.)
    do_sleep(multiplier=0.5)

    def check_devices():
        for device in test_user.devices['items']:
            assert browser.is_text_present(device['devConnectwareId'])
            if device.get('dpDescription'):
                assert browser.is_text_present(device['dpDescription'])

            # Check the connection status indicator is correct.
            conn_status = device.get('dpConnectionStatus', "0")

            conn_image = "device_disconnected.png"

            try:
                if int(conn_status):
                    conn_image = "device_connected.png"
            except (ValueError, TypeError):
                pass

            # Find the image. This XPath ensures that the connection status
            # image is in the cell immediately before the device ID.
            xpath = '//td[.="{}"]/preceding-sibling::td[1]/img'
            xpath = xpath.format(device['devConnectwareId'])
            img = browser.find_by_xpath(xpath)
            assert not img.is_empty()
            assert_that(len(img), is_(1))

            assert_that(img.first['src'], ends_with(conn_image))

    # Check the device list right now
    check_devices()

    # Refresh the list, check it again.
    ref_button = browser.find_by_xpath('//button[contains(., "Refresh List")]')
    assert not ref_button.is_empty()
    ref_button.click()
    # Wait for list to load
    do_sleep()
    # Check the list again
    check_devices()


def test_devices_page():
    for user in e2e_users:
        fn = lambda: do_check_device_list(user)
        desc = "Check Devices page for test user {}".format(user.username)
        fn.description = desc

        yield fn
