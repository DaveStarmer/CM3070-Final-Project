"""Tests for Movement Detection Code"""

from unittest import TestCase

from pathlib import Path
import cv2

from ..movement_detection import MovementDetection, FRAME_HISTORY

TEST_FRAME_RATE = 15

# location of test folder, to ensure that data files can be referenced no matter where tests are
# called from
TEST_FOLDER = Path(__file__).parent


class TestMovementDetection(TestCase):
    """TestCase to test movement detection"""

    def test_movement_detected(self):
        """Ensure movement is detected when it should be"""
        # create detector to test
        detector = MovementDetection(frame_rate=TEST_FRAME_RATE)

        # open test file
        filename = TEST_FOLDER.joinpath("data", "movement.mp4")
        capture = cv2.VideoCapture(filename)

        # read first frame of video, and repeat for frame history + 1 frames
        # with no movement detected
        _, frame = capture.read()

        assert not any([detector.add_frame(frame) for _ in range(FRAME_HISTORY + 1)])

        # loop rest of file, verify video is completed
        detection_result = loop_file_and_detect(detector, capture)

        assert any(detection_result)

    def test_no_movement_detected(self):
        """Ensure no movement is detected when it should not be"""
        # create detector to test
        detector = MovementDetection(frame_rate=TEST_FRAME_RATE)

        # open test file
        filename = TEST_FOLDER.joinpath("data", "no_movement.mp4")
        capture = cv2.VideoCapture(filename)

        # read first frame of video, and repeat for frame history + 1 frames
        _, frame = capture.read()
        detection_result = [detector.add_frame(frame) for _ in range(FRAME_HISTORY + 1)]

        # add rest of file
        detection_result += loop_file_and_detect(detector, capture)

        # movement should not have been detected at any point
        assert not any(detection_result[:-2])


def loop_file_and_detect(detector, capture):
    """loop remainder of file, add to list of responses from add

    Args:
        detector (MovementDetection): movement detector to append frames to
        capture (cv2.VideoCapture): cv2 access to test file

    Returns:
        list: list of boolean responses to add_frame
    """
    result = []
    while True:
        # read frame from file
        ret, frame = capture.read()

        if not ret:
            # end of file
            break

        # append result to list
        result.append(detector.add_frame(frame))

    return result
