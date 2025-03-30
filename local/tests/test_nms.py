"""Tests for Movement Detection Support Functions"""

from unittest import TestCase
from unittest.mock import Mock, patch

from pathlib import Path
import numpy as np

from ..movement_detection import (
    remove_nested_bounding_rects,
    non_maxima_supression_bounding_rects,
)

# location of test folder, to ensure that data files can be referenced no matter where tests are
# called from
TEST_FOLDER = Path(__file__).parent


class TestNonMaximaSupression(TestCase):
    """Tests for non-maxima suppression code"""

    def setUp(self):
        self.test_boxes = [
            np.array([1, 1, 11, 11]),  # large box
            np.array([5, 5, 12, 12]),  # overlapping large box
            np.array([2, 2, 7, 7]),  # entirely contained within large box
            np.array([21, 21, 41, 41]),  # totally separate box
        ]

    def test_nested_removal(self):
        """one of the standard boxes should be removed as it is entirely contained within another"""
        actual = remove_nested_bounding_rects(self.test_boxes)

        assert len(actual) == 3

    def test_nms(self):
        """overall nms test - both contained box and overlapping box should be removed"""
        actual = non_maxima_supression_bounding_rects(self.test_boxes)

        assert len(actual) == 2

    def test_area_sort(self):
        """check that remaining items are in area order"""
        actual = non_maxima_supression_bounding_rects(self.test_boxes)
        areas = [(x[2] - x[0]) * (x[3] - x[1]) for x in actual]
        assert areas[0] > areas[1]
