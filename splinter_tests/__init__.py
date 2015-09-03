#
# This Source Code Form is subject to the terms of the Mozilla Public License,
# v. 2.0. If a copy of the MPL was not distributed with this file, You can
# obtain one at http://mozilla.org/MPL/2.0/.
#
# Copyright (c) 2015 Digi International Inc., All Rights Reserved.
#

from splinter import Browser
import datetime
import json
import os
import logging
import time


logging.basicConfig()
logger = logging.getLogger("splinter_tests.__init__")


# Quiet down the Selenium logging
from selenium.webdriver.remote.remote_connection import \
        LOGGER as _selenium_logger
_selenium_logger.setLevel(logging.INFO)


SERVER_URL = "http://localhost:5859"
#SERVER_URL = "https://xbeewifi.herokuapp.com"
#SERVER_URL = "https://xbgw-333.herokuapp.com"

def make_url(uri):
    return '{}{}'.format(SERVER_URL, uri)

browser = None
driver = "phantomjs"


def _put_local_phantomjs_on_path():
    # Use local PhantomJS installation (from node_modules) by putting the path
    # to the phantomjs executable at the front of the PATH.
    thisdir = os.path.dirname(__file__)
    node_modules = os.path.abspath(os.path.join(thisdir, "..", "node_modules"))
    dirs = ["karma-phantomjs-launcher", "node_modules", "phantomjs", "bin"]
    phantomjs = os.path.join(node_modules, *dirs)

    if os.path.isdir(phantomjs):
        curpath = os.environ["PATH"]
        os.environ["PATH"] = os.pathsep.join([phantomjs, curpath])
    else:
        print "Could not find PhantomJS installation at", phantomjs


# Nose test package setup
def setup_package():
    # Remove any old screenshots
    if os.path.isdir('splinter_tests/screenshots/'):
        for filename in os.listdir('splinter_tests/screenshots/'):
            if os.path.isfile(filename):
                print "Removing old screenshot", filename
                os.unlink(filename)


def start_browser():
    if driver == "phantomjs":
        _put_local_phantomjs_on_path()

    logger.debug("Starting browser: %s", driver)
    global browser
    browser = Browser(driver)
    browser.cookies.delete()


def kill_browser():
    global browser

    logger.debug("Killing browser, in 3 seconds")
    # Wait 3 seconds before killing the browser, so that any ongoing API
    # requests or page loads can complete. This keeps the server logs from
    # filling with broken pipe errors, etc.
    time.sleep(3)

    browser.quit()
    browser = None


def visit(uri):
    url = make_url(uri)
    logger.info("Visiting: %s", url)
    global browser
    browser.visit(url)


def screenshot(name):
    shots_dir = 'splinter_tests/screenshots/'
    if not os.path.exists(shots_dir):
        os.makedirs(shots_dir)
    elif not os.path.isdir(shots_dir):
        raise IOError(shots_dir + " is not a directory.")

    if not name.endswith('.png'):
        name += '.png'

    # Remove any spaces in the filename
    name = name.replace(' ', '-')

    # Append the current time
    now = datetime.datetime.now().isoformat('_')

    # Convert name to <name>_<time>.png
    name = ''.join((name[:-4], '_', now, '.png'))

    print "Exception when URL =", browser.url

    print "Saving screenshot at", shots_dir + name

    browser.driver.save_screenshot(shots_dir + name)

    # If we're taking a screenshot, we probably also want the logs...
    print "Saving console log at", shots_dir + name + ".log"
    with open(shots_dir + name + ".log", "w") as f:
        log = browser.driver.get_log('browser')
        json.dump(log, f, indent=4)


def select_by_text(name, text):
    '''Like browser.select, but select by option text, not value.'''
    global browser
    xpath = '//select[@name="%s"]/option[.="%s"]' % (name, text)
    # Based on splinter.driver.webdriver.BaseWebDriver implementation
    browser.find_by_xpath(xpath).first._element.click()
