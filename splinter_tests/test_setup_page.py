#
# This Source Code Form is subject to the terms of the Mozilla Public License,
# v. 2.0. If a copy of the MPL was not distributed with this file, You can
# obtain one at http://mozilla.org/MPL/2.0/.
#
# Copyright (c) 2015 Digi International Inc., All Rights Reserved.
#

from hamcrest import assert_that, ends_with, starts_with, is_, is_not
from nose import with_setup

import splinter_tests
from utils import (delete_all_dashboards, get_e2e_user, do_sleep,
                   screenshot_on_exception, screenshot_on_exception_decorator)

browser = None


BAD_CREDS_TEXT = "Username or password was incorrect."
NEW_DEVICE_MODAL_TITLE = "Add a New Gateway to your Account"

STEP_TITLES = [
    None, "1: Choose a layout preset",
    "2: Select your XBee Gateway", "3: Select your Cloud Kit XBee",
    "4: Configure XBee for Cloud Kit"
]


def setup():
    splinter_tests.start_browser()
    global browser
    browser = splinter_tests.browser


def teardown():
    splinter_tests.kill_browser()


def re_login():
    # Copied from test_login.test_login_good_credentials
    splinter_tests.visit("/logout")
    splinter_tests.visit("/#/login/e2e_fqdn")

    do_sleep()

    with screenshot_on_exception("re_login"):
        assert not browser.find_by_id("login_error").visible

        browser.fill("username", "e2e_user")
        browser.fill("password", "e2e_password")
        browser.find_by_css('.btn.login-button').click()

        # Wait for a moment
        do_sleep()

        assert not browser.is_text_present(BAD_CREDS_TEXT)
        assert_that(browser.url, ends_with("#/setup"))


def re_login_no_devices():
    splinter_tests.visit("/logout")
    splinter_tests.visit("/#/login")

    do_sleep()

    with screenshot_on_exception("re_login_no_devices"):
        assert not browser.find_by_id("login_error").visible
        browser.fill("username", "e2e_user_nodevices")
        browser.fill("password", "e2e_password")
        browser.find_by_css('.btn.login-button').click()

        # Wait for a moment
        do_sleep()

        assert not browser.is_text_present(BAD_CREDS_TEXT)
        assert_that(browser.url, ends_with("#/setup"))


def re_login_tst_user():  # tst, not test, so nose ignores this.
    splinter_tests.visit("/logout")
    splinter_tests.visit("/#/login")
    assert not browser.find_by_id("login_error").visible
    browser.fill("username", "test_user")
    browser.fill("password", "e2e_password")
    browser.find_by_css('.btn.login-button').click()

    do_sleep()

    assert not browser.is_text_present("Username or password was incorrect.")
    assert_that(browser.url, ends_with("#/setup"))


def clear_dashboards(user="e2e_user", password="e2e_password",
                     fqdn="e2e_fqdn"):
    delete_all_dashboards(user, password, fqdn)


log_back_in_before = with_setup(re_login)
log_in_nodevices_before = with_setup(re_login_no_devices)
clear_dashboards_before = with_setup(lambda: clear_dashboards)
clear_dashboards_nodevices_before = with_setup(
    lambda: clear_dashboards("e2e_user_nodevices", fqdn="login.etherios.com"))
clear_dashboards_test_before = with_setup(
    lambda: clear_dashboards("test_user", fqdn="login.etherios.com"))
#clear_dashboards = with_setup(clear_dashboards)


def get_user_device_option_labels(username='e2e_user'):
    user = get_e2e_user(username)

    if not user:
        raise ValueError("Failed to find user")

    options = []
    for device in user.devices['items']:
        template = "{id}"
        if device.get('dpDescription'):
            template = "{id} ({desc})"

        fmt = {
            'id': device['devConnectwareId'],
            'desc': device.get('dpDescription')
        }
        options.append(template.format(**fmt))

    return options


