"""Movement Detection"""

from datetime import datetime
import cv2
import numpy as np

FRAME_HISTORY = 20
ADDITIONAL_PROCESSING_SECS = 0
IOU_THRESHOLD = 0.2


class MovementDetection:
    """Detect movement in video made up of supplied frame"""

    def __init__(
        self,
        frame_rate=30,
        detection_threshold=50,
        alert_contour_area=10000,
        video_preroll=3,
        video_length=20,
    ):
        # frame rate of video supplied
        self._frame_rate = frame_rate
        # contour area to consider when alerting
        self._alert_contour_area = alert_contour_area
        # seconds of video to retain to be included preceding detected movement
        self.preroll = video_preroll * frame_rate
        # length of video in seconds
        self.video_length = video_length
        # full colour video
        self._video = []
        # hsv version of video
        self._hsv_video = []
        # detection instance
        self._bg_sub = cv2.createBackgroundSubtractorMOG2(
            history=FRAME_HISTORY, varThreshold=25
        )
        # time movement detected
        self._movement_dt = None
        # count number of frames captured
        self._captured_frames = 0
        self._detection_threshold = detection_threshold

    def add_frame(self, frame):
        """Add frame to to movement detection

        Args:
            frame: next frame of video
        Returns:
            boolean: movement has been detected and there is a full length video clip available
        Raises:
        """
        self._video.append(frame)
        det_frame = self._bg_sub.apply(frame)

        # ensure that sufficient video has been stored
        if len(self._video) < self.preroll:
            return False

        moving_objects = self._detect_movement(det_frame)
        if len(moving_objects) > 0:
            self._draw_rectangles(moving_objects)
            if self._movement_dt is None:
                print("Movement detected")
                self._movement_dt = datetime.now()
        if self._movement_dt is not None:
            self._captured_frames += 1
        if self._captured_frames + self.preroll >= self.video_length * self._frame_rate:
            self._tidy()
            return True
        self._tidy()
        return False

    def _detect_movement(self, frame):
        contours, _ = cv2.findContours(
            frame, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE
        )
        movement_points = []
        for contour in contours:
            x, y, w, h = cv2.boundingRect(contour)
            if w * h > self._alert_contour_area:
                # movement_points.append(((x, y), (x + w, y + h)))
                movement_points.append(np.array([x, y, x + w, y + h]))

        movement_points = non_maxima_supression_bounding_rects(movement_points)

        return movement_points

    def _draw_rectangles(self, boundaries):
        """Draw provided rectangles onto image"""
        for x1, y1, x2, y2 in boundaries:
            cv2.rectangle(self._video[-1], (x1, y1), (x2, y2), (0, 255, 0), 2)

    def _tidy(self):
        frames_to_retain = int(
            self._frame_rate * (self.video_length + ADDITIONAL_PROCESSING_SECS)
        )
        if len(self._video) > frames_to_retain:
            self._video = self._video[-frames_to_retain:]

    def get_video(self):
        """Get video clip"""
        self._movement_dt = None
        self._captured_frames = 0
        return self._video


def remove_nested_bounding_rects(bounds: list) -> np.array:
    """Remove detected bounding rectangles which are wholly contained within another

    Args:
        bounds (list|np.array): bounding rectangle coordinates
                in nested np.arrays [x_left, y_top, x_right, y_bottom]

    Returns:
        np.array: only those bounding rectangles which are not wholly contained in another
    """
    # result expected from comparison if the box is nested
    nested_box_result = np.array([True, True, False, False])
    # list of box indices, indices removed as contained boxes are discovered
    output_indices = list(range(len(bounds)))

    # convert detected to an numpy array so it can be reordered later
    bounds = np.array(bounds)

    # sort detected into descending order by area
    areas = [(z[2] - z[0]) * (z[3] - z[1]) for z in bounds]  # calculate areas
    # use argsort to get the correct ASCENDING order, then use [::-1] to reverse the order
    bounds = bounds[np.argsort(areas)[::-1]]

    for i in output_indices:
        for j in output_indices:
            # compare boxes to see if nested
            if np.all((bounds[i] >= bounds[j]) == nested_box_result):
                output_indices.remove(j)

    return bounds[output_indices]


def non_maxima_supression_bounding_rects(bounds: np.array) -> np.array:
    """Perform Non-Maxima Suppression on array of bounding rectangles

    Args:
        bounds (np.array): bounding rectangle coordinates
                in nested np.arrays [x_left, y_top, x_right, y_bottom]

    Returns:
        np.array: coordinates of remaining bounding boxes
    """
    bounds = remove_nested_bounding_rects(bounds)

    output_indices = []
    process_indices = list(range(len(bounds)))

    # loop through remaining bounding rectangles, and compare the "Intersection over Union" (IOU)
    # between each box
    # processed using a while loop and removing indices as entries are removed while looping
    while len(process_indices) > 0:
        # remove the first item from the list
        i = process_indices.pop(0)
        # retain the first item
        output_indices.append(i)

        # loop through remaining items to calculate the IOU
        for j in process_indices:
            # intersection between boxes
            intersection_x = max(0, bounds[i][2], bounds[j][2]) - max(
                bounds[i][0], bounds[j][0]
            )
            intersection_y = max(0, bounds[i][3], bounds[j][3]) - max(
                bounds[i][1], bounds[j][1]
            )
            intersection = intersection_x * intersection_y
            # union of boxes (area  not part of intersection)
            area_i = (bounds[i][2] - bounds[i][0]) * (bounds[i][3] - bounds[i][1])
            area_j = (bounds[j][2] - bounds[j][0]) * (bounds[j][3] - bounds[j][1])
            union = area_i + area_j - intersection
            # combine boxes if entirely contained (union <=0) or IOU is too high
            if union <= 0 or (intersection / union) > IOU_THRESHOLD:
                bounds[i][0] = min(bounds[i][0], bounds[j][0])
                bounds[i][1] = min(bounds[i][1], bounds[j][1])
                bounds[i][2] = max(bounds[i][2], bounds[j][2])
                bounds[i][3] = max(bounds[i][3], bounds[j][3])
                process_indices.remove(j)

    return bounds[output_indices]
