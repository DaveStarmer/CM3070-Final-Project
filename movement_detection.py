"""Movement Detection"""

from datetime import datetime
import cv2

FRAME_HISTORY = 20
ADDITIONAL_PROCESSING_SECS = 0


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
            boolean. True if movement has been detected and there is a full length video clip available
        Raises:
        """
        self._video.append(frame)
        det_frame = self._bg_sub.apply(frame)

        # ensure that background subtraction has initialised
        if len(self._video) < self.preroll:
            return False

        moving_objects = self._detect_movement(det_frame)
        if moving_objects:
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
                movement_points.append(((x, y), (x + w, y + h)))

        # TODO: Merge overlapping boxes using Non-maximum supression

        return movement_points

    def _draw_rectangles(self, boundaries):
        """Draw provided rectangles onto image"""
        for point1, point2 in boundaries:
            cv2.rectangle(self._video[-1], point1, point2, (0, 255, 0), 2)

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