@clear_dashboards_before
@log_back_in_before
def test_page_contents():
    """The setup page should appear correctly."""
    assert_that(browser.url, ends_with("#/setup"))

    assert_that(browser.title, starts_with("Dashboard Creation |"))

    header = browser.find_by_css("body > .content-holder > .container > h1")
    assert_that(header.first.text, is_("Dashboard Creation"))

    assert browser.is_text_present(STEP_TITLES[1])


@log_back_in_before
def test_logout():
    """Finding and clicking 'Log out' should log the user out."""
    # Log out. To do this, we must click on the username in the top right, then
    # "Log out". Splinter seems to have trouble finding the link by text, so we
    # will have to find it by CSS...
    dropdown_css = ".nav.navbar-right > li.dropdown > a.dropdown-toggle"
    dropdown = browser.find_by_css(dropdown_css)
    assert not dropdown.is_empty()  # Make sure we found it

    dropdown.click()

    # Click the 'Log out' link
    browser.find_link_by_text("Log out").click()

    assert_that(browser.url, ends_with("#/login"))


@clear_dashboards_before
@log_back_in_before
def test_select_dashboard():
    """Selecting a dashboard should bring up Step 2 of the setup process."""
    # By default, "Cloud Kit (recommended)" should be selected, and so Step 2
    # is visible.
    assert browser.is_text_present(STEP_TITLES[1])
    assert_that(browser.find_by_name("inputDashboard").value, is_("0"))
    assert browser.is_text_present(STEP_TITLES[2])

    # Check that we haven't selected a device yet.
    for device in get_user_device_option_labels():
        option = browser.find_option_by_text(device)
        assert not option.is_empty()
        # Make sure this option isn't selected
        assert not option.first.selected

    # Angular uses simple indexing for the values, and Splinter's selection API
    # states that you select an option by its value. Select the second
    # dashboard (Empty).
    browser.select("inputDashboard", 1)

    # Step 2 should have gone away, and the "Create Dashboard" button should
    # have appeared.
    assert not browser.is_text_present(STEP_TITLES[2])
    button = browser.find_by_name("createDash")
    assert not button.is_empty()
    assert button.first.visible

    # Select the default dashboard again - Step 2 reappears
    browser.select("inputDashboard", "0")
    assert browser.is_text_present(STEP_TITLES[2])
    # The 'Create Dashboard!' button should be hidden
    assert not button.first.visible


@log_back_in_before
def test_refresh_device_list():
    """Clicking the 'Refresh List' button clears selection, etc."""
    # Pick Cloud Kit dashboard, just to be safe.
    browser.select("inputDashboard", "0")

    # Find the refresh button
    button = browser.find_by_name("refreshList")
    assert not button.is_empty()

    # select the first device in the list
    browser.select("inputDevice", "0")

    # check that Step 3 is visible

    assert browser.is_text_present(STEP_TITLES[3])

    # Click the gateway list refresh button
    button.click()

    # Check that the selection is cleared. (Done by checking that all of the
    # given options are NOT selected.)
    for device in get_user_device_option_labels():
        option = browser.find_option_by_text(device)
        assert not option.is_empty()
        # Make sure this option isn't selected
        assert not option.first.selected

    # Check that step 3 went away as a result
    assert not browser.is_text_present(STEP_TITLES[3])


