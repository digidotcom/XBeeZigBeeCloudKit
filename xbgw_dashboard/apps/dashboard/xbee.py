#
# This Source Code Form is subject to the terms of the Mozilla Public License,
# v. 2.0. If a copy of the MPL was not distributed with this file, You can
# obtain one at http://mozilla.org/MPL/2.0/.
#
# Copyright (c) 2014 Digi International Inc., All Rights Reserved.
#

'''
Collection of helper classes and methods related to the XBee module

Created on Aug 30, 2013

@author: skravik
'''

_COMM_BUTTON = '1'
_ASSOC_IND = '1'
_ANALOG = '2'
_DIN = '3'
_DLOW = '4'
_DHI = '5'

# Configuration to be applied to for stock Kit experience
XBEE_KIT_CONFIG = {
    'radio': {
        # D0: Set as commissioning button
        'dio0_config': _COMM_BUTTON,
        # D1: Set as Analog Input (for potentiometer)
        'dio1_config': _ANALOG,
        # D2: Set as Analog Input (for accelerometer X-axis)
        'dio2_config': _ANALOG,
        # D3: Set as Analog Input (for accelerometer Y-axis)
        'dio3_config': _ANALOG,
        # D4: Set as Digital Input (for user button)
        'dio4_config': _DIN,
        # D5: Set as association indicator
        'dio5_config': _ASSOC_IND,
        # D6: Set as Digital Output High (for vibration)
        'dio6_config': _DHI,
        # D7: Set as Digital Output Low (for buzzer toggle)
        'dio7_config': _DLOW,
        # D8, D9 not supported on ZB radios.
        # P0: Set to Digital Output Low (for Gauge LEDs)
        'dio10_config': _DLOW,
        # P1: Set to Digital Output High (for buzzer frequency)
        'dio11_config': _DHI,
        # P2: Set to Digital Output Low (for user LED 0)
        'dio12_config': _DLOW,

        # Change detection. Detect DIO4, DIO6, DIO7, DIO10, DIO11, DIO12
        # changes.
        'dio_detect': hex(
            (1 << 4) | (1 << 6) | (1 << 7) | (1 << 10) | (1 << 11) | (1 << 12)
        ),

        # Change PR (pull-up resistor enable) on everything
        'pullup_enable': '0x3dff',

        # Enable JV (join verification) so that the radio searches for new
        # coordinators when it can't find its old one.
        'join_verification': '1',

        # Set IR (sampling rate) to 10 seconds
        'sample_rate': '10000'
    }
}

# Map of pin name to AT command used in configuration
XBEE_DIO_AT_MAP = {
    'DIO0': 'D0',
    'DIO1': 'D1',
    'DIO2': 'D2',
    'DIO3': 'D3',
    'DIO4': 'D4',
    'DIO5': 'D5',
    'DIO6': 'D6',
    'DIO7': 'D7',
    'DIO8': 'D8',
    'DIO9': 'D9',
    'DI10': 'P0',
    'DIO11': 'P1',
    'DIO12': 'P2',
    # UART controls
    'DIO13': 'P3',
    'DIO14': 'P4',
    # Only available on surface mount version
    'DIO15': 'P5',
    'DIO16': 'P6',
    'DIO17': 'P7',
    'DIO18': 'P8',
    'DIO19': 'P9',
}


# Dictionary comparison helper from http://stackoverflow.com/a/1165552
class DictDiffer(object):
    """
    Calculate the difference between two dictionaries as:
    (1) items added
    (2) items removed
    (3) keys same in both but changed values
    (4) keys same in both and unchanged values
    """

    def __init__(self, current_dict, past_dict):
        self.current_dict, self.past_dict = current_dict, past_dict
        self.current_keys, self.past_keys = [
            set(d.keys()) for d in (current_dict, past_dict)
        ]
        self.intersect = self.current_keys.intersection(self.past_keys)

    def added(self):
        return self.current_keys - self.intersect

    def removed(self):
        return self.past_keys - self.intersect

    def changed(self):
        return set(o for o in self.intersect
                   if self.past_dict[o] != self.current_dict[o])

    def unchanged(self):
        return set(o for o in self.intersect
                   if self.past_dict[o] == self.current_dict[o])


def compare_config_with_stock(config):
    """
    Compare a config dictionary with default Kit configuration, returning items
    that are missing/modified

    Returns a dictionary with stock values for modified or missing items
    """
    stock = XBEE_KIT_CONFIG
    delta = {}
    for settings_group in stock.iterkeys():
        if settings_group in config:
            # Compare group's items in each
            d = DictDiffer(config[settings_group], stock[settings_group])
            diff = d.changed() | d.removed()
            if len(diff) and not settings_group in delta:
                delta[settings_group] = {}
            for changed in diff:
                delta[settings_group][changed] = stock[settings_group][changed]
        else:
            # Entire group is missing, add it
            delta[settings_group] = stock[settings_group]

    return delta