@clear_dashboards_test_before
@with_setup(re_login_tst_user)
def test_refresh_xbee_list():
    """Clicking the XBee 'Refresh List' button clears selection, etc."""
    # Pick this user's one gateway
    browser.select("inputDevice", "0")

    # Wait for XBee list to populate
    do_sleep()

    # Get the test_user's remote XBees, count them
    test_xbees = (x for x in get_e2e_user('test_user').xbees['items']
                  if int(x.get('xpNetAddr', 0)))
    num_xbees = len(list(test_xbees))

    xbee_count = len(browser.find_by_css('select#inputRadio option'))
    assert_that(xbee_count, is_(num_xbees + 1))  # some XBees, one empty option
    # The first option in the list is the empty option
    first = browser.find_by_css('select#inputRadio option:first-of-type')
    assert not first.is_empty()
    assert_that(first.value, is_(""))
    assert first.selected

    cbutton = browser.find_by_name("createDash").first

    # No XBees should have been selected yet, so no create dashboard button
    assert not cbutton.visible

    # Pick the first XBee in the list
    browser.select("inputRadio", "0");

    # Step 4, configuring the radio should show up.
    assert browser.is_text_present(STEP_TITLES[4])
    # Wait for configuration check to complete
    do_sleep()

    # If we click Refresh List, the selection should be cleared out
    button = browser.find_by_name("refreshXbees")
    assert not button.is_empty()
    button.click()
    # Step 4 should go away then
    assert not browser.is_text_present(STEP_TITLES[4])

    do_sleep()

    # Check XBee node list again, and the selection
    xbee_count = len(browser.find_by_css('select#inputRadio option'))
    assert_that(xbee_count, is_(num_xbees + 1))  # some XBees, one empty option
    # The first option in the list is the empty option
    first = browser.find_by_css('select#inputRadio option:first-of-type')
    assert not first.is_empty()
    assert_that(str(first.value), is_(""))
    assert first.selected


# Testing the configuration step is better left to dev-testing and functional
# test.
@clear_dashboards_test_before
@with_setup(re_login_tst_user)
@screenshot_on_exception_decorator("test_create_dashboard")
def test_create_dashboard():
    """Test out straight-through setting up dashboard."""
    assert browser.is_text_present(STEP_TITLES[1])
    assert browser.is_text_present(STEP_TITLES[2])

    # Select the first gateway
    browser.select("inputDevice", "0")

    # Wait for XBee list to populate
    do_sleep()

    assert browser.is_text_present(STEP_TITLES[3])
    # Select the first XBee
    browser.select("inputRadio", "0")

    assert browser.is_text_present(STEP_TITLES[4])
    # Wait for configuration check to go through.
    do_sleep(multiplier=2)
    if browser.find_by_id("configureRadio").first.visible:
        # Skip reconfiguration
        skip_button = browser.find_by_id("skipConfig")
        skip_button.click()
    elif browser.is_text_present("An error occurred"):
        # Error. Fail out.
        raise Exception("Configuration check had an error.")
    else:
        # Configuration check is really slow.
        import time
        now = time.time()
        while time.time() < now + 10:
            if browser.is_text_present("radio is configured", wait_time=1):
                break
            elif browser.is_text_present("An error occurred"):
                raise Exception("Configuration check had an error.")
        else:
            # Configuration check was too slow, or something else is wrong
            raise Exception("Configuration check never completed?")

    # hit the 'Create Dashboard!' button, check that it worked
    cbutton = browser.find_by_name("createDash")
    assert cbutton.first.visible

    cbutton.click()
    do_sleep()

    assert_that(browser.url, ends_with("#/dashboard"))
    # Make sure some of the expected widgets are visible
    assert browser.is_text_present("Potentiometer")
    assert browser.is_text_present("Buzzer Toggle")


@log_back_in_before
def test_click_add_device():
    """Clicking the 'Add New Device' button brings up that modal."""
    button = browser.find_by_name("addDevice")
    assert not button.is_empty()

    button.click()

    # Wait up to one second for the necessary text to be visible on screen
    # (i.e. for the modal dialog to appear)
    assert browser.is_text_present(NEW_DEVICE_MODAL_TITLE, 1)


@log_back_in_before
def test_cancel_add_device():
    """Clicking 'Cancel' in the add-device modal should hide the modal."""
    browser.find_by_name("addDevice").click()

    # Wait for the modal to appear
    assert browser.is_text_present(NEW_DEVICE_MODAL_TITLE, 1)

    # Click Cancel
    button = browser.find_by_name("cancelAdd")
    # Make sure we can find the button
    assert not button.is_empty()
    # Click the button
    button.click()

    # Check that the modal is gone
    assert not browser.is_text_present(NEW_DEVICE_MODAL_TITLE)
    # Try to find the button, but we expect it to not be found
    button = browser.find_by_name("cancelAdd")
    assert button.is_empty()


@log_back_in_before
def test_add_device_modal_whats_this():
    """The tooltip for `What's This?` must be correct."""
    browser.find_by_name("addDevice").click()

    # Wait up to 1 second for the modal dialog to appear.
    assert browser.is_text_present("What's This?", 1)

    link = browser.find_link_by_text("What's This?")
    # Make sure the link could be found.
    assert not link.is_empty()
    # Check its tooltip is correct
    expected_tooltip = ("The serial number is 12 characters, usually printed"
                        " on attached label and starting with 00409D")
    assert_that(link.first['tooltip'], is_(expected_tooltip))


# FT T225610
@clear_dashboards_nodevices_before
@log_in_nodevices_before
@screenshot_on_exception_decorator('test_add_device_error.png')
def test_add_device():
    """Test out adding a device to a user's account."""
    # Pick Cloud Kit dashboard
    browser.select("inputDashboard", "0")

    # Step 1 and Step 2 should be visible now
    assert browser.is_text_present(STEP_TITLES[1])
    assert browser.is_text_present(STEP_TITLES[2])

    # Wait a moment for the devices fetch to work.
    do_sleep()

    # Make sure no devices are selected.
    # (This user has no devices in their account anyway.)
    assert_that(browser.find_by_name("inputDevice").first.value, is_(""))

    # check that the Create Dashboard button is not visible
    button_xpath = '//button[contains(., "Create Dashboard!")]'
    cbutton = browser.find_by_xpath(button_xpath)
    assert not cbutton.is_empty()
    assert not cbutton.first.visible

    # Click 'Add New Device' button
    add_new_button = browser.find_by_name("addDevice")
    assert not add_new_button.is_empty()
    add_new_button.click()

    # Check that the modal has appeared.
    assert browser.is_text_present(NEW_DEVICE_MODAL_TITLE, 1)
    assert browser.is_text_present("What's This?")

    # Click 'Cancel' button
    browser.find_by_xpath('//button[.="Cancel"]').first.click()
    # Check that the modal has disappeared.
    assert not browser.is_text_present(NEW_DEVICE_MODAL_TITLE, 1)
    assert not browser.is_text_present("What's This?")

    # Click 'Add New Device' button again.
    add_new_button.click()
    # Check that the modal has appeared.
    assert browser.is_text_present(NEW_DEVICE_MODAL_TITLE, 1)
    assert browser.is_text_present("What's This?")

    # Check that the "Add Device" button is disabled
    button = browser.find_by_xpath('//button[contains(., "Add Device")]')
    assert not button.is_empty()
    assert button.first['disabled'], "Add Device button isn't disabled!"

    add_button = button

    # Check that the serial number field has 00409D pre-filled
    assert_that(browser.find_by_name("input_mac").first['placeholder'],
                is_("00409D ______"))

    # Enter some non-numeric characters in the serial number field
    browser.fill("input_mac", "zanzibar")
    assert add_button.first['disabled'], "Add Device button isn't disabled!"

    # Enter valid characters
    browser.fill("input_mac", "665544")
    assert not add_button.first['disabled'], "Add Device button isn't enabled!"
    # Enter description
    browser.fill("input_desc", "Integration test device description")

    # Click the button
    add_button.click()

    # Wait a moment while the POST happens. We'll know it worked when the
    # notification comes up. (Wait up to 10 seconds)
    assert browser.is_text_present("provisioned to your Device Cloud account",
                                   wait_time=10)
    # We then attempt configuration. Wait for that to pass. Should only take a
    # moment
    do_sleep(multiplier=3)

    # Check that the modal has disappeared.
    assert not browser.is_text_present(NEW_DEVICE_MODAL_TITLE)
    assert not browser.is_text_present("What's This?")

    # We should have automatically selected the new device.
    sel_value = str(browser.find_by_name("inputDevice").first.value)
    assert_that(sel_value, is_not(""))
